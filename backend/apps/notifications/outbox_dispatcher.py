"""Translate durable outbox events back into the existing notification API."""

from apps.notifications.models import Notification


class TerminalDispatchError(Exception):
    """The event can never be delivered (for example, its booking was deleted)."""


def _get_booking(domain, booking_id):
    model_paths = {
        'spaces': ('apps.spaces.models', 'SpaceBooking'),
        'fleet': ('apps.fleet.models', 'FleetBooking'),
        'mess': ('apps.mess.models', 'MessBooking'),
        'media': ('apps.media.models', 'MediaBooking'),
    }
    try:
        module_name, model_name = model_paths[domain]
    except KeyError as exc:
        raise TerminalDispatchError(f'Unsupported booking domain: {domain}') from exc

    module = __import__(module_name, fromlist=[model_name])
    model = getattr(module, model_name)
    related_fields = {
        'spaces': ('user', 'department', 'resolved_by', 'space', 'faculty_sponsor'),
        'fleet': ('user', 'department', 'resolved_by', 'vehicle'),
        'mess': ('user', 'department', 'resolved_by'),
        'media': ('user', 'department', 'resolved_by', 'space'),
    }[domain]
    try:
        return model.objects.select_related(*related_fields).get(pk=booking_id)
    except model.DoesNotExist as exc:
        raise TerminalDispatchError(
            f'{domain} booking {booking_id} no longer exists'
        ) from exc


def _get_user(user_id, label):
    if user_id is None:
        return None
    from apps.users.models import CustomUser

    try:
        return CustomUser.objects.get(pk=user_id)
    except CustomUser.DoesNotExist as exc:
        raise TerminalDispatchError(f'{label} user {user_id} no longer exists') from exc


def _dispatch_direct_space_notification(entry, booking, payload):
    """Render chain notifications from fresh booking data at drain time."""
    from apps.notifications.utils import _approver_link, _booking_reference, _resource_name, notify

    recipient = _get_user(payload.get('recipient_id'), 'recipient')
    variant = payload.get('variant')
    reference = _booking_reference(booking)
    resource = _resource_name(booking, 'spaces')

    if variant == 'new_request':
        title = 'New Booking Request'
        message = (
            f"{getattr(booking.user, 'first_name', None) or 'A user'} requested "
            f"{resource}. It requires your approval."
        )
    elif variant == 'faculty_approved':
        title = 'New Booking Request'
        message = f'A faculty-approved booking for {resource} requires your approval.'
    else:
        raise TerminalDispatchError(f'Unsupported spaces.direct_notify variant: {variant}')

    notify(
        recipient,
        Notification.Category.BOOKING_PENDING,
        title,
        message,
        link=_approver_link('spaces', reference),
        domain='spaces',
        reference_code=reference,
        is_actionable=True,
        outbox_entry=entry,
    )


def dispatch_outbox_event(entry):
    """Dispatch one outbox event using the current booking and recipient data."""
    from apps.notifications.utils import (
        notify_auto_approved_informational,
        notify_booking_status_change,
        notify_comanagers_actioned,
        notify_crew_updated,
        notify_faculty_approved,
        notify_faculty_details_changed,
        notify_faculty_new_request,
        notify_faculty_rejected,
        notify_faculty_resent,
        notify_group_status_change,
        notify_incharge_booking_edited,
        notify_incharge_cancelled,
        notify_new_request,
        notify_student_cancelled_faculty,
    )

    payload = entry.payload
    event_type = entry.event_type
    domain = payload.get('domain')

    if event_type == 'spaces.group_status_change':
        booking_ids = payload.get('booking_ids') or []
        if not booking_ids:
            raise TerminalDispatchError('spaces.group_status_change has no booking IDs')
        bookings = [_get_booking('spaces', booking_id) for booking_id in booking_ids]
        notify_group_status_change(
            bookings=bookings,
            new_status=payload['new_status'],
            domain='spaces',
            resolved_by=_get_user(payload.get('resolved_by_id'), 'resolver'),
            remarks=payload.get('remarks'),
            outbox_entry=entry,
        )
        return

    booking = _get_booking(domain, payload.get('booking_id'))

    if event_type == 'spaces.direct_notify':
        _dispatch_direct_space_notification(entry, booking, payload)
    elif event_type == 'spaces.faculty_new_request':
        notify_faculty_new_request(booking, outbox_entry=entry)
    elif event_type == 'spaces.faculty_approved':
        notify_faculty_approved(booking, outbox_entry=entry)
    elif event_type == 'spaces.faculty_rejected':
        notify_faculty_rejected(booking, outbox_entry=entry)
    elif event_type == 'spaces.faculty_details_changed':
        notify_faculty_details_changed(booking, outbox_entry=entry)
    elif event_type == 'spaces.faculty_resent':
        notify_faculty_resent(booking, outbox_entry=entry)
    elif event_type == 'spaces.student_cancelled_faculty':
        notify_student_cancelled_faculty(booking, outbox_entry=entry)
    elif event_type == 'spaces.auto_approved_informational':
        users = [
            _get_user(user_id, 'recipient')
            for user_id in payload.get('recipient_ids', [])
        ]
        notify_auto_approved_informational(
            booking,
            'spaces',
            users,
            outbox_entry=entry,
        )
    elif event_type.endswith('.new_request'):
        notify_new_request(
            booking=booking,
            domain=domain,
            role_name=payload['role_name'],
            exclude_user=_get_user(payload.get('exclude_user_id'), 'excluded'),
            outbox_entry=entry,
        )
    elif event_type.endswith('.status_change'):
        notify_booking_status_change(
            booking=booking,
            new_status=payload['new_status'],
            domain=domain,
            resolved_by=_get_user(payload.get('resolved_by_id'), 'resolver'),
            remarks=payload.get('remarks'),
            outbox_entry=entry,
        )
    elif event_type.endswith('.comanagers_actioned'):
        notify_comanagers_actioned(
            booking=booking,
            domain=domain,
            actioned_by=_get_user(payload.get('actioned_by_id'), 'actor'),
            new_status=payload['new_status'],
            outbox_entry=entry,
        )
    elif event_type.endswith('.incharge_booking_edited'):
        notify_incharge_booking_edited(
            booking=booking,
            domain=domain,
            role_name=payload['role_name'],
            outbox_entry=entry,
        )
    elif event_type.endswith('.incharge_cancelled'):
        notify_incharge_cancelled(
            booking=booking,
            domain=domain,
            role_name=payload['role_name'],
            outbox_entry=entry,
        )
    elif event_type == 'media.crew_updated':
        notify_crew_updated(booking, outbox_entry=entry)
    else:
        raise TerminalDispatchError(f'Unknown notification event type: {event_type}')
