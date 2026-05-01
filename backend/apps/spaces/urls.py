from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import SpaceViewSet, SpaceBookingViewSet

# The router automatically generates all the standard REST URLs
router = DefaultRouter()
router.register(r'catalog', SpaceViewSet, basename='space')
router.register(r'requests', SpaceBookingViewSet, basename='space-booking')

urlpatterns = [
    path('', include(router.urls)),
]