from django.db.models import Q
from django.utils import timezone

from apps.notifications.models import Notification
from apps.users.models import CustomUser, Role, RoleOverride


def notify(
    recipient,
    category,
    title,
    message,
    link=None,
    send_email=False,
    domain='',
    reference_code='',
    is_actionable=False,
):
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
        domain    = domain or '',
        reference_code = reference_code or '',
        is_actionable = is_actionable,
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


def notify_approvers(
    role_name,
    category,
    title,
    message,
    link=None,
    domain='',
    reference_code='',
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


def _resource_name(booking, domain=''):
    domain = (domain or '').lower()

    if domain == 'media':
        return (
            getattr(booking, 'event_name', None)
            or getattr(getattr(booking, 'space', None), 'name', None)
            or 'media request'
        )

    if domain == 'mess':
        return (
            getattr(booking, 'purpose_of_programme', None)
            or getattr(booking, 'delivery_location', None)
            or 'mess request'
        )

    if domain == 'fleet':
        vehicle = getattr(booking, 'vehicle', None)
        if vehicle:
            return getattr(vehicle, 'name', None) or str(vehicle)
        return 'fleet request'

    space = getattr(booking, 'space', None)
    if space:
        return getattr(space, 'name', None) or str(space)

    vehicle = getattr(booking, 'vehicle', None)
    if vehicle:
        return getattr(vehicle, 'name', None) or str(vehicle)

    return (
        getattr(booking, 'event_name', None)
        or getattr(booking, 'purpose_of_programme', None)
        or getattr(booking, 'delivery_location', None)
        or 'requested resource'
    )


def _booking_reference(booking):
    return getattr(booking, 'reference_code', 'Booking')


def mark_pending_request_notifications_read(booking, domain=''):
    reference = _booking_reference(booking)
    queryset = Notification.objects.filter(
        category=Notification.Category.BOOKING_PENDING,
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
        'spaces': f"/bookings/{reference}",
        'media':  f"/media/my-bookings?booking={reference}",
        'mess':   f"/mess?booking={reference}",
        'fleet':  f"/transport?booking={reference}",
    }
    return links.get(domain, f"/bookings/{reference}")


def _approver_link(domain, reference, tab='pending'):
    if tab == 'history':
        tab = {
            'spaces': 'history',
            'media': 'active',
            'mess': 'history',
            'fleet': 'active',
        }.get(domain, 'history')

    links = {
        'spaces': f"/admin?tab={tab}&booking={reference}",
        'media':  f"/admin/media?tab={tab}&booking={reference}",
        'mess':   f"/admin/mess?tab={tab}&booking={reference}",
        'fleet':  f"/admin/transport?tab={tab}&booking={reference}",
    }
    return links.get(domain, f"/admin?tab={tab}&booking={reference}")


def _resolver_title(resolved_by, domain):
    # When triggered by an automated lifecycle transition (e.g. expiry),
    # resolved_by will be None — fall back to "the system".
    if not resolved_by:
        return 'the system'

    effective_roles = resolved_by.get_effective_roles()
    roles = Role.objects.filter(name__in=effective_roles).order_by('name')

    domain_roles = {
        'spaces': [
            Role.Name.PRINCIPAL,
            Role.Name.RECEPTIONIST,
            Role.Name.LAB_INCHARGE,
            Role.Name.LIBRARIAN,
            Role.Name.HOD,
            Role.Name.IT_ADMIN,
        ],
        'fleet':  [Role.Name.FLEET_MANAGER, Role.Name.IT_ADMIN],
        'mess':   [Role.Name.MESS_MANAGER, Role.Name.IT_ADMIN],
        'media':  [Role.Name.MEDIA_INCHARGE, Role.Name.IT_ADMIN],
    }

    role_map = {role.name: role for role in roles}
    for role_name in domain_roles.get(domain, []):
        role = role_map.get(role_name)
        if role:
            return role.get_name_display()

    role = roles.first()
    return role.get_name_display() if role else 'an approver'


def _format_datetime_range(start_dt, end_dt):
    start_dt = timezone.localtime(start_dt)
    end_dt   = timezone.localtime(end_dt)

    if start_dt.date() == end_dt.date():
        date_str = start_dt.strftime('%b %d, %Y')
        time_str = f"{start_dt.strftime('%I:%M %p')} - {end_dt.strftime('%I:%M %p')}"
        return f"{date_str} ({time_str})"

    start_str = start_dt.strftime('%b %d, %Y %I:%M %p')
    end_str   = end_dt.strftime('%b %d, %Y %I:%M %p')
    return f"{start_str} to {end_str}"


def _mess_first_meal_time(booking):
    relation = getattr(booking, 'daily_menus', None)
    if not relation:
        return None

    try:
        menus = relation.all()
    except AttributeError:
        menus = relation

    meal_fields = [
        'breakfast_time',
        'morning_tea_time',
        'lunch_time',
        'evening_tea_time',
        'dinner_time',
    ]
    times = []
    for menu in menus:
        menu_date = getattr(menu, 'date', None)
        for field in meal_fields:
            meal_time = getattr(menu, field, None)
            if menu_date and meal_time:
                times.append((menu_date, meal_time))

    if not times:
        return None

    return min(times, key=lambda item: (item[0], item[1]))[1]


def _format_short_date(date_value):
    if not date_value:
        return ''
    return f"{date_value.day} {date_value.strftime('%b')}"


def _format_short_date_range(start_date, end_date):
    if not start_date:
        return ''
    end_date = end_date or start_date
    if start_date == end_date:
        return _format_short_date(start_date)
    return f"{_format_short_date(start_date)} - {_format_short_date(end_date)}"


def _format_time_value(time_value):
    if not time_value:
        return ''
    return time_value.strftime('%I:%M %p').lstrip('0')


def _format_mess_date_range(booking):
    start_date = getattr(booking, 'start_date', None)
    end_date = getattr(booking, 'end_date', None) or start_date
    return _format_short_date_range(start_date, end_date)


def _format_media_date_range(booking):
    setup_start = getattr(booking, 'setup_start_datetime', None)
    teardown_end = getattr(booking, 'teardown_end_datetime', None)
    event_start = getattr(booking, 'event_start_datetime', None)

    if setup_start and teardown_end:
        setup_date = timezone.localtime(setup_start).date()
        teardown_date = timezone.localtime(teardown_end).date()
        if setup_date != teardown_date:
            return _format_short_date_range(setup_date, teardown_date)

    display_dt = event_start or setup_start or teardown_end
    if display_dt:
        return _format_short_date(timezone.localtime(display_dt).date())
    return ''


def _format_booking_time(booking, domain=''):
    """
    Extracts and nicely formats the date and time from any type of booking.
    """
    domain = (domain or '').lower()

    if domain == 'media':
        start_dt = (
            getattr(booking, 'event_start_datetime', None)
            or getattr(booking, 'setup_start_datetime', None)
        )
        end_dt = (
            getattr(booking, 'event_end_datetime', None)
            or getattr(booking, 'teardown_end_datetime', None)
        )
        if start_dt and end_dt:
            return _format_datetime_range(start_dt, end_dt)

    if domain == 'mess':
        start_date = getattr(booking, 'start_date', None)
        end_date = getattr(booking, 'end_date', None) or start_date
        if start_date:
            if end_date and end_date != start_date:
                date_str = f"{start_date.strftime('%b %d, %Y')} to {end_date.strftime('%b %d, %Y')}"
            else:
                date_str = start_date.strftime('%b %d, %Y')

            first_meal = _mess_first_meal_time(booking)
            if first_meal:
                return f"{date_str} (first meal {first_meal.strftime('%I:%M %p')})"
            return date_str

    # 1. Try to get Datetime objects (Spaces, Fleet)
    start_dt = getattr(booking, 'start_datetime', None)
    end_dt   = getattr(booking, 'end_datetime', None)

    # 2. Try to get Date/Time objects (Mess, Media)
    b_date = getattr(booking, 'booking_date', getattr(booking, 'start_date', None))
    s_time = getattr(booking, 'start_time', None)
    e_time = getattr(booking, 'end_time', None)

    if start_dt and end_dt:
        return _format_datetime_range(start_dt, end_dt)

    elif b_date:
        date_str = b_date.strftime('%b %d, %Y')
        if s_time and e_time:
            time_str = f"{s_time.strftime('%I:%M %p')} - {e_time.strftime('%I:%M %p')}"
            return f"{date_str} ({time_str})"
        elif s_time:
            return f"{date_str} ({s_time.strftime('%I:%M %p')})"
        else:
            return date_str

    return ""


def notify_booking_status_change(booking, new_status, domain, resolved_by, remarks=None):
    """
    Notify the requester that their booking status changed.

    EXPIRED changes are triggered by the lifecycle engine with resolved_by=None.
    """
    status_value = str(new_status or '').upper()
    reference    = _booking_reference(booking)
    resource     = _resource_name(booking, domain)
    resolver     = _resolver_title(resolved_by, domain)
    link         = _requester_link(domain, reference)

    category_map = {
        'APPROVED':  Notification.Category.BOOKING_APPROVED,
        'REJECTED':  Notification.Category.BOOKING_REJECTED,
        'CANCELLED': Notification.Category.BOOKING_CANCELLED,
        'EXPIRED':   Notification.Category.SYSTEM,
    }

    category = category_map.get(status_value)
    if not category:
        return None

    status_display = status_value.lower()

    if domain == 'mess':
        date_range = _format_mess_date_range(booking)
        date_context = f" for {date_range}" if date_range else ""
        title = f"Catering Request {status_value.title()}"
        message = f"Your catering request{date_context} was {status_display} by {resolver}."
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

    if domain == 'media':
        event_name = getattr(booking, 'event_name', None) or 'the event'
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

    title          = f"{resource} booking {status_display}"

    # Generate the schedule string
    time_str     = _format_booking_time(booking, domain)
    time_context = f" scheduled for {time_str}" if time_str else ""

    message = f"Your booking for {resource}{time_context} was {status_display} by {resolver}."
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
    status_value = str(new_status or '').upper()
    reference    = _booking_reference(base_booking)
    resource     = _resource_name(base_booking, domain)
    resolver     = _resolver_title(resolved_by, domain)
    link         = _requester_link(domain, reference)

    category_map = {
        'APPROVED':  Notification.Category.BOOKING_APPROVED,
        'REJECTED':  Notification.Category.BOOKING_REJECTED,
        'CANCELLED': Notification.Category.BOOKING_CANCELLED,
        'EXPIRED':   Notification.Category.SYSTEM,
    }

    category = category_map.get(status_value)
    if not category:
        return None

    status_display = status_value.lower()
    title          = f"{resource} request {status_display}"
    count          = len(bookings)

    if count > 1:
        # Summarise the series rather than listing every date
        time_context = f" (series of {count} scheduled dates)"
    else:
        time_str     = _format_booking_time(base_booking, domain)
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
    """
    resource  = _resource_name(booking, domain)
    reference = _booking_reference(booking)
    link      = _approver_link(domain, reference)
    requester = getattr(booking.user, 'first_name', None) or 'A user'

    title   = f"{domain.capitalize()} Booking Updated"
    message = f"{requester} updated their approved booking for {resource}. Please review the changes."

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
    """
    resource  = _resource_name(booking, domain)
    reference = _booking_reference(booking)
    link      = _approver_link(domain, reference)
    requester = getattr(booking.user, 'first_name', None) or 'A user'

    title   = f"{domain.capitalize()} Booking Cancelled"
    message = f"{requester} cancelled their booking for {resource}."

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
    """
    resource  = _resource_name(booking, domain)
    reference = _booking_reference(booking)
    link      = _approver_link(domain, reference)

    time_str     = _format_booking_time(booking, domain)
    time_context = f" scheduled for {time_str}" if time_str else ""

    requester = getattr(booking.user, 'first_name', None) or 'A user'

    title   = f"New {domain} request"
    message = f"{requester} requested {resource}{time_context}. It requires your approval."

    if domain == 'mess':
        date_range = _format_mess_date_range(booking)
        first_meal = _mess_first_meal_time(booking)
        title = "New Catering Request"
        if date_range and first_meal:
            message = f"{requester} requested catering for {date_range}, first meal at {_format_time_value(first_meal)}."
        elif date_range:
            message = f"{requester} requested catering for {date_range}."
        else:
            message = f"{requester} submitted a new catering request."

    elif domain == 'media':
        event_name = getattr(booking, 'event_name', None) or 'the event'
        date_range = _format_media_date_range(booking)
        request_label = "Media team request" if getattr(booking, 'is_team_request', False) else "Equipment request"
        title = "New Media Request"
        if date_range:
            message = f"{requester} — {request_label} for {event_name} on {date_range}."
        else:
            message = f"{requester} — {request_label} for {event_name}."

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


# ==========================================
# FACULTY APPROVAL NOTIFICATIONS
# ==========================================

def notify_faculty_new_request(booking):
    student_name = getattr(booking.user, 'first_name', 'A student')
    space_name = _resource_name(booking, 'spaces')
    date_str = _format_short_date(getattr(booking, 'start_datetime', None))
    notify(
        booking.faculty_sponsor,
        Notification.Category.FACULTY_APPROVAL_REQ,
        "Faculty Approval Required",
        f"{student_name} is requesting your approval to book {space_name} on {date_str}.",
        link=f"/faculty-approvals?booking={_booking_reference(booking)}",
        domain='spaces',
        reference_code=_booking_reference(booking),
        is_actionable=True,
    )

def notify_faculty_approved(booking):
    space_name = _resource_name(booking, 'spaces')
    faculty_name = getattr(booking.faculty_sponsor, 'first_name', 'Your faculty sponsor')
    notify(
        booking.user,
        Notification.Category.FACULTY_APPROVED,
        "Faculty Approved",
        f"Your booking for {space_name} was approved by {faculty_name} and sent to the next approver.",
        link=_requester_link('spaces', _booking_reference(booking)),
        domain='spaces',
        reference_code=_booking_reference(booking),
        is_actionable=False,
    )

def notify_faculty_rejected(booking):
    space_name = _resource_name(booking, 'spaces')
    faculty_name = getattr(booking.faculty_sponsor, 'first_name', 'Your faculty sponsor')
    remarks = getattr(booking, 'remarks_by_admin', '')
    msg = f"{faculty_name} did not approve your booking for {space_name}."
    if remarks:
        msg += f" Remarks: {remarks}"
    notify(
        booking.user,
        Notification.Category.FACULTY_REJECTED,
        "Faculty Rejected",
        msg,
        link=_requester_link('spaces', _booking_reference(booking)),
        domain='spaces',
        reference_code=_booking_reference(booking),
        is_actionable=False,
    )

def notify_faculty_details_changed(booking):
    space_name = _resource_name(booking, 'spaces')
    notify(
        booking.faculty_sponsor,
        Notification.Category.FACULTY_APPROVAL_REQ,
        "Booking Details Changed",
        f"The booking you approved for {space_name} has been changed. Please review and approve again.",
        link=f"/faculty-approvals?booking={_booking_reference(booking)}",
        domain='spaces',
        reference_code=_booking_reference(booking),
        is_actionable=True,
    )

def notify_incharge_escalated(booking, role_name):
    student_name = getattr(booking.user, 'first_name', 'A student')
    space_name = _resource_name(booking, 'spaces')
    notify_approvers(
        role_name,
        Notification.Category.FACULTY_ESCALATED,
        "Booking Escalated",
        f"{student_name}'s booking for {space_name} was not approved by their faculty member within 24 hours and needs your attention.",
        link=_approver_link('spaces', _booking_reference(booking)),
        domain='spaces',
        reference_code=_booking_reference(booking),
        is_actionable=True,
    )

def notify_incharge_booking_returned(booking, role_name):
    space_name = _resource_name(booking, 'spaces')
    notify_approvers(
        role_name,
        Notification.Category.BOOKING_PENDING,
        "Booking Returned",
        f"A booking for {space_name} was edited and returned to faculty review.",
        link=_approver_link('spaces', _booking_reference(booking)),
        domain='spaces',
        reference_code=_booking_reference(booking),
        is_actionable=False,
    )

def notify_faculty_resent(booking):
    space_name = _resource_name(booking, 'spaces')
    notify(
        booking.faculty_sponsor,
        Notification.Category.FACULTY_RESENT,
        "Faculty Resent",
        f"The department incharge has resent a booking for {space_name} for your approval.",
        link=f"/faculty-approvals?booking={_booking_reference(booking)}",
        domain='spaces',
        reference_code=_booking_reference(booking),
        is_actionable=True,
    )

def notify_student_cancelled_faculty(booking):
    student_name = getattr(booking.user, 'first_name', 'A student')
    space_name = _resource_name(booking, 'spaces')
    notify(
        booking.faculty_sponsor,
        Notification.Category.BOOKING_CANCELLED,
        "Booking Cancelled",
        f"{student_name} cancelled their booking for {space_name}. No action needed.",
        link=None,
        domain='spaces',
        reference_code=_booking_reference(booking),
        is_actionable=False,
    )


def notify_swap_event(swap_request, event):
    """
    Stub for future swap notifications.

    Will be implemented when the SwapRequest model exists. Expected event
    values: 'requested', 'accepted', 'declined', 'expired', 'cancelled'.
    """
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
        f"Your booking for {space_name} was approved by the primary approver.",
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
            f"A booking for {space_name} was approved by the primary approver.",
            link=_approver_link('spaces', _booking_reference(booking), tab='history'),
            domain='spaces',
            reference_code=_booking_reference(booking),
            is_actionable=False,
        )

def notify_chain_rejected(booking):
    space_name = _resource_name(booking, 'spaces')
    remarks = getattr(booking, 'remarks_by_admin', '')
    msg = f"Your booking for {space_name} was rejected."
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
        f"Your booking for {space_name} was approved by the fallback approver.",
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