from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.media.views import MediaBookingViewSet, MediaSettingsView

media_router = DefaultRouter()
media_router.register(r'bookings', MediaBookingViewSet, basename='media-booking')

urlpatterns = [
    path('settings/', MediaSettingsView.as_view(), name='media-settings'),
    path('', include(media_router.urls)),
]