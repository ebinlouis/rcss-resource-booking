from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.media.views import MediaBookingViewSet

media_router = DefaultRouter()
media_router.register(r'bookings', MediaBookingViewSet, basename='media-booking')

urlpatterns = [
    path('', include(media_router.urls)),
]
