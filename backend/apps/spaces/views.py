from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from apps.users.permissions import IsAdminOrReadOnly # <-- Your new custom permission
from .models import Space, SpaceBooking
from .serializers import SpaceSerializer, SpaceBookingSerializer

class SpaceViewSet(viewsets.ModelViewSet):
    queryset = Space.objects.filter(is_active=True)
    serializer_class = SpaceSerializer
    
    # Anyone can view the catalog, only admins can add/edit/delete rooms
    permission_classes = [IsAdminOrReadOnly] 

class SpaceBookingViewSet(viewsets.ModelViewSet):
    queryset = SpaceBooking.objects.all().order_by('-created_at')
    serializer_class = SpaceBookingSerializer
    
    # Anyone who is logged in can make a booking request
    permission_classes = [IsAuthenticated]