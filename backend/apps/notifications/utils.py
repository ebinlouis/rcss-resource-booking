from django.db.models import Q
from django.utils import timezone

from apps.notifications.models import Notification
from apps.users.models import CustomUser, Role, RoleOverride


def notify(recipient, category, title, message, link=None, send_email=False):
    """
    Single entry point for creating notifications.

    This function has no request dependency so it can be wrapped by a Celery
    task later without changing call sites.
    """
    notification = Notification.objects.create(
        recipient = recipient,
        category  = category,
        title     = title,
        message   = message,
        link      = link,
    )

    if send_email:
        # TODO: Enable email sending after these .env variables are configured:
        # EMAIL_HOST=smtp.example.com
        # EMAIL_HOST_USER=notifications@example.com
        # EMAIL_HOST_PASSWORD=your-smtp-password
        # DEFAULT_FROM_EMAIL=RCSS Notifications <notifications@example.com>
        #
        # from django.conf import settings
        # from django.core.mail import send_mail
        #
        # if not getattr(settings, 'NOTIFICATION_EMAIL_STUB', True):
        #     send_mail(
        #         subject=title,
        #         message=message,
        #         from_email=settings.DEFAULT_FROM_EMAIL,
        #         recipient_list=[recipient.email],
        #         fail_silently=False,
        #     )
        pass

    return notification


def notify_approvers(role_name, category, title, message, link=None):
    """
    Notify all active users who currently hold role_name.

    One Notification row is created per recipient so read state is always
    per-user, never shared across approvers.
    """
    now = timezone.now()

    base_role_user_ids = CustomUser.objects.filter(
        is_active=True,
        roles__name=role_name,
    ).values_list('id', flat=True)

    override_user_ids = RoleOverride.objects.filter(
        role__name=role_name,
        user__is_active=True,
        is_active=True,
        revoked_at__isnull=True,
    ).filter(
        Q(valid_until__isnull=True) | Q(valid_until__gt=now)
    ).values_list('user_id', flat=True)

    recipients = CustomUser.objects.filter(
        id__in=set(base_role_user_ids) | set(override_user_ids)
    ).order_by('id')

    created_count = 0
    for recipient in recipients:
        notify(recipient, category, title, message, link=link)
        created_count += 1

    return created_count


def _resource_name(booking):
    space = getattr(booking, 'space', None)
    if space:
        return getattr(space, 'name', None) or str(space)

    vehicle = getattr(booking, 'vehicle', None)
    if vehicle:
        return getattr(vehicle, 'name', None) or str(vehicle)

    return (
        getattr(booking, 'event_name', None)
        or getattr(booking, 'delivery_location', None)
        or 'requested resource'
    )


def _resolver_name(resolved_by):
    if not resolved_by:
        return 'an approver'
    full_name = ' '.join(
        part for part in [resolved_by.first_name, resolved_by.last_name]
        if part
    ).strip()
    return full_name or resolved_by.email


def notify_booking_status_change(booking, new_status, domain, resolved_by, remarks=None):
    """
    Notify the requester that their booking status changed.

    APPROVED changes also create an audit notification for IT_ADMIN users.
    """
    status_value = str(new_status or '').upper()
    reference    = getattr(booking, 'reference_code', 'Booking')
    resource     = _resource_name(booking)
    resolver     = _resolver_name(resolved_by)
    link         = f"/bookings/{reference}"

    category_map = {
        'APPROVED':  Notification.Category.BOOKING_APPROVED,
        'REJECTED':  Notification.Category.BOOKING_REJECTED,
        'CANCELLED': Notification.Category.BOOKING_CANCELLED,
    }

    category = category_map.get(status_value)
    if not category:
        return None

    status_display = status_value.lower()
    title = f"Booking {status_display}: {reference}"
    message = f"Your booking {reference} for {resource} was {status_display} by {resolver}."
    if remarks:
        message = f"{message} Remarks: {remarks}"

    notification = notify(
        booking.user,
        category,
        title,
        message,
        link=link,
    )

    if status_value == 'APPROVED':
        audit_title = f"Booking approved: {reference}"
        audit_message = f"{resolver} approved {domain} booking {reference} for {resource}."
        notify_approvers(
            Role.Name.IT_ADMIN,
            Notification.Category.BOOKING_APPROVED,
            audit_title,
            audit_message,
            link=link,
        )

    return notification


def notify_swap_event(swap_request, event):
    """
    Stub for future swap notifications.

    Will be implemented when the SwapRequest model exists. Expected event
    values: 'requested', 'accepted', 'declined', 'expired', 'cancelled'.
    """
    return None
