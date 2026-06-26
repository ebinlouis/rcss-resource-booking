import hashlib
from datetime import timedelta

from django.test import TestCase
from django.utils import timezone

from apps.approvals.models import BaseBooking
from apps.fleet.models import FleetBooking, Vehicle
from apps.notifications.models import ApprovalToken
from apps.notifications.views import _token_holder_still_eligible
from apps.spaces.models import Block, Space, SpaceApprover, SpaceBooking
from apps.users.models import CustomUser, Department, Role, RoleOverride


class ApprovalTokenLiveEligibilityTests(TestCase):
    def setUp(self):
        self.department = Department.objects.create(
            department_name="Token Test Department",
            department_code="TTD",
        )
        self.block = Block.objects.create(name="Token Test Block", code="TTB")
        self.space = Space.objects.create(
            name="Token Test Hall",
            space_type=Space.SpaceType.GENERAL_HALL,
            approval_category=Space.ApprovalCategory.GENERAL,
            approval_workflow_type=Space.ApprovalWorkflowType.DIRECT,
            block=self.block,
            location="Token Block",
            capacity_hard=40,
        )
        self.vehicle = Vehicle.objects.create(
            name="Token Test Van",
            registration_number="TT-001",
            capacity=8,
            is_active=True,
        )

        self.receptionist_role, _ = Role.objects.get_or_create(
            name=Role.Name.RECEPTIONIST
        )
        self.fleet_manager_role, _ = Role.objects.get_or_create(
            name=Role.Name.FLEET_MANAGER
        )
        self.faculty_role, _ = Role.objects.get_or_create(name=Role.Name.FACULTY)
        self.staff_role, _ = Role.objects.get_or_create(name=Role.Name.STAFF)
        self.it_admin_role, _ = Role.objects.get_or_create(name=Role.Name.IT_ADMIN)

        self.requester = self._make_user("requester-token@test.com", self.staff_role)
        self.space_approver = self._make_user("space-approver-token@test.com")
        self.override_approver = self._make_user("override-token@test.com")
        self.faculty_sponsor = self._make_user(
            "faculty-sponsor-token@test.com", self.faculty_role
        )
        self.other_faculty = self._make_user(
            "other-faculty-token@test.com", self.faculty_role
        )
        self.fleet_manager = self._make_user(
            "fleet-manager-token@test.com", self.fleet_manager_role
        )
        self.it_admin = self._make_user("it-admin-token@test.com", self.it_admin_role)

    def _make_user(self, email, *roles):
        user = CustomUser.objects.create_user(
            email=email,
            employee_student_id=email.split("@")[0],
            password="testpass",
            first_name=email.split("@")[0],
            last_name="User",
            department=self.department,
        )
        for role in roles:
            user.roles.add(role)
        return user

    def _make_space_booking(self, reference_code):
        now = timezone.now()
        return SpaceBooking.objects.create(
            reference_code=reference_code,
            user=self.requester,
            department=self.department,
            space=self.space,
            status=BaseBooking.BookingStatus.PENDING,
            start_datetime=now + timedelta(days=1),
            end_datetime=now + timedelta(days=1, hours=1),
            attendee_count=12,
            purpose_of_booking="Token approval test",
        )

    def _make_fleet_booking(self, reference_code):
        now = timezone.now()
        return FleetBooking.objects.create(
            reference_code=reference_code,
            user=self.requester,
            department=self.department,
            vehicle=self.vehicle,
            status=BaseBooking.BookingStatus.PENDING,
            start_datetime=now + timedelta(days=2),
            end_datetime=now + timedelta(days=2, hours=1),
            pickup_location="Campus",
            destination="City",
            total_passengers=4,
            purpose="Token approval test",
        )

    def _make_faculty_booking(self, reference_code, sponsor):
        now = timezone.now()
        return SpaceBooking.objects.create(
            reference_code=reference_code,
            user=self.requester,
            department=self.department,
            space=self.space,
            status=BaseBooking.BookingStatus.AWAITING_FACULTY,
            start_datetime=now + timedelta(days=1),
            end_datetime=now + timedelta(days=1, hours=1),
            attendee_count=12,
            purpose_of_booking="Faculty token approval test",
            faculty_sponsor=sponsor,
            faculty_response_deadline=now + timedelta(hours=24),
        )

    def _make_token(self, raw_token, domain, booking, issued_to):
        return ApprovalToken.objects.create(
            token_hash=hashlib.sha256(raw_token.encode()).hexdigest(),
            domain=domain,
            booking_ref=booking.reference_code,
            issued_to=issued_to,
            expires_at=timezone.now() + timedelta(days=1),
        )

    def _redeem(self, raw_token):
        return self.client.get("/api/notifications/action/", {"token": raw_token})

    def assert_rejected_for_changed_access(self, response):
        self.assertEqual(response.status_code, 400)
        self.assertIn(
            "your access to approve this booking has changed",
            response.content.decode(),
        )

    def test_space_token_rejects_after_space_approver_assignment_removed(self):
        booking = self._make_space_booking("SPT-001")
        assignment = SpaceApprover.objects.create(
            user=self.space_approver,
            role=self.receptionist_role,
            scope_type=SpaceApprover.ScopeType.SPACE,
            space=self.space,
            is_active=True,
        )
        token = self._make_token(
            "space-assignment-removed", "spaces", booking, self.space_approver
        )
        self.assertTrue(_token_holder_still_eligible(token))

        assignment.delete()

        with self.assertLogs("apps.notifications.views", level="WARNING") as logs:
            response = self._redeem("space-assignment-removed")

        self.assert_rejected_for_changed_access(response)
        self.assertIn("live eligibility rejected", logs.output[0])
        booking.refresh_from_db()
        token.refresh_from_db()
        self.assertEqual(booking.status, BaseBooking.BookingStatus.PENDING)
        self.assertFalse(token.used)

    def test_space_token_rejects_after_role_override_expires(self):
        booking = self._make_space_booking("SPT-002")
        override = RoleOverride.objects.create(
            user=self.override_approver,
            role=self.receptionist_role,
            space=self.space,
            granted_by=self.it_admin,
            valid_until=timezone.now() + timedelta(days=1),
            reason="Temporary venue approval coverage",
        )
        token = self._make_token(
            "space-override-expired", "spaces", booking, self.override_approver
        )
        self.assertTrue(_token_holder_still_eligible(token))

        override.valid_until = timezone.now() - timedelta(minutes=1)
        override.save(update_fields=["valid_until", "updated_at"])

        response = self._redeem("space-override-expired")

        self.assert_rejected_for_changed_access(response)
        booking.refresh_from_db()
        token.refresh_from_db()
        self.assertEqual(booking.status, BaseBooking.BookingStatus.PENDING)
        self.assertFalse(token.used)

    def test_space_token_still_succeeds_when_holder_remains_eligible(self):
        booking = self._make_space_booking("SPT-003")
        SpaceApprover.objects.create(
            user=self.space_approver,
            role=self.receptionist_role,
            scope_type=SpaceApprover.ScopeType.SPACE,
            space=self.space,
            is_active=True,
        )
        token = self._make_token(
            "space-still-eligible", "spaces", booking, self.space_approver
        )

        response = self._redeem("space-still-eligible")

        self.assertEqual(response.status_code, 200)
        booking.refresh_from_db()
        token.refresh_from_db()
        self.assertEqual(booking.status, BaseBooking.BookingStatus.APPROVED)
        self.assertEqual(booking.resolved_by, self.space_approver)
        self.assertTrue(token.used)

    def test_fleet_token_rejects_after_manager_role_removed(self):
        booking = self._make_fleet_booking("FLT-001")
        token = self._make_token("fleet-role-removed", "fleet", booking, self.fleet_manager)
        self.assertTrue(_token_holder_still_eligible(token))

        self.fleet_manager.roles.remove(self.fleet_manager_role)

        response = self._redeem("fleet-role-removed")

        self.assert_rejected_for_changed_access(response)
        booking.refresh_from_db()
        token.refresh_from_db()
        self.assertEqual(booking.status, BaseBooking.BookingStatus.PENDING)
        self.assertFalse(token.used)

    def test_fleet_token_still_succeeds_when_holder_remains_eligible(self):
        booking = self._make_fleet_booking("FLT-002")
        token = self._make_token(
            "fleet-still-eligible", "fleet", booking, self.fleet_manager
        )

        response = self._redeem("fleet-still-eligible")

        self.assertEqual(response.status_code, 200)
        booking.refresh_from_db()
        token.refresh_from_db()
        self.assertEqual(booking.status, BaseBooking.BookingStatus.APPROVED)
        self.assertEqual(booking.resolved_by, self.fleet_manager)
        self.assertTrue(token.used)

    def test_faculty_token_rejects_after_sponsor_changed(self):
        booking = self._make_faculty_booking("FAC-001", self.faculty_sponsor)
        original_status = booking.status
        token = self._make_token(
            "faculty-sponsor-changed",
            "spaces_faculty",
            booking,
            self.faculty_sponsor,
        )
        self.assertTrue(_token_holder_still_eligible(token))

        booking.faculty_sponsor = self.other_faculty
        booking.save(update_fields=["faculty_sponsor", "updated_at"])

        with self.assertLogs("apps.notifications.views", level="WARNING") as logs:
            response = self._redeem("faculty-sponsor-changed")

        self.assert_rejected_for_changed_access(response)
        self.assertIn("live eligibility rejected", logs.output[0])
        booking.refresh_from_db()
        token.refresh_from_db()
        self.assertEqual(booking.status, original_status)
        self.assertEqual(booking.faculty_sponsor, self.other_faculty)
        self.assertFalse(token.used)

    def test_faculty_token_still_succeeds_when_sponsor_unchanged(self):
        booking = self._make_faculty_booking("FAC-002", self.faculty_sponsor)
        token = self._make_token(
            "faculty-still-eligible",
            "spaces_faculty",
            booking,
            self.faculty_sponsor,
        )
        self.assertTrue(_token_holder_still_eligible(token))

        response = self._redeem("faculty-still-eligible")

        self.assertEqual(response.status_code, 200)
        booking.refresh_from_db()
        token.refresh_from_db()
        self.assertEqual(booking.status, BaseBooking.BookingStatus.PENDING)
        self.assertEqual(booking.faculty_sponsor, self.faculty_sponsor)
        self.assertIsNone(booking.faculty_response_deadline)
        self.assertFalse(booking.faculty_timed_out)
        self.assertTrue(token.used)
