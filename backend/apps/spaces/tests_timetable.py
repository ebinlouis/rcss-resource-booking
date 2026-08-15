from datetime import datetime, time, timedelta

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
