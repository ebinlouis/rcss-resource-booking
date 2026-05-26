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
from apps.media.serializers import MediaBookingSerializer, MediaSettingsSerializer
from apps.media.services import (
    is_media_admin,
    get_all_media_crew,
    get_crew_availability,
    get_busy_crew_ids,
    count_free_crew,
    crew_available_for_today,
    reserve_standard_team_kit,
    check_equipment_availability_for_approval,
    get_equipment_used_map_for_booking,
    get_daily_team_availability,
)
from apps.spaces.models import Equipment
from apps.users.models import Role
from apps.notifications.utils import (
    mark_pending_request_notifications_read,
    notify_booking_status_change,
    notify_new_request,
    notify_crew_updated,
    notify_incharge_booking_edited,
    notify_incharge_cancelled,
)


# ==========================================
# MEDIA SETTINGS
# ==========================================

class MediaSettingsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        settings = MediaSettings.load()
        return Response(MediaSettingsSerializer(settings).data)

    def patch(self, request):
        if not is_media_admin(request.user):
            return Response(
                {"detail": "Only the Media administrator can change team settings."},
                status=status.HTTP_403_FORBIDDEN,
            )
        settings_obj = MediaSettings.load()
        serializer   = MediaSettingsSerializer(settings_obj, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


# ==========================================
# MEDIA BOOKING VIEWSET
# ==========================================

class MediaBookingViewSet(viewsets.ModelViewSet):
    serializer_class   = MediaBookingSerializer
    permission_classes = [IsAuthenticated]

    # ------------------------------------------------------------------
    # Queryset
    # ------------------------------------------------------------------

    def get_queryset(self):
        user       = self.request.user
        view_param = self.request.query_params.get('view', 'mine')
        admin      = is_media_admin(user)
        refresh_queryset_lifecycle(MediaBooking.objects.all())

        qs = MediaBooking.objects.select_related(
            'space', 'user', 'department'
        ).prefetch_related(
            'equipment_requests__equipment',
            'assigned_crew',
        )

        if self.action in ['review', 'update_loadout', 'crew_availability', 'update_crew', 'edit_crew_availability', 'retrieve', 'partial_update', 'update'] and admin:
            return qs

        VIEW_MAP = {
            'pending':        (lambda: qs.filter(status='PENDING').order_by('-updated_at'),           admin),
            'active':         (lambda: qs.filter(status='APPROVED').order_by('setup_start_datetime'), admin),
            'history':        (lambda: qs.exclude(status='PENDING').order_by('-updated_at'),          admin),
            'resolved_by_me': (lambda: qs.filter(resolved_by=user).order_by('-resolved_at'),          admin),
        }

        if view_param in VIEW_MAP:
            query_fn, requires_admin = VIEW_MAP[view_param]
            return query_fn() if (not requires_admin or admin) else qs.none()

        if view_param == 'general':
            return (
                qs.order_by('-updated_at') if admin
                else qs.filter(user=user).exclude(status='REJECTED').order_by('setup_start_datetime')
            )

        return qs.filter(user=user).order_by('-updated_at')

    # ------------------------------------------------------------------
    # Create / Update / Delete
    # ------------------------------------------------------------------

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

        if Role.Name.STUDENT in user.get_effective_roles():
            raise ValidationError({
                "non_field_errors": "Students are not permitted to make media bookings."
            })

        # -- Crew availability gate --
        # Retrieve validated datetime fields from the serializer
        setup_start   = serializer.validated_data.get('setup_start_datetime')
        teardown_end  = serializer.validated_data.get('teardown_end_datetime')

        if setup_start and teardown_end:
            free = count_free_crew(setup_start, teardown_end)
            if free == 0:
                raise ValidationError({
                    "non_field_errors": (
                        "The media team is fully occupied during this time slot. "
                        "Please choose a different date or time."
                    )
                })

        user_dept = getattr(user, 'department', None)
        booking   = serializer.save(
            user=user,
            **({"department": user_dept} if user_dept else {})
        )

        if booking.is_team_request:
            reserve_standard_team_kit(booking)

        notify_new_request(
            booking=booking,
            domain='media',
            role_name=Role.Name.MEDIA_INCHARGE,
        )

    @transaction.atomic
    def perform_update(self, serializer):
        instance         = self.get_object()
        user             = self.request.user
        was_team_request = instance.is_team_request
        was_approved     = instance.status == 'APPROVED'

        booking = serializer.save()

        if booking.is_team_request:
            free = count_free_crew(
                booking.setup_start_datetime,
                booking.teardown_end_datetime,
                exclude_booking_pk=booking.pk,
            )
            if free == 0:
                raise ValidationError({
                    "non_field_errors": (
                        "The media team is fully occupied during this time slot. "
                        "Please choose a different date or time."
                    )
                })

        if booking.is_team_request and not was_team_request:
            reserve_standard_team_kit(booking)

        is_owner = (instance.user == user)
        if was_approved and (is_owner or not is_media_admin(user)):
            booking.status           = 'PENDING'
            booking.resolved_by      = None
            booking.resolved_at      = None
            booking.remarks_by_admin = ''
            booking.updated_by       = user
            # Clear crew assignment when booking reverts to PENDING
            booking.assigned_crew.clear()
            booking.save(update_fields=[
                'status', 'resolved_by', 'resolved_at',
                'remarks_by_admin', 'updated_by', 'updated_at',
            ])
            notify_incharge_booking_edited(
                booking=booking,
                domain='media',
                role_name=Role.Name.MEDIA_INCHARGE,
            )

    def perform_destroy(self, instance):
        refresh_booking_lifecycle(instance)
        if not can_user_modify_booking(instance):
            raise ValidationError({"detail": "Cannot cancel a media request whose setup time has already passed."})
        instance.status           = 'CANCELLED'
        instance.resolved_by      = None
        instance.resolved_at      = timezone.now()
        instance.remarks_by_admin = 'Cancelled by requester.'
        instance.assigned_crew.clear()
        instance.save(update_fields=[
            'status', 'resolved_by', 'resolved_at',
            'remarks_by_admin', 'updated_at',
        ])
        mark_pending_request_notifications_read(instance, domain='media')
        notify_incharge_cancelled(
            booking=instance,
            domain='media',
            role_name=Role.Name.MEDIA_INCHARGE,
        )

    # ------------------------------------------------------------------
    # Admin: Review (approve / reject) with crew assignment
    # ------------------------------------------------------------------

    @action(detail=True, methods=['patch'])
    @transaction.atomic
    def review(self, request, pk=None):
        if not is_media_admin(request.user):
            return Response(
                {"detail": "Only the Media administrator can review requests."},
                status=status.HTTP_403_FORBIDDEN,
            )

        booking    = self.get_object()
        new_status = request.data.get('status')
        remarks    = request.data.get('remarks_by_admin', '')
        crew_ids   = request.data.get('assigned_crew', [])  # list of user PKs

        refresh_booking_lifecycle(booking)
        booking.refresh_from_db()

        # -- Basic status validation --
        if new_status not in ['APPROVED', 'REJECTED']:
            return Response(
                {"error": "Invalid status. Must be APPROVED or REJECTED."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if new_status == 'REJECTED' and not remarks.strip():
            return Response(
                {"error": "Remarks are required when rejecting a booking."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if new_status == 'APPROVED' and booking.status != 'PENDING':
            return Response(
                {"error": f"Cannot approve a booking that is currently {booking.status}."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if new_status == 'REJECTED' and booking.status not in ['PENDING', 'APPROVED']:
            return Response(
                {"error": f"Cannot reject a booking that is currently {booking.status}."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if new_status == 'APPROVED':
            # -- Crew assignment validation --
            if not crew_ids:
                return Response(
                    {"error": "At least one crew member must be assigned before approving."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Validate all submitted IDs are actual MEDIA_INCHARGE users
            valid_crew_qs = get_all_media_crew().filter(pk__in=crew_ids)
            valid_crew_ids = set(valid_crew_qs.values_list('id', flat=True))
            invalid_ids    = set(crew_ids) - valid_crew_ids
            if invalid_ids:
                return Response(
                    {"error": f"The following user IDs are not valid media crew members: {sorted(invalid_ids)}"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # -- Crew conflict check (warning, not a hard block per-person) --
            # Hard block: zero free crew in this window (submission already
            # gates this, but re-check here in case of race condition or
            # admin directly approving a previously-pending booking)
            free_count = count_free_crew(
                booking.setup_start_datetime,
                booking.teardown_end_datetime,
                exclude_booking_pk=booking.pk,
            )
            if free_count == 0:
                return Response(
                    {"error": "All crew members are occupied during this booking's time slot. Cannot approve."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # -- Equipment checks --
            if booking.is_team_request and not booking.equipment_requests.exists():
                reserve_standard_team_kit(booking)

            is_avail, error_msg = check_equipment_availability_for_approval(booking)
            if not is_avail:
                return Response({"error": error_msg}, status=status.HTTP_400_BAD_REQUEST)

        # -- Commit --
        booking.status           = new_status
        booking.remarks_by_admin = remarks
        booking.resolved_by      = request.user
        booking.resolved_at      = timezone.now()
        booking.save()

        if new_status == 'APPROVED':
            booking.assigned_crew.set(valid_crew_qs)
        else:
            # On rejection, clear any previously assigned crew
            booking.assigned_crew.clear()

        mark_pending_request_notifications_read(booking, domain='media')
        notify_booking_status_change(
            booking=booking,
            new_status=new_status,
            domain='media',
            resolved_by=request.user,
            remarks=remarks,
        )

        return Response(self.get_serializer(booking).data)

    # ------------------------------------------------------------------
    # Admin: Crew availability for approval modal
    # ------------------------------------------------------------------

    @action(detail=True, methods=['get'], url_path='crew_availability')
    def crew_availability(self, request, pk=None):
        """
        Returns all MEDIA_INCHARGE users with a busy/free flag for
        the time window of the given booking. Called by the admin
        approval modal before assigning crew.
        """
        if not is_media_admin(request.user):
            return Response(
                {"detail": "Only the Media administrator can view crew availability."},
                status=status.HTTP_403_FORBIDDEN,
            )

        booking = self.get_object()
        crew    = get_crew_availability(
            booking.setup_start_datetime,
            booking.teardown_end_datetime,
            exclude_booking_pk=booking.pk,
        )
        return Response({
            "booking_reference": booking.reference_code,
            "window_start":      booking.setup_start_datetime.isoformat(),
            "window_end":        booking.teardown_end_datetime.isoformat(),
            "crew":              crew,
        })

    # ------------------------------------------------------------------
    # Admin: Media crew roster (read-only list of MEDIA_INCHARGE users)
    # ------------------------------------------------------------------

    @action(detail=False, methods=['get'], url_path='crew_roster')
    def crew_roster(self, request):
        """
        Returns the list of all active MEDIA_INCHARGE users for the
        read-only roster card displayed on the Admin Media page.
        Only accessible to Media Admins.
        """
        if not is_media_admin(request.user):
            return Response(
                {"detail": "Only the Media administrator can view the crew roster."},
                status=status.HTTP_403_FORBIDDEN,
            )

        crew = get_all_media_crew().order_by('first_name', 'last_name')
        data = [
            {
                'id':                  member.pk,
                'name':                ' '.join(
                    part for part in [
                        member.first_name,
                        getattr(member, 'middle_name', None),
                        member.last_name,
                    ] if part
                ).strip() or str(member),
                'email':               member.email,
                'phone':               member.phone,
                'designation':         member.designation,
                'employee_student_id': member.employee_student_id,
            }
            for member in crew
        ]
        return Response(data)

    # ------------------------------------------------------------------
    # Admin: Update loadout
    # ------------------------------------------------------------------

    @action(detail=True, methods=['patch'], url_path='update_loadout')
    @transaction.atomic
    def update_loadout(self, request, pk=None):
        if not is_media_admin(request.user):
            return Response(
                {"detail": "Only the Media administrator can update loadouts."},
                status=status.HTTP_403_FORBIDDEN,
            )

        booking = self.get_object()
        refresh_booking_lifecycle(booking)
        booking.refresh_from_db()

        if booking.status != 'APPROVED':
            return Response(
                {"error": "Loadout can only be edited on APPROVED bookings."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not booking.is_team_request:
            return Response(
                {"error": "Loadout editing is only available for team-request bookings."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        equipment_data = request.data.get('equipment_requests')
        if not isinstance(equipment_data, list):
            return Response(
                {"error": "'equipment_requests' must be a list."},
                status=status.HTTP_400_BAD_REQUEST,
            )

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

        used_map = get_equipment_used_map_for_booking(booking)

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

    # ------------------------------------------------------------------
    # Equipment availability check (booking form)
    # ------------------------------------------------------------------

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
        ).exclude(
            status__in=['REJECTED', 'CANCELLED', 'EXPIRED', 'COMPLETED']
        ).prefetch_related('equipment_requests')

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

    # ------------------------------------------------------------------
    # Crew availability for landing page (today)
    # ------------------------------------------------------------------

    @action(detail=False, methods=['get'], url_path='crew_count')
    def crew_count(self, request):
        """
        Returns free crew count for a given time window.
        Accepts optional `start` and `end` ISO datetime query params.
        Falls back to today's full calendar day if params are not supplied.
        Replaces the old team_capacity endpoint on the media landing page.
        """
        refresh_queryset_lifecycle(MediaBooking.objects.all())

        start_str = request.query_params.get('start')
        end_str   = request.query_params.get('end')

        if start_str and end_str:
            window_start = parse_datetime(start_str)
            window_end   = parse_datetime(end_str)
            if not window_start or not window_end:
                return Response(
                    {"error": "Invalid datetime format for start/end. Expected ISO 8601."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        else:
            # Default: today's full calendar day
            today        = timezone.localdate()
            window_start = timezone.make_aware(
                datetime.datetime.combine(today, datetime.time.min)
            )
            window_end   = timezone.make_aware(
                datetime.datetime.combine(today, datetime.time.max)
            )

        free  = count_free_crew(window_start, window_end)
        total = get_all_media_crew().count()
        return Response({
            "total_crew": total,
            "free_crew":  free,
            "is_full":    free == 0,
        })


    # ------------------------------------------------------------------
    # Daily availability (equipment + team views)
    # ------------------------------------------------------------------

    @action(detail=False, methods=['get'])
    def daily_availability(self, request):
        refresh_queryset_lifecycle(MediaBooking.objects.all())
        date_param   = request.query_params.get('date')
        view_type    = request.query_params.get('type', 'equipment')
        booking_date = parse_date(date_param) if date_param else timezone.localdate()

        if not booking_date:
            return Response({"error": "Invalid date. Expected YYYY-MM-DD."}, status=status.HTTP_400_BAD_REQUEST)

        if view_type == 'team':
            data = get_daily_team_availability(booking_date)
            return Response(data)

        if view_type != 'equipment':
            return Response({"error": "Invalid type. Expected 'equipment' or 'team'."}, status=status.HTTP_400_BAD_REQUEST)

        # -- Equipment view (unchanged) --
        day_start = timezone.make_aware(datetime.datetime.combine(booking_date, datetime.time.min))
        day_end   = timezone.make_aware(datetime.datetime.combine(booking_date, datetime.time.max))

        approved = MediaBooking.objects.filter(
            status__in=['APPROVED', 'COMPLETED'],
            setup_start_datetime__lt=day_end,
            teardown_end_datetime__gt=day_start,
        ).prefetch_related('equipment_requests')

        eq_slots = {}
        for b in approved:
            s_clamp = max(b.setup_start_datetime, day_start)
            e_clamp = min(b.teardown_end_datetime, day_end)
            s_local = timezone.localtime(s_clamp)
            e_local = timezone.localtime(e_clamp)
            s_str   = s_local.strftime('%H:%M')
            e_str   = '23:59' if e_clamp >= day_end else e_local.strftime('%H:%M')
            for req in b.equipment_requests.all():
                eq_slots.setdefault(req.equipment_id, []).append({
                    'start_time': s_str,
                    'end_time':   e_str,
                    'quantity':   req.quantity,
                    'event_name': b.event_name,
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
                'id':                    item.id,
                'name':                  item.name,
                'category':              item.category,
                'category_display':      item.get_category_display(),
                'total_owned':           item.total_owned,
                'booked_quantity':       max_used,
                'available_quantity':    max(0, item.total_owned - max_used),
                'booked_slots':          sorted(slots, key=lambda x: x['start_time']),
                'is_standard_media_kit': item.is_standard_media_kit,
            })

        return Response({'date': booking_date.isoformat(), 'type': 'equipment', 'items': availability})

    # ------------------------------------------------------------------
    # Runsheet
    # ------------------------------------------------------------------

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
            status__in=['APPROVED', 'COMPLETED'],
            is_team_request=True,
            setup_start_datetime__lt=day_end,
            teardown_end_datetime__gt=day_start,
        ).select_related(
            'space', 'user', 'department'
        ).prefetch_related(
            'equipment_requests__equipment',
            'assigned_crew',
        ).order_by('event_start_datetime')
        return Response(self.get_serializer(bookings, many=True).data)

    # ------------------------------------------------------------------
    # My bookings
    # ------------------------------------------------------------------

    @action(detail=False, methods=['get'], url_path='my-bookings')
    def my_bookings(self, request):
        refresh_queryset_lifecycle(MediaBooking.objects.filter(user=request.user))
        bookings = MediaBooking.objects.filter(
            user=request.user
        ).prefetch_related('assigned_crew').order_by('-updated_at')
        return Response(self.get_serializer(bookings, many=True).data)

    # ------------------------------------------------------------------
    # Admin: Update crew assignment
    # ------------------------------------------------------------------

    @action(detail=True, methods=['patch'], url_path='update_crew')
    @transaction.atomic
    def update_crew(self, request, pk=None):
        if not is_media_admin(request.user):
            return Response(
                {"detail": "Only the Media administrator can update crew."},
                status=status.HTTP_403_FORBIDDEN,
            )

        booking = self.get_object()
        refresh_booking_lifecycle(booking)
        booking.refresh_from_db()

        if booking.status != 'APPROVED':
            return Response(
                {"error": "Crew can only be updated on APPROVED bookings."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        crew_ids = request.data.get('assigned_crew', [])
        if not crew_ids:
            return Response(
                {"error": "At least one crew member must remain assigned."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        valid_crew_qs = get_all_media_crew().filter(pk__in=crew_ids)
        valid_crew_ids = set(valid_crew_qs.values_list('id', flat=True))
        invalid_ids = set(crew_ids) - valid_crew_ids
        if invalid_ids:
            return Response(
                {"error": f"The following user IDs are not valid media crew members: {sorted(invalid_ids)}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        booking.assigned_crew.set(valid_crew_qs)
        booking.updated_by = request.user
        booking.save(update_fields=['updated_by', 'updated_at'])

        notify_crew_updated(booking)

        return Response(self.get_serializer(booking).data)

    # ------------------------------------------------------------------
    # Admin: Crew availability for edit modal
    # ------------------------------------------------------------------

    @action(detail=True, methods=['get'], url_path='edit_crew_availability')
    def edit_crew_availability(self, request, pk=None):
        if not is_media_admin(request.user):
            return Response(
                {"detail": "Only the Media administrator can view crew availability."},
                status=status.HTTP_403_FORBIDDEN,
            )

        booking = self.get_object()
        refresh_booking_lifecycle(booking)
        booking.refresh_from_db()

        if booking.status != 'APPROVED':
            return Response(
                {"error": "Crew availability can only be checked on APPROVED bookings."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        crew_data = get_crew_availability(
            booking.setup_start_datetime,
            booking.teardown_end_datetime,
            exclude_booking_pk=booking.pk,
        )

        currently_assigned_ids = set(booking.assigned_crew.values_list('id', flat=True))

        currently_assigned_busy = []
        available_crew = []

        for member in crew_data:
            is_assigned = member['id'] in currently_assigned_ids
            if member['is_busy']:
                if is_assigned:
                    currently_assigned_busy.append(member)
            else:
                member['is_preselected'] = is_assigned
                available_crew.append(member)

        return Response({
            "currently_assigned_busy": currently_assigned_busy,
            "available_crew": available_crew,
        })