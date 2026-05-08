from django.db import transaction
from django.utils import timezone
from django.db.models import Q
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

    def _get_effective_role(self, user):
        """
        Helper to determine the user's active role, accounting for Role Overrides
        and falling back to Django groups if the custom role FK is missing.
        """
        if user.is_superuser:
            return 'IT_ADMIN'
        
        now = timezone.now()
        active_override = user.role_overrides.filter(
            is_active=True
        ).filter(
            Q(expires_at__isnull=True) | Q(expires_at__gt=now)
        ).first()

        if active_override:
            return active_override.overridden_role.name.upper()
            
        # Fallback mirroring the CurrentUserView logic
        base_role = user.role.name if getattr(user, 'role', None) else None
        if not base_role and user.groups.exists():
            base_role = user.groups.first().name
            
        return base_role.upper() if base_role else ""

    def get_queryset(self):
        """
        Filter so standard users only see their own requests.
        Authorized Admins see all for logistics management.
        """
        user = self.request.user
        effective_role = self._get_effective_role(user)

        # Added 'MESS' to explicitly match the group name in your database
        if user.is_staff or effective_role in ['MESS', 'MESS ADMIN', 'IT_ADMIN', 'SYSTEM OPS', 'CATERING MANAGER']:
            return MessBooking.objects.all().order_by('-created_at')
        
        # Standard users see only their own
        return MessBooking.objects.filter(user=user).order_by('-created_at')

    @transaction.atomic
    def perform_create(self, serializer):
        """
        Security Enforcement: Automatically set the user and their department.
        Wrapped in atomic block for concurrency control.
        """
        user_dept = getattr(self.request.user, 'department', None)
        
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

    @action(detail=True, methods=['patch'])
    @transaction.atomic
    def approve(self, request, pk=None):
        """
        Endpoint: PATCH /api/mess/bookings/{id}/approve/
        Ensures only authorized personnel can approve catering requests.
        """
        booking = self.get_object()
        effective_role = self._get_effective_role(request.user)

        if effective_role not in ['MESS', 'MESS ADMIN', 'IT_ADMIN', 'SYSTEM OPS', 'CATERING MANAGER']:
            return Response(
                {"detail": "Only authorized administrators can approve catering requests."},
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

    @action(detail=True, methods=['patch'])
    @transaction.atomic
    def reject(self, request, pk=None):
        """
        Endpoint: PATCH /api/mess/bookings/{id}/reject/
        Ensures only authorized personnel can reject catering requests.
        """
        booking = self.get_object()
        effective_role = self._get_effective_role(request.user)

        if effective_role not in ['MESS', 'MESS ADMIN', 'IT_ADMIN', 'SYSTEM OPS', 'CATERING MANAGER']:
            return Response(
                {"detail": "Only authorized administrators can reject catering requests."},
                status=status.HTTP_403_FORBIDDEN
            )

        if booking.status == 'rejected':
            return Response(
                {"detail": "This booking is already rejected."},
                status=status.HTTP_400_BAD_REQUEST
            )

        booking.status = 'rejected'
        booking.save()

        return Response({"status": "rejected", "message": "Booking rejected."})