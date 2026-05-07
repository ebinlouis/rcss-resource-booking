from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from apps.users.permissions import IsAdminOrReadOnly
from .permissions import IsOwnerOrAdminOrReadOnly
from .models import Space, SpaceBooking, Equipment
from .serializers import SpaceSerializer, SpaceBookingSerializer, EquipmentSerializer

# ==========================================
# RESOURCE CATALOG MANAGEMENT
# ==========================================
class EquipmentViewSet(viewsets.ModelViewSet):
    queryset = Equipment.objects.filter(is_active=True)
    serializer_class = EquipmentSerializer
    # Only true IT Admins / Staff can add/edit equipment. Everyone else reads.
    permission_classes = [IsAdminOrReadOnly]

class SpaceViewSet(viewsets.ModelViewSet):
    queryset = Space.objects.filter(is_active=True)
    serializer_class = SpaceSerializer
    # Only true IT Admins / Staff can add/edit spaces. Everyone else reads.
    permission_classes = [IsAdminOrReadOnly]

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def check_availability(self, request, pk=None):
        space = self.get_object()
        start = request.data.get('start_datetime')
        end = request.data.get('end_datetime')

        if not start or not end:
            return Response(
                {"error": "Both start_datetime and end_datetime are required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        overlapping = SpaceBooking.objects.filter(
            space=space,
            status='APPROVED',
            start_datetime__lt=end,
            end_datetime__gt=start
        ).exists()

        if overlapping:
            return Response(
                {"available": False, "message": "This space is already booked for the requested time."},
                status=status.HTTP_200_OK
            )
        return Response({"available": True, "message": "Space is available."}, status=status.HTTP_200_OK)

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
            # All users can see the general activity feed.
            # Privacy is enforced in the serializer, not here.
            return (
                SpaceBooking.objects
                .select_related('space', 'user')
                .exclude(status='REJECTED')   # Hide rejected from general view
                .order_by('start_datetime')
            )

        # Default: 'mine' — only this user's own bookings (all statuses)
        return (
            SpaceBooking.objects
            .filter(user=user)
            .select_related('space', 'user')
            .order_by('-created_at')
        )

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=True, methods=['patch'], permission_classes=[IsAuthenticated])
    def review(self, request, pk=None):
        # NOTE: If your React App uses the UnifiedApprovalQueue, 
        # this endpoint might be redundant, but it's safe to keep as a fallback.
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

        booking.status = new_status
        booking.remarks_by_admin = remarks
        booking.resolved_by = user
        booking.resolved_at = timezone.now()
        booking.save()

        serializer = self.get_serializer(booking)
        return Response(serializer.data, status=status.HTTP_200_OK)