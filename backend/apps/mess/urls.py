from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.mess.views import MessBookingViewSet

mess_router = DefaultRouter()
mess_router.register(r'bookings', MessBookingViewSet, basename='mess-booking')

urlpatterns = [
    path('', include(mess_router.urls)),
]