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
)
from apps.mess.models import MessBooking, DailyMessMenu
from apps.mess.serializers import MessBookingSerializer
from apps.users.models import Role

from apps.notifications.utils import (
    mark_pending_request_notifications_read,
    notify_booking_status_change,
    notify_new_request,
)


# --- Role resolution ---

def _is_mess_admin(user):
    return (
        user.is_superuser or
        Role.Name.MESS_MANAGER in user.get_effective_roles()
    )


# --- ViewSet ---

class MessBookingViewSet(viewsets.ModelViewSet):
    queryset = MessBooking.objects.all().order_by('-updated_at')
    serializer_class = MessBookingSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user

        if _is_mess_admin(user):
            return (
                MessBooking.objects
                .prefetch_related('daily_menus')
                .all()
                .order_by('-updated_at')
            )

        return (
            MessBooking.objects
            .prefetch_related('daily_menus')
            .filter(user=user)
            .order_by('-updated_at')
        )

    @transaction.atomic
    def perform_create(self, serializer):
        user = self.request.user

        if Role.Name.STUDENT in user.get_effective_roles():
            raise ValidationError({
                "non_field_errors":
                "Students are not permitted to make mess bookings."
            })

        user_dept = getattr(user, 'department', None)

        booking = serializer.save(
            user=user,
            **({"department": user_dept} if user_dept else {})
        )

        notify_new_request(
            booking=booking,
            domain='mess',
            role_name=Role.Name.MESS_MANAGER
        )

    @transaction.atomic
    def perform_update(self, serializer):
        was_approved = serializer.instance.status == 'APPROVED'

        booking = serializer.save(
            updated_by=self.request.user
        )

        if was_approved and booking.status == 'PENDING':
            notify_new_request(
                booking=booking,
                domain='mess',
                role_name=Role.Name.MESS_MANAGER
            )

    def perform_destroy(self, instance):
        refresh_booking_lifecycle(instance)

        if not can_user_modify_booking(instance):
            raise ValidationError({
                "detail":
                "Cannot cancel a mess booking whose first meal time has already passed."
            })

        instance.status = 'CANCELLED'
        instance.resolved_by = None
        instance.resolved_at = timezone.now()
        instance.remarks_by_admin = 'Cancelled by requester.'

        instance.save(
            update_fields=[
                'status',
                'resolved_by',
                'resolved_at',
                'remarks_by_admin',
                'updated_at',
            ]
        )

        mark_pending_request_notifications_read(
            instance,
            domain='mess'
        )

    @action(detail=False, methods=['get'], url_path='my-bookings')
    def my_bookings(self, request):
        bookings = (
            MessBooking.objects
            .prefetch_related('daily_menus')
            .filter(user=request.user)
            .order_by('-updated_at')
        )

        serializer = self.get_serializer(
            bookings,
            many=True
        )

        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def suggestions(self, request):
        field = request.query_params.get('field')

        booking_fields = [
            'purpose_of_programme',
            'delivery_location',
        ]

        menu_fields = [
            'breakfast_menu',
            'morning_snack_option',
            'lunch_menu',
            'evening_snack_option',
            'dinner_menu',
        ]

        if field in booking_fields:
            data = (
                MessBooking.objects
                .exclude(**{f"{field}__isnull": True})
                .exclude(**{field: ""})
                .values_list(field, flat=True)
                .distinct()
            )

            return Response(sorted(list(data)))

        if field in menu_fields:
            data = (
                DailyMessMenu.objects
                .exclude(**{f"{field}__isnull": True})
                .exclude(**{field: ""})
                .values_list(field, flat=True)
                .distinct()
            )

            return Response(sorted(list(data)))

        return Response(
            {"detail": "Invalid field"},
            status=status.HTTP_400_BAD_REQUEST
        )

    @action(detail=True, methods=['patch'])
    @transaction.atomic
    def approve(self, request, pk=None):
        if not _is_mess_admin(request.user):
            return Response(
                {
                    "detail":
                    "Only the Mess administrator can approve catering requests."
                },
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
                {
                    "detail":
                    f"Cannot approve a booking that is currently {booking.status}."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        booking.status = 'APPROVED'
        booking.resolved_by = request.user
        booking.resolved_at = timezone.now()

        booking.save()

        mark_pending_request_notifications_read(
            booking,
            domain='mess'
        )

        notify_booking_status_change(
            booking=booking,
            new_status='APPROVED',
            domain='mess',
            resolved_by=request.user,
        )

        return Response({
            "status": "APPROVED",
            "message": "Booking approved."
        })

    @action(detail=True, methods=['patch'])
    @transaction.atomic
    def reject(self, request, pk=None):
        if not _is_mess_admin(request.user):
            return Response(
                {
                    "detail":
                    "Only the Mess administrator can reject catering requests."
                },
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
                {
                    "detail":
                    f"Cannot reject a booking that is currently {booking.status}."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        remark = request.data.get(
            'rejection_remark',
            ''
        ).strip()

        if not remark:
            return Response(
                {
                    "rejection_remark":
                    "A rejection remark is required."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        booking.status = 'REJECTED'
        booking.rejection_remark = remark
        booking.remarks_by_admin = remark
        booking.resolved_by = request.user
        booking.resolved_at = timezone.now()

        booking.save()

        mark_pending_request_notifications_read(
            booking,
            domain='mess'
        )

        notify_booking_status_change(
            booking=booking,
            new_status='REJECTED',
            domain='mess',
            resolved_by=request.user,
            remarks=remark
        )

        return Response({
            "status": "REJECTED",
            "message": "Booking rejected."
        })