from datetime import timedelta

from django.db import transaction
from django.utils import timezone

from apps.notifications.utils import (
    mark_pending_request_notifications_read,
    notify_approvers,
)
from apps.users.models import Role


REVIEWABLE_STATUSES = {'PENDING', 'APPROVED', 'REJECTED'}
RETRIGGER_STATUSES = {'APPROVED', 'REJECTED'}


def capture_space_anchor(space):
    return {
        'space_id': space.space_id,
        'start_datetime': space.start_datetime,
        'end_datetime': space.end_datetime,
    }


def changed_space_anchor_fields(previous_anchor, space):
    changed = set()
    if not previous_anchor:
        return changed

    if previous_anchor.get('space_id') != space.space_id:
        changed.add('space')
    if previous_anchor.get('start_datetime') != space.start_datetime:
        changed.add('start_datetime')
    if previous_anchor.get('end_datetime') != space.end_datetime:
        changed.add('end_datetime')
    return changed


def _date_range(start_date, end_date):
    days = (end_date - start_date).days
    return [start_date + timedelta(days=i) for i in range(days + 1)]


def _space_location(space_booking):
    space = space_booking.space
    location = getattr(space, 'location', '')
    return f"{space.name}, {location}" if location else space.name


def _format_space_schedule(space_booking):
    start = timezone.localtime(space_booking.start_datetime)
    end = timezone.localtime(space_booking.end_datetime)
    if start.date() == end.date():
        return f"{start:%d %b %Y}, {start:%I:%M %p} - {end:%I:%M %p}"
    return f"{start:%d %b %Y %I:%M %p} - {end:%d %b %Y %I:%M %p}"


def _notify_reapproval(booking, domain, role_name, message):
    notify_approvers(
        role_name=role_name,
        category='BOOKING_PENDING',
        title=f"Linked {domain} request needs re-approval",
        message=message,
        domain=domain,
        reference_code=booking.reference_code,
        is_actionable=True,
    )


def _notify_cascade_cancel(booking, domain, role_name, message):
    notify_approvers(
        role_name=role_name,
        category='BOOKING_CANCELLED',
        title=f"Linked {domain} request cancelled",
        message=message,
        domain=domain,
        reference_code=booking.reference_code,
        is_actionable=False,
    )


def _sync_mess_anchor(mess_booking, space_booking):
    from apps.mess.models import DailyMessMenu

    start = timezone.localtime(space_booking.start_datetime).date()
    end = timezone.localtime(space_booking.end_datetime).date()

    existing_menus = list(mess_booking.daily_menus.order_by('date'))
    menu_fields = [
        'total_persons',
        'veg_persons',
        'nonveg_persons',
        'breakfast_time',
        'breakfast_menu',
        'morning_tea_time',
        'morning_snack_option',
        'lunch_time',
        'lunch_menu',
        'evening_tea_time',
        'evening_snack_option',
        'dinner_time',
        'dinner_menu',
    ]

    mess_booking.start_date = start
    mess_booking.end_date = end
    mess_booking.delivery_location = _space_location(space_booking)

    if existing_menus:
        new_dates = _date_range(start, end)
        snapshots = [
            {field: getattr(menu, field) for field in menu_fields}
            for menu in existing_menus
        ]
        mess_booking.daily_menus.all().delete()
        rebuilt = []
        for index, date in enumerate(new_dates):
            source = snapshots[min(index, len(snapshots) - 1)]
            rebuilt.append(DailyMessMenu(booking=mess_booking, date=date, **source))
        DailyMessMenu.objects.bulk_create(rebuilt)


def _sync_media_anchor(media_booking, space_booking, previous_anchor):
    old_start = previous_anchor.get('start_datetime') if previous_anchor else None
    old_end = previous_anchor.get('end_datetime') if previous_anchor else None

    if old_start:
        setup_offset = old_start - media_booking.setup_start_datetime
    else:
        setup_offset = timedelta()

    if old_end:
        teardown_offset = media_booking.teardown_end_datetime - old_end
    else:
        teardown_offset = timedelta()

    media_booking.space = space_booking.space
    media_booking.event_start_datetime = space_booking.start_datetime
    media_booking.event_end_datetime = space_booking.end_datetime
    media_booking.setup_start_datetime = space_booking.start_datetime - setup_offset
    media_booking.teardown_end_datetime = space_booking.end_datetime + teardown_offset


def _reset_for_reapproval(booking, actor=None):
    booking.status = 'PENDING'
    booking.resolved_by = None
    booking.resolved_at = None
    booking.remarks_by_admin = None
    booking.updated_by = actor
    if hasattr(booking, 'rejection_remark'):
        booking.rejection_remark = ''


@transaction.atomic
def sync_linked_siblings_after_space_edit(space_booking, previous_anchor, actor=None):
    if not space_booking.event_group_id:
        return {'mess': 0, 'media': 0, 'anchor_changed': False}

    from apps.media.models import MediaBooking
    from apps.mess.models import MessBooking

    anchor_fields = changed_space_anchor_fields(previous_anchor, space_booking)
    anchor_changed = bool(anchor_fields)
    schedule = _format_space_schedule(space_booking)
    updated = {'mess': 0, 'media': 0, 'anchor_changed': anchor_changed}

    for mess in MessBooking.objects.filter(event_group_id=space_booking.event_group_id):
        if mess.status not in REVIEWABLE_STATUSES:
            continue

        if anchor_changed:
            _sync_mess_anchor(mess, space_booking)

        should_notify = mess.status in RETRIGGER_STATUSES
        if should_notify:
            _reset_for_reapproval(mess, actor=actor)

        mess.save()
        updated['mess'] += 1

        if should_notify:
            message = (
                f"The linked Space booking was updated to {schedule}. "
                "The Mess request has been moved to the new date/location and needs re-approval."
                if anchor_changed else
                "The linked Space booking was updated. The Mess request details are unchanged, "
                "but it needs re-review and re-approval."
            )
            _notify_reapproval(mess, 'mess', Role.Name.MESS_MANAGER, message)

    for media in MediaBooking.objects.filter(event_group_id=space_booking.event_group_id):
        if media.status not in REVIEWABLE_STATUSES:
            continue

        if anchor_changed:
            _sync_media_anchor(media, space_booking, previous_anchor)

        should_notify = media.status in RETRIGGER_STATUSES
        if should_notify:
            _reset_for_reapproval(media, actor=actor)

        media.save()
        updated['media'] += 1

        if should_notify:
            message = (
                f"The linked Space booking was updated to {schedule}. "
                "The Media request has been moved to the new room/time and needs re-approval."
                if anchor_changed else
                "The linked Space booking was updated. The Media request details are unchanged, "
                "but it needs re-review and re-approval."
            )
            _notify_reapproval(media, 'media', Role.Name.MEDIA_INCHARGE, message)

    return updated


@transaction.atomic
def cancel_linked_siblings_for_space(space_booking, reason):
    if not space_booking.event_group_id:
        return {'mess': 0, 'media': 0}

    from apps.media.models import MediaBooking
    from apps.mess.models import MessBooking

    updated = {'mess': 0, 'media': 0}

    for mess in MessBooking.objects.filter(
        event_group_id=space_booking.event_group_id,
        status__in=REVIEWABLE_STATUSES,
    ):
        mess.status = 'CANCELLED'
        mess.resolved_by = None
        mess.resolved_at = timezone.now()
        mess.remarks_by_admin = reason
        mess.save(update_fields=[
            'status',
            'resolved_by',
            'resolved_at',
            'remarks_by_admin',
            'updated_at',
        ])
        mark_pending_request_notifications_read(mess, domain='mess')
        _notify_cascade_cancel(
            mess,
            'mess',
            Role.Name.MESS_MANAGER,
            "The linked Space booking was cancelled or rejected. "
            "This Mess request has been automatically cancelled. No action is required.",
        )
        updated['mess'] += 1

    for media in MediaBooking.objects.filter(
        event_group_id=space_booking.event_group_id,
        status__in=REVIEWABLE_STATUSES,
    ):
        media.status = 'CANCELLED'
        media.resolved_by = None
        media.resolved_at = timezone.now()
        media.remarks_by_admin = reason
        media.save(update_fields=[
            'status',
            'resolved_by',
            'resolved_at',
            'remarks_by_admin',
            'updated_at',
        ])
        mark_pending_request_notifications_read(media, domain='media')
        _notify_cascade_cancel(
            media,
            'media',
            Role.Name.MEDIA_INCHARGE,
            "The linked Space booking was cancelled or rejected. "
            "This Media request has been automatically cancelled. No action is required.",
        )
        updated['media'] += 1

    return updated
