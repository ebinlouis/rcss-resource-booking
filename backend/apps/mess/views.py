from django.db import transaction
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError

from apps.mess.models import MessBooking
from apps.mess.serializers import MessBookingSerializer
from apps.users.models import Role


# ── Role resolution ───────────────────────────────────────────────────────────

def _is_mess_admin(user):
    return (
        user.is_superuser or
        Role.Name.MESS_MANAGER in user.get_effective_roles()
    )


# ── ViewSet ───────────────────────────────────────────────────────────────────

class MessBookingViewSet(viewsets.ModelViewSet):
    queryset           = MessBooking.objects.all().order_by('-created_at')
    serializer_class   = MessBookingSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if _is_mess_admin(user):
            return MessBooking.objects.all().order_by('-created_at')
        return MessBooking.objects.filter(user=user).order_by('-created_at')

    @transaction.atomic
    def perform_create(self, serializer):
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
        bookings   = MessBooking.objects.filter(user=request.user).order_by('-created_at')
        serializer = self.get_serializer(bookings, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['patch'])
    @transaction.atomic
    def approve(self, request, pk=None):
        if not _is_mess_admin(request.user):
            return Response(
                {"detail": "Only the Mess administrator can approve catering requests."},
                status=status.HTTP_403_FORBIDDEN,
            )
        booking = self.get_object()
        if booking.status == 'APPROVED':
            return Response(
                {"detail": "This booking is already approved."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        booking.status      = 'APPROVED'
        booking.resolved_by = request.user
        booking.resolved_at = timezone.now()
        booking.save()
        return Response({"status": "APPROVED", "message": "Booking approved."})

    @action(detail=True, methods=['patch'])
    @transaction.atomic
    def reject(self, request, pk=None):
        if not _is_mess_admin(request.user):
            return Response(
                {"detail": "Only the Mess administrator can reject catering requests."},
                status=status.HTTP_403_FORBIDDEN,
            )
        booking = self.get_object()
        if booking.status == 'REJECTED':
            return Response(
                {"detail": "This booking is already rejected."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        remark = request.data.get('rejection_remark', '').strip()
        if not remark:
            return Response(
                {"rejection_remark": "A rejection remark is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        booking.status           = 'REJECTED'
        booking.rejection_remark = remark
        booking.remarks_by_admin = remark
        booking.resolved_by      = request.user
        booking.resolved_at      = timezone.now()
        booking.save()
        return Response({"status": "REJECTED", "message": "Booking rejected."})