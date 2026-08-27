from datetime import datetime, time, timedelta, date

from django.utils import timezone
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APITestCase

from apps.spaces.models import Space, SpaceBooking, SpaceTimetableBlock, TimetableUploadBatch
from apps.spaces.serializers import SCHEDULE_ENTRY_BASE_FIELDS
from apps.users.models import CustomUser, Department, Role


class TimetableScheduleParityTests(APITestCase):
    def setUp(self):
        self.department = Department.objects.create(
            department_name="Computer Science",
            department_code="CS",
        )
        self.uploader = CustomUser.objects.create_user(
            email="timetable-owner@example.com",
            employee_student_id="TT-001",
            password="test-password",
            first_name="Ada",
            last_name="Lovelace",
            designation="Lecturer",
            department=self.department,
        )
        self.uploader.is_staff = True
        self.uploader.is_superuser = True
        self.uploader.save(update_fields=["is_staff", "is_superuser"])
        it_admin, _ = Role.objects.get_or_create(name=Role.Name.IT_ADMIN)
        self.uploader.roles.add(it_admin)
        self.space = Space.objects.create(
            name="Timetable Test Room",
            space_type=Space.SpaceType.GENERAL_HALL,
            capacity_hard=50,
            location="Block A",
        )
        day = timezone.localdate() + timedelta(days=1)
        start = timezone.make_aware(datetime.combine(day, time(9, 0)))
        end = timezone.make_aware(datetime.combine(day, time(10, 0)))
        SpaceBooking.objects.create(
            user=self.uploader,
            department=self.department,
            space=self.space,
            start_datetime=start,
            end_datetime=end,
            attendee_count=20,
            purpose_of_booking="Department Meeting",
            status=SpaceBooking.BookingStatus.APPROVED,
        )
        batch = TimetableUploadBatch.objects.create(
            space=self.space,
            uploaded_by=self.uploader,
            upload_label="Semester 1",
        )
        SpaceTimetableBlock.objects.create(
            batch=batch,
            space=self.space,
            date=day,
            start_time=time(11, 0),
            end_time=time(12, 0),
            label="Discrete Mathematics",
            instructor="Dr. Ada",
        )

    def test_general_schedule_timetable_and_booking_share_base_fields(self):
        response = self.client.get(f"/api/spaces/requests/?view=general&space={self.space.id}")

        self.assertEqual(response.status_code, 200)
        entries = response.data["results"] if isinstance(response.data, dict) else response.data
        booking = next(entry for entry in entries if not entry["is_timetable"])
        timetable = next(entry for entry in entries if entry["is_timetable"])

        base_fields = set(SCHEDULE_ENTRY_BASE_FIELDS)
        self.assertTrue(base_fields.issubset(booking))
        self.assertEqual(set(timetable), base_fields)
        self.assertEqual(timetable["subject"], "Discrete Mathematics")
        self.assertEqual(timetable["purpose_of_booking"], timetable["subject"])
        self.assertEqual(timetable["instructor"], "Dr. Ada")
        self.assertEqual(timetable["booked_by_name"], "Ada Lovelace")
        self.assertEqual(timetable["booked_by_designation"], "Lecturer")
        self.assertEqual(timetable["booked_by_department"], "Computer Science")

    def test_timetable_upload_supports_optional_instructor_column(self):
        legacy_csv = SimpleUploadedFile(
            "legacy-timetable.csv",
            b"date,start_time,end_time,label\n2030-01-01,09:00,10:00,Legacy Subject\n",
            content_type="text/csv",
        )
        self.client.force_authenticate(self.uploader)

        legacy_response = self.client.post(
            f"/api/spaces/catalog/{self.space.id}/timetable/",
            {"file": legacy_csv},
            format="multipart",
        )

        self.assertEqual(legacy_response.status_code, 200)
        self.assertEqual(
            SpaceTimetableBlock.objects.get(label="Legacy Subject").instructor,
            "",
        )

        instructor_csv = SimpleUploadedFile(
            "instructor-timetable.csv",
            b"date,start_time,end_time,label,instructor\n2030-01-02,09:00,10:00,Calculus,Dr. Newton\n",
            content_type="text/csv",
        )
        instructor_response = self.client.post(
            f"/api/spaces/catalog/{self.space.id}/timetable/",
            {"file": instructor_csv},
            format="multipart",
        )

        self.assertEqual(instructor_response.status_code, 200)
        self.assertEqual(
            SpaceTimetableBlock.objects.get(label="Calculus").instructor,
            "Dr. Newton",
        )

    def test_booked_by_email_is_hidden_from_anonymous_requests(self):
        """Anonymous callers of the public general-schedule endpoint must
        receive None for booked_by_email — the field must never expose a
        raw email address to unauthenticated users."""
        # Ensure no authenticated user is attached to the test client
        self.client.force_authenticate(user=None)

        response = self.client.get(
            f"/api/spaces/requests/?view=general&space={self.space.id}"
        )
        self.assertEqual(response.status_code, 200)

        entries = response.data["results"] if isinstance(response.data, dict) else response.data
        normal_bookings = [e for e in entries if not e["is_timetable"]]
        self.assertTrue(normal_bookings, "Expected at least one normal booking in response")

        for booking in normal_bookings:
            self.assertIsNone(
                booking.get("booked_by_email"),
                msg=f"booked_by_email should be None for anonymous user, got: {booking.get('booked_by_email')}",
            )

    def test_booked_by_email_is_returned_for_authorised_user(self):
        """Staff/IT-admin requesters must receive the real email value for
        booked_by_email — same authorisation bar as booked_by_phone."""
        self.client.force_authenticate(self.uploader)  # is_staff + is_superuser + IT_ADMIN

        response = self.client.get(
            f"/api/spaces/requests/?view=general&space={self.space.id}"
        )
        self.assertEqual(response.status_code, 200)

        entries = response.data["results"] if isinstance(response.data, dict) else response.data
        normal_bookings = [e for e in entries if not e["is_timetable"]]
        self.assertTrue(normal_bookings, "Expected at least one normal booking in response")

        for booking in normal_bookings:
            self.assertEqual(
                booking.get("booked_by_email"),
                self.uploader.email,
                msg=f"booked_by_email should be the real email for authorised user",
            )


class TimetableConflictTests(APITestCase):
    """
    Tests for intra-file and DB-level conflict checking on timetable upload.

    Covers:
      POST  — intra-file first-occurrence-wins
      POST  — DB-conflict regression (existing block in DB)
      PATCH — intra-file conflict → 409, zero DB writes
      PATCH — cross-batch DB conflict → 409
      PATCH — re-uploading the same unchanged file succeeds (self-exclusion)
    """

    def setUp(self):
        self.department = Department.objects.create(
            department_name="Engineering",
            department_code="ENG",
        )
        self.uploader = CustomUser.objects.create_user(
            email="conflict-test@example.com",
            employee_student_id="CT-001",
            password="test-password",
            first_name="Test",
            last_name="Uploader",
            department=self.department,
        )
        self.uploader.is_staff = True
        self.uploader.is_superuser = True
        self.uploader.save(update_fields=["is_staff", "is_superuser"])
        it_admin, _ = Role.objects.get_or_create(name=Role.Name.IT_ADMIN)
        self.uploader.roles.add(it_admin)

        self.space = Space.objects.create(
            name="Conflict Test Room",
            space_type=Space.SpaceType.GENERAL_HALL,
            capacity_hard=30,
            location="Block B",
        )
        self.client.force_authenticate(self.uploader)
        self.upload_url = f"/api/spaces/catalog/{self.space.id}/timetable/"

    # ── helpers ──────────────────────────────────────────────────────────────

    def _make_csv(self, rows):
        """Build a CSV bytes object from a list of row dicts."""
        import csv as _csv
        import io as _io
        buf = _io.StringIO()
        fieldnames = ["date", "start_time", "end_time", "label"]
        writer = _csv.DictWriter(buf, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        for row in rows:
            writer.writerow(row)
        return buf.getvalue().encode("utf-8")

    def _existing_batch(self, blocks_spec, label="Existing Batch"):
        """Create a TimetableUploadBatch with SpaceTimetableBlocks.

        blocks_spec is a list of dicts with keys: date, start_time, end_time, label.
        All time values are expected to be datetime.time objects.
        """
        batch = TimetableUploadBatch.objects.create(
            space=self.space,
            uploaded_by=self.uploader,
            upload_label=label,
        )
        for spec in blocks_spec:
            SpaceTimetableBlock.objects.create(
                batch=batch,
                space=self.space,
                date=spec["date"],
                start_time=spec["start_time"],
                end_time=spec["end_time"],
                label=spec["label"],
            )
        return batch

    # ── POST tests ────────────────────────────────────────────────────────────

    def test_post_intra_file_conflict_first_occurrence_wins(self):
        """Two rows in one file conflict with each other.

        First row must be accepted; second must be skipped with a reason that
        references the first row's index via conflicts_with.type == 'intra_file'.
        """
        csv_bytes = self._make_csv([
            {"date": "2030-06-01", "start_time": "09:00", "end_time": "10:00", "label": "Math"},
            {"date": "2030-06-01", "start_time": "09:30", "end_time": "10:30", "label": "Physics"},
        ])
        file = SimpleUploadedFile("tt.csv", csv_bytes, content_type="text/csv")
        response = self.client.post(self.upload_url, {"file": file}, format="multipart")

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["row_count"], 1)
        self.assertEqual(response.data["skipped_count"], 1)
        self.assertEqual(len(response.data["skipped_rows"]), 1)

        skip = response.data["skipped_rows"][0]
        self.assertEqual(skip["row_index"], 1,
                         "Second row (index 1) should be the skipped one")
        self.assertEqual(skip["conflicts_with"]["type"], "intra_file")
        self.assertEqual(skip["conflicts_with"]["row_index"], 0,
                         "Should report conflict with first row (index 0)")

        # `conflicts` must be present, non-empty, and contain only strings —
        # this field is read by the frontend (TimetableManagerModal.jsx) and
        # must never be silently dropped.
        self.assertIn("conflicts", response.data,
                      "POST response must include a 'conflicts' list for frontend compat")
        self.assertIsInstance(response.data["conflicts"], list)
        self.assertGreater(len(response.data["conflicts"]), 0)
        self.assertTrue(all(isinstance(s, str) for s in response.data["conflicts"]),
                        "Every entry in 'conflicts' must be a plain string")

        # First row must be persisted; second must not.
        self.assertEqual(SpaceTimetableBlock.objects.filter(space=self.space, label="Math").count(), 1)
        self.assertEqual(SpaceTimetableBlock.objects.filter(space=self.space, label="Physics").count(), 0)

    def test_post_db_conflict_regression(self):
        """A row conflicts with an existing SpaceTimetableBlock in the DB.

        Must be skipped with conflicts_with.type == 'timetable_block'.
        When every row is skipped the response is 400 (regression check —
        the old behaviour must still hold).
        """
        self._existing_batch([
            {"date": date(2030, 7, 1), "start_time": time(10, 0),
             "end_time": time(11, 0), "label": "Existing Subject"},
        ])

        csv_bytes = self._make_csv([
            {"date": "2030-07-01", "start_time": "10:00", "end_time": "11:00",
             "label": "New Subject"},
        ])
        file = SimpleUploadedFile("tt.csv", csv_bytes, content_type="text/csv")
        response = self.client.post(self.upload_url, {"file": file}, format="multipart")

        self.assertEqual(response.status_code, 400, response.data)
        self.assertEqual(response.data["row_count"], 0)
        self.assertEqual(response.data["skipped_count"], 1)
        self.assertEqual(len(response.data["skipped_rows"]), 1)
        self.assertEqual(response.data["skipped_rows"][0]["conflicts_with"]["type"],
                         "timetable_block")
        # `conflicts` must be present and non-empty — read by the frontend 400 handler.
        self.assertIn("conflicts", response.data,
                      "POST 400 response must include a 'conflicts' list for frontend compat")
        self.assertIsInstance(response.data["conflicts"], list)
        self.assertGreater(len(response.data["conflicts"]), 0)
        self.assertTrue(all(isinstance(s, str) for s in response.data["conflicts"]),
                        "Every entry in 'conflicts' must be a plain string")

    # ── PATCH tests ───────────────────────────────────────────────────────────

    def test_patch_intra_file_conflict_rejected(self):
        """PATCH re-upload with two rows that conflict with each other.

        Must return 409, make zero DB writes, and include the conflict list
        in skipped_rows with type == 'intra_file'.
        """
        # Create the batch to re-upload (has one original block).
        batch = self._existing_batch([
            {"date": date(2030, 8, 1), "start_time": time(9, 0),
             "end_time": time(10, 0), "label": "Original Subject"},
        ], label="Semester A")
        block_count_before = SpaceTimetableBlock.objects.count()

        csv_bytes = self._make_csv([
            {"date": "2030-08-02", "start_time": "14:00", "end_time": "15:00", "label": "Row A"},
            {"date": "2030-08-02", "start_time": "14:30", "end_time": "15:30", "label": "Row B"},
        ])
        file = SimpleUploadedFile("reupload.csv", csv_bytes, content_type="text/csv")
        patch_url = f"/api/spaces/catalog/{self.space.id}/timetable/{batch.id}/"
        response = self.client.patch(patch_url, {"file": file}, format="multipart")

        self.assertEqual(response.status_code, 409, response.data)
        self.assertIn("skipped_rows", response.data)
        self.assertGreater(len(response.data["skipped_rows"]), 0)
        conflict_types = [s["conflicts_with"]["type"] for s in response.data["skipped_rows"]]
        self.assertIn("intra_file", conflict_types)
        # `conflicts` must be present and non-empty — frontend may read it on 409.
        self.assertIn("conflicts", response.data,
                      "PATCH 409 response must include a 'conflicts' list for frontend compat")
        self.assertIsInstance(response.data["conflicts"], list)
        self.assertGreater(len(response.data["conflicts"]), 0)
        self.assertTrue(all(isinstance(s, str) for s in response.data["conflicts"]),
                        "Every entry in 'conflicts' must be a plain string")

        # Zero DB writes — block count must be identical to before the PATCH.
        self.assertEqual(SpaceTimetableBlock.objects.count(), block_count_before,
                         "No blocks should be deleted or inserted on a 409 PATCH")

    def test_patch_db_conflict_rejected(self):
        """PATCH re-upload where a candidate row conflicts with a block in a
        DIFFERENT batch.  Must return 409 with type == 'timetable_block' and
        leave the DB unchanged.
        """
        # A block in another batch that occupies the slot we'll try to claim.
        self._existing_batch([
            {"date": date(2030, 9, 1), "start_time": time(11, 0),
             "end_time": time(12, 0), "label": "Other Batch Subject"},
        ], label="Other Batch")

        # The batch we are re-uploading (has its own slot on a different day).
        target_batch = self._existing_batch([
            {"date": date(2030, 9, 5), "start_time": time(9, 0),
             "end_time": time(10, 0), "label": "Target Original Subject"},
        ], label="Target Batch")
        block_count_before = SpaceTimetableBlock.objects.count()

        # Re-upload with a row that clashes with the OTHER batch.
        csv_bytes = self._make_csv([
            {"date": "2030-09-01", "start_time": "11:00", "end_time": "12:00",
             "label": "Conflict Row"},
        ])
        file = SimpleUploadedFile("reupload.csv", csv_bytes, content_type="text/csv")
        patch_url = f"/api/spaces/catalog/{self.space.id}/timetable/{target_batch.id}/"
        response = self.client.patch(patch_url, {"file": file}, format="multipart")

        self.assertEqual(response.status_code, 409, response.data)
        self.assertIn("skipped_rows", response.data)
        self.assertEqual(response.data["skipped_rows"][0]["conflicts_with"]["type"],
                         "timetable_block")
        # `conflicts` must be present and non-empty — frontend may read it on 409.
        self.assertIn("conflicts", response.data,
                      "PATCH 409 response must include a 'conflicts' list for frontend compat")
        self.assertIsInstance(response.data["conflicts"], list)
        self.assertGreater(len(response.data["conflicts"]), 0)
        self.assertTrue(all(isinstance(s, str) for s in response.data["conflicts"]),
                        "Every entry in 'conflicts' must be a plain string")
        # No DB writes.
        self.assertEqual(SpaceTimetableBlock.objects.count(), block_count_before,
                         "No blocks should be deleted or inserted on a 409 PATCH")

    def test_patch_same_file_reupload_succeeds(self):
        """Re-uploading the exact same file for the same batch must succeed.

        The batch's own prior rows must be excluded from the conflict comparison
        (self-exclusion).  If they are not excluded, every re-upload of a non-
        empty batch would trigger a 409.
        """
        batch = self._existing_batch([
            {"date": date(2030, 10, 1), "start_time": time(9, 0),
             "end_time": time(10, 0), "label": "Chemistry"},
            {"date": date(2030, 10, 2), "start_time": time(14, 0),
             "end_time": time(15, 0), "label": "Biology"},
        ], label="Self Reupload Batch")

        # Exact same CSV as what's already stored.
        csv_bytes = self._make_csv([
            {"date": "2030-10-01", "start_time": "09:00", "end_time": "10:00", "label": "Chemistry"},
            {"date": "2030-10-02", "start_time": "14:00", "end_time": "15:00", "label": "Biology"},
        ])
        file = SimpleUploadedFile("same.csv", csv_bytes, content_type="text/csv")
        patch_url = f"/api/spaces/catalog/{self.space.id}/timetable/{batch.id}/"
        response = self.client.patch(patch_url, {"file": file}, format="multipart")

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["row_count"], 2)
        self.assertEqual(response.data["skipped_count"], 0)

        # Both blocks should be present in the DB under the same batch.
        self.assertEqual(
            SpaceTimetableBlock.objects.filter(space=self.space, batch=batch).count(),
            2,
        )
