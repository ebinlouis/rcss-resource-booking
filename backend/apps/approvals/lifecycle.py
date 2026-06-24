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

    Returns True when the booking status changed or a notification side-effect
    (e.g. chain escalation) was applied. The caller can then decide whether to
    return an error, refresh serialization, or keep processing.
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
    elif current_status == AWAITING_FACULTY and getattr(booking, 'faculty_response_deadline', None) and booking.faculty_response_deadline < now:
        next_status = FACULTY_ESCALATED
        booking.faculty_timed_out = True
        update_fields.append('faculty_timed_out')

    # ── HOD_FALLBACK chain escalation ─────────────────────────────────────────
    # Checked alongside (not instead of) the status-change branches above.
    # Does NOT alter booking.status -- the fallback approver is merely notified;
    # the booking stays PENDING until someone acts.
    #
    # Note: _uses_hod_fallback_workflow lives in apps.approvals.views, which
    # already imports this module, so we cannot import it here without creating
    # a circular dependency.  The equivalent one-liner is used inline inside the
    # local-import block where Space is already available.
    chain_escalation_fired = False
    if (
        current_status == PENDING
        and getattr(booking, 'chain_escalated_at', None) is None
        and not is_past_approval_deadline(booking, now)
    ):
        try:
            chain = booking.space.approver_chain
        except Exception:
            chain = None
        if chain is not None:
            from apps.spaces.models import Space
            if (
                booking.space.approval_workflow_type == Space.ApprovalWorkflowType.HOD_FALLBACK
                and now - booking.created_at >= datetime.timedelta(hours=chain.escalation_hours)
            ):
                from apps.notifications.utils import notify_chain_escalated
                notify_chain_escalated(booking)
                booking.chain_escalated_at = now
                update_fields.append('chain_escalated_at')
                chain_escalation_fired = True

    if not next_status and not chain_escalation_fired:
        return False

    if next_status:
        booking.status = next_status
    else:
        # Pure side-effect save: only chain_escalated_at (+ updated_at) changed;
        # do not write a no-op status column update.
        update_fields.remove('status')

    if save:
        booking.save(update_fields=update_fields)

    if next_status == EXPIRED:
        # Import locally to avoid circular dependencies with models
        from apps.notifications.utils import (
            notify_booking_status_change,
            mark_pending_request_notifications_read,
            notify_incharge_expired,
        )
        
        domain = _get_booking_domain(booking)
        
        # Clear the actionable notification for approvers since the booking is now expired
        mark_pending_request_notifications_read(booking, domain=domain)
        
        # Send a new non-actionable standard notification to the admins
        notify_incharge_expired(booking, domain=domain)

        notify_booking_status_change(
            booking=booking,
            new_status='EXPIRED',
            domain=domain,
            resolved_by=None,
            remarks=(
                "This request automatically expired because its scheduled "
                "start time passed before it could be approved."
            ),
        )
    elif next_status == FACULTY_ESCALATED:
        domain = _get_booking_domain(booking)
        
        from apps.notifications.utils import mark_pending_request_notifications_read
        mark_pending_request_notifications_read(booking, domain=domain)
        
        if domain == 'spaces':
            from apps.notifications.utils import notify_incharge_escalated
            from apps.spaces.models import Space
            from apps.users.models import Role
            
            category = booking.space.approval_category
            if category == Space.ApprovalCategory.LAB:
                role = Role.Name.LAB_INCHARGE
            elif category == Space.ApprovalCategory.LIBRARY:
                role = Role.Name.LIBRARIAN
            else:
                role = Role.Name.RECEPTIONIST
                
            notify_incharge_escalated(booking, role)

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

    # ── Build faculty-escalation filter (AWAITING_FACULTY) ──────────────────
    # A spaces booking with a faculty sponsor escalates if they don't respond
    # within 24 hours of booking creation.
    if 'faculty_response_deadline' in field_names:
        escalation_q = Q(status=AWAITING_FACULTY, faculty_response_deadline__lt=now)
    else:
        escalation_q = Q(pk__in=[])

    # ── Build chain-escalation filter (HOD_FALLBACK PENDING bookings) ────────
    # Surfaces PENDING bookings whose HOD_FALLBACK chain has not yet been
    # notified.  The precise time comparison (created_at + escalation_hours)
    # is deferred to Python inside refresh_booking_lifecycle because
    # escalation_hours lives on a related model row and can't be folded into a
    # simple DB filter without a subquery; fetching a slightly broader set here
    # and discarding early in Python is safe and consistent with how the
    # faculty-escalation fallback above works.
    if 'chain_escalated_at' in field_names:
        chain_escalation_q = Q(
            status=PENDING,
            chain_escalated_at__isnull=True,
            space__approval_workflow_type='HOD_FALLBACK',
            space__approver_chain__isnull=False,
        )
    else:
        chain_escalation_q = Q(pk__in=[])

    candidates = queryset.filter(
        expiry_q | completion_q | escalation_q | chain_escalation_q
    )

    for booking in candidates:
        if refresh_booking_lifecycle(booking, now=now):
            changed += 1

    return changed