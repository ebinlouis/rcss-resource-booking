from django.db import transaction
from rest_framework import viewsets, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError

from apps.mess.models import MessBooking
from apps.mess.serializers import MessBookingSerializer

class MessBookingViewSet(viewsets.ModelViewSet):
    queryset = MessBooking.objects.all().order_by('-created_at')
    serializer_class = MessBookingSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """
        Filter so standard users only see their own requests.
        Staff/Admins see all for logistics management.
        """
        user = self.request.user
        if user.is_staff:
            return MessBooking.objects.all().order_by('-created_at')
        return MessBooking.objects.filter(user=user).order_by('-created_at')

    @transaction.atomic
    def perform_create(self, serializer):
        """
        Security Enforcement: Automatically set the user and their department.
        Wrapped in atomic block for concurrency control.
        """
        # Safely pull the department from the user profile
        user_dept = getattr(self.request.user, 'department', None)
        
        # 🔥 PREVENT 500 ERROR: Catch missing department and return a clean 400 API error
        if not user_dept:
            raise ValidationError({
                "non_field_errors": "Your user profile is not assigned to a department. Please contact an administrator before booking."
            })
        
        serializer.save(
            user=self.request.user,
            department=user_dept
        )

    @transaction.atomic
    def perform_update(self, serializer):
        """
        Wrapped in atomic block for concurrency control during edits.
        """
        serializer.save()

    # Optional: Strict Role-Based Approval Endpoint
    @action(detail=True, methods=['patch'])
    @transaction.atomic
    def approve(self, request, pk=None):
        """
        Endpoint: PATCH /api/mess/bookings/{id}/approve/
        Ensures only the Mess Admin can approve catering requests.
        """
        booking = self.get_object()

        # Check if user is in the Mess Admin group
        if not request.user.groups.filter(name='Mess Admin').exists() and not request.user.is_superuser:
            return Response(
                {"detail": "Only the Mess Admin can approve catering requests."},
                status=status.HTTP_403_FORBIDDEN
            )

        if booking.status == 'confirmed':
            return Response(
                {"detail": "This booking is already confirmed."},
                status=status.HTTP_400_BAD_REQUEST
            )

        booking.status = 'confirmed'
        booking.save()

        return Response({"status": "confirmed", "message": "Booking approved."})