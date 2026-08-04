from datetime import timedelta
from unittest.mock import patch

from django.db import transaction
from django.test import TestCase, override_settings
from django.utils import timezone

from apps.fleet.models import FleetBooking, Vehicle
from apps.media.models import MediaBooking
from apps.mess.models import MessBooking
from apps.notifications.models import Notification, NotificationOutbox
from apps.notifications.outbox import enqueue_notification
from apps.notifications.outbox_dispatcher import TerminalDispatchError, dispatch_outbox_event
from apps.notifications.outbox_processor import process_pending_outbox
from apps.notifications.utils import notify
from apps.spaces.models import Space, SpaceBooking
from apps.users.models import CustomUser, Department, Role


@override_settings(NOTIFICATION_EMAIL_STUB=True)
class NotificationOutboxTests(TestCase):
    def setUp(self):
        self.recipient = CustomUser.objects.create_user(
            email='outbox-recipient@example.test',
            employee_student_id='OUTBOX-RECIPIENT',
            first_name='Outbox',
            password='test-password',
        )

    def test_enqueue_participates_in_the_surrounding_transaction(self):
        with self.assertRaises(RuntimeError):
            with transaction.atomic():
                enqueue_notification('mess.new_request', booking_id=123, domain='mess')
                raise RuntimeError('roll back request')

        self.assertEqual(NotificationOutbox.objects.count(), 0)

    def test_notification_is_idempotent_for_an_outbox_recipient(self):
        entry = enqueue_notification('test.event', recipient_id=self.recipient.id)

        notify(
            self.recipient,
            Notification.Category.SYSTEM,
            'Test notification',
            'Created by the outbox test.',
            outbox_entry=entry,
        )
        notify(
            self.recipient,
            Notification.Category.SYSTEM,
            'Test notification',
            'Created by the outbox test.',
            outbox_entry=entry,
        )

        self.assertEqual(Notification.objects.filter(outbox_entry=entry).count(), 1)

    @override_settings(NOTIFICATION_EMAIL_STUB=False)
    @patch('apps.notifications.tasks.send_notification_email.delay')
    def test_retry_queues_email_after_initial_publish_failure(self, delay):
        department = Department.objects.create(
            department_name='Outbox Test Department',
            department_code='OUTBOX',
        )
        requester = CustomUser.objects.create_user(
            email='outbox-requester@example.test',
            employee_student_id='OUTBOX-REQUESTER',
            first_name='Requester',
            department=department,
            password='test-password',
        )
        manager = CustomUser.objects.create_user(
            email='outbox-manager@example.test',
            employee_student_id='OUTBOX-MANAGER',
            first_name='Manager',
            department=department,
            password='test-password',
        )
        manager_role, _ = Role.objects.get_or_create(name=Role.Name.MESS_MANAGER)
        manager.roles.add(manager_role)
        booking = MessBooking.objects.create(
            user=requester,
            department=department,
            start_date=timezone.localdate() + timedelta(days=2),
            end_date=timezone.localdate() + timedelta(days=2),
            delivery_location='Test Hall',
            purpose_of_programme='Outbox retry test',
        )
        entry = enqueue_notification(
            'mess.new_request',
            booking_id=booking.id,
            domain='mess',
            role_name=Role.Name.MESS_MANAGER,
            exclude_user_id=requester.id,
        )

        publish_outcomes = []

        def publish_email(**kwargs):
            if not publish_outcomes:
                publish_outcomes.append('rejected')
                raise ConnectionError('broker unavailable')
            publish_outcomes.append('confirmed')

        delay.side_effect = publish_email

        first_result = process_pending_outbox()

        entry.refresh_from_db()
        notification = Notification.objects.get(outbox_entry=entry, recipient=manager)
        self.assertEqual(first_result['retried'], 1)
        self.assertEqual(entry.status, NotificationOutbox.Status.PENDING)
        self.assertEqual(notification.email_dispatch_status, Notification.EmailDispatchStatus.PENDING)
        self.assertEqual(notification.email_dispatch_attempts, 1)
        self.assertEqual(Notification.objects.filter(outbox_entry=entry).count(), 1)

        entry.next_attempt_at = timezone.now()
        entry.save(update_fields=['next_attempt_at'])

        second_result = process_pending_outbox()

        entry.refresh_from_db()
        notification.refresh_from_db()
        self.assertEqual(second_result['sent'], 1)
        self.assertEqual(entry.status, NotificationOutbox.Status.SENT)
        self.assertEqual(notification.email_dispatch_status, Notification.EmailDispatchStatus.QUEUED)
        self.assertEqual(notification.email_dispatch_attempts, 2)
        self.assertEqual(Notification.objects.filter(outbox_entry=entry).count(), 1)
        self.assertEqual(publish_outcomes, ['rejected', 'confirmed'])
        self.assertEqual(delay.call_count, 2)

    @patch('apps.notifications.outbox_processor.dispatch_outbox_event')
    def test_successful_dispatch_marks_entry_sent(self, dispatch):
        entry = enqueue_notification('test.event')

        result = process_pending_outbox()

        entry.refresh_from_db()
        self.assertEqual(result['sent'], 1)
        self.assertEqual(entry.status, NotificationOutbox.Status.SENT)
        self.assertEqual(entry.attempts, 1)
        dispatch.assert_called_once_with(entry)


class NotificationOutboxDispatcherTests(TestCase):
    def setUp(self):
        self.department = Department.objects.create(
            department_name='Dispatcher Test Department',
            department_code='DISPATCH',
        )
        self.requester = CustomUser.objects.create_user(
            email='dispatcher-requester@example.test',
            employee_student_id='DISPATCH-REQUESTER',
            first_name='Requester',
            department=self.department,
            password='test-password',
        )

    @patch('apps.notifications.utils.notify_new_request')
    def test_routes_mess_new_request(self, notify_new_request):
        booking = MessBooking.objects.create(
            user=self.requester,
            department=self.department,
            start_date=timezone.localdate() + timedelta(days=2),
            end_date=timezone.localdate() + timedelta(days=2),
            delivery_location='Test Hall',
            purpose_of_programme='Dispatcher test',
        )
        entry = enqueue_notification(
            'mess.new_request',
            booking_id=booking.id,
            domain='mess',
            role_name=Role.Name.MESS_MANAGER,
            exclude_user_id=self.requester.id,
        )

        dispatch_outbox_event(entry)

        self.assertEqual(notify_new_request.call_args.kwargs['booking'].id, booking.id)
        self.assertEqual(notify_new_request.call_args.kwargs['domain'], 'mess')
        self.assertEqual(notify_new_request.call_args.kwargs['role_name'], Role.Name.MESS_MANAGER)

    @patch('apps.notifications.utils.notify_booking_status_change')
    def test_routes_fleet_status_change(self, notify_status_change):
        vehicle = Vehicle.objects.create(
            name='Dispatcher Van',
            registration_number='DISPATCH-001',
            capacity=10,
        )
        booking = FleetBooking.objects.create(
            user=self.requester,
            department=self.department,
            vehicle=vehicle,
            purpose='Dispatcher test',
            start_datetime=timezone.now() + timedelta(days=2),
            end_datetime=timezone.now() + timedelta(days=2, hours=1),
            pickup_location='Campus',
            destination='Town',
            total_passengers=2,
        )
        entry = enqueue_notification(
            'fleet.status_change',
            booking_id=booking.id,
            domain='fleet',
            new_status='APPROVED',
            resolved_by_id=self.requester.id,
            remarks='',
        )

        dispatch_outbox_event(entry)

        self.assertEqual(notify_status_change.call_args.kwargs['booking'].id, booking.id)
        self.assertEqual(notify_status_change.call_args.kwargs['domain'], 'fleet')
        self.assertEqual(notify_status_change.call_args.kwargs['new_status'], 'APPROVED')

    @patch('apps.notifications.utils.notify_crew_updated')
    def test_routes_media_crew_update(self, notify_crew_updated):
        space = Space.objects.create(
            name='Dispatcher Media Space',
            location='Campus',
            space_type=Space.SpaceType.GENERAL_HALL,
            capacity_hard=30,
        )
        booking = MediaBooking.objects.create(
            user=self.requester,
            department=self.department,
            space=space,
            event_name='Dispatcher test',
            setup_start_datetime=timezone.now() + timedelta(days=2),
            event_start_datetime=timezone.now() + timedelta(days=2, minutes=30),
            event_end_datetime=timezone.now() + timedelta(days=2, hours=1),
            teardown_end_datetime=timezone.now() + timedelta(days=2, hours=1, minutes=30),
        )
        entry = enqueue_notification(
            'media.crew_updated',
            booking_id=booking.id,
            domain='media',
        )

        dispatch_outbox_event(entry)

        self.assertEqual(notify_crew_updated.call_args.args[0].id, booking.id)
        self.assertEqual(notify_crew_updated.call_args.kwargs['outbox_entry'].id, entry.id)

    @patch('apps.notifications.utils.notify_faculty_new_request')
    def test_routes_spaces_faculty_request(self, notify_faculty_new_request):
        space = Space.objects.create(
            name='Dispatcher Space',
            location='Campus',
            space_type=Space.SpaceType.GENERAL_HALL,
            capacity_hard=30,
        )
        booking = SpaceBooking.objects.create(
            user=self.requester,
            department=self.department,
            space=space,
            start_datetime=timezone.now() + timedelta(days=2),
            end_datetime=timezone.now() + timedelta(days=2, hours=1),
            attendee_count=5,
            purpose_of_booking='Dispatcher test',
        )
        entry = enqueue_notification(
            'spaces.faculty_new_request',
            booking_id=booking.id,
            domain='spaces',
        )

        dispatch_outbox_event(entry)

        self.assertEqual(notify_faculty_new_request.call_args.args[0].id, booking.id)
        self.assertEqual(notify_faculty_new_request.call_args.kwargs['outbox_entry'].id, entry.id)

    @patch('apps.notifications.outbox_processor.dispatch_outbox_event')
    def test_retry_uses_backoff_then_can_succeed(self, dispatch):
        entry = enqueue_notification('test.event')
        dispatch.side_effect = RuntimeError('broker unavailable')

        result = process_pending_outbox()

        entry.refresh_from_db()
        self.assertEqual(result['retried'], 1)
        self.assertEqual(entry.status, NotificationOutbox.Status.PENDING)
        self.assertEqual(entry.attempts, 1)
        self.assertGreater(entry.next_attempt_at, timezone.now() - timedelta(seconds=1))

        entry.next_attempt_at = timezone.now()
        entry.save(update_fields=['next_attempt_at'])
        dispatch.side_effect = None

        result = process_pending_outbox()

        entry.refresh_from_db()
        self.assertEqual(result['sent'], 1)
        self.assertEqual(entry.status, NotificationOutbox.Status.SENT)
        self.assertEqual(entry.attempts, 2)

    @patch('apps.notifications.outbox_processor.dispatch_outbox_event')
    def test_terminal_errors_are_not_retried(self, dispatch):
        entry = enqueue_notification('unknown.event')
        dispatch.side_effect = TerminalDispatchError('unknown event type')

        result = process_pending_outbox()

        entry.refresh_from_db()
        self.assertEqual(result['failed'], 1)
        self.assertEqual(entry.status, NotificationOutbox.Status.FAILED)
        self.assertEqual(entry.attempts, 1)
        self.assertIsNone(entry.next_attempt_at)

    @patch('apps.notifications.outbox_processor.dispatch_outbox_event')
    def test_stale_processing_claim_is_recovered(self, dispatch):
        entry = enqueue_notification('test.event')
        entry.status = NotificationOutbox.Status.PROCESSING
        entry.last_attempted_at = timezone.now() - timedelta(minutes=6)
        entry.save(update_fields=['status', 'last_attempted_at'])

        result = process_pending_outbox()

        entry.refresh_from_db()
        self.assertEqual(result['recovered'], 1)
        self.assertEqual(entry.status, NotificationOutbox.Status.SENT)
        self.assertEqual(entry.attempts, 1)
