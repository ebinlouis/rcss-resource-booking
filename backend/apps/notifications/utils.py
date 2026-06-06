import hashlib
import logging
import secrets

from django.conf import settings
from django.db.models import Q
from django.utils import timezone

from apps.notifications.models import Notification
from apps.users.models import CustomUser, Role, RoleOverride

logger = logging.getLogger(__name__)

EMAIL_CATEGORIES = {
    Notification.Category.BOOKING_APPROVED,
    Notification.Category.BOOKING_REJECTED,
    Notification.Category.BOOKING_CANCELLED,
    Notification.Category.BOOKING_PENDING,
    Notification.Category.FACULTY_APPROVAL_REQ,
    Notification.Category.FACULTY_REJECTED,
    Notification.Category.FACULTY_ESCALATED,
    Notification.Category.SYSTEM,
}


def notify(
    recipient,
    category,
    title,
    message,
    link=None,
    email_override=None,
    domain="",
    reference_code="",
    is_actionable=False,
):
    """
    Single entry point for creating notifications.

    This function has no request dependency so it can be wrapped by a Celery
    task later without changing call sites.
    """
    notification = Notification.objects.create(
        recipient=recipient,
        category=category,
        title=title,
        message=message,
        link=link,
        domain=domain or "",
        reference_code=reference_code or "",
        is_actionable=is_actionable,
    )

    try:
        # Determine whether to send an email for this notification.
        # email_override=False  → skip always
        # email_override=True   → send always (regardless of category)
        # email_override=None   → send only for categories in EMAIL_CATEGORIES
        if email_override is False:
            should_email = False
        elif email_override is True:
            should_email = True
        else:
            should_email = notification.category in EMAIL_CATEGORIES

        if should_email:
            # Honour the stub flag — set NOTIFICATION_EMAIL_STUB=False in
            # settings/env when the SMTP backend is properly configured.
            if getattr(settings, 'NOTIFICATION_EMAIL_STUB', True):
                pass  # Email sending is stubbed out
            elif not recipient.email:
                pass  # No email address on file — skip silently
            else:
                # Token generation — unchanged
                EMAIL_DOMAINS_WITH_TOKEN = {'spaces', 'fleet', 'mess'}
                should_attach_token = (
                    is_actionable
                    and email_override is not False
                    and (domain or '') in EMAIL_DOMAINS_WITH_TOKEN
                    and notification.category in {
                        Notification.Category.BOOKING_PENDING,
                        Notification.Category.FACULTY_APPROVAL_REQ,
                        Notification.Category.FACULTY_ESCALATED,
                        Notification.Category.FACULTY_RESENT,
                    }
                    and recipient.email
                )

                booking_obj = None
                raw_token = None
                if should_attach_token:
                    from apps.approvals.lifecycle import get_approval_deadline
                    # Dynamically look up the booking to get its approval deadline
                    booking_obj = _resolve_booking_by_ref(reference_code, domain or '')
                    if booking_obj is not None:
                        token_expires_at = get_approval_deadline(booking_obj)
                        if token_expires_at:
                            # Faculty approval categories use a separate domain key
                            token_domain = domain or ''
                            if token_domain == 'spaces' and notification.category in {
                                Notification.Category.FACULTY_APPROVAL_REQ,
                                Notification.Category.FACULTY_RESENT,
                            }:
                                token_domain = 'spaces_faculty'
                            raw_token = _generate_approval_token(
                                recipient=recipient,
                                domain=token_domain,
                                booking_ref=reference_code,
                                expires_at=token_expires_at,
                            )

                # Build rich email content via email_builder
                from apps.notifications.email_builder import build_email

                # Reuse already-fetched booking_obj if available, otherwise resolve now
                _email_booking = booking_obj if booking_obj is not None else _resolve_booking_by_ref(reference_code, domain or '')

                # Build approve URL if a token was generated
                _approve_url = None
                if should_attach_token and raw_token:
                    base_url = getattr(settings, 'SITE_BASE_URL', 'http://localhost:8000')
                    _approve_url = f"{base_url}/api/notifications/action/?token={raw_token}"

                try:
                    subject, plain_text, html_message = build_email(
                        notification=notification,
                        booking=_email_booking,
                        domain=domain or '',
                        approve_url=_approve_url,
                    )
                except Exception:
                    logger.exception('build_email failed for %s/%s — falling back to plain text', domain, reference_code)
                    subject = title
                    plain_text = message
                    html_message = None

                from apps.notifications.tasks import send_notification_email
                send_notification_email.delay(
                    recipient_email=recipient.email,
                    subject=subject,
                    plain_text=plain_text,
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    html_message=html_message,
                )
    except Exception:
        logger.exception(
            "Failed to send email notification to %s (category=%s)",
            getattr(recipient, 'email', '<unknown>'),
            category,
        )

    return notification


def notify_approvers(
    role_name,
    category,
    title,
    message,
    link=None,
    domain="",
    reference_code="",
    is_actionable=False,
):
    """
    Notify all active users who currently hold role_name.

    One Notification row is created per recipient so read state is always
    per-user, never shared across approvers.
    """
    now = timezone.now()

    base_role_user_ids = CustomUser.objects.filter(
        is_active=True,
        roles__name=role_name,
    ).values_list("id", flat=True)

    override_user_ids = (
        RoleOverride.objects.filter(
            role__name=role_name,
            user__is_active=True,
            is_active=True,
            revoked_at__isnull=True,
        )
        .filter(Q(valid_until__isnull=True) | Q(valid_until__gt=now))
        .values_list("user_id", flat=True)
    )

    recipients = CustomUser.objects.filter(
        id__in=set(base_role_user_ids) | set(override_user_ids)
    ).order_by("id")

    created_count = 0
    for recipient in recipients:
        notify(
            recipient,
            category,
            title,
            message,
            link=link,
            domain=domain,
            reference_code=reference_code,
            is_actionable=is_actionable,
        )
        created_count += 1

    return created_count


# ==========================================
# SCOPED SPACE APPROVER RESOLUTION (Step 2)
# ==========================================

def resolve_space_approver_recipients(booking, role_name):
    """
    Single source of truth for "who should receive notifications/visibility
    for this space booking."

    Most-specific-wins rule:
      - If any active SPACE-scope SpaceApprover exists for booking.space with
        the given role, ONLY those users are returned (block-scope excluded).
      - Otherwise, users with an active BLOCK-scope SpaceApprover for
        booking.space.block with the given role are returned.

    RoleOverride users are also included with the same precedence:
      - Space-scoped overrides (override.space == booking.space) win over
        block-scoped overrides (override.block == booking.space.block).

    Returns a list of distinct, active CustomUser objects.
    No notification side effects.
    """
    from apps.spaces.models import SpaceApprover
    now = timezone.now()
    space = booking.space

    # ── SpaceApprover resolution ─────────────────────────────────────────────
    space_assignees = list(
        SpaceApprover.objects.filter(
            scope_type="SPACE",
            space=space,
            role__name=role_name,
            is_active=True,
            user__is_active=True,
        ).values_list("user_id", flat=True)
    )

    if space_assignees:
        # Space-scope wins — block-scope excluded entirely for this space
        approver_user_ids = set(space_assignees)
    else:
        # Fall back to block-scope
        block_assignees = list(
            SpaceApprover.objects.filter(
                scope_type="BLOCK",
                block=space.block,
                role__name=role_name,
                is_active=True,
                user__is_active=True,
            ).values_list("user_id", flat=True)
        )
        approver_user_ids = set(block_assignees)

    # ── RoleOverride resolution — same most-specific-wins rule ───────────────
    space_override_ids = list(
        RoleOverride.objects.filter(
            role__name=role_name,
            space=space,
            user__is_active=True,
            is_active=True,
            revoked_at__isnull=True,
        )
        .filter(Q(valid_until__isnull=True) | Q(valid_until__gt=now))
        .values_list("user_id", flat=True)
    )

    if space_override_ids:
        # Space-scoped overrides win — skip block-scoped overrides
        approver_user_ids |= set(space_override_ids)
    else:
        block_override_ids = list(
            RoleOverride.objects.filter(
                role__name=role_name,
                block=space.block,
                space__isnull=True,
                user__is_active=True,
                is_active=True,
                revoked_at__isnull=True,
            )
            .filter(Q(valid_until__isnull=True) | Q(valid_until__gt=now))
            .values_list("user_id", flat=True)
        )
        approver_user_ids |= set(block_override_ids)

    if not approver_user_ids:
        return []

    return list(
        CustomUser.objects.filter(id__in=approver_user_ids, is_active=True).order_by("id")
    )


# ==========================================
# SCOPED SPACE NOTIFICATION DISPATCH (Step 3)
# ==========================================

def notify_space_approvers(
    booking,
    role_name,
    category,
    title,
    message,
    link=None,
    domain="spaces",
    reference_code="",
    is_actionable=False,
):
    """
    Scoped notification dispatcher for space bookings.

    Calls resolve_space_approver_recipients() to determine the correct
    recipient set (most-specific-wins), then calls notify() for each.
    Contains no business logic — purely dispatch.

    Never use this for fleet/mess/media — those domains use notify_approvers()
    because they are global-role domains with no block/space scoping.
    """
    recipients = resolve_space_approver_recipients(booking, role_name)
    for recipient in recipients:
        notify(
            recipient,
            category,
            title,
            message,
            link=link,
            domain=domain,
            reference_code=reference_code,
            is_actionable=is_actionable,
        )


def _resource_name(booking, domain=""):
    domain = (domain or "").lower()

    if domain == "media":
        return (
            getattr(booking, "event_name", None)
            or getattr(getattr(booking, "space", None), "name", None)
            or "media request"
        )

    if domain == "mess":
        return (
            getattr(booking, "purpose_of_programme", None)
            or getattr(booking, "delivery_location", None)
            or "mess request"
        )

    if domain == "fleet":
        vehicle = getattr(booking, "vehicle", None)
        if vehicle:
            return getattr(vehicle, "name", None) or str(vehicle)
        return "fleet request"

    space = getattr(booking, "space", None)
    if space:
        return getattr(space, "name", None) or str(space)

    vehicle = getattr(booking, "vehicle", None)
    if vehicle:
        return getattr(vehicle, "name", None) or str(vehicle)

    return (
        getattr(booking, "event_name", None)
        or getattr(booking, "purpose_of_programme", None)
        or getattr(booking, "delivery_location", None)
        or "requested resource"
    )


def _booking_reference(booking):
    return getattr(booking, "reference_code", "Booking")


def mark_pending_request_notifications_read(booking, domain=""):
    """
    Clears all actionable notifications for a booking reference when the
    booking is resolved — approved, rejected, expired, or cancelled.

    Covers all actionable categories, not just BOOKING_PENDING, so that
    faculty escalation and resent notifications are also cleared correctly.
    """
    reference = _booking_reference(booking)

    actionable_categories = [
        Notification.Category.BOOKING_PENDING,
        Notification.Category.FACULTY_ESCALATED,
        Notification.Category.FACULTY_APPROVAL_REQ,
        Notification.Category.FACULTY_RESENT,
    ]

    queryset = Notification.objects.filter(
        category__in=actionable_categories,
        reference_code=reference,
        is_actionable=True,
    )
    if domain:
        queryset = queryset.filter(domain=domain)

    return queryset.update(
        is_actionable=False,
        is_read=True,
        read_at=timezone.now(),
    )


def _requester_link(domain, reference):
    links = {
        "spaces": f"/bookings/{reference}",
        "media": f"/media/my-bookings?booking={reference}",
        "mess": f"/mess?booking={reference}",
        "fleet": f"/transport?booking={reference}",
    }
    return links.get(domain, f"/bookings/{reference}")


def _approver_link(domain, reference, tab="pending"):
    if tab == "history":
        tab = {
            "spaces": "history",
            "media": "active",
            "mess": "history",
            "fleet": "active",
        }.get(domain, "history")

    links = {
        "spaces": f"/admin?tab={tab}&booking={reference}",
        "media": f"/admin/media?tab={tab}&booking={reference}",
        "mess": f"/admin/mess?tab={tab}&booking={reference}",
        "fleet": f"/admin/transport?tab={tab}&booking={reference}",
    }
    return links.get(domain, f"/admin?tab={tab}&booking={reference}")


def _resolver_title(resolved_by, domain):
    # When triggered by an automated lifecycle transition (e.g. expiry),
    # resolved_by will be None — fall back to "the system".
    if not resolved_by:
        return "the system"

    effective_roles = resolved_by.get_effective_roles()
    roles = Role.objects.filter(name__in=effective_roles).order_by("name")

    domain_roles = {
        "spaces": [
            Role.Name.PRINCIPAL,
            Role.Name.RECEPTIONIST,
            Role.Name.LAB_INCHARGE,
            Role.Name.LIBRARIAN,
            Role.Name.HOD,
            Role.Name.IT_ADMIN,
        ],
        "fleet": [Role.Name.FLEET_MANAGER, Role.Name.IT_ADMIN],
        "mess": [Role.Name.MESS_MANAGER, Role.Name.IT_ADMIN],
        "media": [Role.Name.MEDIA_INCHARGE, Role.Name.IT_ADMIN],
    }

    role_map = {role.name: role for role in roles}
    for role_name in domain_roles.get(domain, []):
        role = role_map.get(role_name)
        if role:
            return role.get_name_display()

    role = roles.first()
    return role.get_name_display() if role else "an approver"


def _format_datetime_range(start_dt, end_dt):
    start_dt = timezone.localtime(start_dt)
    end_dt = timezone.localtime(end_dt)

    if start_dt.date() == end_dt.date():
        date_str = start_dt.strftime("%b %d, %Y")
        time_str = f"{start_dt.strftime('%I:%M %p')} - {end_dt.strftime('%I:%M %p')}"
        return f"{date_str} ({time_str})"

    start_str = start_dt.strftime("%b %d, %Y %I:%M %p")
    end_str = end_dt.strftime("%b %d, %Y %I:%M %p")
    return f"{start_str} to {end_str}"


def _mess_first_meal_time(booking):
    relation = getattr(booking, "daily_menus", None)
    if not relation:
        return None

    try:
        menus = relation.all()
    except AttributeError:
        menus = relation

    meal_fields = [
        "breakfast_time",
        "morning_tea_time",
        "lunch_time",
        "evening_tea_time",
        "dinner_time",
    ]
    times = []
    for menu in menus:
        menu_date = getattr(menu, "date", None)
        for field in meal_fields:
            meal_time = getattr(menu, field, None)
            if menu_date and meal_time:
                times.append((menu_date, meal_time))

    if not times:
        return None

    return min(times, key=lambda item: (item[0], item[1]))[1]


def _format_short_date(date_value):
    if not date_value:
        return ""
    return f"{date_value.day} {date_value.strftime('%b')}"


def _format_short_date_range(start_date, end_date):
    if not start_date:
        return ""
    end_date = end_date or start_date
    if start_date == end_date:
        return _format_short_date(start_date)
    return f"{_format_short_date(start_date)} - {_format_short_date(end_date)}"


def _format_time_value(time_value):
    if not time_value:
        return ""
    return time_value.strftime("%I:%M %p").lstrip("0")


def _format_mess_date_range(booking):
    start_date = getattr(booking, "start_date", None)
    end_date = getattr(booking, "end_date", None) or start_date
    return _format_short_date_range(start_date, end_date)


def _format_media_date_range(booking):
    setup_start = getattr(booking, "setup_start_datetime", None)
    teardown_end = getattr(booking, "teardown_end_datetime", None)
    event_start = getattr(booking, "event_start_datetime", None)

    if setup_start and teardown_end:
        setup_date = timezone.localtime(setup_start).date()
        teardown_date = timezone.localtime(teardown_end).date()
        if setup_date != teardown_date:
            return _format_short_date_range(setup_date, teardown_date)

    display_dt = event_start or setup_start or teardown_end
    if display_dt:
        return _format_short_date(timezone.localtime(display_dt).date())
    return ""


def _format_booking_time(booking, domain=""):
    """
    Extracts and nicely formats the date and time from any type of booking.
    """
    domain = (domain or "").lower()

    if domain == "media":
        start_dt = getattr(booking, "event_start_datetime", None) or getattr(
            booking, "setup_start_datetime", None
        )
        end_dt = getattr(booking, "event_end_datetime", None) or getattr(
            booking, "teardown_end_datetime", None
        )
        if start_dt and end_dt:
            return _format_datetime_range(start_dt, end_dt)

    if domain == "mess":
        start_date = getattr(booking, "start_date", None)
        end_date = getattr(booking, "end_date", None) or start_date
        if start_date:
            if end_date and end_date != start_date:
                date_str = f"{start_date.strftime('%b %d, %Y')} to {end_date.strftime('%b %d, %Y')}"
            else:
                date_str = start_date.strftime("%b %d, %Y")

            first_meal = _mess_first_meal_time(booking)
            if first_meal:
                return f"{date_str} (meal {first_meal.strftime('%I:%M %p')})"
            return date_str

    # 1. Try to get Datetime objects (Spaces, Fleet)
    start_dt = getattr(booking, "start_datetime", None)
    end_dt = getattr(booking, "end_datetime", None)

    # 2. Try to get Date/Time objects (Mess, Media)
    b_date = getattr(booking, "booking_date", getattr(booking, "start_date", None))
    s_time = getattr(booking, "start_time", None)
    e_time = getattr(booking, "end_time", None)

    if start_dt and end_dt:
        return _format_datetime_range(start_dt, end_dt)

    elif b_date:
        date_str = b_date.strftime("%b %d, %Y")
        if s_time and e_time:
            time_str = f"{s_time.strftime('%I:%M %p')} - {e_time.strftime('%I:%M %p')}"
            return f"{date_str} ({time_str})"
        elif s_time:
            return f"{date_str} ({s_time.strftime('%I:%M %p')})"
        else:
            return date_str

    return ""


def notify_booking_status_change(
    booking, new_status, domain, resolved_by, remarks=None
):
    """
    Notify the requester that their booking status changed.

    EXPIRED changes are triggered by the lifecycle engine with resolved_by=None.
    """
    status_value = str(new_status or "").upper()
    reference = _booking_reference(booking)
    resource = _resource_name(booking, domain)
    resolver = _resolver_title(resolved_by, domain)
    link = _requester_link(domain, reference)

    category_map = {
        "APPROVED": Notification.Category.BOOKING_APPROVED,
        "REJECTED": Notification.Category.BOOKING_REJECTED,
        "CANCELLED": Notification.Category.BOOKING_CANCELLED,
        "EXPIRED": Notification.Category.SYSTEM,
    }

    category = category_map.get(status_value)
    if not category:
        return None

    status_display = status_value.lower()

    if domain == "mess":
        date_range = _format_mess_date_range(booking)
        date_context = f" for {date_range}" if date_range else ""
        title = f"Catering Request {status_value.title()}"
        message = (
            f"Your catering request{date_context} was {status_display} by {resolver}."
        )
        if remarks:
            message = f"{message} Remarks: {remarks}"

        return notify(
            booking.user,
            category,
            title,
            message,
            link=link,
            domain=domain,
            reference_code=reference,
            is_actionable=False,
        )

    if domain == "media":
        event_name = getattr(booking, "event_name", None) or "the event"
        date_range = _format_media_date_range(booking)
        date_context = f" on {date_range}" if date_range else ""
        title = f"Media Request {status_value.title()}"
        message = f"Your media request for {event_name}{date_context} was {status_display} by {resolver}."
        if remarks:
            message = f"{message} Remarks: {remarks}"

        return notify(
            booking.user,
            category,
            title,
            message,
            link=link,
            domain=domain,
            reference_code=reference,
            is_actionable=False,
        )

    # Generate the schedule string
    time_str = _format_booking_time(booking, domain)
    time_context = f" scheduled for {time_str}" if time_str else ""

    if domain == 'spaces':
        title = f"Venue Booking {status_value.title()} - {resource}"
        message = (
            f"Your venue booking for {resource}{time_context} was {status_display} by {resolver}."
        )
    elif domain == 'fleet':
        title = f"Transport Booking {status_value.title()} - {resource}"
        message = (
            f"Your booking for {resource}{time_context} was {status_display} by {resolver}."
        )
    else:
        title = f"{resource} booking {status_display}"
        message = (
            f"Your booking for {resource}{time_context} was {status_display} by {resolver}."
        )
    if remarks:
        message = f"{message} Remarks: {remarks}"

    return notify(
        booking.user,
        category,
        title,
        message,
        link=link,
        domain=domain,
        reference_code=reference,
        is_actionable=False,
    )


def notify_group_status_change(bookings, new_status, domain, resolved_by, remarks=None):
    """
    Aggregate notifications for recurring booking groups.

    Instead of flooding the user with one notification per date, this sends a
    single notification that summarises the whole series. For a single booking
    in the list it falls back to the normal per-booking time format.

    """
    if not bookings:
        return None

    base_booking = bookings[0]
    status_value = str(new_status or "").upper()
    reference = _booking_reference(base_booking)
    resource = _resource_name(base_booking, domain)
    resolver = _resolver_title(resolved_by, domain)
    link = _requester_link(domain, reference)

    category_map = {
        "APPROVED": Notification.Category.BOOKING_APPROVED,
        "REJECTED": Notification.Category.BOOKING_REJECTED,
        "CANCELLED": Notification.Category.BOOKING_CANCELLED,
        "EXPIRED": Notification.Category.SYSTEM,
    }

    category = category_map.get(status_value)
    if not category:
        return None

    status_display = status_value.lower()
    title = f"{resource} request {status_display}"
    count = len(bookings)

    if count > 1:
        # Summarise the series rather than listing every date
        time_context = f" (series of {count} scheduled dates)"
    else:
        time_str = _format_booking_time(base_booking, domain)
        time_context = f" scheduled for {time_str}" if time_str else ""

    message = f"Your recurring request for {resource}{time_context} was {status_display} by {resolver}."
    if remarks:
        message = f"{message} Remarks: {remarks}"

    return notify(
        base_booking.user,
        category,
        title,
        message,
        link=link,
        domain=domain,
        reference_code=reference,
        is_actionable=False,
    )


def notify_incharge_booking_edited(booking, domain, role_name):
    """
    Notify the relevant admins that an already approved booking was edited and needs re-review.
    For spaces, uses scoped notify_space_approvers (most-specific-wins).
    """
    resource = _resource_name(booking, domain)
    reference = _booking_reference(booking)
    link = _approver_link(domain, reference)
    requester = getattr(booking.user, "first_name", None) or "A user"

    _domain_display = {'spaces': 'Venue', 'fleet': 'Transport', 'mess': 'Catering', 'media': 'Media'}.get(domain, domain.capitalize())
    title = f"{_domain_display} Booking Updated"
    message = f"{requester} updated their approved booking for {resource}. Please review the changes."

    if domain == "spaces":
        notify_space_approvers(
            booking,
            role_name,
            Notification.Category.BOOKING_PENDING,
            title,
            message,
            link=link,
            domain=domain,
            reference_code=reference,
            is_actionable=True,
        )
    else:
        notify_approvers(
            role_name,
            Notification.Category.BOOKING_PENDING,
            title,
            message,
            link=link,
            domain=domain,
            reference_code=reference,
            is_actionable=True,
        )


def notify_incharge_cancelled(booking, domain, role_name):
    """
    Notify the relevant admins that an active or pending booking was cancelled by the user.
    For spaces, uses scoped notify_space_approvers (most-specific-wins).
    """
    resource = _resource_name(booking, domain)
    reference = _booking_reference(booking)
    link = _approver_link(domain, reference)
    requester = getattr(booking.user, "first_name", None) or "A user"

    _domain_display = {'spaces': 'Venue', 'fleet': 'Transport', 'mess': 'Catering', 'media': 'Media'}.get(domain, domain.capitalize())
    title = f"{_domain_display} Booking Cancelled"
    message = f"{requester} cancelled their booking for {resource}."

    if domain == "spaces":
        notify_space_approvers(
            booking,
            role_name,
            Notification.Category.BOOKING_CANCELLED,
            title,
            message,
            link=link,
            domain=domain,
            reference_code=reference,
            is_actionable=False,
        )
    else:
        notify_approvers(
            role_name,
            Notification.Category.BOOKING_CANCELLED,
            title,
            message,
            link=link,
            domain=domain,
            reference_code=reference,
            is_actionable=False,
        )


def notify_new_request(booking, domain, role_name):
    """
    Notify the relevant admins that a new booking requires approval.
    For spaces, uses scoped notify_space_approvers (most-specific-wins).
    For other domains, uses global notify_approvers.
    """
    resource = _resource_name(booking, domain)
    reference = _booking_reference(booking)
    link = _approver_link(domain, reference)

    time_str = _format_booking_time(booking, domain)
    time_context = f" scheduled for {time_str}" if time_str else ""

    requester = getattr(booking.user, "first_name", None) or "A user"

    if domain == 'spaces':
        title = f"New Venue Request - {resource}"
    else:
        title = f"New {domain} request"
    message = (
        f"{requester} requested {resource}{time_context}. It requires your approval."
    )

    if domain == "mess":
        date_range = _format_mess_date_range(booking)
        first_meal = _mess_first_meal_time(booking)
        title = "New Catering Request"
        if date_range and first_meal:
            message = f"{requester} requested catering for {date_range}, meal at {_format_time_value(first_meal)}."
        elif date_range:
            message = f"{requester} requested catering for {date_range}."
        else:
            message = f"{requester} submitted a new catering request."

    elif domain == "media":
        event_name = getattr(booking, "event_name", None) or "the event"
        date_range = _format_media_date_range(booking)
        request_label = (
            "Media team request"
            if getattr(booking, "is_team_request", False)
            else "Equipment request"
        )
        title = "New Media Request"
        if date_range:
            message = f"{requester} — {request_label} for {event_name} on {date_range}."
        else:
            message = f"{requester} — {request_label} for {event_name}."

    if domain == "spaces":
        notify_space_approvers(
            booking,
            role_name,
            Notification.Category.BOOKING_PENDING,
            title,
            message,
            link=link,
            domain=domain,
            reference_code=reference,
            is_actionable=True,
        )
    else:
        notify_approvers(
            role_name,
            Notification.Category.BOOKING_PENDING,
            title,
            message,
            link=link,
            domain=domain,
            reference_code=reference,
            is_actionable=True,
        )


def notify_incharge_expired(booking, domain):
    """
    Notify the relevant admins that a booking request has automatically expired.
    For spaces with an approver chain, notifies chain members directly.
    For spaces without a chain, uses scoped notify_space_approvers.
    For other domains, uses global notify_approvers.
    """
    resource = _resource_name(booking, domain)
    reference = _booking_reference(booking)
    link = _approver_link(domain, reference, tab='history')
    requester = getattr(booking.user, "first_name", None) or "A user"
    
    time_str = _format_booking_time(booking, domain)
    time_context = f" scheduled for {time_str}" if time_str else ""

    title = f"Venue Request Expired - {resource}"
    message = f"A venue request from {requester} for {resource}{time_context} has automatically expired."

    if domain == "mess":
        date_range = _format_mess_date_range(booking)
        first_meal = _mess_first_meal_time(booking)
        title = "Catering Request Expired"
        if date_range and first_meal:
            message = f"A catering request from {requester} for {date_range} (meal at {_format_time_value(first_meal)}) has automatically expired."
        elif date_range:
            message = f"A catering request from {requester} for {date_range} has automatically expired."
        else:
            message = f"A catering request from {requester} has automatically expired."

    elif domain == "fleet":
        title = f"Transport Request Expired - {resource}"
        message = f"A transport request from {requester} for {resource}{time_context} has automatically expired."

    elif domain == "media":
        event_name = getattr(booking, "event_name", None) or "the event"
        date_range = _format_media_date_range(booking)
        request_label = "Media team request" if getattr(booking, "is_team_request", False) else "Equipment request"
        title = "Media Request Expired"
        if date_range:
            message = f"A {request_label} from {requester} for {event_name} on {date_range} has automatically expired."
        else:
            message = f"A {request_label} from {requester} for {event_name} has automatically expired."

    if domain == 'spaces':
        chain = getattr(getattr(booking, 'space', None), 'approver_chain', None)
        if chain:
            # Chain-based spaces: notify the named approvers directly
            for approver in [chain.primary_approver, chain.fallback_approver]:
                if approver:
                    notify(
                        approver,
                        Notification.Category.SYSTEM,
                        title,
                        message,
                        link=link,
                        domain=domain,
                        reference_code=reference,
                        is_actionable=False,
                    )
        else:
            # Non-chain spaces: use scoped resolution
            space = booking.space
            category = getattr(space, 'approval_category', None)
            from apps.spaces.models import Space as SpaceModel
            if category == SpaceModel.ApprovalCategory.LAB:
                role_name = Role.Name.LAB_INCHARGE
            elif category == SpaceModel.ApprovalCategory.LIBRARY:
                role_name = Role.Name.LIBRARIAN
            else:
                role_name = Role.Name.RECEPTIONIST
            notify_space_approvers(
                booking,
                role_name,
                Notification.Category.SYSTEM,
                title,
                message,
                link=link,
                domain=domain,
                reference_code=reference,
                is_actionable=False,
            )
    else:
        role_map = {
            'fleet': Role.Name.FLEET_MANAGER,
            'mess': Role.Name.MESS_MANAGER,
            'media': Role.Name.MEDIA_INCHARGE,
        }
        role_name = role_map.get(domain)
        if role_name:
            notify_approvers(
                role_name,
                Notification.Category.SYSTEM,
                title,
                message,
                link=link,
                domain=domain,
                reference_code=reference,
                is_actionable=False,
            )

# ==========================================
# FACULTY APPROVAL NOTIFICATIONS
# ==========================================


def notify_faculty_new_request(booking):
    student_name = getattr(booking.user, "first_name", "A student")
    space_name = _resource_name(booking, "spaces")
    date_str = _format_short_date(getattr(booking, "start_datetime", None))
    notify(
        booking.faculty_sponsor,
        Notification.Category.FACULTY_APPROVAL_REQ,
        "Faculty Approval Required",
        f"{student_name} is requesting your approval to book the venue {space_name} on {date_str}.",
        link=f"/faculty-approvals?booking={_booking_reference(booking)}",
        domain="spaces",
        reference_code=_booking_reference(booking),
        is_actionable=True,
    )


def notify_faculty_approved(booking):
    space_name = _resource_name(booking, "spaces")
    faculty_name = getattr(
        booking.faculty_sponsor, "first_name", "Your faculty sponsor"
    )
    notify(
        booking.user,
        Notification.Category.FACULTY_APPROVED,
        "Faculty Approved",
        f"Your venue booking for {space_name} was approved by {faculty_name} and sent to the next approver.",
        link=_requester_link("spaces", _booking_reference(booking)),
        domain="spaces",
        reference_code=_booking_reference(booking),
        is_actionable=False,
    )


def notify_faculty_rejected(booking):
    space_name = _resource_name(booking, "spaces")
    faculty_name = getattr(
        booking.faculty_sponsor, "first_name", "Your faculty sponsor"
    )
    remarks = getattr(booking, "remarks_by_admin", "")
    msg = f"{faculty_name} did not approve your venue booking for {space_name}."
    if remarks:
        msg += f" Remarks: {remarks}"
    notify(
        booking.user,
        Notification.Category.FACULTY_REJECTED,
        "Faculty Rejected",
        msg,
        link=_requester_link("spaces", _booking_reference(booking)),
        domain="spaces",
        reference_code=_booking_reference(booking),
        is_actionable=False,
    )


def notify_faculty_details_changed(booking):
    space_name = _resource_name(booking, "spaces")
    notify(
        booking.faculty_sponsor,
        Notification.Category.FACULTY_APPROVAL_REQ,
        "Booking Details Changed",
        f"The venue booking you approved for {space_name} has been changed. Please review and approve again.",
        link=f"/faculty-approvals?booking={_booking_reference(booking)}",
        domain="spaces",
        reference_code=_booking_reference(booking),
        is_actionable=True,
    )


def notify_incharge_escalated(booking, role_name):
    """
    Notify the relevant admins that a booking has been escalated from faculty to incharge.
    Uses scoped notify_space_approvers (most-specific-wins) since escalation is
    always spaces-domain.
    """
    student_name = getattr(booking.user, "first_name", "A student")
    space_name = _resource_name(booking, "spaces")
    notify_space_approvers(
        booking,
        role_name,
        Notification.Category.FACULTY_ESCALATED,
        "Booking Escalated",
        f"{student_name}'s booking for {space_name} was not approved by their faculty member within 24 hours and needs your attention.",
        link=_approver_link("spaces", _booking_reference(booking)),
        domain="spaces",
        reference_code=_booking_reference(booking),
        is_actionable=True,
    )


def notify_incharge_booking_returned(booking, role_name):
    space_name = _resource_name(booking, "spaces")
    notify_space_approvers(
        booking,
        role_name,
        Notification.Category.BOOKING_PENDING,
        "Booking Returned",
        f"A booking for {space_name} was edited and returned to faculty review.",
        link=_approver_link("spaces", _booking_reference(booking)),
        domain="spaces",
        reference_code=_booking_reference(booking),
        is_actionable=False,
    )


def notify_faculty_resent(booking):
    space_name = _resource_name(booking, "spaces")
    notify(
        booking.faculty_sponsor,
        Notification.Category.FACULTY_RESENT,
        "Faculty Resent",
        f"The department incharge has resent a booking for {space_name} for your approval.",
        link=f"/faculty-approvals?booking={_booking_reference(booking)}",
        domain="spaces",
        reference_code=_booking_reference(booking),
        is_actionable=True,
    )


def notify_student_cancelled_faculty(booking):
    student_name = getattr(booking.user, "first_name", "A student")
    space_name = _resource_name(booking, "spaces")
    notify(
        booking.faculty_sponsor,
        Notification.Category.BOOKING_CANCELLED,
        "Booking Cancelled",
        f"{student_name} cancelled their booking for {space_name}. No action needed.",
        link=None,
        email_override=False,
        domain="spaces",
        reference_code=_booking_reference(booking),
        is_actionable=False,
    )


# ==========================================
# CO-MANAGER ACTIONED NOTIFICATION
# ==========================================

def notify_comanagers_actioned(booking, domain, actioned_by, new_status):
    """
    Notifies all co-managers of a venue/domain that another admin has
    actioned a booking, so it doesn't silently vanish from their queue.
    Creates a non-actionable Recent Updates notification for each
    co-manager excluding the person who actioned it.

    For spaces: uses scoped resolution (most-specific-wins).
    For fleet/mess/media: notifies all users with the domain role.
    """
    reference = _booking_reference(booking)
    resource = _resource_name(booking, domain)
    time_str = _format_booking_time(booking, domain)
    time_context = f" scheduled for {time_str}" if time_str else ""
    link = _approver_link(domain, reference, tab='history')

    actioned_by_name = (
        f"{actioned_by.first_name} {actioned_by.last_name}".strip()
        or actioned_by.email
    )
    status_display = new_status.lower()

    title = f"Booking {new_status.title()} by {actioned_by_name}"
    message = (
        f"{actioned_by_name} {status_display} the booking for {resource}"
        f"{time_context}. No action needed."
    )

    if domain == 'spaces':
        # Resolve all co-managers for this space using most-specific-wins
        space = getattr(booking, 'space', None)
        if not space:
            return

        # Check chain-based spaces first
        chain = getattr(space, 'approver_chain', None)
        if chain:
            for approver in [chain.primary_approver, chain.fallback_approver]:
                if approver and approver.id != actioned_by.id:
                    notify(
                        approver,
                        Notification.Category.SYSTEM,
                        title,
                        message,
                        link=link,
                        email_override=False,
                        domain=domain,
                        reference_code=reference,
                        is_actionable=False,
                    )
            return

        # Standard scoped spaces
        approval_category = getattr(space, 'approval_category', None)
        from apps.spaces.models import Space as SpaceModel
        if approval_category == SpaceModel.ApprovalCategory.LAB:
            role_name = Role.Name.LAB_INCHARGE
        elif approval_category == SpaceModel.ApprovalCategory.LIBRARY:
            role_name = Role.Name.LIBRARIAN
        else:
            role_name = Role.Name.RECEPTIONIST

        recipients = resolve_space_approver_recipients(booking, role_name)
        for recipient in recipients:
            if recipient.id != actioned_by.id:
                notify(
                    recipient,
                    Notification.Category.SYSTEM,
                    title,
                    message,
                    link=link,
                    email_override=False,
                    domain=domain,
                    reference_code=reference,
                    is_actionable=False,
                )

    else:
        # Fleet, mess, media — notify all role holders except actioned_by
        role_map = {
            'fleet': Role.Name.FLEET_MANAGER,
            'mess': Role.Name.MESS_MANAGER,
            'media': Role.Name.MEDIA_INCHARGE,
        }
        role_name = role_map.get(domain)
        if not role_name:
            return

        now = timezone.now()
        base_ids = list(
            CustomUser.objects.filter(
                is_active=True,
                roles__name=role_name,
            ).values_list("id", flat=True)
        )
        override_ids = list(
            RoleOverride.objects.filter(
                role__name=role_name,
                user__is_active=True,
                is_active=True,
                revoked_at__isnull=True,
            )
            .filter(Q(valid_until__isnull=True) | Q(valid_until__gt=now))
            .values_list("user_id", flat=True)
        )
        recipients = CustomUser.objects.filter(
            id__in=set(base_ids) | set(override_ids)
        ).exclude(id=actioned_by.id).order_by("id")

        for recipient in recipients:
            notify(
                recipient,
                Notification.Category.SYSTEM,
                title,
                message,
                link=link,
                email_override=False,
                domain=domain,
                reference_code=reference,
                is_actionable=False,
            )


def notify_swap_event(swap_request, event):
    """
    Stub for future swap notifications.

    Will be implemented when the SwapRequest model exists. Expected event
    values: 'requested', 'accepted', 'declined', 'expired', 'cancelled'.
    """
    return None


def _resolve_booking_by_ref(reference_code, domain):
    """
    Looks up a booking by reference_code and domain.
    Returns the booking object or None if not found.
    Used internally to fetch the approval deadline for token generation
    and to provide booking data to email_builder.
    """
    if not reference_code or not domain:
        return None
    try:
        if domain in ('spaces', 'spaces_faculty'):
            from apps.spaces.models import SpaceBooking
            return (
                SpaceBooking.objects
                .filter(reference_code=reference_code)
                .select_related('space', 'space__block', 'user', 'user__department')
                .prefetch_related('requested_equipment__equipment')
                .first()
            )
        if domain == 'fleet':
            from apps.fleet.models import FleetBooking
            return (
                FleetBooking.objects
                .filter(reference_code=reference_code)
                .select_related('vehicle', 'user', 'user__department')
                .first()
            )
        if domain == 'mess':
            from apps.mess.models import MessBooking
            return (
                MessBooking.objects
                .filter(reference_code=reference_code)
                .select_related('user', 'user__department')
                .prefetch_related('daily_menus')
                .first()
            )
        if domain == 'media':
            from apps.media.models import MediaBooking
            return (
                MediaBooking.objects
                .filter(reference_code=reference_code)
                .select_related('space', 'user', 'user__department')
                .prefetch_related('equipment_requests__equipment', 'assigned_crew')
                .first()
            )
    except Exception:
        logger.exception('_resolve_booking_by_ref failed for %s/%s', domain, reference_code)
    return None



def _generate_approval_token(recipient, domain, booking_ref, expires_at):
    """
    Generates a one-click approval token, stores its SHA-256 hash in the DB,
    and returns the raw token string to embed in the email URL.
    Only called for actionable approver-facing notifications on non-media domains.
    Returns None if token creation fails for any reason.
    """
    from apps.notifications.models import ApprovalToken
    try:
        raw_token = secrets.token_urlsafe(32)
        token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
        ApprovalToken.objects.create(
            token_hash=token_hash,
            domain=domain,
            booking_ref=booking_ref,
            action=ApprovalToken.Action.APPROVE,
            issued_to=recipient,
            expires_at=expires_at,
        )
        return raw_token
    except Exception:
        logger.exception('Failed to generate approval token for %s/%s', domain, booking_ref)
        return None


# ==========================================
# CHAIN APPROVAL NOTIFICATIONS
# ==========================================

def notify_chain_approved_primary(booking):
    space_name = _resource_name(booking, 'spaces')
    
    # Notify the requester
    notify(
        booking.user,
        Notification.Category.BOOKING_APPROVED,
        "Booking Approved",
        f"Your venue booking for {space_name} was approved by the primary approver.",
        link=_requester_link('spaces', _booking_reference(booking)),
        domain='spaces',
        reference_code=_booking_reference(booking),
        is_actionable=False,
    )

    # Notify the fallback approver (e.g. Lab In-Charge)
    chain = getattr(booking.space, 'approver_chain', None)
    if chain and chain.fallback_approver:
        notify(
            chain.fallback_approver,
            Notification.Category.BOOKING_APPROVED,
            "Booking Approved",
            f"A venue booking for {space_name} was approved by the primary approver.",
            link=_approver_link('spaces', _booking_reference(booking), tab='history'),
            domain='spaces',
            reference_code=_booking_reference(booking),
            is_actionable=False,
        )

def notify_chain_rejected(booking):
    space_name = _resource_name(booking, 'spaces')
    remarks = getattr(booking, 'remarks_by_admin', '')
    msg = f"Your venue booking for {space_name} was rejected."
    if remarks:
        msg += f" Remarks: {remarks}"
    notify(
        booking.user,
        Notification.Category.BOOKING_REJECTED,
        "Booking Rejected",
        msg,
        link=_requester_link('spaces', _booking_reference(booking)),
        domain='spaces',
        reference_code=_booking_reference(booking),
        is_actionable=False,
    )

def notify_chain_escalated(booking):
    student_name = getattr(booking.user, 'first_name', 'A student')
    space_name = _resource_name(booking, 'spaces')
    chain = getattr(booking.space, 'approver_chain', None)
    if not chain or not chain.fallback_approver:
        return
    notify(
        chain.fallback_approver,
        Notification.Category.BOOKING_PENDING,
        "Booking Escalated",
        f"{student_name}'s booking for {space_name} was escalated to you as the fallback approver.",
        link=_approver_link('spaces', _booking_reference(booking)),
        domain='spaces',
        reference_code=_booking_reference(booking),
        is_actionable=True,
    )

def notify_chain_approved_fallback(booking):
    space_name = _resource_name(booking, 'spaces')
    notify(
        booking.user,
        Notification.Category.BOOKING_APPROVED,
        "Booking Approved",
        f"Your venue booking for {space_name} was approved by the fallback approver.",
        link=_requester_link('spaces', _booking_reference(booking)),
        domain='spaces',
        reference_code=_booking_reference(booking),
        is_actionable=False,
    )

def notify_chain_cancelled(booking):
    student_name = getattr(booking.user, 'first_name', 'A student')
    space_name = _resource_name(booking, 'spaces')
    chain = getattr(booking.space, 'approver_chain', None)
    if chain:
        for approver in [chain.primary_approver, chain.fallback_approver]:
            if approver:
                notify(
                    approver,
                    Notification.Category.BOOKING_CANCELLED,
                    "Booking Cancelled",
                    f"{student_name} cancelled their booking for {space_name}. No action needed.",
                    link=None,
                    domain='spaces',
                    reference_code=_booking_reference(booking),
                    is_actionable=False,
                )


def notify_crew_updated(booking):
    """
    Notify the requester that their assigned media team has been updated.
    """
    event_name = getattr(booking, "event_name", None) or "the event"
    reference = _booking_reference(booking)
    link = _requester_link('media', reference)

    return notify(
        booking.user,
        Notification.Category.SYSTEM,
        "Media Team Updated",
        f"Your assigned media team for {event_name} has been updated. Please check your booking for the latest crew details.",
        link=link,
        domain='media',
        reference_code=reference,
        is_actionable=False,
    )
