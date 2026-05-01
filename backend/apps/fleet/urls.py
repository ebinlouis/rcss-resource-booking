from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.fleet.views import VehicleViewSet, FleetBookingViewSet

# Using a DefaultRouter for consistent RESTful endpoints
fleet_router = DefaultRouter()
fleet_router.register(r'vehicles', VehicleViewSet, basename='vehicle')
fleet_router.register(r'bookings', FleetBookingViewSet, basename='fleet-booking')

urlpatterns = [
    path('', include(fleet_router.urls)),
]