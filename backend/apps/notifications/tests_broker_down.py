"""Endpoint-level verification that a down broker cannot block booking mutations."""

from datetime import timedelta
import socket
from unittest.mock import patch

from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APITestCase

from apps.fleet.models import FleetBooking, Vehicle
from apps.mess.models import MessBooking
from apps.notifications.models import NotificationOutbox
from apps.notifications.outbox_processor import process_pending_outbox
from apps.users.models import CustomUser, Department, Role


@override_settings(
    CELERY_BROKER_URL='redis://127.0.0.1:6399/0',
    CELERY_RESULT_BACKEND='redis://127.0.0.1:6399/0',
    NOTIFICATION_EMAIL_STUB=False,
)
class BrokerDownEndpointVerificationTests(APITestCase):
    """Use an intentionally closed Redis port while invoking real DRF actions."""

    def setUp(self):
        self.department = Department.objects.create(
            department_name='Broker Down Test Department',
            department_code='BROKERDOWN',
        )
        self.requester = CustomUser.objects.create_user(
            email='broker-down-requester@example.test',
            employee_student_id='BROKERDOWN-REQUESTER',
            first_name='Requester',
            department=self.department,
            password='test-password',
        )
        self.manager = CustomUser.objects.create_user(
            email='broker-down-manager@example.test',
            employee_student_id='BROKERDOWN-MANAGER',
            first_name='Manager',
            department=self.department,
            password='test-password',
        )
        self.mess_manager_role, _ = Role.objects.get_or_create(
            name=Role.Name.MESS_MANAGER,
        )
        self.fleet_manager_role, _ = Role.objects.get_or_create(
            name=Role.Name.FLEET_MANAGER,
        )
        self.manager.roles.add(self.mess_manager_role, self.fleet_manager_role)
        self.vehicle = Vehicle.objects.create(
            name='Broker Down Van',
            registration_number='BROKERDOWN-001',
            capacity=12,
        )

    def _assert_broker_is_unavailable(self):
        with self.assertRaises(OSError):
            socket.create_connection(('127.0.0.1', 6399), timeout=0.2)

    def _assert_events_queue_then_drain(self, booking, expected_event_types):
        queued = list(
            NotificationOutbox.objects.filter(payload__booking_id=booking.id)
            .order_by('id')
        )
        self.assertEqual(
            {entry.event_type for entry in queued},
            set(expected_event_types),
        )
        self.assertTrue(all(entry.status == NotificationOutbox.Status.PENDING for entry in queued))

        # Restoring delivery conditions is represented by enabling the email
        # stub.  The processor performs real event routing and marks the rows
        # sent without contacting the deliberately unavailable Redis broker.
        with self.settings(NOTIFICATION_EMAIL_STUB=True):
            result = process_pending_outbox()

        self.assertEqual(result['sent'], len(queued))
        for entry in queued:
            entry.refresh_from_db()
            self.assertEqual(entry.status, NotificationOutbox.Status.SENT)

    def _mess_booking(self):
        return MessBooking.objects.create(
            user=self.requester,
            department=self.department,
            start_date=timezone.localdate() + timedelta(days=2),
            end_date=timezone.localdate() + timedelta(days=2),
            delivery_location='Test Hall',
            purpose_of_programme='Broker-down endpoint verification',
        )

    def _fleet_booking(self, status='PENDING'):
        return FleetBooking.objects.create(
            user=self.requester,
            department=self.department,
            vehicle=self.vehicle,
            purpose='Broker-down endpoint verification',
            start_datetime=timezone.now() + timedelta(days=2),
            end_datetime=timezone.now() + timedelta(days=2, hours=1),
            pickup_location='Campus',
            destination='Town',
            total_passengers=4,
            status=status,
            resolved_by=self.manager if status == 'APPROVED' else None,
        )

    @patch('apps.notifications.tasks.send_notification_email.delay')
    def test_mess_approve_queues_then_drains_while_broker_is_down(self, delay):
        self._assert_broker_is_unavailable()
        booking = self._mess_booking()
        self.client.force_authenticate(self.manager)

        response = self.client.patch(f'/api/mess/bookings/{booking.id}/approve/')

        self.assertEqual(response.status_code, 200)
        delay.assert_not_called()
        self._assert_events_queue_then_drain(
            booking,
            ['mess.status_change', 'mess.comanagers_actioned'],
        )

    @patch('apps.notifications.tasks.send_notification_email.delay')
    def test_mess_reject_queues_then_drains_while_broker_is_down(self, delay):
        self._assert_broker_is_unavailable()
        booking = self._mess_booking()
        self.client.force_authenticate(self.manager)

        response = self.client.patch(
            f'/api/mess/bookings/{booking.id}/reject/',
            {'rejection_remark': 'Capacity unavailable'},
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        delay.assert_not_called()
        self._assert_events_queue_then_drain(
            booking,
            ['mess.status_change', 'mess.comanagers_actioned'],
        )

    @patch('apps.notifications.tasks.send_notification_email.delay')
    def test_fleet_cancel_queues_then_drains_while_broker_is_down(self, delay):
        self._assert_broker_is_unavailable()
        booking = self._fleet_booking()
        self.client.force_authenticate(self.requester)

        response = self.client.patch(f'/api/fleet/bookings/{booking.id}/cancel/')

        self.assertEqual(response.status_code, 200)
        delay.assert_not_called()
        self._assert_events_queue_then_drain(
            booking,
            ['fleet.status_change', 'fleet.incharge_cancelled'],
        )

    @patch('apps.notifications.tasks.send_notification_email.delay')
    def test_fleet_partial_update_queues_then_drains_while_broker_is_down(self, delay):
        self._assert_broker_is_unavailable()
        booking = self._fleet_booking(status='APPROVED')
        self.client.force_authenticate(self.requester)

        response = self.client.patch(
            f'/api/fleet/bookings/{booking.id}/',
            {'purpose': 'Updated while broker is unavailable'},
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        delay.assert_not_called()
        self._assert_events_queue_then_drain(booking, ['fleet.new_request'])
