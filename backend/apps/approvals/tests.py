from datetime import timedelta

from django.test import TestCase, override_settings
from django.utils import timezone

from apps.approvals.models import BaseBooking
from apps.approvals.views import _get_space_queryset_for_user, _user_can_resolve_space_booking
from apps.spaces.models import Block, Space, SpaceApprover, SpaceBooking
from apps.users.models import CustomUser, Department, Role, RoleOverride


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

    AI Lab uses HOD_FALLBACK workflow - HOD gets first action window,
    LAB_INCHARGE is excluded until the window expires.
    """

    def setUp(self):
        self.block = Block.objects.create(name="Test Block")
        self.dept = Department.objects.create(
            department_name="Computer Science",
            department_code="CS",
        )

        # AI Lab - HOD_FALLBACK workflow
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
        """LAB_INCHARGE exclusion only applies to HOD_FALLBACK spaces - DIRECT workflow spaces appear immediately."""
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


class RoleOverrideApprovalResolutionTests(TestCase):
    """
    Tests for RoleOverride being correctly wired into space-booking approval
    resolution (_get_space_queryset_for_user / _user_can_resolve_space_booking),
    including cross-type most-specific-wins precedence between SpaceApprover
    and RoleOverride: a SPACE-scoped row of either type must suppress a
    BLOCK-scoped row of either type for that same space.
    """

    def setUp(self):
        self.block_a = Block.objects.create(name="Override Test Block")
        self.dept = Department.objects.create(
            department_name="General Admin",
            department_code="GA",
        )

        # Two GENERAL spaces in the same block. `room` will have a dedicated
        # SPACE-scope SpaceApprover; `other_room` will not, so it relies on
        # the BLOCK-scope RoleOverride.
        self.room = Space.objects.create(
            name="Conference Room",
            block=self.block_a,
            approval_category="GENERAL",
            approval_workflow_type=Space.ApprovalWorkflowType.DIRECT,
            location="Block A, Floor 1",
            capacity_hard=20,
        )
        self.other_room = Space.objects.create(
            name="Seminar Hall",
            block=self.block_a,
            approval_category="GENERAL",
            approval_workflow_type=Space.ApprovalWorkflowType.DIRECT,
            location="Block A, Floor 2",
            capacity_hard=30,
        )

        # Anu: permanent SPACE-scope SpaceApprover on `room` specifically.
        self.anu = _make_user("anu_override_test@test.com", Role.Name.RECEPTIONIST)
        receptionist_role = Role.objects.get(name=Role.Name.RECEPTIONIST)
        SpaceApprover.objects.create(
            user=self.anu,
            role=receptionist_role,
            scope_type="SPACE",
            space=self.room,
            is_active=True,
        )

        # Priya: NO permanent role assignment at all -- her access must come
        # ONLY from the RoleOverride below. Deliberately not using _make_user
        # here, since that helper also grants a permanent role via roles.add(),
        # which would defeat the point of this test.
        self.priya = CustomUser.objects.create_user(
            email="priya_override_test@test.com",
            employee_student_id="priya_override_test",
            password="testpass",
            first_name="Priya",
            last_name="Test",
        )

        self.it_admin = _make_user("itadmin_override_test@test.com", Role.Name.IT_ADMIN)

        self.override = RoleOverride.objects.create(
            user=self.priya,
            role=receptionist_role,
            block=self.block_a,
            granted_by=self.it_admin,
            valid_until=timezone.now() + timedelta(days=7),
            reason="Covering for Anu while on leave",
        )

        self.requester = _make_user("requester_override_test@test.com", Role.Name.STAFF)

    def test_space_scope_assignment_suppresses_block_scope_override(self):
        """Anu's SPACE-scope SpaceApprover on `room` must suppress Priya's
        BLOCK-scope RoleOverride for that specific room."""
        booking = _make_booking(self.requester, self.room, self.dept)

        priya_roles = self.priya.get_effective_roles()
        qs = _get_space_queryset_for_user(self.priya, priya_roles, "PENDING")
        self.assertNotIn(booking, qs)
        self.assertFalse(
            _user_can_resolve_space_booking(self.priya, priya_roles, booking)
        )

    def test_block_scope_override_covers_unassigned_space(self):
        """Priya's BLOCK-scope override must still cover `other_room`, which
        has no dedicated SpaceApprover of its own."""
        booking = _make_booking(self.requester, self.other_room, self.dept)

        priya_roles = self.priya.get_effective_roles()
        qs = _get_space_queryset_for_user(self.priya, priya_roles, "PENDING")
        self.assertIn(booking, qs)
        self.assertTrue(
            _user_can_resolve_space_booking(self.priya, priya_roles, booking)
        )

    def test_anu_access_unchanged_by_override_existing(self):
        """Regression check: Anu's own SpaceApprover access to `room` is
        unaffected by Priya's override existing alongside it."""
        booking = _make_booking(self.requester, self.room, self.dept)

        anu_roles = self.anu.get_effective_roles()
        qs = _get_space_queryset_for_user(self.anu, anu_roles, "PENDING")
        self.assertIn(booking, qs)
        self.assertTrue(
            _user_can_resolve_space_booking(self.anu, anu_roles, booking)
        )

    def test_expired_override_grants_no_access(self):
        """An expired RoleOverride must not grant queue visibility or
        resolution rights, even for a space with no dedicated approver."""
        self.override.valid_until = timezone.now() - timedelta(days=1)
        self.override.save()

        booking = _make_booking(self.requester, self.other_room, self.dept)

        priya_roles = self.priya.get_effective_roles()
        qs = _get_space_queryset_for_user(self.priya, priya_roles, "PENDING")
        self.assertNotIn(booking, qs)
        self.assertFalse(
            _user_can_resolve_space_booking(self.priya, priya_roles, booking)
        )

    def test_revoked_override_grants_no_access(self):
        """A manually revoked RoleOverride must not grant access, even if
        valid_until is still in the future."""
        self.override.revoke(revoked_by=self.it_admin)

        booking = _make_booking(self.requester, self.other_room, self.dept)

        priya_roles = self.priya.get_effective_roles()
        qs = _get_space_queryset_for_user(self.priya, priya_roles, "PENDING")
        self.assertNotIn(booking, qs)