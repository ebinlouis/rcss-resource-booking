"""
views.py — Fleet, Mess, and Media apps
Follows the SpaceViewSet / SpaceBookingViewSet pattern from apps/spaces/views.py
Uses ModelViewSet for full CRUD. Permissions mirror the spaces app convention.
"""

from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from apps.users.permissions import IsAdminOrReadOnly  # Same custom permission as spaces app

# ---------------------------------------------------------------------------
# FLEET
# ---------------------------------------------------------------------------
from apps.fleet.models import Vehicle, FleetBooking
from apps.fleet.serializers import VehicleSerializer, FleetBookingSerializer


class VehicleViewSet(viewsets.ModelViewSet):
    """
    Vehicle catalog.
    - Any authenticated user can list/retrieve vehicles.
    - Only admins can create, update, or deactivate vehicles.
    Mirrors SpaceViewSet: catalog is read-only for regular users.
    """
    queryset = Vehicle.objects.filter(is_active=True)
    serializer_class = VehicleSerializer
    permission_classes = [IsAdminOrReadOnly]


class FleetBookingViewSet(viewsets.ModelViewSet):
    """
    Fleet booking requests.
    - Any authenticated user can create and view their own bookings.
    - Approval / rejection handled via separate action endpoints (Phase 1 Admin Dashboard).
    Mirrors SpaceBookingViewSet.
    """
    queryset = FleetBooking.objects.all().order_by('-created_at')
    serializer_class = FleetBookingSerializer
    permission_classes = [IsAuthenticated]


