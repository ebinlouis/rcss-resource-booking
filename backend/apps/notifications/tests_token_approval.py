import hashlib
import threading
from datetime import timedelta
from unittest.mock import patch

from django.db import close_old_connections, connection
from django.test import Client, TestCase, TransactionTestCase, override_settings
from django.utils import timezone

from apps.approvals.models import BaseBooking
from apps.fleet.models import FleetBooking, Vehicle
from apps.mess.models import MessBooking
from apps.notifications.models import ApprovalToken, NotificationOutbox
from apps.notifications.views import TokenApprovalView, _token_holder_still_eligible
from apps.spaces.models import (
    Block,
    Space,
    SpaceApprover,
    SpaceApproverChain,
    SpaceBooking,
)
from apps.users.models import CustomUser, Department, Role, RoleOverride


class ApprovalTokenTestDataMixin:
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
        self.mess_manager_role, _ = Role.objects.get_or_create(
            name=Role.Name.MESS_MANAGER
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
        self.mess_manager = self._make_user(
            "mess-manager-token@test.com", self.mess_manager_role
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

    def _make_mess_booking(self, reference_code):
        today = timezone.now().date()
        return MessBooking.objects.create(
            reference_code=reference_code,
            user=self.requester,
            department=self.department,
            status=BaseBooking.BookingStatus.PENDING,
            start_date=today + timedelta(days=3),
            end_date=today + timedelta(days=3),
            delivery_location="Mess Hall",
            purpose_of_programme="Token approval test",
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


@override_settings(NOTIFICATION_EMAIL_STUB=True)
class ApprovalTokenLiveEligibilityTests(ApprovalTokenTestDataMixin, TestCase):
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

    def test_redeeming_the_same_token_twice_only_approves_once(self):
        booking = self._make_fleet_booking("FLT-DOUBLE-USE")
        token = self._make_token(
            "fleet-double-use", "fleet", booking, self.fleet_manager
        )

        first_response = self._redeem("fleet-double-use")
        second_response = self._redeem("fleet-double-use")

        self.assertEqual(first_response.status_code, 200)
        self.assertEqual(second_response.status_code, 400)
        self.assertIn("already been actioned", second_response.content.decode())
        booking.refresh_from_db()
        token.refresh_from_db()
        self.assertEqual(booking.status, BaseBooking.BookingStatus.APPROVED)
        self.assertEqual(booking.resolved_by, self.fleet_manager)
        self.assertTrue(token.used)

    def test_fleet_token_approval_queues_status_and_comanager_events(self):
        booking = self._make_fleet_booking("FLT-OUTBOX")
        self._make_token("fleet-outbox", "fleet", booking, self.fleet_manager)

        response = self._redeem("fleet-outbox")

        self.assertEqual(response.status_code, 200)
        entries = list(
            NotificationOutbox.objects.filter(payload__booking_id=booking.id).order_by("id")
        )
        self.assertEqual([entry.event_type for entry in entries], [
            "fleet.status_change",
            "fleet.comanagers_actioned",
        ])
        self.assertEqual(entries[0].payload, {
            "booking_id": booking.id,
            "domain": "fleet",
            "new_status": "APPROVED",
            "resolved_by_id": self.fleet_manager.id,
            "remarks": None,
        })
        self.assertEqual(entries[1].payload, {
            "booking_id": booking.id,
            "domain": "fleet",
            "actioned_by_id": self.fleet_manager.id,
            "new_status": "APPROVED",
        })

    def test_mess_token_approval_queues_status_and_comanager_events(self):
        booking = self._make_mess_booking("MSS-OUTBOX")
        self._make_token("mess-outbox", "mess", booking, self.mess_manager)

        response = self._redeem("mess-outbox")

        self.assertEqual(response.status_code, 200)
        entries = list(
            NotificationOutbox.objects.filter(payload__booking_id=booking.id).order_by("id")
        )
        self.assertEqual([entry.event_type for entry in entries], [
            "mess.status_change",
            "mess.comanagers_actioned",
        ])
        self.assertEqual(entries[0].payload, {
            "booking_id": booking.id,
            "domain": "mess",
            "new_status": "APPROVED",
            "resolved_by_id": self.mess_manager.id,
            "remarks": None,
        })
        self.assertEqual(entries[1].payload, {
            "booking_id": booking.id,
            "domain": "mess",
            "actioned_by_id": self.mess_manager.id,
            "new_status": "APPROVED",
        })

    def test_space_recurring_token_approval_queues_one_status_event_per_sibling(self):
        booking = self._make_space_booking("SPT-OUTBOX-1")
        sibling = self._make_space_booking("SPT-OUTBOX-2")
        sibling.group_id = booking.group_id
        sibling.start_datetime = booking.start_datetime + timedelta(days=1)
        sibling.end_datetime = booking.end_datetime + timedelta(days=1)
        sibling.save(update_fields=["group_id", "start_datetime", "end_datetime", "updated_at"])
        SpaceApprover.objects.create(
            user=self.space_approver,
            role=self.receptionist_role,
            scope_type=SpaceApprover.ScopeType.SPACE,
            space=self.space,
            is_active=True,
        )
        self._make_token("space-outbox", "spaces", booking, self.space_approver)

        response = self._redeem("space-outbox")

        self.assertEqual(response.status_code, 200)
        entries = list(
            NotificationOutbox.objects.filter(
                payload__booking_id__in=[booking.id, sibling.id]
            ).order_by("id")
        )
        status_entries = [
            entry for entry in entries if entry.event_type == "spaces.status_change"
        ]
        self.assertEqual(len(status_entries), 2)
        self.assertEqual(
            {entry.payload["booking_id"] for entry in status_entries},
            {booking.id, sibling.id},
        )
        for entry in status_entries:
            self.assertEqual(entry.payload, {
                "booking_id": entry.payload["booking_id"],
                "domain": "spaces",
                "new_status": "APPROVED",
                "resolved_by_id": self.space_approver.id,
                "remarks": None,
            })
        comanager_entries = [
            entry for entry in entries if entry.event_type == "spaces.comanagers_actioned"
        ]
        self.assertEqual(len(comanager_entries), 1)
        self.assertEqual(comanager_entries[0].payload, {
            "booking_id": booking.id,
            "domain": "spaces",
            "actioned_by_id": self.space_approver.id,
            "new_status": "APPROVED",
        })

    def test_space_token_approval_queues_comanager_event(self):
        booking = self._make_space_booking("SPT-COMANAGER-OUTBOX")
        SpaceApprover.objects.create(
            user=self.space_approver,
            role=self.receptionist_role,
            scope_type=SpaceApprover.ScopeType.SPACE,
            space=self.space,
            is_active=True,
        )
        self._make_token("space-comanager-outbox", "spaces", booking, self.space_approver)

        response = self._redeem("space-comanager-outbox")

        self.assertEqual(response.status_code, 200)
        entry = NotificationOutbox.objects.get(
            event_type="spaces.comanagers_actioned",
            payload__booking_id=booking.id,
        )
        self.assertEqual(entry.payload, {
            "booking_id": booking.id,
            "domain": "spaces",
            "actioned_by_id": self.space_approver.id,
            "new_status": "APPROVED",
        })

    def test_faculty_token_approval_queues_standard_incharge_events(self):
        booking = self._make_faculty_booking("FAC-OUTBOX-STANDARD", self.faculty_sponsor)
        self._make_token(
            "faculty-outbox-standard",
            "spaces_faculty",
            booking,
            self.faculty_sponsor,
        )

        response = self._redeem("faculty-outbox-standard")

        self.assertEqual(response.status_code, 200)
        entries = list(
            NotificationOutbox.objects.filter(payload__booking_id=booking.id).order_by("id")
        )
        self.assertEqual([entry.event_type for entry in entries], [
            "spaces.faculty_approved",
            "spaces.new_request",
        ])
        self.assertEqual(entries[0].payload, {
            "booking_id": booking.id,
            "domain": "spaces",
        })
        self.assertEqual(entries[1].payload, {
            "booking_id": booking.id,
            "domain": "spaces",
            "role_name": Role.Name.RECEPTIONIST,
            "exclude_user_id": None,
        })

    def test_faculty_token_approval_queues_direct_chain_event(self):
        self.space.approval_workflow_type = Space.ApprovalWorkflowType.HOD_FALLBACK
        self.space.save(update_fields=["approval_workflow_type"])
        SpaceApproverChain.objects.create(
            space=self.space,
            primary_approver=self.space_approver,
            fallback_approver=self.override_approver,
        )
        booking = self._make_faculty_booking("FAC-OUTBOX-CHAIN", self.faculty_sponsor)
        self._make_token(
            "faculty-outbox-chain",
            "spaces_faculty",
            booking,
            self.faculty_sponsor,
        )

        response = self._redeem("faculty-outbox-chain")

        self.assertEqual(response.status_code, 200)
        entries = list(
            NotificationOutbox.objects.filter(payload__booking_id=booking.id).order_by("id")
        )
        self.assertEqual([entry.event_type for entry in entries], [
            "spaces.faculty_approved",
            "spaces.direct_notify",
        ])
        self.assertEqual(entries[1].payload, {
            "booking_id": booking.id,
            "domain": "spaces",
            "recipient_id": self.space_approver.id,
            "variant": "faculty_approved",
        })

    def test_edited_faculty_token_approval_queues_rereview_event(self):
        booking = self._make_faculty_booking("FAC-OUTBOX-EDITED", self.faculty_sponsor)
        SpaceBooking.objects.filter(pk=booking.pk).update(
            created_at=timezone.now() - timedelta(minutes=5),
            updated_at=timezone.now(),
        )
        self._make_token(
            "faculty-outbox-edited",
            "spaces_faculty",
            booking,
            self.faculty_sponsor,
        )

        response = self._redeem("faculty-outbox-edited")

        self.assertEqual(response.status_code, 200)
        entries = list(
            NotificationOutbox.objects.filter(payload__booking_id=booking.id).order_by("id")
        )
        self.assertEqual([entry.event_type for entry in entries], [
            "spaces.faculty_approved",
            "spaces.incharge_booking_edited",
        ])
        self.assertEqual(entries[1].payload, {
            "booking_id": booking.id,
            "domain": "spaces",
            "role_name": Role.Name.RECEPTIONIST,
        })

    def test_mess_token_rejects_after_manager_role_removed(self):
        booking = self._make_mess_booking("MSS-001")
        token = self._make_token("mess-role-removed", "mess", booking, self.mess_manager)
        self.assertTrue(_token_holder_still_eligible(token))

        self.mess_manager.roles.remove(self.mess_manager_role)

        response = self._redeem("mess-role-removed")

        self.assert_rejected_for_changed_access(response)
        booking.refresh_from_db()
        token.refresh_from_db()
        self.assertEqual(booking.status, BaseBooking.BookingStatus.PENDING)
        self.assertFalse(token.used)

    def test_mess_token_still_succeeds_when_holder_remains_eligible(self):
        booking = self._make_mess_booking("MSS-002")
        token = self._make_token(
            "mess-still-eligible", "mess", booking, self.mess_manager
        )

        response = self._redeem("mess-still-eligible")

        self.assertEqual(response.status_code, 200)
        booking.refresh_from_db()
        token.refresh_from_db()
        self.assertEqual(booking.status, BaseBooking.BookingStatus.APPROVED)
        self.assertEqual(booking.resolved_by, self.mess_manager)
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


@override_settings(NOTIFICATION_EMAIL_STUB=True)
class ApprovalTokenConcurrencyTests(ApprovalTokenTestDataMixin, TransactionTestCase):
    def test_concurrent_redemption_of_the_same_token_only_approves_once(self):
        if not connection.features.has_select_for_update:
            self.skipTest("This database does not support row-level SELECT FOR UPDATE locks.")

        booking = self._make_fleet_booking("FLT-CONCURRENT-USE")
        token = self._make_token(
            "fleet-concurrent-use", "fleet", booking, self.fleet_manager
        )
        first_inside_approval = threading.Event()
        release_first_request = threading.Event()
        second_request_started = threading.Event()
        second_request_finished = threading.Event()
        results = {}
        results_lock = threading.Lock()
        original_apply_approval = TokenApprovalView._apply_approval

        def hold_first_approval(view, approval_token, now):
            if not first_inside_approval.is_set():
                first_inside_approval.set()
                if not release_first_request.wait(timeout=5):
                    raise TimeoutError("The test did not release the first token redemption.")
            return original_apply_approval(view, approval_token, now)

        def redeem(label, started=None, finished=None):
            close_old_connections()
            try:
                if started:
                    started.set()
                response = Client().get(
                    "/api/notifications/action/", {"token": "fleet-concurrent-use"}
                )
                with results_lock:
                    results[label] = (response.status_code, response.content.decode())
            finally:
                if finished:
                    finished.set()
                close_old_connections()

        with patch.object(TokenApprovalView, "_apply_approval", new=hold_first_approval):
            first = threading.Thread(target=redeem, args=("first",))
            first.start()
            self.assertTrue(first_inside_approval.wait(timeout=2))

            second = threading.Thread(
                target=redeem,
                args=("second", second_request_started, second_request_finished),
            )
            second.start()
            self.assertTrue(second_request_started.wait(timeout=2))
            self.assertFalse(
                second_request_finished.wait(timeout=0.2),
                "The second redemption completed before the first transaction released its token lock.",
            )
            release_first_request.set()
            first.join(timeout=5)
            second.join(timeout=5)

        self.assertFalse(first.is_alive())
        self.assertFalse(second.is_alive())
        self.assertEqual(results["first"][0], 200)
        self.assertEqual(results["second"][0], 400)
        self.assertIn("already been actioned", results["second"][1])
        booking.refresh_from_db()
        token.refresh_from_db()
        self.assertEqual(booking.status, BaseBooking.BookingStatus.APPROVED)
        self.assertEqual(booking.resolved_by, self.fleet_manager)
        self.assertTrue(token.used)
