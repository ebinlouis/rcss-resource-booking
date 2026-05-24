from datetime import timedelta
from django.utils import timezone


def get_buffered_range(space, start_dt, end_dt):
    """
    Expand a booking's raw start/end times by the space's setup and
    teardown buffers. Returns (effective_start, effective_end).

    The booking record always stores the clean user-facing times.
    Conflict detection uses the buffered range so that back-to-back
    bookings respect the space's cleaning/setup needs.

    Example:
        Space has setup_buffer_minutes=30, teardown_buffer_minutes=30.
        User books 10:00–13:00.
        Effective blocked range: 09:30–13:30.
        A new booking for 13:00–15:00 would conflict (13:00 < 13:30).
    """
    effective_start = start_dt - timedelta(minutes=space.setup_buffer_minutes)
    effective_end   = end_dt   + timedelta(minutes=space.teardown_buffer_minutes)
    return effective_start, effective_end


def get_overlapping_bookings(space, start_dt, end_dt, exclude_pk=None):
    """
    Return a queryset of APPROVED SpaceBookings that conflict with the
    given (start_dt, end_dt) range for the given space, taking the
    space's setup/teardown buffers into account.

    Args:
        space:       Space instance (needs setup/teardown buffer fields).
        start_dt:    Proposed booking start (timezone-aware datetime).
        end_dt:      Proposed booking end   (timezone-aware datetime).
        exclude_pk:  Optional booking PK to exclude (for edit flows).

    Returns:
        QuerySet of conflicting SpaceBooking instances, ordered by
        start_datetime. Empty queryset means no conflicts.

    How the overlap test works:
        An existing booking [A_start, A_end] conflicts with proposed
        [B_start, B_end] when A_start < B_end AND A_end > B_start
        (standard interval overlap). We apply the same test but
        expand the existing booking's range by its space's buffers
        so that cleanup/setup time is protected.

        Concretely, for the existing booking we check:
            (A_start - setup_buffer) < B_end
            AND
            (A_end + teardown_buffer) > B_start

        Which translates to:
            start_datetime__lt = end_dt   + teardown_buffer  (A_start < B_end + buffer)
            end_datetime__gt   = start_dt - setup_buffer     (A_end   > B_start - buffer)

        This is equivalent to checking whether the proposed slot
        falls within the existing booking's effective blocked range.
    """
    # Import here to avoid circular imports at module level
    from .models import SpaceBooking

    setup_delta    = timedelta(minutes=space.setup_buffer_minutes)
    teardown_delta = timedelta(minutes=space.teardown_buffer_minutes)

    qs = SpaceBooking.objects.filter(
        space=space,
        status__in=['PENDING', 'APPROVED', 'AWAITING_FACULTY', 'FACULTY_ESCALATED'],
        # Existing booking's effective start (A_start - setup) < proposed end
        start_datetime__lt=end_dt + teardown_delta,
        # Existing booking's effective end (A_end + teardown) > proposed start
        end_datetime__gt=start_dt - setup_delta,
    ).select_related('user', 'space').order_by('start_datetime')

    if exclude_pk:
        qs = qs.exclude(pk=exclude_pk)

    return qs


def build_conflict_report(overlapping_qs, requesting_user=None):
    """
    Convert a queryset of overlapping bookings into a structured list
    suitable for returning to the frontend.

    Each conflict entry contains:
        - date:      ISO date string (YYYY-MM-DD) of the booking's start
        - start:     HH:MM of the booking's start time
        - end:       HH:MM of the booking's end time
        - label:     Human-readable purpose, role-gated (Occupied for others)
        - reference_code: e.g. SPC-XXXX (shown to staff/admin only)

    Role gating mirrors the serializer's get_purpose_of_booking logic:
        - Staff/superuser → sees real purpose + reference_code
        - Faculty group   → sees real purpose, no reference_code
        - Booking owner   → sees their own purpose
        - Everyone else   → sees "Occupied"

    Args:
        overlapping_qs:   QuerySet from get_overlapping_bookings().
        requesting_user:  The User making the request (can be None).

    Returns:
        List of dicts, one per conflicting booking.
    """
    conflicts = []

    is_staff = requesting_user and (
        requesting_user.is_staff or requesting_user.is_superuser
    )
    is_faculty = requesting_user and (
        not is_staff and
        requesting_user.groups.filter(name='Faculty').exists()
    )

    for booking in overlapping_qs:
        label = booking.purpose_of_booking or "Occupied"
        ref = booking.reference_code if (is_staff or (requesting_user and booking.user_id == requesting_user.pk)) else None

        # Convert to local-aware strings for the frontend
        start_local = booking.start_datetime.astimezone()
        end_local   = booking.end_datetime.astimezone()

        entry = {
            "date":  start_local.strftime("%Y-%m-%d"),
            "start": start_local.strftime("%H:%M"),
            "end":   end_local.strftime("%H:%M"),
            "label": label,
        }
        if ref:
            entry["reference_code"] = ref

        conflicts.append(entry)

    return conflicts
