from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import SpaceViewSet, SpaceBookingViewSet, EquipmentViewSet

router = DefaultRouter()
router.register(r'catalog', SpaceViewSet, basename='space')
router.register(r'requests', SpaceBookingViewSet, basename='space-booking')
router.register(r'inventory', EquipmentViewSet, basename='equipment') # <-- ADDED

urlpatterns = [
    path('', include(router.urls)),
]