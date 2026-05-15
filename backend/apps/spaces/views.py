import json
from datetime import timedelta
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import ValidationError

from apps.users.permissions import IsAdminOrReadOnly
from .permissions import IsOwnerOrAdminOrReadOnly
from .models import Space, SpaceBooking, Equipment
from .serializers import SpaceSerializer, SpaceBookingSerializer, EquipmentSerializer
from .utils import get_overlapping_bookings, build_conflict_report


# ==========================================
# RESOURCE CATALOG MANAGEMENT
# ==========================================
class EquipmentViewSet(viewsets.ModelViewSet):
    serializer_class = EquipmentSerializer
    permission_classes = [IsAdminOrReadOnly]

    def get_queryset(self):
        qs = Equipment.objects.filter(is_active=True)
        
        # Hide media kits if the frontend is asking for Space gear
        if self.request.query_params.get('for_space') == 'true':
            qs = qs.filter(is_standard_media_kit=False)
            
        return qs


class SpaceViewSet(viewsets.ModelViewSet):
    serializer_class = SpaceSerializer
    permission_classes = [IsAdminOrReadOnly]

    def get_queryset(self):
        qs = Space.objects.filter(is_active=True)

        min_capacity = self.request.query_params.get('min_capacity')
        if min_capacity is not None:
            try:
                qs = qs.filter(capacity_hard__gte=int(min_capacity))
            except ValueError:
                pass

        if self.request.query_params.get('for_suggestion') == 'true':
            qs = qs.filter(is_special_purpose=False)

        return qs

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def check_availability(self, request, pk=None):
        space = self.get_object()

        start_raw    = request.data.get('start_datetime')
        end_raw      = request.data.get('end_datetime')
        booking_type = request.data.get('booking_type', SpaceBooking.BookingType.SINGLE_CONTINUOUS)

        if not start_raw or not end_raw:
            return Response(
                {"error": "Both start_datetime and end_datetime are required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        from django.utils.dateparse import parse_datetime
        start_dt = parse_datetime(start_raw)
        end_dt   = parse_datetime(end_raw)

        if not start_dt or not end_dt:
            return Response(
                {"error": "Invalid datetime format. Use ISO 8601."},
                status=status.HTTP_400_BAD_REQUEST
            )

        from django.utils import timezone as tz
        if tz.is_naive(start_dt):
            start_dt = tz.make_aware(start_dt)
        if tz.is_naive(end_dt):
            end_dt = tz.make_aware(end_dt)

        exclude_pk = request.data.get('exclude_booking_id')
        if exclude_pk:
            try:
                exclude_pk = int(exclude_pk)
            except (TypeError, ValueError):
                exclude_pk = None

        conflicts = []

        if booking_type == SpaceBooking.BookingType.RECURRING_DAILY:
            if start_dt.time() >= end_dt.time():
                return Response(
                    {"error": "For recurring bookings, daily start time must be before end time."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            days_diff = (end_dt.date() - start_dt.date()).days
            if days_diff < 0:
                return Response(
                    {"error": "start_datetime must be before end_datetime."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            for i in range(days_diff + 1):
                slot_start = start_dt + timedelta(days=i)
                slot_end = slot_start.replace(
                    hour=end_dt.hour, 
                    minute=end_dt.minute, 
                    second=end_dt.second, 
                    microsecond=end_dt.microsecond
                )

                overlapping = get_overlapping_bookings(space, slot_start, slot_end, exclude_pk=exclude_pk)
                if overlapping.exists():
                    conflicts.extend(build_conflict_report(overlapping, request.user))

        else:
            if start_dt >= end_dt:
                return Response(
                    {"error": "start_datetime must be before end_datetime."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            overlapping = get_overlapping_bookings(space, start_dt, end_dt, exclude_pk=exclude_pk)
            if overlapping.exists():
                conflicts.extend(build_conflict_report(overlapping, request.user))

        unique_conflicts = []
        seen = set()
        for c in conflicts:
            sig = (c['date'], c['start'], c['end'], c.get('reference_code', ''))
            if sig not in seen:
                seen.add(sig)
                unique_conflicts.append(c)

        if not unique_conflicts:
            return Response({
                "available": True,
                "conflicts": [],
                "message": "Space is available.",
            }, status=status.HTTP_200_OK)

        count = len(unique_conflicts)
        return Response({
            "available": False,
            "conflicts": unique_conflicts,
            "message": f"{count} conflict{'s' if count != 1 else ''} found across your selected range.",
        }, status=status.HTTP_200_OK)


# ==========================================
# BOOKING SUBMISSIONS
# ==========================================
class SpaceBookingViewSet(viewsets.ModelViewSet):
    serializer_class = SpaceBookingSerializer
    permission_classes = [IsAuthenticated, IsOwnerOrAdminOrReadOnly]

    def get_queryset(self):
        user = self.request.user
        view_param = self.request.query_params.get('view', 'mine')

        if view_param == 'general':
            return (
                SpaceBooking.objects
                .select_related('space', 'user')
                .exclude(status='REJECTED')
                .order_by('start_datetime')
            )

        return (
            SpaceBooking.objects
            .filter(user=user)
            .select_related('space', 'user')
            .order_by('-created_at')
        )

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    def perform_update(self, serializer):
        user = self.request.user
        instance = serializer.instance

        if user.is_staff or user.is_superuser:
            serializer.save(updated_by=user)
            return

        extra_fields = {"updated_by": user}
        if instance.status == 'APPROVED':
            extra_fields.update({
                "status": 'PENDING',
                "resolved_by": None,
                "resolved_at": None,
                "remarks_by_admin": None,
            })

        serializer.save(**extra_fields)

    def perform_destroy(self, instance):
        if instance.end_datetime < timezone.now():
            raise ValidationError({"detail": "Cannot cancel a booking that has already expired."})
        instance.delete()

    @action(detail=True, methods=['patch'], permission_classes=[IsAuthenticated])
    def review(self, request, pk=None):
        user = request.user
        if not (user.is_staff or user.is_superuser):
            return Response(
                {"detail": "Not authorized to review bookings."},
                status=status.HTTP_403_FORBIDDEN
            )

        booking = self.get_object()
        new_status = request.data.get('status')
        remarks = request.data.get('remarks_by_admin', '')

        if new_status not in ['APPROVED', 'REJECTED']:
            return Response(
                {"error": "Invalid status. Must be APPROVED or REJECTED."},
                status=status.HTTP_400_BAD_REQUEST
            )

        if new_status == 'REJECTED' and not remarks:
            return Response(
                {"error": "Remarks are required when rejecting a booking."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # ── Grouped Update Logic ──────────────────────────────────────────────
        # Safely loops and saves to trigger proper inheritance updates
        bookings_in_group = SpaceBooking.objects.filter(group_id=booking.group_id)
        for b in bookings_in_group:
            b.status = new_status
            b.remarks_by_admin = remarks
            b.resolved_by = user
            b.resolved_at = timezone.now()
            b.save()

        booking.refresh_from_db()
        serializer = self.get_serializer(booking)
        return Response(serializer.data, status=status.HTTP_200_OK)