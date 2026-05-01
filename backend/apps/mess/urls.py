# ---------------------------------------------------------------------------
# mess/urls.py  (copy this block into apps/mess/urls.py)
# ---------------------------------------------------------------------------
from apps.mess.views import MessBookingViewSet
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.fleet.views import VehicleViewSet, FleetBookingViewSet

mess_router = DefaultRouter()
mess_router.register('bookings', MessBookingViewSet, basename='mess-booking')
 
mess_urlpatterns = [
    path('', include(mess_router.urls)),
]