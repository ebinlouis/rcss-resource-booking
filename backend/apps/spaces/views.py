from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from apps.users.permissions import IsAdminOrReadOnly
from .models import Space, SpaceBooking
from .serializers import SpaceSerializer, SpaceBookingSerializer

class SpaceViewSet(viewsets.ModelViewSet):
    queryset = Space.objects.filter(is_active=True)
    serializer_class = SpaceSerializer
    permission_classes = [IsAdminOrReadOnly] 

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def check_availability(self, request, pk=None):
        """
        Endpoint: POST /api/spaces/catalog/{id}/check_availability/
        Checks if the specific space is free for the requested time range.
        """
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
        
        return Response(
            {"available": True, "message": "Space is available."}, 
            status=status.HTTP_200_OK
        )

class SpaceBookingViewSet(viewsets.ModelViewSet):
    serializer_class = SpaceBookingSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """
        Privacy Filter: 
        If an Admin asks for bookings, show them everything.
        If a normal user asks, ONLY show them their own bookings.
        """
        user = self.request.user
        if user.is_staff or user.is_superuser:
            return SpaceBooking.objects.all().order_by('-created_at')
        
        return SpaceBooking.objects.filter(user=user).order_by('-created_at')

    def perform_create(self, serializer):
        """
        Security Lock:
        Force the database to use the exact user who is currently logged in.
        """
        serializer.save(user=self.request.user)