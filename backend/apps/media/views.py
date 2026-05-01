from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from apps.media.models import MediaBooking
from apps.media.serializers import MediaBookingSerializer

class MediaBookingViewSet(viewsets.ModelViewSet):
    queryset = MediaBooking.objects.all().order_by('-created_at')
    serializer_class = MediaBookingSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """
        Lead Logic: Users should only see their own media requests.
        Admins/Staff should see everything.
        """
        user = self.request.user
        if user.is_staff:
            return MediaBooking.objects.all().order_by('-created_at')
        return MediaBooking.objects.filter(user=user).order_by('-created_at')

    def perform_create(self, serializer):
        """
        Security Enforcement: Automatically assign the booking to the logged-in user.
        """
        serializer.save(user=self.request.user)