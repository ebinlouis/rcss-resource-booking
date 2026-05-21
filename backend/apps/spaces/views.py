import json
from datetime import timedelta
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import ValidationError

from apps.approvals.lifecycle import (
    can_user_modify_booking,
    refresh_booking_lifecycle,
    refresh_queryset_lifecycle,
)
from apps.notifications.utils import notify_booking_status_change
from apps.users.permissions import IsAdminOrReadOnly, IsEquipmentManagerOrReadOnly, IsITAdmin, IsPrincipal
from .permissions import IsOwnerOrAdminOrReadOnly
from .models import Block, Space, SpaceBooking, Equipment, SpaceApprover
from .serializers import (
    BlockSerializer,
    SpaceSerializer,
    SpaceBookingSerializer,
    EquipmentSerializer,
    SpaceApproverSerializer,
)
from .utils import get_overlapping_bookings, build_conflict_report


# ==========================================
# RESOURCE CATALOG MANAGEMENT
# ==========================================

class EquipmentViewSet(viewsets.ModelViewSet):
    serializer_class   = EquipmentSerializer
    permission_classes = [IsEquipmentManagerOrReadOnly]

    def get_queryset(self):
        qs = Equipment.objects.filter(is_active=True)

        # Hide media kits if the frontend is asking for Space gear
        if self.request.query_params.get('for_space') == 'true':
            qs = qs.filter(is_standard_media_kit=False)

        return qs


class SpaceViewSet(viewsets.ModelViewSet):
    serializer_class   = SpaceSerializer
    permission_classes = [IsAdminOrReadOnly]

    def get_queryset(self):
        qs = Space.objects.filter(is_active=True)

        min_capacity = self.request.query_params.get('min_capacity')
        if min_capacity is not None:
            try:
                qs = qs.filter(capacity_hard__gte=int(min_capacity))
            except ValueError:
                pass

        if self.request.query_params.get('for_suggestion') == 'true':
            qs = qs.filter(is_special_purpose=False)

        return qs

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def check_availability(self, request, pk=None):
        space = self.get_object()

        start_raw    = request.data.get('start_datetime')
        end_raw      = request.data.get('end_datetime')
        booking_type = request.data.get('booking_type', SpaceBooking.BookingType.SINGLE_CONTINUOUS)

        if not start_raw or not end_raw:
            return Response(
                {"error": "Both start_datetime and end_datetime are required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        from django.utils.dateparse import parse_datetime
        start_dt = parse_datetime(start_raw)
        end_dt   = parse_datetime(end_raw)

        if not start_dt or not end_dt:
            return Response(
                {"error": "Invalid datetime format. Use ISO 8601."},
                status=status.HTTP_400_BAD_REQUEST
            )

        from django.utils import timezone as tz
        if tz.is_naive(start_dt):
            start_dt = tz.make_aware(start_dt)
        if tz.is_naive(end_dt):
            end_dt = tz.make_aware(end_dt)

        exclude_pk = request.data.get('exclude_booking_id')
        if exclude_pk:
            try:
                exclude_pk = int(exclude_pk)
            except (TypeError, ValueError):
                exclude_pk = None

        conflicts = []

        if booking_type == SpaceBooking.BookingType.RECURRING_DAILY:
            if start_dt.time() >= end_dt.time():
                return Response(
                    {"error": "For recurring bookings, daily start time must be before end time."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            days_diff = (end_dt.date() - start_dt.date()).days
            if days_diff < 0:
                return Response(
                    {"error": "start_datetime must be before end_datetime."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            for i in range(days_diff + 1):
                slot_start = start_dt + timedelta(days=i)
                slot_end   = slot_start.replace(
                    hour        = end_dt.hour,
                    minute      = end_dt.minute,
                    second      = end_dt.second,
                    microsecond = end_dt.microsecond,
                )

                overlapping = get_overlapping_bookings(space, slot_start, slot_end, exclude_pk=exclude_pk)
                if overlapping.exists():
                    conflicts.extend(build_conflict_report(overlapping, request.user))

        else:
            if start_dt >= end_dt:
                return Response(
                    {"error": "start_datetime must be before end_datetime."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            overlapping = get_overlapping_bookings(space, start_dt, end_dt, exclude_pk=exclude_pk)
            if overlapping.exists():
                conflicts.extend(build_conflict_report(overlapping, request.user))

        unique_conflicts = []
        seen = set()
        for c in conflicts:
            sig = (c['date'], c['start'], c['end'], c.get('reference_code', ''))
            if sig not in seen:
                seen.add(sig)
                unique_conflicts.append(c)

        if not unique_conflicts:
            return Response({
                "available": True,
                "conflicts": [],
                "message":   "Space is available.",
            }, status=status.HTTP_200_OK)

        count = len(unique_conflicts)
        return Response({
            "available": False,
            "conflicts": unique_conflicts,
            "message":   f"{count} conflict{'s' if count != 1 else ''} found across your selected range.",
        }, status=status.HTTP_200_OK)


# ==========================================
# BOOKING SUBMISSIONS
# ==========================================

class SpaceBookingViewSet(viewsets.ModelViewSet):
    serializer_class   = SpaceBookingSerializer
    permission_classes = [IsAuthenticated, IsOwnerOrAdminOrReadOnly]

    def get_queryset(self):
        user       = self.request.user
        view_param = self.request.query_params.get('view', 'mine')
        refresh_queryset_lifecycle(SpaceBooking.objects.all())

        if view_param == 'general':
            return (
                SpaceBooking.objects
                .select_related('space', 'user')
                .exclude(status='REJECTED')
                .order_by('start_datetime')
            )

        return (
            SpaceBooking.objects
            .filter(user=user)
            .select_related('space', 'user')
            .order_by('-created_at')
        )

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    def perform_update(self, serializer):
        user     = self.request.user
        instance = serializer.instance

        if user.is_staff or user.is_superuser:
            serializer.save(updated_by=user)
            return

        extra_fields = {"updated_by": user}
        if instance.status == 'APPROVED':
            extra_fields.update({
                "status":           'PENDING',
                "resolved_by":      None,
                "resolved_at":      None,
                "remarks_by_admin": None,
            })

        serializer.save(**extra_fields)

    def perform_destroy(self, instance):
        refresh_booking_lifecycle(instance)
        if not can_user_modify_booking(instance):
            raise ValidationError({"detail": "Cannot cancel a booking whose start time has already passed."})
        instance.delete()

    @action(detail=True, methods=['patch'], permission_classes=[IsAuthenticated])
    def review(self, request, pk=None):
        user = request.user
        if not (user.is_staff or user.is_superuser):
            return Response(
                {"detail": "Not authorized to review bookings."},
                status=status.HTTP_403_FORBIDDEN
            )

        booking    = self.get_object()
        new_status = request.data.get('status')
        remarks    = request.data.get('remarks_by_admin', '')
        refresh_queryset_lifecycle(SpaceBooking.objects.filter(group_id=booking.group_id))
        booking.refresh_from_db()

        if new_status not in ['APPROVED', 'REJECTED']:
            return Response(
                {"error": "Invalid status. Must be APPROVED or REJECTED."},
                status=status.HTTP_400_BAD_REQUEST
            )

        if new_status == 'REJECTED' and not remarks:
            return Response(
                {"error": "Remarks are required when rejecting a booking."},
                status=status.HTTP_400_BAD_REQUEST
            )

        if new_status == 'APPROVED' and booking.status != 'PENDING':
            return Response(
                {"error": f"Cannot approve a booking that is currently {booking.status}."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if new_status == 'REJECTED' and booking.status not in ['PENDING', 'APPROVED']:
            return Response(
                {"error": f"Cannot reject a booking that is currently {booking.status}."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # ── Grouped Update Logic ──────────────────────────────────────────────
        # Safely loops and saves to trigger proper inheritance updates
        bookings_in_group = SpaceBooking.objects.filter(
            group_id=booking.group_id,
            status__in=['PENDING', 'APPROVED'],
        )
        for b in bookings_in_group:
            if new_status == 'APPROVED' and b.status != 'PENDING':
                continue
            b.status           = new_status
            b.remarks_by_admin = remarks
            b.resolved_by      = user
            b.resolved_at      = timezone.now()
            b.save()

        booking.refresh_from_db()
        serializer = self.get_serializer(booking)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['patch'], permission_classes=[IsPrincipal])
    def cancel(self, request, pk=None):
        """
        Principal cancels an APPROVED booking and releases the slot.
        """
        booking = self.get_object()
        remarks = request.data.get('remarks', '').strip()
        refresh_queryset_lifecycle(SpaceBooking.objects.filter(group_id=booking.group_id))
        booking.refresh_from_db()

        if booking.status != 'APPROVED':
            return Response(
                {
                    "error": (
                        f"Only APPROVED bookings can be cancelled by the Principal. "
                        f"This booking is currently '{booking.status}'."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not remarks:
            return Response(
                {"error": "Remarks are required when cancelling a booking."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        siblings       = SpaceBooking.objects.filter(group_id=booking.group_id, status='APPROVED')
        resolved_at    = timezone.now()
        cancelled_refs = []

        for sibling in siblings:
            sibling.status           = 'CANCELLED'
            sibling.resolved_by      = request.user
            sibling.resolved_at      = resolved_at
            sibling.remarks_by_admin = remarks
            sibling.save()
            notify_booking_status_change(sibling, 'CANCELLED', 'spaces', request.user, remarks=remarks)
            cancelled_refs.append(sibling.reference_code)

        return Response(
            {
                "message":     f"{len(cancelled_refs)} booking(s) cancelled successfully.",
                "cancelled":   cancelled_refs,
                "cancelled_by": request.user.email,
            },
            status=status.HTTP_200_OK,
        )


# ==========================================
# BLOCK MANAGEMENT  (IT_ADMIN only)
# ==========================================

class BlockViewSet(viewsets.ModelViewSet):
    serializer_class   = BlockSerializer
    permission_classes = [IsITAdmin]

    def get_queryset(self):
        qs = Block.objects.all().order_by('name')

        active_param = self.request.query_params.get('active')
        if active_param is not None:
            qs = qs.filter(is_active=active_param.lower() == 'true')

        return qs

    def destroy(self, request, *args, **kwargs):
        from django.db.models import ProtectedError
        try:
            return super().destroy(request, *args, **kwargs)
        except ProtectedError:
            return Response(
                {
                    "error": (
                        "This block cannot be deleted because spaces or approver "
                        "assignments reference it. "
                        "Set is_active=false to deactivate it instead."
                    )
                },
                status=status.HTTP_409_CONFLICT,
            )


# ==========================================
# SPACE APPROVER MANAGEMENT  (IT_ADMIN only)
# api/spaces/approvers/
# ==========================================

class SpaceApproverViewSet(viewsets.ModelViewSet):
    serializer_class   = SpaceApproverSerializer
    permission_classes = [IsITAdmin]

    def get_queryset(self):
        qs = (
            SpaceApprover.objects
            .select_related('user', 'role', 'block', 'space')
            .order_by('user__first_name', 'role__name')
        )

        user_id      = self.request.query_params.get('user')
        role_name    = self.request.query_params.get('role')
        block_id     = self.request.query_params.get('block')
        active_param = self.request.query_params.get('active')

        if user_id:
            qs = qs.filter(user_id=user_id)
        if role_name:
            qs = qs.filter(role__name=role_name.upper())
        if block_id:
            qs = qs.filter(block_id=block_id)
        if active_param is not None:
            qs = qs.filter(is_active=active_param.lower() == 'true')

        return qs

    def perform_create(self, serializer):
        serializer.save()

    def perform_destroy(self, instance):
        user = instance.user
        role = instance.role

        # Delete the row first so it's excluded from the remaining count.
        instance.delete()

        # Strip the role badge only if no other active assignment remains
        remaining = SpaceApprover.objects.filter(
            user=user,
            role=role,
            is_active=True,
        ).count()

        if remaining == 0:
            user.roles.remove(role)
