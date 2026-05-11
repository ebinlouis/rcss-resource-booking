from django.utils import timezone
from django.db.models import Sum, Q
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from apps.spaces.permissions import IsOwnerOrAdminOrReadOnly
from apps.media.models import MediaBooking, MediaEquipmentRequest
from apps.media.serializers import MediaBookingSerializer
from apps.spaces.models import Equipment


class MediaBookingViewSet(viewsets.ModelViewSet):
    serializer_class = MediaBookingSerializer
    permission_classes = [IsAuthenticated, IsOwnerOrAdminOrReadOnly]

    def _is_admin(self, user):
        return user.is_superuser or user.is_staff or (
            user.role and user.role.name in ['IT_ADMIN', 'HOD'] # Add 'MEDIA_ADMIN' here if you have one
        )

    def get_queryset(self):
        user       = self.request.user
        view_param = self.request.query_params.get('view', 'mine')
        is_admin   = self._is_admin(user)

        qs = MediaBooking.objects.select_related('space', 'user', 'department').prefetch_related('equipment_requests__equipment')

        if is_admin and view_param == 'general':
            return qs.order_by('-created_at')
        elif is_admin and view_param == 'pending':
            return qs.filter(status='PENDING').order_by('-created_at')
        elif is_admin and view_param == 'active':
            return qs.filter(status='APPROVED').order_by('booking_date', 'setup_start_time')
        elif is_admin and view_param == 'resolved_by_me':
            return qs.filter(resolved_by=user).order_by('-resolved_at')
        elif view_param == 'general':
            return qs.exclude(status='REJECTED').order_by('booking_date', 'setup_start_time')

        # Default: 'mine'
        return qs.filter(user=user).order_by('-created_at')

    def perform_create(self, serializer):
        user = self.request.user
        serializer.save(
            user=user,
            department=user.department if hasattr(user, 'department') and user.department else None,
        )

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def check_availability(self, request):
        """
        Strict Inventory Math Endpoint.
        GET /api/media/bookings/check_availability/?date=2026-05-15&start=09:00&end=14:00
        """
        booking_date = request.query_params.get('date')
        req_start    = request.query_params.get('start') # maps to setup_start_time
        req_end      = request.query_params.get('end')   # maps to teardown_end_time

        if not all([booking_date, req_start, req_end]):
            return Response(
                {"error": "date, start, and end parameters are required."}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        # 1. Find all bookings on this date that OVERLAP with the requested time window.
        # Logic: (Existing Setup < Requested Teardown) AND (Existing Teardown > Requested Setup)
        # We exclude REJECTED and CANCELLED bookings.
        overlapping_bookings = MediaBooking.objects.filter(
            booking_date=booking_date,
            setup_start_time__lt=req_end,
            teardown_end_time__gt=req_start
        ).exclude(status__in=['REJECTED', 'CANCELLED'])

        # 2. Sum up how many of each equipment are being used in those overlapping bookings
        checked_out_gear = MediaEquipmentRequest.objects.filter(
            media_booking__in=overlapping_bookings
        ).values('equipment_id').annotate(total_used=Sum('quantity'))

        used_map = {item['equipment_id']: item['total_used'] for item in checked_out_gear}

        # 3. Get all portable equipment and calculate what's left
        all_equipment = Equipment.objects.filter(is_active=True, is_portable=True)
        availability = []

        for eq in all_equipment:
            used = used_map.get(eq.id, 0)
            available = max(0, eq.total_owned - used)
            availability.append({
                "id": eq.id,
                "name": eq.name,
                "category": eq.category,
                "total_owned": eq.total_owned,
                "currently_available": available
            })

        return Response(availability, status=status.HTTP_200_OK)

    @action(detail=True, methods=['patch'], permission_classes=[IsAuthenticated])
    def review(self, request, pk=None):
        # ... (Your existing review logic remains exactly the same) ...
        user = request.user
        if not self._is_admin(user):
            return Response({"detail": "Not authorized."}, status=status.HTTP_403_FORBIDDEN)

        booking    = self.get_object()
        new_status = request.data.get('status')
        remarks    = request.data.get('remarks_by_admin', '')

        if new_status not in ['APPROVED', 'REJECTED']:
            return Response({"error": "Invalid status."}, status=status.HTTP_400_BAD_REQUEST)

        if new_status == 'REJECTED' and not remarks:
            return Response({"error": "Remarks are required."}, status=status.HTTP_400_BAD_REQUEST)

        booking.status           = new_status
        booking.remarks_by_admin = remarks
        booking.resolved_by      = user
        booking.resolved_at      = timezone.now()
        booking.save()

        serializer = self.get_serializer(booking)
        return Response(serializer.data, status=status.HTTP_200_OK)