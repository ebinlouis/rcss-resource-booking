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


class GeneralScheduleSensitiveFieldsTests(APITestCase):
    """Visibility coverage for PII-bearing general-schedule serializer fields."""

    def setUp(self):
        self.department = Department.objects.create(
            department_name="Schedule Privacy Dept",
            department_code="SPD",
        )
        student_role, _ = Role.objects.get_or_create(name=Role.Name.STUDENT)
        faculty_role, _ = Role.objects.get_or_create(name=Role.Name.FACULTY)
        it_admin_role, _ = Role.objects.get_or_create(name=Role.Name.IT_ADMIN)

        self.owner = self._user("owner", "Owner", "Student")
        self.owner.roles.add(student_role)
        self.non_owner_student = self._user("non-owner", "Non", "Owner")
        self.non_owner_student.roles.add(student_role)
        self.faculty_viewer = self._user("faculty", "Faculty", "Viewer")
        self.faculty_viewer.roles.add(faculty_role)
        self.it_admin_viewer = self._user("it-admin", "IT", "Admin")
        self.it_admin_viewer.roles.add(it_admin_role)
        self.staff_viewer = self._user("staff", "Staff", "Viewer")
        self.staff_viewer.is_staff = True
        self.staff_viewer.save(update_fields=["is_staff"])
        self.superuser_viewer = self._user("superuser", "Super", "User")
        self.superuser_viewer.is_superuser = True
        self.superuser_viewer.save(update_fields=["is_superuser"])
        self.faculty_sponsor = self._user("sponsor", "Faculty", "Sponsor", phone="9000000001")
        self.instructor = self._user("instructor", "Timetable", "Instructor", phone="9000000002")

        self.space = Space.objects.create(
            name="Schedule Privacy Room",
            space_type=Space.SpaceType.GENERAL_HALL,
            capacity_hard=40,
            location="Block Privacy",
        )
        day = timezone.localdate() + timedelta(days=1)
        start = timezone.make_aware(datetime.combine(day, time(9, 0)))
        self.booking = SpaceBooking.objects.create(
            user=self.owner,
            department=self.department,
            space=self.space,
            start_datetime=start,
            end_datetime=start + timedelta(hours=1),
            attendee_count=10,
            purpose_of_booking="Privacy Test Booking",
            faculty_sponsor=self.faculty_sponsor,
            status=SpaceBooking.BookingStatus.APPROVED,
        )
        batch = TimetableUploadBatch.objects.create(
            space=self.space,
            uploaded_by=self.owner,
            upload_label="Privacy Timetable",
        )
        self.timetable_block = SpaceTimetableBlock.objects.create(
            batch=batch,
            space=self.space,
            date=day,
            start_time=time(11, 0),
            end_time=time(12, 0),
            label="Privacy Class",
            instructor="Timetable Instructor",
            instructor_user=self.instructor,
        )

    def _user(self, identifier, first_name, last_name, **extra_fields):
        return CustomUser.objects.create_user(
            email=f"{identifier}@example.com",
            employee_student_id=f"SPD-{identifier}",
            password="test-password",
            first_name=first_name,
            last_name=last_name,
            department=self.department,
            **extra_fields,
        )

    def _schedule_entries(self):
        response = self.client.get(
            f"/api/spaces/requests/?view=general&space={self.space.id}"
        )
        self.assertEqual(response.status_code, 200)
        entries = response.data["results"] if isinstance(response.data, dict) else response.data
        booking = next(entry for entry in entries if entry["id"] == self.booking.id)
        timetable = next(
            entry for entry in entries if entry["id"] == f"tt_{self.timetable_block.id}"
        )
        return booking, timetable

    def test_instructor_details_hidden_from_anonymous_and_student_requesters(self):
        for label, requester in (("anonymous", None), ("student", self.non_owner_student)):
            with self.subTest(requester=label):
                self.client.force_authenticate(user=requester)
                _, timetable = self._schedule_entries()
                self.assertIsNone(timetable["instructor_details"])

    def test_instructor_details_hidden_from_booking_owner_without_role(self):
        """The booking owner has no ownership relationship to
        SpaceTimetableBlock/instructor_user — instructor_details must
        stay role-gated only, with no owner carve-out, even for the
        owner of the (separate) SpaceBooking entry in the same response."""
        self.client.force_authenticate(self.owner)
        _, timetable = self._schedule_entries()
        self.assertIsNone(timetable["instructor_details"])

    def test_instructor_details_returned_for_authorised_requesters(self):
        for label, requester in (
            ("faculty", self.faculty_viewer),
            ("IT admin", self.it_admin_viewer),
            ("staff", self.staff_viewer),
            ("superuser", self.superuser_viewer),
        ):
            with self.subTest(requester=label):
                self.client.force_authenticate(requester)
                _, timetable = self._schedule_entries()
                self.assertEqual(timetable["instructor_details"]["id"], self.instructor.id)
                self.assertEqual(timetable["instructor_details"]["email"], self.instructor.email)

    def test_booking_sensitive_fields_hidden_from_anonymous_and_non_owner_student(self):
        for label, requester in (("anonymous", None), ("student", self.non_owner_student)):
            with self.subTest(requester=label):
                self.client.force_authenticate(user=requester)
                booking, _ = self._schedule_entries()
                self.assertIsNone(booking["faculty_sponsor_details"])
                self.assertIsNone(booking["faculty_phone"])
                self.assertIsNone(booking["reference_code"])

    def test_booking_sensitive_fields_returned_to_student_booking_owner(self):
        self.client.force_authenticate(self.owner)
        booking, _ = self._schedule_entries()

        self.assertEqual(booking["faculty_sponsor_details"]["id"], self.faculty_sponsor.id)
        self.assertEqual(booking["faculty_phone"], self.faculty_sponsor.phone)
        self.assertEqual(booking["reference_code"], self.booking.reference_code)

    def test_booking_sensitive_fields_returned_to_authorised_requesters(self):
        for label, requester in (
            ("faculty", self.faculty_viewer),
            ("IT admin", self.it_admin_viewer),
            ("staff", self.staff_viewer),
            ("superuser", self.superuser_viewer),
        ):
            with self.subTest(requester=label):
                self.client.force_authenticate(requester)
                booking, _ = self._schedule_entries()
                self.assertEqual(booking["faculty_sponsor_details"]["id"], self.faculty_sponsor.id)
                self.assertEqual(booking["faculty_phone"], self.faculty_sponsor.phone)
                self.assertEqual(booking["reference_code"], self.booking.reference_code)


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


# ═══════════════════════════════════════════════════════════════
# FIX 1 — build_conflict_report visibility
# ═══════════════════════════════════════════════════════════════

class BuildConflictReportVisibilityTests(APITestCase):
    """
    Confirms that build_conflict_report:
      - Always exposes purpose_of_booking in `label` regardless of the
        requesting user's role (including a plain student with no elevated role).
      - Keeps `reference_code` gated to staff/superusers and booking owners only.

    These are regression tests: the is_faculty dead-code block was removed
    and the docstring corrected.  Behavior for label was already unconditional;
    the tests confirm it stays that way and that ref-gating is untouched.
    """

    def setUp(self):
        self.department = Department.objects.create(
            department_name="Visibility Test Dept",
            department_code="VTD",
        )
        # The user who OWNS the conflicting booking (staff + superuser)
        self.booking_owner = CustomUser.objects.create_user(
            email="owner@example.com",
            employee_student_id="VTD-001",
            password="pw",
        )
        self.booking_owner.is_staff = True
        self.booking_owner.is_superuser = True
        self.booking_owner.save(update_fields=["is_staff", "is_superuser"])

        # A plain student requester — no staff, no superuser, not the owner
        self.student = CustomUser.objects.create_user(
            email="student@example.com",
            employee_student_id="VTD-002",
            password="pw",
        )

        self.space = Space.objects.create(
            name="Conflict Visibility Room",
            space_type=Space.SpaceType.GENERAL_HALL,
            capacity_hard=30,
            location="Block B",
        )

        now = timezone.now()
        self.booking = SpaceBooking.objects.create(
            user=self.booking_owner,
            department=self.department,
            space=self.space,
            start_datetime=now + timezone.timedelta(hours=1),
            end_datetime=now + timezone.timedelta(hours=2),
            attendee_count=10,
            purpose_of_booking="Board Meeting",
            status=SpaceBooking.BookingStatus.APPROVED,
        )

    def _conflict_qs(self):
        from apps.spaces.models import SpaceBooking as SB
        return SB.objects.filter(pk=self.booking.pk)

    def test_label_shows_purpose_for_student_requester(self):
        """purpose_of_booking must appear in label even for a plain student
        requester — not gated by any role."""
        from apps.spaces.utils import build_conflict_report
        conflicts = build_conflict_report(self._conflict_qs(), requesting_user=self.student)
        self.assertEqual(len(conflicts), 1)
        self.assertEqual(
            conflicts[0]["label"],
            "Board Meeting",
            "label should be purpose_of_booking for any requester",
        )

    def test_reference_code_hidden_from_non_owner_non_staff(self):
        """reference_code must be absent for a requester who is neither staff
        nor the booking's own owner."""
        from apps.spaces.utils import build_conflict_report
        conflicts = build_conflict_report(self._conflict_qs(), requesting_user=self.student)
        self.assertNotIn(
            "reference_code",
            conflicts[0],
            "reference_code must not appear for a non-staff, non-owner requester",
        )

    def test_reference_code_shown_to_staff_requester(self):
        """reference_code must be present for a staff/superuser requester,
        confirming ref-gating is still active and correct."""
        from apps.spaces.utils import build_conflict_report
        conflicts = build_conflict_report(self._conflict_qs(), requesting_user=self.booking_owner)
        # reference_code is only present in the dict when it has a value
        ref = conflicts[0].get("reference_code")
        self.assertEqual(
            ref,
            self.booking.reference_code,
            "reference_code should be the booking's code for a staff/superuser requester",
        )

    def test_label_shows_purpose_when_requesting_user_is_none(self):
        """Anonymous callers (requesting_user=None) must still see label."""
        from apps.spaces.utils import build_conflict_report
        conflicts = build_conflict_report(self._conflict_qs(), requesting_user=None)
        self.assertEqual(conflicts[0]["label"], "Board Meeting")
        self.assertNotIn("reference_code", conflicts[0])

    def test_label_falls_back_to_occupied_when_purpose_blank(self):
        """If purpose_of_booking is blank, label must fall back to 'Occupied'."""
        self.booking.purpose_of_booking = ""
        self.booking.save(update_fields=["purpose_of_booking"])
        from apps.spaces.utils import build_conflict_report
        conflicts = build_conflict_report(self._conflict_qs(), requesting_user=self.student)
        self.assertEqual(conflicts[0]["label"], "Occupied")


# ═══════════════════════════════════════════════════════════════
# FIX 2 — get_booked_by_phone field lookup
# ═══════════════════════════════════════════════════════════════

class BookedByPhoneFieldTests(APITestCase):
    """
    Regression test for get_booked_by_phone in SpaceBookingSerializer.

    The dead `phone_number` getattr fallback was removed; this test
    confirms the field still returns the correct value (via obj.user.phone)
    for an authorised requester, and is None for an anonymous caller.
    """

    def setUp(self):
        self.department = Department.objects.create(
            department_name="Phone Test Dept",
            department_code="PTD",
        )
        # Booking owner with a known phone number
        self.booker = CustomUser.objects.create_user(
            email="booker@example.com",
            employee_student_id="PTD-001",
            password="pw",
            phone="9876543210",
        )
        # Staff/IT_ADMIN requester who is authorised to see phone
        self.staff_viewer = CustomUser.objects.create_user(
            email="staff@example.com",
            employee_student_id="PTD-002",
            password="pw",
        )
        self.staff_viewer.is_staff = True
        self.staff_viewer.is_superuser = True
        self.staff_viewer.save(update_fields=["is_staff", "is_superuser"])
        it_admin, _ = Role.objects.get_or_create(name=Role.Name.IT_ADMIN)
        self.staff_viewer.roles.add(it_admin)

        self.space = Space.objects.create(
            name="Phone Test Room",
            space_type=Space.SpaceType.GENERAL_HALL,
            capacity_hard=20,
            location="Block C",
        )
        now = timezone.now()
        self.booking = SpaceBooking.objects.create(
            user=self.booker,
            department=self.department,
            space=self.space,
            start_datetime=now + timezone.timedelta(hours=3),
            end_datetime=now + timezone.timedelta(hours=4),
            attendee_count=5,
            purpose_of_booking="Phone Test Booking",
            status=SpaceBooking.BookingStatus.APPROVED,
        )

    def _get_booking_entry(self):
        """Return the serialized booking entry via the API for the authenticated client."""
        response = self.client.get(
            f"/api/spaces/requests/?view=general&space={self.space.id}"
        )
        self.assertEqual(response.status_code, 200)
        entries = response.data["results"] if isinstance(response.data, dict) else response.data
        normal = [e for e in entries if not e["is_timetable"]]
        self.assertTrue(normal, "Expected at least one normal booking entry")
        return normal[0]

    def test_booked_by_phone_returned_for_authorised_requester(self):
        """Staff/IT_ADMIN requesters must receive the real phone value — confirming
        the obj.user.phone lookup works correctly after removing the dead
        phone_number getattr fallback."""
        self.client.force_authenticate(self.staff_viewer)
        entry = self._get_booking_entry()
        self.assertEqual(
            entry.get("booked_by_phone"),
            "9876543210",
            "booked_by_phone must return obj.user.phone for an authorised requester",
        )

    def test_booked_by_phone_hidden_from_anonymous(self):
        """Anonymous callers must receive None for booked_by_phone."""
        self.client.force_authenticate(user=None)
        entry = self._get_booking_entry()
        self.assertIsNone(
            entry.get("booked_by_phone"),
            "booked_by_phone must be None for anonymous callers",
        )


# ═══════════════════════════════════════════════════════════════
# Q-import fix — instructor_search endpoint
# ═══════════════════════════════════════════════════════════════

class InstructorSearchEndpointTests(APITestCase):
    """
    Regression tests for GET /api/spaces/instructor-search/.

    Primary regression: before the fix, any q >= 2 chars raised
    NameError because Q was never imported at module level in views.py.
    The second test below directly exercises that path.

    Also covers the short-circuit (q < 2 → []) and the 403 case
    (non-manager requester), neither of which had any test coverage.
    """

    def setUp(self):
        self.department = Department.objects.create(
            department_name="Search Test Dept",
            department_code="STD",
        )

        # Timetable manager: SpaceApprover SPACE-scoped (not superuser,
        # so the 403 test uses a genuinely distinct non-privileged user).
        self.manager = CustomUser.objects.create_user(
            email="mgr-search@example.com",
            employee_student_id="STD-MGR-01",
            password="pw",
            first_name="Timetable",
            last_name="Manager",
        )
        # Plain authenticated user with no manager assignment
        self.outsider = CustomUser.objects.create_user(
            email="outsider-search@example.com",
            employee_student_id="STD-OUT-01",
            password="pw",
        )
        # A user who should appear in search results
        self.searchable = CustomUser.objects.create_user(
            email="findable-instructor@example.com",
            employee_student_id="STD-SRC-01",
            password="pw",
            first_name="Findable",
            last_name="Instructor",
        )

        self.space = Space.objects.create(
            name="Instructor Search Room",
            space_type=Space.SpaceType.GENERAL_HALL,
            capacity_hard=40,
            location="Block D",
        )

        # Grant manager the timetable-manager right via SpaceApprover SPACE scope
        from apps.spaces.models import SpaceApprover
        receptionist_role, _ = Role.objects.get_or_create(name=Role.Name.RECEPTIONIST)
        SpaceApprover.objects.create(
            user=self.manager,
            role=receptionist_role,
            scope_type="SPACE",
            space=self.space,
            is_active=True,
        )

    def _url(self, **params):
        from urllib.parse import urlencode
        base = f"/api/spaces/instructor-search/"
        if params:
            base += "?" + urlencode(params)
        return base

    def test_short_query_returns_empty_list(self):
        """q with < 2 chars must return [] immediately (no DB search)."""
        self.client.force_authenticate(self.manager)
        for short_q in ['', 'a']:
            response = self.client.get(self._url(space=self.space.id, q=short_q))
            self.assertEqual(response.status_code, 200, f"Expected 200 for q={short_q!r}")
            self.assertEqual(response.data, [], f"Expected [] for q={short_q!r}")

    def test_non_manager_gets_403(self):
        """An authenticated user who is not a timetable manager for the
        space must receive 403 — regardless of search term."""
        self.client.force_authenticate(self.outsider)
        response = self.client.get(self._url(space=self.space.id, q="find"))
        self.assertEqual(
            response.status_code, 403,
            f"Expected 403 for non-manager; got {response.status_code}: {response.data}",
        )

    def test_search_returns_matching_users(self):
        """PRIMARY REGRESSION TEST: q >= 2 chars must execute the Q filter and
        return matching users. Before the fix this raised NameError because
        django.db.models.Q was never imported at module level in views.py."""
        self.client.force_authenticate(self.manager)

        # Search by first name prefix — 'Find' matches self.searchable
        response = self.client.get(self._url(space=self.space.id, q="Find"))
        self.assertEqual(
            response.status_code, 200,
            f"Expected 200; got {response.status_code}: {response.data}",
        )
        self.assertIsInstance(response.data, list)
        ids = [u["id"] for u in response.data]
        self.assertIn(
            self.searchable.id,
            ids,
            f"Expected searchable user (id={self.searchable.id}) in results; got ids={ids}",
        )
        # Confirm result shape: each entry has id, email, first_name, last_name
        for entry in response.data:
            for field in ("id", "email", "first_name", "last_name"):
                self.assertIn(field, entry, f"Missing field {field!r} in result entry")

    def test_search_by_email_returns_matching_user(self):
        """Search by email fragment also exercises the Q-OR chain."""
        self.client.force_authenticate(self.manager)
        response = self.client.get(self._url(space=self.space.id, q="findable-i"))
        self.assertEqual(response.status_code, 200)
        ids = [u["id"] for u in response.data]
        self.assertIn(self.searchable.id, ids)

    def test_missing_space_param_returns_400(self):
        """Omitting the space query param must return 400."""
        self.client.force_authenticate(self.manager)
        response = self.client.get(self._url(q="find"))
        self.assertEqual(response.status_code, 400)

    def test_invalid_space_id_returns_400(self):
        """A space id that does not exist must return 400."""
        self.client.force_authenticate(self.manager)
        response = self.client.get(self._url(space=999999, q="find"))
        self.assertEqual(response.status_code, 400)
