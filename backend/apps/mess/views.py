from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from apps.mess.models import MessBooking
from apps.mess.serializers import MessBookingSerializer

class MessBookingViewSet(viewsets.ModelViewSet):
    queryset = MessBooking.objects.all().order_by('-created_at')
    serializer_class = MessBookingSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """
        Lead Logic: Filter so users only see their own requests.
        Staff/Admins see all for logistics management.
        """
        user = self.request.user
        if user.is_staff:
            return MessBooking.objects.all().order_by('-created_at')
        return MessBooking.objects.filter(user=user).order_by('-created_at')

    def perform_create(self, serializer):
        """
        Security Enforcement: Automatically set the user to the one logged in.
        """
        serializer.save(user=self.request.user)