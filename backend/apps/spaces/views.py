from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from apps.users.permissions import IsAdminOrReadOnly
from .models import Space, SpaceBooking, Equipment
from .serializers import SpaceSerializer, SpaceBookingSerializer, EquipmentSerializer

class EquipmentViewSet(viewsets.ModelViewSet):
    """
    Manage the master catalog of equipment (Cameras, Mics, etc.)
    """
    queryset = Equipment.objects.filter(is_active=True)
    serializer_class = EquipmentSerializer
    permission_classes = [IsAdminOrReadOnly] # Admins manage, others view

class SpaceViewSet(viewsets.ModelViewSet):
    queryset = Space.objects.filter(is_active=True)
    serializer_class = SpaceSerializer
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

class SpaceBookingViewSet(viewsets.ModelViewSet):
    serializer_class = SpaceBookingSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.is_staff or user.is_superuser:
            return SpaceBooking.objects.all().order_by('-created_at')
        return SpaceBooking.objects.filter(user=user).order_by('-created_at')

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=True, methods=['patch'])
    def review(self, request, pk=None):
        """
        Custom endpoint for admins to approve or reject a booking.
        Expected payload: {"status": "APPROVED" | "REJECTED", "remarks_by_admin": "Optional text"}
        """
        user = request.user
        if not (user.is_staff or user.is_superuser):
            return Response({"detail": "Not authorized to review bookings."}, status=status.HTTP_403_FORBIDDEN)

        booking = self.get_object()
        new_status = request.data.get('status')
        remarks = request.data.get('remarks_by_admin', '')

        if new_status not in ['APPROVED', 'REJECTED']:
            return Response(
                {"error": "Invalid status. Must be APPROVED or REJECTED."}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        # Enforce the database CheckConstraint at the API level for better error messages
        if new_status == 'REJECTED' and not remarks:
             return Response(
                 {"error": "Remarks are required when rejecting a booking."}, 
                 status=status.HTTP_400_BAD_REQUEST
             )

        # Update the booking
        booking.status = new_status
        booking.remarks_by_admin = remarks
        booking.resolved_by = user
        booking.resolved_at = timezone.now()
        booking.save()

        # Return the updated booking data
        serializer = self.get_serializer(booking)
        return Response(serializer.data, status=status.HTTP_200_OK)