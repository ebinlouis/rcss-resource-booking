from rest_framework.test import APITestCase
from django.utils import timezone
from datetime import timedelta
from apps.users.models import CustomUser, Department, Role
from apps.media.models import MediaBooking
from apps.spaces.models import Space
from apps.notifications.models import NotificationOutbox

class MediaAutoApprovalTests(APITestCase):
    def setUp(self):
        self.department = Department.objects.create(department_name="Test Dept", department_code="TST")
        self.media_incharge_role, _ = Role.objects.get_or_create(name=Role.Name.MEDIA_INCHARGE)

        self.user1 = CustomUser.objects.create_user(email="user1@rcss.edu", password="pw", department=self.department, employee_student_id="E1")
        self.user2 = CustomUser.objects.create_user(email="user2@rcss.edu", password="pw", department=self.department, employee_student_id="E2")

        self.space = Space.objects.create(name="Media Hall", space_type="OTHER", capacity_hard=50, approval_workflow_type="DIRECT", approval_category="OTHER")

    def test_scenario_9_sole_media_incharge_auto_approved(self):
        """9. MEDIA: sole MEDIA_INCHARGE books a media request -> auto-approved."""
        self.user1.roles.add(self.media_incharge_role)
        
        self.client.force_authenticate(user=self.user1)
        start_time = timezone.now() + timedelta(days=1)
        end_time = start_time + timedelta(hours=2)

        res = self.client.post("/api/media/bookings/", {
            "space": self.space.id,
            "event_name": "Test Event",
            "setup_start_datetime": start_time.isoformat(),
            "event_start_datetime": start_time.isoformat(),
            "event_end_datetime": end_time.isoformat(),
            "teardown_end_datetime": end_time.isoformat(),
            "is_team_request": True
        }, format='json')
        
        if res.status_code != 201:
            print("MEDIA ERROR:", res.data)
        self.assertEqual(res.status_code, 201)
        booking = MediaBooking.objects.get(id=res.data['id'])
        self.assertEqual(booking.status, 'APPROVED')
        self.assertEqual(booking.resolved_by, self.user1)
        self.assertFalse(
            NotificationOutbox.objects.filter(payload__booking_id=booking.id).exists()
        )

    def test_scenario_10_media_crew_unavailable_raises_validation_error(self):
        """10. MEDIA: sole MEDIA_INCHARGE tries to book but is already busy -> ValidationError raised before auto-approval."""
        self.user1.roles.add(self.media_incharge_role)
        
        start_time = timezone.now() + timedelta(days=1)
        end_time = start_time + timedelta(hours=2)

        # Create an overlapping booking and assign user1 to make free crew 0
        busy_booking = MediaBooking.objects.create(
            user=self.user1,
            space=self.space,
            event_name="Prior Event",
            setup_start_datetime=start_time,
            event_start_datetime=start_time,
            event_end_datetime=end_time,
            teardown_end_datetime=end_time,
            is_team_request=True,
            status='APPROVED',
            resolved_by=self.user1
        )
        busy_booking.assigned_crew.add(self.user1)

        self.client.force_authenticate(user=self.user1)
        
        # Try to create an overlapping request
        res = self.client.post("/api/media/bookings/", {
            "space": self.space.id,
            "event_name": "Overlapping Event",
            "setup_start_datetime": start_time.isoformat(),
            "event_start_datetime": start_time.isoformat(),
            "event_end_datetime": end_time.isoformat(),
            "teardown_end_datetime": end_time.isoformat(),
            "is_team_request": True
        }, format='json')
        
        self.assertEqual(res.status_code, 400)
        self.assertIn('non_field_errors', res.data)
        error_msg = res.data['non_field_errors']
        if isinstance(error_msg, list):
            error_msg = error_msg[0]
        self.assertEqual(error_msg, "The media team is fully occupied during this time slot. Please choose a different date or time.")

    def test_scenario_9_two_media_incharge(self):
        """9. MEDIA: two MEDIA_INCHARGE users exist, one books -> stays PENDING, only the other is notified."""
        self.user1.roles.add(self.media_incharge_role)
        self.user2.roles.add(self.media_incharge_role)
        
        self.client.force_authenticate(user=self.user1)
        start_time = timezone.now() + timedelta(days=1)
        end_time = start_time + timedelta(hours=2)

        res = self.client.post("/api/media/bookings/", {
            "space": self.space.id,
            "event_name": "Test Event",
            "setup_start_datetime": start_time.isoformat(),
            "event_start_datetime": start_time.isoformat(),
            "event_end_datetime": end_time.isoformat(),
            "teardown_end_datetime": end_time.isoformat(),
            "is_team_request": True
        }, format='json')
        
        booking = MediaBooking.objects.get(id=res.data['id'])
        self.assertEqual(booking.status, 'PENDING')
        
        outbox = NotificationOutbox.objects.get(payload__booking_id=booking.id)
        self.assertEqual(outbox.event_type, 'media.new_request')
        self.assertEqual(outbox.payload['role_name'], Role.Name.MEDIA_INCHARGE)
        self.assertEqual(outbox.payload['exclude_user_id'], self.user1.id)
