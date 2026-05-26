"""
apps/media/services.py

All pure business logic for the media booking domain.
Views and serializers import from here — never the other way around.
"""
import datetime
from django.db.models import Sum
from django.utils import timezone

from apps.media.models import MediaBooking, MediaEquipmentRequest
from apps.spaces.models import Equipment
from apps.users.models import CustomUser, Role


# ==========================================
# ROLE HELPERS
# ==========================================

def is_media_admin(user) -> bool:
    return (
        user.is_superuser or
        Role.Name.MEDIA_INCHARGE in user.get_effective_roles()
    )


def get_all_media_crew():
    """
    Returns all active CustomUsers who hold the MEDIA_INCHARGE role.
    This is the authoritative list for crew assignment and availability checks.
    """
    return CustomUser.objects.filter(
        is_active=True,
        roles__name=Role.Name.MEDIA_INCHARGE,
    ).distinct()


# ==========================================
# CREW AVAILABILITY
# ==========================================

def get_busy_crew_ids(setup_start, teardown_end, exclude_booking_pk=None):
    """
    Returns a set of CustomUser PKs who are already assigned to at least one
    APPROVED booking whose window overlaps [setup_start, teardown_end].

    A crew member is considered "busy" for the entire duration of a booking
    they are assigned to — setup_start through teardown_end.
    """
    overlapping_qs = MediaBooking.objects.filter(
        status='APPROVED',
        setup_start_datetime__lt=teardown_end,
        teardown_end_datetime__gt=setup_start,
    )
    if exclude_booking_pk:
        overlapping_qs = overlapping_qs.exclude(pk=exclude_booking_pk)

    busy_ids = set(
        overlapping_qs
        .values_list('assigned_crew__id', flat=True)
        .exclude(assigned_crew__isnull=True)
    )
    return busy_ids


def get_crew_availability(setup_start, teardown_end, exclude_booking_pk=None):
    """
    Returns all MEDIA_INCHARGE users annotated with their availability
    for the given time window.

    Return shape per member:
        {
            'id': int,
            'name': str,
            'email': str,
            'phone': str,
            'designation': str,
            'is_busy': bool,
            'busy_bookings': [   # only populated when is_busy=True
                {
                    'reference_code': str,
                    'event_name': str,
                    'setup_start_datetime': str (ISO),
                    'teardown_end_datetime': str (ISO),
                }
            ]
        }
    """
    all_crew = get_all_media_crew().select_related('department')
    busy_ids = get_busy_crew_ids(setup_start, teardown_end, exclude_booking_pk)

    # Fetch the actual overlapping bookings for richer warning detail
    overlapping_qs = MediaBooking.objects.filter(
        status='APPROVED',
        setup_start_datetime__lt=teardown_end,
        teardown_end_datetime__gt=setup_start,
    ).prefetch_related('assigned_crew')
    if exclude_booking_pk:
        overlapping_qs = overlapping_qs.exclude(pk=exclude_booking_pk)

    # Map crew_id → list of conflicting bookings for the warning display
    crew_conflicts: dict[int, list] = {}
    for booking in overlapping_qs:
        for member in booking.assigned_crew.all():
            crew_conflicts.setdefault(member.pk, []).append({
                'reference_code': booking.reference_code,
                'event_name': booking.event_name,
                'setup_start_datetime': booking.setup_start_datetime.isoformat(),
                'teardown_end_datetime': booking.teardown_end_datetime.isoformat(),
            })

    result = []
    for member in all_crew:
        full_name = ' '.join(
            part for part in [
                member.first_name,
                getattr(member, 'middle_name', None),
                member.last_name,
            ]
            if part
        ).strip()
        is_busy = member.pk in busy_ids
        result.append({
            'id': member.pk,
            'name': full_name or str(member),
            'email': member.email,
            'phone': member.phone,
            'designation': member.designation,
            'employee_student_id': member.employee_student_id,
            'is_busy': is_busy,
            'busy_bookings': crew_conflicts.get(member.pk, []) if is_busy else [],
        })

    return result


def count_free_crew(setup_start, teardown_end, exclude_booking_pk=None) -> int:
    """
    Returns the number of MEDIA_INCHARGE users who are NOT assigned to any
    overlapping approved booking in the given window.

    This is the submission gate check — if this returns 0 the user is blocked.
    """
    all_crew_ids = set(get_all_media_crew().values_list('id', flat=True))
    busy_ids = get_busy_crew_ids(setup_start, teardown_end, exclude_booking_pk)
    return len(all_crew_ids - busy_ids)


def crew_available_for_today() -> int:
    """
    Returns the number of free crew members for today (full calendar day).
    Used by the media landing page.
    """
    today = timezone.localdate()
    day_start = timezone.make_aware(datetime.datetime.combine(today, datetime.time.min))
    day_end   = timezone.make_aware(datetime.datetime.combine(today, datetime.time.max))
    return count_free_crew(day_start, day_end)


# ==========================================
# EQUIPMENT HELPERS
# ==========================================

def reserve_standard_team_kit(booking):
    """
    Auto-assigns 1 unit of every active, portable, standard-kit equipment
    item to the given team-request booking.
    Idempotent — safe to call multiple times.
    """
    standard_gear = Equipment.objects.filter(
        is_active=True,
        is_portable=True,
        is_standard_media_kit=True,
    )
    for gear in standard_gear:
        request, created = MediaEquipmentRequest.objects.get_or_create(
            media_booking=booking,
            equipment=gear,
            defaults={'quantity': 1},
        )
        if not created and request.quantity < 1:
            request.quantity = 1
            request.save(update_fields=['quantity'])


def check_equipment_availability_for_approval(booking) -> tuple[bool, str]:
    """
    Checks that all equipment on the booking is still available against
    other APPROVED bookings in the same time window.

    Returns (True, "") on success, (False, error_message) on conflict.
    """
    overlapping_bookings = MediaBooking.objects.filter(
        status='APPROVED',
        setup_start_datetime__lt=booking.teardown_end_datetime,
        teardown_end_datetime__gt=booking.setup_start_datetime,
    ).exclude(pk=booking.pk)

    used_map = {
        item['equipment_id']: item['total_used']
        for item in MediaEquipmentRequest.objects.filter(
            media_booking__in=overlapping_bookings
        ).values('equipment_id').annotate(total_used=Sum('quantity'))
    }

    for req in booking.equipment_requests.select_related('equipment'):
        eq           = req.equipment
        available    = max(0, eq.total_owned - used_map.get(eq.id, 0))
        if available < req.quantity:
            return False, (
                f"Not enough {eq.name}. "
                f"Need {req.quantity}, but only {available} available for this time block."
            )

    return True, ""


def get_equipment_used_map_for_booking(booking) -> dict:
    """
    Returns a {equipment_id: total_used} map for equipment already committed
    by other APPROVED bookings overlapping with the given booking's window.
    Used by update_loadout to validate new quantities.
    """
    overlapping = MediaBooking.objects.filter(
        status='APPROVED',
        setup_start_datetime__lt=booking.teardown_end_datetime,
        teardown_end_datetime__gt=booking.setup_start_datetime,
    ).exclude(pk=booking.pk)

    return {
        row['equipment_id']: row['total_used']
        for row in MediaEquipmentRequest.objects.filter(
            media_booking__in=overlapping
        ).values('equipment_id').annotate(total_used=Sum('quantity'))
    }


# ==========================================
# DAILY AVAILABILITY HELPERS
# ==========================================

def get_daily_team_availability(booking_date):
    """
    Returns a structured summary of crew availability for a given date.

    Shape:
        {
            'date': str,
            'total_crew': int,
            'free_crew': int,
            'booked_slots': [ { event_name, start, end, assigned_crew_count } ],
        }
    """
    day_start = timezone.make_aware(datetime.datetime.combine(booking_date, datetime.time.min))
    day_end   = timezone.make_aware(datetime.datetime.combine(booking_date, datetime.time.max))

    total_crew = get_all_media_crew().count()
    free_crew  = count_free_crew(day_start, day_end)

    approved_bookings = MediaBooking.objects.filter(
        status='APPROVED',
        is_team_request=True,
        setup_start_datetime__lt=day_end,
        teardown_end_datetime__gt=day_start,
    ).prefetch_related('assigned_crew').select_related('space').order_by('setup_start_datetime')

    slots = []
    for b in approved_bookings:
        s_local = timezone.localtime(max(b.setup_start_datetime, day_start))
        e_local = timezone.localtime(min(b.teardown_end_datetime, day_end))
        actual_start = timezone.localtime(b.setup_start_datetime)
        actual_end   = timezone.localtime(b.teardown_end_datetime)
        slots.append({
            'event_name':          b.event_name,
            'reference_code':      b.reference_code,
            'start_time':          s_local.strftime('%H:%M'),
            'end_time':            '23:59' if e_local >= timezone.localtime(day_end) else e_local.strftime('%H:%M'),
            'actual_start':        actual_start.isoformat(),
            'actual_end':          actual_end.isoformat(),
            'is_multiday':         actual_start.date() != actual_end.date(),
            'assigned_crew_count': b.assigned_crew.count(),
            'location':            b.space.name if b.space else b.custom_location,
        })

    return {
        'date':        booking_date.isoformat(),
        'total_crew':  total_crew,
        'free_crew':   free_crew,
        'booked_slots': slots,
    }