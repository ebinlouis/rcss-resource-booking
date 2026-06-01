from datetime import timedelta

from django.test import TestCase, override_settings
from django.utils import timezone

from apps.approvals.models import BaseBooking
from apps.approvals.views import _get_space_queryset_for_user
from apps.spaces.models import Block, Space, SpaceApprover, SpaceBooking
from apps.users.models import CustomUser, Department, Role


def _make_user(email, role_name):
    user = CustomUser.objects.create_user(
        email=email,
        employee_student_id=email.split("@")[0], password="testpass",
        first_name="Test",
        last_name="User",
    )
    role, _ = Role.objects.get_or_create(name=role_name)
    user.roles.add(role)
    return user


def _make_booking(user, space, department, created_at=None):
    now = created_at or timezone.now()
    booking = SpaceBooking.objects.create(
        user=user,
        space=space,
        department=department,
        status=BaseBooking.BookingStatus.PENDING,
        reference_code=f"REF-{SpaceBooking.objects.count() + 1:04d}",
        start_datetime=now + timedelta(hours=1),
        end_datetime=now + timedelta(hours=2),
        attendee_count=10,
        purpose_of_booking="Test booking",
    )
    if created_at:
        SpaceBooking.objects.filter(pk=booking.pk).update(created_at=created_at)
        booking.refresh_from_db()
    return booking


class HodFallbackQueueTests(TestCase):
    """
    Tests for the HOD_FALLBACK exclusion window in _get_space_queryset_for_user.

    AI Lab uses HOD_FALLBACK workflow — HOD gets first action window,
    LAB_INCHARGE is excluded until the window expires.
    """

    def setUp(self):
        self.block = Block.objects.create(name="Test Block")
        self.dept = Department.objects.create(
            department_name="Computer Science",
            department_code="CS",
        )

        # AI Lab — HOD_FALLBACK workflow
        self.ai_lab = Space.objects.create(
            name="Advanced AI Lab",
            block=self.block,
            approval_category="LAB",
            approval_workflow_type=Space.ApprovalWorkflowType.HOD_FALLBACK,
            location="Block A",
            capacity_hard=30,
        )

        # Users
        self.booker = _make_user("booker@test.com", Role.Name.STAFF)
        self.lab_incharge = _make_user("lab@test.com", Role.Name.LAB_INCHARGE)
        self.hod = _make_user("hod@test.com", Role.Name.HOD)

        # Assign LAB_INCHARGE to the space
        lab_role, _ = Role.objects.get_or_create(name=Role.Name.LAB_INCHARGE)
        SpaceApprover.objects.create(
            user=self.lab_incharge,
            role=lab_role,
            scope_type="SPACE",
            space=self.ai_lab,
            is_active=True,
        )

    @override_settings(AI_LAB_HOD_FALLBACK_HOURS=24)
    def test_lab_incharge_cannot_see_booking_within_fallback_window(self):
        """LAB_INCHARGE queue is empty while the HOD fallback window is active."""
        booking = _make_booking(self.booker, self.ai_lab, self.dept)

        roles = self.lab_incharge.get_effective_roles()
        qs = _get_space_queryset_for_user(self.lab_incharge, roles, "PENDING")

        self.assertNotIn(booking, qs)

    @override_settings(AI_LAB_HOD_FALLBACK_HOURS=24)
    def test_lab_incharge_sees_booking_after_fallback_window_expires(self):
        """LAB_INCHARGE queue shows the booking once the HOD fallback window has passed."""
        # Backdate created_at so the window has already expired
        past = timezone.now() - timedelta(hours=25)
        booking = _make_booking(self.booker, self.ai_lab, self.dept, created_at=past)

        roles = self.lab_incharge.get_effective_roles()
        qs = _get_space_queryset_for_user(self.lab_incharge, roles, "PENDING")

        self.assertIn(booking, qs)

    @override_settings(AI_LAB_HOD_FALLBACK_HOURS=24)
    def test_hod_sees_booking_immediately(self):
        """HOD sees all HOD_FALLBACK bookings immediately regardless of who booked."""
        booking = _make_booking(self.booker, self.ai_lab, self.dept)

        roles = self.hod.get_effective_roles()
        qs = _get_space_queryset_for_user(self.hod, roles, "PENDING")

        self.assertIn(booking, qs)

    @override_settings(AI_LAB_HOD_FALLBACK_HOURS=24)
    def test_hod_sees_booking_from_any_department(self):
        """HOD visibility is not gated by the booker's department."""
        other_dept = Department.objects.create(
            department_name="Mechanical Engineering",
            department_code="ME",
        )
        booker2 = _make_user("mech@test.com", Role.Name.STAFF)
        booker2.department = other_dept
        booker2.save()

        booking = _make_booking(booker2, self.ai_lab, other_dept)

        roles = self.hod.get_effective_roles()
        qs = _get_space_queryset_for_user(self.hod, roles, "PENDING")

        self.assertIn(booking, qs)

    @override_settings(AI_LAB_HOD_FALLBACK_HOURS=24)
    def test_lab_incharge_sees_non_hod_fallback_space_immediately(self):
        """LAB_INCHARGE exclusion only applies to HOD_FALLBACK spaces — DIRECT workflow spaces appear immediately."""
        direct_lab = Space.objects.create(
            name="Regular Lab",
            block=self.block,
            approval_category="LAB",
            approval_workflow_type=Space.ApprovalWorkflowType.DIRECT,
            location="Block B",
            capacity_hard=20,
        )
        lab_role, _ = Role.objects.get_or_create(name=Role.Name.LAB_INCHARGE)
        SpaceApprover.objects.create(
            user=self.lab_incharge,
            role=lab_role,
            scope_type="SPACE",
            space=direct_lab,
            is_active=True,
        )
        booking = _make_booking(self.booker, direct_lab, self.dept)

        roles = self.lab_incharge.get_effective_roles()
        qs = _get_space_queryset_for_user(self.lab_incharge, roles, "PENDING")

        self.assertIn(booking, qs)
