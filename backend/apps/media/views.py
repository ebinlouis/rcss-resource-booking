import datetime
from django.db import transaction
from django.utils import timezone
from django.utils.dateparse import parse_date, parse_datetime
from django.db.models import Sum
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import ValidationError
from rest_framework.views import APIView

from apps.approvals.lifecycle import (
    can_user_modify_booking,
    refresh_booking_lifecycle,
    refresh_queryset_lifecycle,
)
from apps.media.models import MediaBooking, MediaEquipmentRequest, MediaSettings
from apps.spaces.models import Equipment
from apps.users.models import Role
from apps.media.serializers import MediaBookingSerializer, MediaSettingsSerializer
from apps.notifications.utils import mark_pending_request_notifications_read, notify_booking_status_change, notify_new_request


# --- Role resolution ---

def _is_media_admin(user):
    return (
        user.is_superuser or
        Role.Name.MEDIA_INCHARGE in user.get_effective_roles()
    )


# --- Helpers ---

def _overlapping_team_bookings(start_dt, end_dt, exclude_pk=None):
    qs = MediaBooking.objects.filter(
        status='APPROVED',
        is_team_request=True,
        setup_start_datetime__lt=end_dt,
        teardown_end_datetime__gt=start_dt,
    )
    if exclude_pk:
        qs = qs.exclude(pk=exclude_pk)
    return qs

def _team_capacity_available(booking, settings):
    overlapping_count = _overlapping_team_bookings(
        booking.setup_start_datetime,
        booking.teardown_end_datetime,
        exclude_pk=booking.pk,
    ).count()
    return overlapping_count < settings.max_concurrent_events

def _reserve_standard_team_kit(booking):
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


# --- Views ---

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


class MediaBookingViewSet(viewsets.ModelViewSet):
    serializer_class   = MediaBookingSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user       = self.request.user
        view_param = self.request.query_params.get('view', 'mine')
        is_admin   = _is_media_admin(user)
        refresh_queryset_lifecycle(MediaBooking.objects.all())

        qs = MediaBooking.objects.select_related(
            'space', 'user', 'department'
        ).prefetch_related('equipment_requests__equipment')

        if self.action in ['review', 'update_loadout', 'retrieve', 'partial_update', 'update'] and is_admin:
            return qs

        VIEW_MAP = {
            'pending':        (lambda: qs.filter(status='PENDING').order_by('-created_at'),            is_admin),
            'active':         (lambda: qs.filter(status='APPROVED').order_by('setup_start_datetime'),  is_admin),
            'resolved_by_me': (lambda: qs.filter(resolved_by=user).order_by('-resolved_at'),           is_admin),
        }

        if view_param in VIEW_MAP:
            query_fn, requires_admin = VIEW_MAP[view_param]
            return query_fn() if (not requires_admin or is_admin) else qs.none()

        if view_param == 'general':
            return (
                qs.order_by('-created_at') if is_admin
                else qs.filter(user=user).exclude(status='REJECTED').order_by('setup_start_datetime')
            )

        return qs.filter(user=user).order_by('-created_at')

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.is_team_request:
            if hasattr(request.data, 'copy'):
                mutable_data = request.data.copy()
            else:
                mutable_data = dict(request.data)
            mutable_data.pop('equipment_requests', None)
            partial    = kwargs.pop('partial', False)
            serializer = self.get_serializer(instance, data=mutable_data, partial=partial)
            serializer.is_valid(raise_exception=True)
            self.perform_update(serializer)
            if getattr(instance, '_prefetched_objects_cache', None):
                instance._prefetched_objects_cache = {}
            return Response(serializer.data)
        return super().update(request, *args, **kwargs)

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
        if booking.is_team_request:
            _reserve_standard_team_kit(booking)

        # Notify the media admin of the new request
        notify_new_request(
            booking=booking,
            domain='media',
            role_name=Role.Name.MEDIA_INCHARGE
        )

    @transaction.atomic
    def perform_update(self, serializer):
        instance         = self.get_object()
        user             = self.request.user
        was_team_request = instance.is_team_request
        was_approved     = instance.status == 'APPROVED'   # capture before save

        booking          = serializer.save()

        if booking.is_team_request and not was_team_request:
            _reserve_standard_team_kit(booking)

        if was_approved and not _is_media_admin(user):
            booking.status           = 'PENDING'
            booking.resolved_by      = None
            booking.resolved_at      = None
            booking.remarks_by_admin = ''
            booking.updated_by       = user
            booking.save(update_fields=[
                'status',
                'resolved_by',
                'resolved_at',
                'remarks_by_admin',
                'updated_by',
                'updated_at',
            ])

            # Notify the media admin that an approved booking was edited and needs re-review
            notify_new_request(
                booking=booking,
                domain='media',
                role_name=Role.Name.MEDIA_INCHARGE
            )

    def perform_destroy(self, instance):
        refresh_booking_lifecycle(instance)
        if not can_user_modify_booking(instance):
            raise ValidationError({"detail": "Cannot cancel a media request whose setup time has already passed."})
        instance.delete()

    @action(detail=False, methods=['get'])
    def check_availability(self, request):
        refresh_queryset_lifecycle(MediaBooking.objects.all())
        req_start_str = request.query_params.get('start')
        req_end_str   = request.query_params.get('end')
        exclude_id    = request.query_params.get('exclude')

        if not all([req_start_str, req_end_str]):
            return Response(
                {"error": "start and end parameters are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        req_start = parse_datetime(req_start_str)
        req_end   = parse_datetime(req_end_str)

        if not req_start or not req_end:
            return Response({"error": "Invalid datetime format."}, status=status.HTTP_400_BAD_REQUEST)

        overlapping = MediaBooking.objects.filter(
            setup_start_datetime__lt=req_end,
            teardown_end_datetime__gt=req_start,
        ).exclude(status__in=['REJECTED', 'CANCELLED', 'EXPIRED', 'COMPLETED']).prefetch_related('equipment_requests')

        if exclude_id and exclude_id not in ['null', 'undefined', '']:
            overlapping = overlapping.exclude(pk=exclude_id)

        eq_time_points = {}
        req_start_ts   = req_start.timestamp()
        req_end_ts     = req_end.timestamp()

        for b in overlapping:
            s_ts = max(b.setup_start_datetime.timestamp(), req_start_ts)
            e_ts = min(b.teardown_end_datetime.timestamp(), req_end_ts)
            if s_ts >= e_ts:
                continue
            for req in b.equipment_requests.all():
                eq_id = req.equipment_id
                eq_time_points.setdefault(eq_id, []).extend([
                    (s_ts,  req.quantity),
                    (e_ts, -req.quantity),
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
                "id":                    eq.id,
                "name":                  eq.name,
                "category":              eq.category,
                "total_owned":           eq.total_owned,
                "currently_available":   max(0, eq.total_owned - used_map.get(eq.id, 0)),
                "is_standard_media_kit": eq.is_standard_media_kit,
            }
            for eq in Equipment.objects.filter(is_active=True, is_portable=True)
        ]
        return Response(availability)

    @action(detail=False, methods=['get'])
    def daily_availability(self, request):
        refresh_queryset_lifecycle(MediaBooking.objects.all())
        date_param   = request.query_params.get('date')
        view_type    = request.query_params.get('type', 'equipment')
        booking_date = parse_date(date_param) if date_param else timezone.localdate()

        if not booking_date:
            return Response({"error": "Invalid date. Expected YYYY-MM-DD."}, status=status.HTTP_400_BAD_REQUEST)

        day_start = timezone.make_aware(datetime.datetime.combine(booking_date, datetime.time.min))
        day_end   = timezone.make_aware(datetime.datetime.combine(booking_date, datetime.time.max))
        settings  = MediaSettings.load()

        if view_type == 'team':
            approved_team = MediaBooking.objects.filter(
                status='APPROVED', is_team_request=True,
                setup_start_datetime__lt=day_end,
                teardown_end_datetime__gt=day_start,
            ).order_by('setup_start_datetime')

            slots       = []
            time_points = []

            for b in approved_team:
                s_clamp = max(b.setup_start_datetime, day_start)
                e_clamp = min(b.teardown_end_datetime, day_end)
                s_local = timezone.localtime(s_clamp)
                e_local = timezone.localtime(e_clamp)
                s_str   = s_local.strftime("%H:%M")
                e_str   = "23:59" if e_clamp >= day_end else e_local.strftime("%H:%M")
                slots.append({"start_time": s_str, "end_time": e_str, "event_name": b.event_name})
                time_points += [(s_str, 1), (e_str, -1)]

            time_points.sort(key=lambda x: (x[0], x[1]))
            current_used = busy_start = 0
            fully_booked_periods = []

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
                "date":                 booking_date.isoformat(),
                "type":                 "team",
                "max_capacity":         settings.max_concurrent_events,
                "booked_slots":         sorted(slots, key=lambda x: x['start_time']),
                "fully_booked_periods": fully_booked_periods,
            })

        if view_type != 'equipment':
            return Response({"error": "Invalid type. Expected equipment or team."}, status=status.HTTP_400_BAD_REQUEST)

        approved = MediaBooking.objects.filter(
            status='APPROVED',
            setup_start_datetime__lt=day_end,
            teardown_end_datetime__gt=day_start,
        ).prefetch_related('equipment_requests')

        eq_slots = {}
        for b in approved:
            s_clamp = max(b.setup_start_datetime, day_start)
            e_clamp = min(b.teardown_end_datetime, day_end)
            s_local = timezone.localtime(s_clamp)
            e_local = timezone.localtime(e_clamp)
            s_str   = s_local.strftime("%H:%M")
            e_str   = "23:59" if e_clamp >= day_end else e_local.strftime("%H:%M")
            for req in b.equipment_requests.all():
                eq_slots.setdefault(req.equipment_id, []).append({
                    "start_time": s_str,
                    "end_time":   e_str,
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
                "id":                    item.id,
                "name":                  item.name,
                "category":              item.category,
                "category_display":      item.get_category_display(),
                "total_owned":           item.total_owned,
                "booked_quantity":       max_used,
                "available_quantity":    max(0, item.total_owned - max_used),
                "booked_slots":          sorted(slots, key=lambda x: x['start_time']),
                "is_standard_media_kit": item.is_standard_media_kit,
            })

        return Response({"date": booking_date.isoformat(), "type": "equipment", "items": availability})

    @action(detail=False, methods=['get'])
    def runsheet(self, request):
        refresh_queryset_lifecycle(MediaBooking.objects.all())
        date_param   = request.query_params.get('date')
        booking_date = parse_date(date_param) if date_param else timezone.localdate()
        if not booking_date:
            return Response({"error": "Invalid date. Expected YYYY-MM-DD."}, status=status.HTTP_400_BAD_REQUEST)
        day_start = timezone.make_aware(datetime.datetime.combine(booking_date, datetime.time.min))
        day_end   = timezone.make_aware(datetime.datetime.combine(booking_date, datetime.time.max))
        bookings  = MediaBooking.objects.filter(
            status='APPROVED', is_team_request=True,
            setup_start_datetime__lt=day_end,
            teardown_end_datetime__gt=day_start,
        ).select_related('space', 'user', 'department').prefetch_related(
            'equipment_requests__equipment'
        ).order_by('event_start_datetime')
        return Response(self.get_serializer(bookings, many=True).data)

    @action(detail=True, methods=['patch'], url_path='update_loadout')
    @transaction.atomic
    def update_loadout(self, request, pk=None):
        if not _is_media_admin(request.user):
            return Response(
                {"detail": "Only the Media administrator can update loadouts."},
                status=status.HTTP_403_FORBIDDEN,
            )
        booking = self.get_object()
        refresh_booking_lifecycle(booking)
        booking.refresh_from_db()
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
                return Response({"error": f"Row {row}: Duplicate equipment id {eq_id}."}, status=status.HTTP_400_BAD_REQUEST)
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
                    status='APPROVED',
                    setup_start_datetime__lt=booking.teardown_end_datetime,
                    teardown_end_datetime__gt=booking.setup_start_datetime,
                ).exclude(pk=booking.pk)
            ).values('equipment_id').annotate(total_used=Sum('quantity'))
        }

        for item in resolved_items:
            eq        = item['equipment']
            needed    = item['quantity']
            available = max(0, eq.total_owned - used_map.get(eq.id, 0))
            if needed > available:
                return Response(
                    {"error": f"Cannot allocate {needed}x {eq.name}. Only {available} available."},
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
        refresh_booking_lifecycle(booking)
        booking.refresh_from_db()

        if new_status not in ['APPROVED', 'REJECTED']:
            return Response({"error": "Invalid status. Must be APPROVED or REJECTED."}, status=status.HTTP_400_BAD_REQUEST)
        if new_status == 'REJECTED' and not remarks.strip():
            return Response({"error": "Remarks are required when rejecting a booking."}, status=status.HTTP_400_BAD_REQUEST)

        if new_status == 'APPROVED' and booking.status != 'PENDING':
            return Response(
                {"error": f"Cannot approve a booking that is currently {booking.status}."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if new_status == 'REJECTED' and booking.status not in ['PENDING', 'APPROVED']:
            return Response(
                {"error": f"Cannot reject or cancel a booking that is currently {booking.status}."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        settings = MediaSettings.load()
        if new_status == 'APPROVED':
            if booking.is_team_request and not booking.equipment_requests.exists():
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
        mark_pending_request_notifications_read(booking)

        # Notify the requester of the status change
        notify_booking_status_change(
            booking=booking,
            new_status=new_status,
            domain='media',
            resolved_by=request.user,
            remarks=remarks
        )

        return Response(self.get_serializer(booking).data)

    @action(detail=False, methods=['get'], url_path='my-bookings')
    def my_bookings(self, request):
        refresh_queryset_lifecycle(MediaBooking.objects.filter(user=request.user))
        bookings = MediaBooking.objects.filter(user=request.user).order_by('-created_at')
        return Response(self.get_serializer(bookings, many=True).data)
