from rest_framework import viewsets
from .models import Space, SpaceBooking
from .serializers import SpaceSerializer, SpaceBookingSerializer

class SpaceViewSet(viewsets.ModelViewSet):
    queryset = Space.objects.filter(is_active=True)
    serializer_class = SpaceSerializer

class SpaceBookingViewSet(viewsets.ModelViewSet):
    queryset = SpaceBooking.objects.all().order_by('-created_at')
    serializer_class = SpaceBookingSerializer
    
    # We will add permissions (IsAuthenticated, IsAdmin) here later!