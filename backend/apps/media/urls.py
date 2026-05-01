# ---------------------------------------------------------------------------
# media/urls.py  (copy this block into apps/media/urls.py)
# ---------------------------------------------------------------------------
from apps.media.views import MediaBookingViewSet
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.fleet.views import VehicleViewSet, FleetBookingViewSet
 
media_router = DefaultRouter()
media_router.register('bookings', MediaBookingViewSet, basename='media-booking')
 
media_urlpatterns = [
    path('', include(media_router.urls)),
]