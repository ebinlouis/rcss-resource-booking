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

ADMIN_ROLES = {'MESS', 'MESS ADMIN', 'IT_ADMIN', 'SYSTEM OPS', 'CATERING MANAGER'}


class MessBookingViewSet(viewsets.ModelViewSet):
    queryset = MessBooking.objects.all().order_by('-created_at')
    serializer_class = MessBookingSerializer
    permission_classes = [IsAuthenticated]

    def _get_effective_role(self, user):
        """
        Determine the user's active role, accounting for role overrides
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

        base_role = user.role.name if getattr(user, 'role', None) else None
        if not base_role and user.groups.exists():
            base_role = user.groups.first().name

        return base_role.upper() if base_role else ""

    def get_queryset(self):
        """
        Standard users see only their own bookings.
        Authorized admin roles see all bookings for logistics management.
        """
        user = self.request.user
        effective_role = self._get_effective_role(user)

        if user.is_staff or effective_role in ADMIN_ROLES:
            return MessBooking.objects.all().order_by('-created_at')

        return MessBooking.objects.filter(user=user).order_by('-created_at')

    @transaction.atomic
    def perform_create(self, serializer):
        """
        Enforce that the booking is always tied to the authenticated user
        and their assigned department.
        """
        user_dept = getattr(self.request.user, 'department', None)

        if not user_dept:
            raise ValidationError({
                "non_field_errors": (
                    "Your user profile is not assigned to a department. "
                    "Please contact an administrator before booking."
                )
            })

        serializer.save(user=self.request.user, department=user_dept)

    @transaction.atomic
    def perform_update(self, serializer):
        serializer.save()

    @action(detail=False, methods=['get'], url_path='my-bookings')
    def my_bookings(self, request):
        """
        Endpoint: GET /api/mess/bookings/my-bookings/

        Returns only the authenticated user's own bookings, unconditionally.
        This endpoint exists specifically so the personal dashboard is never
        affected by the caller's role. Admin users checking their own
        bookings as individuals use this endpoint, not the list endpoint.
        """
        bookings = MessBooking.objects.filter(
            user=request.user
        ).order_by('-created_at')

        serializer = self.get_serializer(bookings, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['patch'])
    @transaction.atomic
    def approve(self, request, pk=None):
        """
        Endpoint: PATCH /api/mess/bookings/{id}/approve/
        """
        booking = self.get_object()
        effective_role = self._get_effective_role(request.user)

        if effective_role not in ADMIN_ROLES:
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

        Requires a non-empty `rejection_remark` in the request body.
        The remark is stored on the booking record so the requester
        can see the reason when they view their personal dashboard.
        """
        booking = self.get_object()
        effective_role = self._get_effective_role(request.user)

        if effective_role not in ADMIN_ROLES:
            return Response(
                {"detail": "Only authorized administrators can reject catering requests."},
                status=status.HTTP_403_FORBIDDEN
            )

        if booking.status == 'rejected':
            return Response(
                {"detail": "This booking is already rejected."},
                status=status.HTTP_400_BAD_REQUEST
            )

        remark = request.data.get('rejection_remark', '').strip()
        if not remark:
            return Response(
                {"rejection_remark": "A rejection remark is required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        booking.status = 'rejected'
        booking.rejection_remark = remark
        booking.save()

        return Response({"status": "rejected", "message": "Booking rejected."})