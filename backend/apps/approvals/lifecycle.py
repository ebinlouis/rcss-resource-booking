import datetime

from django.db.models import Q
from django.utils import timezone


PENDING = 'PENDING'
APPROVED = 'APPROVED'
EXPIRED = 'EXPIRED'
COMPLETED = 'COMPLETED'
AWAITING_FACULTY = 'AWAITING_FACULTY'
FACULTY_ESCALATED = 'FACULTY_ESCALATED'

MESS_MEAL_TIME_FIELDS = (
    'breakfast_time',
    'morning_tea_time',
    'lunch_time',
    'evening_tea_time',
    'dinner_time',
)


def _aware_datetime(value):
    if value is None:
        return None
    if timezone.is_naive(value):
        return timezone.make_aware(value, timezone.get_current_timezone())
    return value


def _combine_date_time(date_value, time_value):
    if not date_value or not time_value:
        return None
    return _aware_datetime(datetime.datetime.combine(date_value, time_value))


def _mess_meal_datetimes(booking):
    menus = getattr(booking, 'daily_menus', None)
    if menus is None:
        return []

    rows = menus.all() if hasattr(menus, 'all') else menus
    values = []
    for menu in rows:
        for field in MESS_MEAL_TIME_FIELDS:
            meal_time = getattr(menu, field, None)
            meal_dt = _combine_date_time(getattr(menu, 'date', None), meal_time)
            if meal_dt:
                values.append(meal_dt)
    return values


def _get_booking_domain(booking):
    """
    Infer the notification domain from the booking model class name.
    Used when dispatching expiry notifications without a request context.
    """
    name = booking.__class__.__name__
    if 'Space' in name: return 'spaces'
    if 'Fleet' in name: return 'fleet'
    if 'Mess'  in name: return 'mess'
    if 'Media' in name: return 'media'
    return 'spaces'


def get_approval_deadline(booking):
    """
    Last instant where approving still makes business sense.

    Pending requests expire when resource use would begin. Approved requests
    complete later, when the final reserved/service window ends.
    """
    if hasattr(booking, 'setup_start_datetime'):
        return _aware_datetime(booking.setup_start_datetime)
    if hasattr(booking, 'start_datetime'):
        return _aware_datetime(booking.start_datetime)
    if hasattr(booking, 'daily_menus'):
        meal_datetimes = _mess_meal_datetimes(booking)
        if meal_datetimes:
            return min(meal_datetimes)
        return _combine_date_time(getattr(booking, 'start_date', None), datetime.time.min)
    return None


def get_completion_deadline(booking):
    if hasattr(booking, 'teardown_end_datetime'):
        return _aware_datetime(booking.teardown_end_datetime)
    if hasattr(booking, 'end_datetime'):
        return _aware_datetime(booking.end_datetime)
    if hasattr(booking, 'daily_menus'):
        meal_datetimes = _mess_meal_datetimes(booking)
        if meal_datetimes:
            return max(meal_datetimes)
        return _combine_date_time(getattr(booking, 'end_date', None), datetime.time.max)
    return None


def is_past_approval_deadline(booking, now=None):
    deadline = get_approval_deadline(booking)
    return bool(deadline and (now or timezone.now()) >= deadline)


def is_past_completion_deadline(booking, now=None):
    deadline = get_completion_deadline(booking)
    return bool(deadline and (now or timezone.now()) >= deadline)


def can_user_modify_booking(booking, now=None):
    return (
        getattr(booking, 'status', None) in {PENDING, APPROVED, AWAITING_FACULTY, FACULTY_ESCALATED}
        and not is_past_approval_deadline(booking, now)
    )


def refresh_booking_lifecycle(booking, now=None, save=True):
    """
    Idempotently transition due bookings.

    Returns True when the booking status changed. The caller can then decide
    whether to return an error, refresh serialization, or keep processing.
    """
    now = now or timezone.now()
    current_status = getattr(booking, 'status', None)
    next_status = None
    update_fields = ['status', 'updated_at']

    if current_status == APPROVED and is_past_completion_deadline(booking, now):
        next_status = COMPLETED
    elif current_status in {PENDING, AWAITING_FACULTY, FACULTY_ESCALATED} and is_past_approval_deadline(booking, now):
        next_status = EXPIRED
        booking.resolved_at = now
        update_fields.append('resolved_at')

    if not next_status:
        return False

    booking.status = next_status
    if save:
        booking.save(update_fields=update_fields)

    if next_status == EXPIRED:
        # Import locally to avoid circular dependencies with models
        from apps.notifications.utils import notify_booking_status_change
        notify_booking_status_change(
            booking=booking,
            new_status='EXPIRED',
            domain=_get_booking_domain(booking),
            resolved_by=None,
            remarks=(
                "This request automatically expired because its scheduled "
                "start time passed before it could be approved."
            ),
        )

    return True


def refresh_queryset_lifecycle(queryset):
    """
    Idempotently transitions all bookings in *queryset* that have crossed
    their lifecycle deadline.

    DB-level optimisation: rather than loading every PENDING/APPROVED row
    into Python and checking timestamps there, we build a Q filter that
    mirrors the exact deadline logic and let the database discard the vast
    majority of rows before they ever leave PostgreSQL.

    Field-name detection is done once per call by inspecting the model's
    meta so this function stays generic across all booking domains (spaces,
    fleet, mess, media).  Mess meal-time bookings fall back to the
    unfiltered approach because their deadline is computed from a related
    manager, which cannot be expressed as a simple DB filter.
    """
    now = timezone.now()
    changed = 0

    model = queryset.model
    field_names = {f.name for f in model._meta.get_fields()}

    # ── Build expiry filter (PENDING / AWAITING_FACULTY / FACULTY_ESCALATED) ──
    # A booking in one of these statuses expires when its approval deadline
    # (setup_start_datetime or start_datetime) has passed.
    expiry_statuses = [PENDING, AWAITING_FACULTY, FACULTY_ESCALATED]

    if 'setup_start_datetime' in field_names:
        expiry_q = Q(status__in=expiry_statuses, setup_start_datetime__lte=now)
    elif 'start_datetime' in field_names:
        expiry_q = Q(status__in=expiry_statuses, start_datetime__lte=now)
    else:
        # Mess or unknown domain — deadline lives in a related manager;
        # fall back to loading all candidate rows and checking in Python.
        expiry_q = Q(status__in=expiry_statuses)

    # ── Build completion filter (APPROVED) ────────────────────────────────────
    # An APPROVED booking completes when its completion deadline
    # (teardown_end_datetime or end_datetime) has passed.
    if 'teardown_end_datetime' in field_names:
        completion_q = Q(status=APPROVED, teardown_end_datetime__lte=now)
    elif 'end_datetime' in field_names:
        completion_q = Q(status=APPROVED, end_datetime__lte=now)
    else:
        completion_q = Q(status=APPROVED)

    candidates = queryset.filter(expiry_q | completion_q)

    for booking in candidates:
        if refresh_booking_lifecycle(booking, now=now):
            changed += 1

    return changed