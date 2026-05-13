from django.db import transaction
from django.utils import timezone
from django.utils.dateparse import parse_date
from django.db.models import Sum, Q
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import ValidationError
from rest_framework.views import APIView

from apps.media.models import MediaBooking, MediaEquipmentRequest, MediaSettings
from apps.spaces.models import Equipment
from apps.users.models import RoleOverride
from apps.media.serializers import MediaBookingSerializer, MediaSettingsSerializer

# ── Role resolution ───────────────────────────────────────────────────────────

MEDIA_ROLE = 'media'

def _normalize(role):
    return (role or "").strip().lower()

def _get_effective_role(user):
    now = timezone.now()
    active_override = RoleOverride.objects.filter(
        user=user,
        is_active=True,
    ).filter(
        Q(expires_at__isnull=True) | Q(expires_at__gt=now)
    ).first()

    if active_override:
        return active_override.overridden_role.name
    if getattr(user, 'role', None):
        return user.role.name
    if user.groups.exists():
        return user.groups.first().name
    return ""

def _is_media_admin(user):
    return _normalize(_get_effective_role(user)) == MEDIA_ROLE

def _overlapping_team_bookings(booking_date, start_time, end_time, exclude_pk=None):
    qs = MediaBooking.objects.filter(
        booking_date=booking_date,
        status='APPROVED',
        is_team_request=True,
        setup_start_time__lt=end_time,
        teardown_end_time__gt=start_time,
    )
    if exclude_pk:
        qs = qs.exclude(pk=exclude_pk)
    return qs

def _team_capacity_available(booking, settings):
    overlapping_count = _overlapping_team_bookings(
        booking.booking_date,
        booking.setup_start_time,
        booking.teardown_end_time,
        exclude_pk=booking.pk,
    ).count()
    return overlapping_count < settings.max_concurrent_events

def _reserve_standard_team_kit(booking):
    # DYNAMIC INVENTORY AUTO-ASSIGNMENT: Pull all gear flagged as part of the standard media kit
    standard_gear = Equipment.objects.filter(
        is_active=True, 
        is_portable=True, 
        is_standard_media_kit=True
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

def _check_equipment_availability_for_approval(booking):
    overlapping_bookings = MediaBooking.objects.filter(
        booking_date=booking.booking_date,
        status='APPROVED',
        setup_start_time__lt=booking.teardown_end_time,
        teardown_end_time__gt=booking.setup_start_time,
    ).exclude(pk=booking.pk)

    used_map = {
        item['equipment_id']: item['total_used']
        for item in MediaEquipmentRequest.objects.filter(
            media_booking__in=overlapping_bookings
        ).values('equipment_id').annotate(total_used=Sum('quantity'))
    }

    # FIX: Always pull the actual requested equipment for this booking.
    # Since gear is now assigned on Creation, this respects Admin loadout edits!
    needed_gear = [
        {'eq': r.equipment, 'qty': r.quantity}
        for r in booking.equipment_requests.select_related('equipment')
    ]

    for item in needed_gear:
        eq, needed_qty = item['eq'], item['qty']
        available_qty  = max(0, eq.total_owned - used_map.get(eq.id, 0))
        if available_qty < needed_qty:
            return False, (
                f"Not enough {eq.name}. "
                f"Need {needed_qty}, but only {available_qty} available for this time block."
            )

    return True, ""


# ── Settings View ─────────────────────────────────────────────────────────────

class MediaSettingsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        settings = MediaSettings.load()
        return Response(MediaSettingsSerializer(settings).data)

    def patch(self, request):
        if not _is_media_admin(request.user):
            return Response(
                {"detail": "Only the Media administrator can change team settings."},
                status=status.HTTP_403_FORBIDDEN,
            )
        settings   = MediaSettings.load()
        serializer = MediaSettingsSerializer(settings, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


# ── ViewSet ───────────────────────────────────────────────────────────────────

class MediaBookingViewSet(viewsets.ModelViewSet):
    serializer_class   = MediaBookingSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user       = self.request.user
        view_param = self.request.query_params.get('view', 'mine')
        is_admin   = _is_media_admin(user)

        qs = MediaBooking.objects.select_related(
            'space', 'user', 'department'
        ).prefetch_related('equipment_requests__equipment')

        if self.action in ['review', 'update_loadout', 'retrieve', 'partial_update', 'update'] and is_admin:
            return qs

        VIEW_MAP = {
            'pending':     (lambda: qs.filter(status='PENDING').order_by('-created_at'),           is_admin),
            'active':      (lambda: qs.filter(status='APPROVED').order_by('booking_date', 'setup_start_time'), is_admin),
            'resolved_by_me': (lambda: qs.filter(resolved_by=user).order_by('-resolved_at'),       is_admin),
        }

        if view_param in VIEW_MAP:
            query_fn, requires_admin = VIEW_MAP[view_param]
            return query_fn() if (not requires_admin or is_admin) else qs.none()

        if view_param == 'general':
            return (
                qs.order_by('-created_at') if is_admin
                else qs.filter(user=user).exclude(status='REJECTED').order_by('booking_date', 'setup_start_time')
            )

        return qs.filter(user=user).order_by('-created_at')

    @transaction.atomic
    def perform_create(self, serializer):
        user = self.request.user
        if not getattr(user, 'department', None):
            raise ValidationError({
                "non_field_errors": (
                    "Your user profile is not assigned to a department. "
                    "Please contact an administrator before booking."
                )
            })
        booking = serializer.save(user=user, department=user.department)
        
        # INSTANT AUTO-ASSIGN: Attach kit while still pending
        if booking.is_team_request:
            _reserve_standard_team_kit(booking)

    @transaction.atomic
    def perform_update(self, serializer):
        instance = self.get_object()
        user = self.request.user
        
        was_team_request = instance.is_team_request
        booking = serializer.save()
        
        # Auto-assign if they switched modes from Equipment to Team
        if booking.is_team_request and not was_team_request:
            _reserve_standard_team_kit(booking)

        # Revert on Edit
        if instance.status == 'APPROVED' and not _is_media_admin(user):
            booking.status = 'PENDING'
            booking.remarks_by_admin = ''
            booking.save(update_fields=['status', 'remarks_by_admin'])

    # ── /check_availability/ ─────────────────────────────────────────────────
    @action(detail=False, methods=['get'])
    def check_availability(self, request):
        booking_date = request.query_params.get('date')
        req_start    = request.query_params.get('start')
        req_end      = request.query_params.get('end')
        exclude_id   = request.query_params.get('exclude')

        if not all([booking_date, req_start, req_end]):
            return Response(
                {"error": "date, start, and end parameters are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        overlapping = MediaBooking.objects.filter(
            booking_date=booking_date,
            setup_start_time__lt=req_end,
            teardown_end_time__gt=req_start,
        ).exclude(status__in=['REJECTED', 'CANCELLED']).prefetch_related('equipment_requests')

        # Prevent self-blocking when editing
        if exclude_id and exclude_id not in ['null', 'undefined', '']:
            overlapping = overlapping.exclude(pk=exclude_id)

        # Sweepline Algorithm for precise inventory concurrency
        eq_time_points = {}
        for b in overlapping:
            s_str = max(b.setup_start_time.strftime("%H:%M:%S"), req_start)
            e_str = min(b.teardown_end_time.strftime("%H:%M:%S"), req_end)
            
            if s_str >= e_str:
                continue

            for req in b.equipment_requests.all():
                eq_id = req.equipment_id
                eq_time_points.setdefault(eq_id, []).extend([
                    (s_str, req.quantity),   # Item checked out
                    (e_str, -req.quantity)   # Item returned
                ])

        used_map = {}
        for eq_id, points in eq_time_points.items():
            points.sort(key=lambda x: (x[0], x[1]))
            current_used = max_used = 0
            for _, delta in points:
                current_used += delta
                if current_used > max_used:
                    max_used = current_used
            used_map[eq_id] = max_used

        availability = [
            {
                "id":                  eq.id,
                "name":                eq.name,
                "category":            eq.category,
                "total_owned":         eq.total_owned,
                "currently_available": max(0, eq.total_owned - used_map.get(eq.id, 0)),
            }
            for eq in Equipment.objects.filter(is_active=True, is_portable=True)
        ]

        return Response(availability)

    # ── /daily_availability/ ─────────────────────────────────────────────────
    @action(detail=False, methods=['get'])
    def daily_availability(self, request):
        date_param   = request.query_params.get('date')
        view_type    = request.query_params.get('type', 'equipment')
        booking_date = parse_date(date_param) if date_param else timezone.localdate()

        if not booking_date:
            return Response({"error": "Invalid date. Expected YYYY-MM-DD."}, status=status.HTTP_400_BAD_REQUEST)

        settings = MediaSettings.load()

        if view_type == 'team':
            approved_team = MediaBooking.objects.filter(
                booking_date=booking_date, status='APPROVED', is_team_request=True,
            ).order_by('setup_start_time')

            slots       = []
            time_points = []

            for b in approved_team:
                s = b.setup_start_time.strftime("%H:%M")
                e = b.teardown_end_time.strftime("%H:%M")
                slots.append({"start_time": s, "end_time": e, "event_name": b.event_name})
                time_points += [(s, 1), (e, -1)]

            time_points.sort(key=lambda x: (x[0], x[1]))

            current_used, busy_start = 0, None
            fully_booked_periods     = []

            for t_str, delta in time_points:
                was_full      = current_used >= settings.max_concurrent_events
                current_used += delta
                is_full       = current_used >= settings.max_concurrent_events

                if is_full and not was_full:
                    busy_start = t_str
                elif was_full and not is_full and busy_start and busy_start != t_str:
                    fully_booked_periods.append({"start": busy_start, "end": t_str})
                    busy_start = None

            return Response({
                "date":                  booking_date.isoformat(),
                "type":                  "team",
                "max_capacity":          settings.max_concurrent_events,
                "booked_slots":          sorted(slots, key=lambda x: x['start_time']),
                "fully_booked_periods":  fully_booked_periods,
            })

        if view_type != 'equipment':
            return Response({"error": "Invalid type. Expected equipment or team."}, status=status.HTTP_400_BAD_REQUEST)

        approved = MediaBooking.objects.filter(
            booking_date=booking_date, status='APPROVED',
        ).prefetch_related('equipment_requests')

        eq_slots = {}
        for b in approved:
            for req in b.equipment_requests.all():
                eq_slots.setdefault(req.equipment_id, []).append({
                    "start_time": b.setup_start_time.strftime("%H:%M"),
                    "end_time":   b.teardown_end_time.strftime("%H:%M"),
                    "quantity":   req.quantity,
                    "event_name": b.event_name,
                })

        availability = []
        for item in Equipment.objects.filter(is_active=True, is_portable=True).order_by('category', 'name'):
            slots       = eq_slots.get(item.id, [])
            time_points = []
            for s in slots:
                time_points += [(s['start_time'], s['quantity']), (s['end_time'], -s['quantity'])]
            time_points.sort(key=lambda x: (x[0], x[1]))

            current_used = max_used = 0
            for _, delta in time_points:
                current_used += delta
                max_used      = max(max_used, current_used)

            availability.append({
                "id":                 item.id,
                "name":               item.name,
                "category":           item.category,
                "category_display":   item.get_category_display(),
                "total_owned":        item.total_owned,
                "booked_quantity":    max_used,
                "available_quantity": max(0, item.total_owned - max_used),
                "booked_slots":       sorted(slots, key=lambda x: x['start_time']),
            })

        return Response({"date": booking_date.isoformat(), "type": "equipment", "items": availability})

    # ── /runsheet/ ────────────────────────────────────────────────────────────
    @action(detail=False, methods=['get'])
    def runsheet(self, request):
        date_param   = request.query_params.get('date')
        booking_date = parse_date(date_param) if date_param else timezone.localdate()

        if not booking_date:
            return Response({"error": "Invalid date. Expected YYYY-MM-DD."}, status=status.HTTP_400_BAD_REQUEST)

        bookings = MediaBooking.objects.filter(
            booking_date=booking_date, status='APPROVED', is_team_request=True,
        ).select_related('space', 'user', 'department').prefetch_related(
            'equipment_requests__equipment'
        ).order_by('event_start_time')

        return Response(self.get_serializer(bookings, many=True).data)

    # ── /<id>/update_loadout/ ─────────────────────────────────────────────────
    @action(detail=True, methods=['patch'], url_path='update_loadout')
    @transaction.atomic
    def update_loadout(self, request, pk=None):
        if not _is_media_admin(request.user):
            return Response(
                {"detail": "Only the Media administrator can update loadouts."},
                status=status.HTTP_403_FORBIDDEN,
            )

        booking = self.get_object()

        if booking.status != 'APPROVED':
            return Response({"error": "Loadout can only be edited on APPROVED bookings."}, status=status.HTTP_400_BAD_REQUEST)
        if not booking.is_team_request:
            return Response({"error": "Loadout editing is only available for team-request bookings."}, status=status.HTTP_400_BAD_REQUEST)

        equipment_data = request.data.get('equipment_requests')
        if not isinstance(equipment_data, list):
            return Response({"error": "'equipment_requests' must be a list."}, status=status.HTTP_400_BAD_REQUEST)

        resolved_items = []
        seen_ids       = set()

        for idx, item in enumerate(equipment_data):
            eq_id    = item.get('equipment')
            quantity = item.get('quantity', 1)
            row      = idx + 1

            if not eq_id:
                return Response({"error": f"Row {row}: 'equipment' field is required."}, status=status.HTTP_400_BAD_REQUEST)
            if not isinstance(quantity, int) or quantity < 1:
                return Response({"error": f"Row {row}: 'quantity' must be a positive integer."}, status=status.HTTP_400_BAD_REQUEST)
            if eq_id in seen_ids:
                return Response({"error": f"Row {row}: Duplicate equipment id {eq_id}. Merge into one row."}, status=status.HTTP_400_BAD_REQUEST)
            seen_ids.add(eq_id)

            try:
                equipment = Equipment.objects.get(pk=eq_id, is_active=True, is_portable=True)
            except Equipment.DoesNotExist:
                return Response({"error": f"Row {row}: Equipment id {eq_id} not found or not available."}, status=status.HTTP_400_BAD_REQUEST)

            resolved_items.append({'equipment': equipment, 'quantity': quantity})

        used_map = {
            row['equipment_id']: row['total_used']
            for row in MediaEquipmentRequest.objects.filter(
                media_booking__in=MediaBooking.objects.filter(
                    booking_date=booking.booking_date,
                    status='APPROVED',
                    setup_start_time__lt=booking.teardown_end_time,
                    teardown_end_time__gt=booking.setup_start_time,
                ).exclude(pk=booking.pk)
            ).values('equipment_id').annotate(total_used=Sum('quantity'))
        }

        for item in resolved_items:
            eq        = item['equipment']
            needed    = item['quantity']
            available = max(0, eq.total_owned - used_map.get(eq.id, 0))
            if needed > available:
                return Response(
                    {"error": f"Cannot allocate {needed}x {eq.name}. Only {available} available during this event's time block."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        booking.equipment_requests.all().delete()
        for item in resolved_items:
            MediaEquipmentRequest.objects.create(
                media_booking=booking,
                equipment=item['equipment'],
                quantity=item['quantity'],
            )

        booking.updated_by = request.user
        booking.save(update_fields=['updated_by', 'updated_at'])
        return Response(self.get_serializer(booking).data)

    # ── /<id>/review/ ─────────────────────────────────────────────────────────
    @action(detail=True, methods=['patch'])
    @transaction.atomic
    def review(self, request, pk=None):
        if not _is_media_admin(request.user):
            return Response(
                {"detail": "Only the Media administrator can review requests."},
                status=status.HTTP_403_FORBIDDEN,
            )

        booking    = self.get_object()
        new_status = request.data.get('status')
        remarks    = request.data.get('remarks_by_admin', '')

        if new_status not in ['APPROVED', 'REJECTED']:
            return Response({"error": "Invalid status. Must be APPROVED or REJECTED."}, status=status.HTTP_400_BAD_REQUEST)
        if new_status == 'REJECTED' and not remarks.strip():
            return Response({"error": "Remarks are required when rejecting a booking."}, status=status.HTTP_400_BAD_REQUEST)

        settings = MediaSettings.load()
        if new_status == 'APPROVED':
            # Fallback for legacy pending requests to ensure they have gear before checking
            if booking.is_team_request:
                _reserve_standard_team_kit(booking)

            if booking.is_team_request and not _team_capacity_available(booking, settings):
                return Response({"error": "Media team capacity is full for this event time."}, status=status.HTTP_400_BAD_REQUEST)
            
            is_avail, error_msg = _check_equipment_availability_for_approval(booking)
            if not is_avail:
                return Response({"error": error_msg}, status=status.HTTP_400_BAD_REQUEST)

        booking.status           = new_status
        booking.remarks_by_admin = remarks
        booking.resolved_by      = request.user
        booking.resolved_at      = timezone.now()
        booking.save()

        return Response(self.get_serializer(booking).data)

    # ── /my-bookings/ ─────────────────────────────────────────────────────────
    @action(detail=False, methods=['get'], url_path='my-bookings')
    def my_bookings(self, request):
        bookings = MediaBooking.objects.filter(user=request.user).order_by('-created_at')
        return Response(self.get_serializer(bookings, many=True).data)