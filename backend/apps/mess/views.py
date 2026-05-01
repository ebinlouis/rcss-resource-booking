"""
views.py — Fleet, Mess, and Media apps
Follows the SpaceViewSet / SpaceBookingViewSet pattern from apps/spaces/views.py
Uses ModelViewSet for full CRUD. Permissions mirror the spaces app convention.
"""

from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from apps.users.permissions import IsAdminOrReadOnly  # Same custom permission as spaces app


# ---------------------------------------------------------------------------
# MESS
# ---------------------------------------------------------------------------
from apps.mess.models import MessBooking
from apps.mess.serializers import MessBookingSerializer


class MessBookingViewSet(viewsets.ModelViewSet):
    """
    Mess / catering booking requests.
    - Any authenticated user can submit and view catering requests.
    - The 24-hour advance SLA is enforced in MessBookingSerializer.validate().
    There is no resource catalog model for Mess (delivery location is free text),
    so no MessResourceViewSet is needed.
    """
    queryset = MessBooking.objects.all().order_by('-created_at')
    serializer_class = MessBookingSerializer
    permission_classes = [IsAuthenticated]

