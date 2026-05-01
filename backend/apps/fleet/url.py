# ---------------------------------------------------------------------------
# fleet/urls.py  (copy this block into apps/fleet/urls.py)
# ---------------------------------------------------------------------------
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.fleet.views import VehicleViewSet, FleetBookingViewSet
 
fleet_router = DefaultRouter()
fleet_router.register(r'vehicles', VehicleViewSet, basename='vehicle')
fleet_router.register(r'bookings', FleetBookingViewSet, basename='fleet-booking')
 
fleet_urlpatterns = [
    path('', include(fleet_router.urls)),
]