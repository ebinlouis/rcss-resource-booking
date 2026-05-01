"""
views.py — Fleet, Mess, and Media apps
Follows the SpaceViewSet / SpaceBookingViewSet pattern from apps/spaces/views.py
Uses ModelViewSet for full CRUD. Permissions mirror the spaces app convention.
"""

from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from apps.users.permissions import IsAdminOrReadOnly  # Same custom permission as spaces app
# ---------------------------------------------------------------------------
# MEDIA
# ---------------------------------------------------------------------------
from apps.media.models import MediaBooking
from apps.media.serializers import MediaBookingSerializer


class MediaBookingViewSet(viewsets.ModelViewSet):
    """
    Media / AV equipment booking requests.
    - Any authenticated user can request equipment coverage.
    - space FK links the media request to an existing room so the IT team
      knows where to deploy.
    Mirrors SpaceBookingViewSet.
    """
    queryset = MediaBooking.objects.all().order_by('-created_at')
    serializer_class = MediaBookingSerializer
    permission_classes = [IsAuthenticated]