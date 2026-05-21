from django.db import transaction
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError

from apps.approvals.lifecycle import (
    can_user_modify_booking,
    refresh_booking_lifecycle,
    refresh_queryset_lifecycle,
)
from apps.mess.models import MessBooking
from apps.mess.serializers import MessBookingSerializer
from apps.users.models import Role

from apps.notifications.utils import notify_booking_status_change


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
        refresh_queryset_lifecycle(MessBooking.objects.prefetch_related('daily_menus'))
        if _is_mess_admin(user):
            return MessBooking.objects.prefetch_related('daily_menus').all().order_by('-created_at')
        return MessBooking.objects.prefetch_related('daily_menus').filter(user=user).order_by('-created_at')

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

    def perform_destroy(self, instance):
        refresh_booking_lifecycle(instance)
        if not can_user_modify_booking(instance):
            raise ValidationError({"detail": "Cannot cancel a mess booking whose first meal time has already passed."})
        instance.delete()

    @action(detail=False, methods=['get'], url_path='my-bookings')
    def my_bookings(self, request):
        refresh_queryset_lifecycle(MessBooking.objects.prefetch_related('daily_menus').filter(user=request.user))
        bookings   = MessBooking.objects.prefetch_related('daily_menus').filter(user=request.user).order_by('-created_at')
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
        refresh_booking_lifecycle(booking)
        booking.refresh_from_db()
        if booking.status == 'APPROVED':
            return Response(
                {"detail": "This booking is already approved."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if booking.status != 'PENDING':
            return Response(
                {"detail": f"Cannot approve a booking that is currently {booking.status}."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        booking.status      = 'APPROVED'
        booking.resolved_by = request.user
        booking.resolved_at = timezone.now()
        booking.save()

        # 👇 FIRE THE NEW NOTIFICATION HERE 👇
        notify_booking_status_change(
            booking=booking,
            new_status='APPROVED',
            domain='mess',
            resolved_by=request.user,
        )

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
        refresh_booking_lifecycle(booking)
        booking.refresh_from_db()
        if booking.status == 'REJECTED':
            return Response(
                {"detail": "This booking is already rejected."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if booking.status not in ['PENDING', 'APPROVED']:
            return Response(
                {"detail": f"Cannot reject a booking that is currently {booking.status}."},
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

        # FIRE THE NEW NOTIFICATION HERE
        notify_booking_status_change(
            booking=booking,
            new_status='REJECTED',
            domain='mess',
            resolved_by=request.user,
            remarks=remark
        )

        return Response({"status": "REJECTED", "message": "Booking rejected."})