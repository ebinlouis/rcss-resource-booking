from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from apps.users.permissions import IsAdminOrReadOnly
from .models import Space, SpaceBooking
from .serializers import SpaceSerializer, SpaceBookingSerializer

class SpaceViewSet(viewsets.ModelViewSet):
    # Only show active spaces in the catalog
    queryset = Space.objects.filter(is_active=True)
    serializer_class = SpaceSerializer
    
    # Anyone can view the catalog, only admins can add/edit/delete rooms
    permission_classes = [IsAdminOrReadOnly] 

class SpaceBookingViewSet(viewsets.ModelViewSet):
    serializer_class = SpaceBookingSerializer
    # Anyone who is logged in can make a booking request
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
        Ignore whatever 'user' ID the frontend sends. Force the database 
        to use the exact user who is currently logged in via the secure cookie.
        """
        serializer.save(user=self.request.user)