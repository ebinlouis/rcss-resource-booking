"""
views.py — apps/fleet
Mirrors the SpaceViewSet / SpaceBookingViewSet pattern exactly.
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.utils import timezone

from apps.users.permissions import IsAdminOrReadOnly, IsApprover, HasRoleOrReadOnly
from apps.notifications.utils import (
    mark_pending_request_notifications_read,
    notify_booking_status_change,
    notify_incharge_cancelled,
    notify_comanagers_actioned,
)
from apps.fleet.models import Vehicle, FleetBooking
from apps.fleet.serializers import VehicleSerializer, FleetBookingSerializer
from apps.users.models import Role


# ==========================================
# INLINE PERMISSION — IsOwnerOrAdminOrReadOnly
# Mirrors the spaces app pattern exactly.
# ==========================================
from rest_framework import permissions as drf_permissions


class IsOwnerOrAdminOrReadOnly(drf_permissions.BasePermission):
    """
    - Safe methods (GET, HEAD, OPTIONS): any authenticated user.
    - Unsafe methods (PATCH, PUT, DELETE): owner only, OR IT_ADMIN/superuser.
    """

    def has_object_permission(self, request, view, obj):
        if request.method in drf_permissions.SAFE_METHODS:
            return True
        if request.user.is_superuser or request.user.is_staff:
            return True
        if Role.Name.FLEET_MANAGER in request.user.get_effective_roles():
            return True
        return obj.user == request.user

class IsFleetManagerOrReadOnly(HasRoleOrReadOnly):
    required_roles = [Role.Name.FLEET_MANAGER, Role.Name.IT_ADMIN]


# ==========================================
# VEHICLE VIEWSET
# ==========================================
class VehicleViewSet(viewsets.ModelViewSet):
    """
    Vehicle catalog.
    - Authenticated users: list & retrieve (GET).
    - IT_ADMIN only: create, update, deactivate.
    Mirrors SpaceViewSet.
    """
    serializer_class = VehicleSerializer
    permission_classes = [IsFleetManagerOrReadOnly]

    def get_permissions(self):
        # Vehicle catalog is publicly viewable
        if self.action in ('list', 'retrieve'):
            return [AllowAny()]
        return super().get_permissions()

    # ✅ FIX: Always look up vehicles from the FULL queryset (active + inactive)
    # so that admin PATCH actions (reactivate, edit) on inactive vehicles
    # don't 404. get_queryset() filters out inactive vehicles for regular
    # users, which was causing the "No Vehicle matches the given query" error.
    def get_object(self):
        obj = get_object_or_404(Vehicle, pk=self.kwargs['pk'])
        self.check_object_permissions(self.request, obj)
        return obj

    def get_queryset(self):
        """
        Regular users see only active vehicles.
        Admins can pass ?all=true to see deactivated ones too.
        """
        user = self.request.user
        is_admin = user.is_authenticated and (
            user.is_superuser or user.is_staff or (
                Role.Name.FLEET_MANAGER in user.get_effective_roles()
            )
        )
        if is_admin and self.request.query_params.get('all') == 'true':
            return Vehicle.objects.all().order_by('name')
        return Vehicle.objects.filter(is_active=True).order_by('name')

    @action(detail=False, methods=['get'])
    def available(self, request):
        """
        GET /api/fleet/vehicles/available/?passengers=40&start_datetime=...&end_datetime=...
        """
        passengers = request.query_params.get('passengers')
        start_str = request.query_params.get('start_datetime')
        end_str = request.query_params.get('end_datetime')
        exclude_booking_id = request.query_params.get('exclude_booking_id')

        if not all([passengers, start_str, end_str]):
            return Response(
                {"error": "passengers, start_datetime, and end_datetime are required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            passengers = int(passengers)
        except ValueError:
            return Response(
                {"error": "Invalid passenger count"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Base filter: active and capacity >= passengers
        qs = Vehicle.objects.filter(is_active=True, capacity__gte=passengers)

        # Exclude vehicles having APPROVED or PENDING bookings overlapping with the requested times
        overlapping = FleetBooking.objects.filter(
            status__in=['APPROVED', 'PENDING'],
            start_datetime__lt=end_str,
            end_datetime__gt=start_str,
        )

        if exclude_booking_id:
            overlapping = overlapping.exclude(id=exclude_booking_id)

        overlapping_vehicle_ids = overlapping.values_list('vehicle_id', flat=True)

        qs = qs.exclude(id__in=overlapping_vehicle_ids).order_by('capacity', 'name')

        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)


# ==========================================
# FLEET BOOKING VIEWSET
# ==========================================
class FleetBookingViewSet(viewsets.ModelViewSet):
    """
    Fleet booking requests.
    Mirrors SpaceBookingViewSet pattern:
      - perform_create()     → auto-assigns user + department
      - get_queryset()       → owner-scoped, ?view=general/pending/active/resolved_by_me for admins
      - review()             → approve / reject action (admin only)
      - cancel()             → user cancels their own PENDING booking
      - reschedule()         → admin reschedules/edits an APPROVED booking
    """
    serializer_class = FleetBookingSerializer
    permission_classes = [IsAuthenticated, IsOwnerOrAdminOrReadOnly]

    # ------------------------------------------------------------------
    # HELPER — is the current user an admin/approver?
    # ------------------------------------------------------------------

    def _is_admin(self, user):
        return user.is_superuser or user.is_staff or (
            Role.Name.FLEET_MANAGER in user.get_effective_roles()
        )

    # ------------------------------------------------------------------
    # GET OBJECT — bypass owner-scoped queryset for admin actions
    # ------------------------------------------------------------------

    def get_object(self):
        if self.action in ['review', 'reschedule']:
            obj = get_object_or_404(FleetBooking, pk=self.kwargs['pk'])
            self.check_object_permissions(self.request, obj)
            return obj
        return super().get_object()

    def get_queryset(self):
        user = self.request.user
        is_admin = self._is_admin(user)
        view_param = self.request.query_params.get('view', '')
        now = timezone.now()

        FleetBooking.objects.filter(
            status='PENDING',
            end_datetime__lt=now
        ).update(status='EXPIRED')

        FleetBooking.objects.filter(
            status='APPROVED',
            end_datetime__lt=now
        ).update(status='COMPLETED')

        if is_admin and view_param == 'general':
            qs = FleetBooking.objects.all()

        elif is_admin and view_param == 'pending':
            qs = FleetBooking.objects.filter(status='PENDING')

        elif is_admin and view_param == 'active':
            qs = FleetBooking.objects.filter(status='APPROVED')

        elif is_admin and view_param == 'resolved_by_me':
            qs = FleetBooking.objects.filter(resolved_by=user)

        else:
            qs = FleetBooking.objects.filter(user=user)

        # --- Optional filters ---
        status_filter = self.request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter.upper())

        vehicle_filter = self.request.query_params.get('vehicle')
        if vehicle_filter:
            qs = qs.filter(vehicle_id=vehicle_filter)

        date_filter = self.request.query_params.get('date')
        if date_filter:
            qs = qs.filter(start_datetime__date=date_filter)

        return qs.select_related(
            'user', 'vehicle', 'department', 'resolved_by', 'updated_by'
        ).order_by('-created_at')

    # ------------------------------------------------------------------
    # CREATE — auto-assign user + department
    # ------------------------------------------------------------------

    def perform_create(self, serializer):
        user = self.request.user
        from apps.users.models import Role

        if Role.Name.STUDENT in user.get_effective_roles():
            from rest_framework.exceptions import ValidationError
            raise ValidationError({
                "non_field_errors": "Students are not permitted to make fleet bookings."
            })

        if not user.department:
            from rest_framework.exceptions import ValidationError
            raise ValidationError({
                "department": (
                    "Your profile does not have a department assigned. "
                    "Please complete your profile before making a booking."
                )
            })

        booking = serializer.save(
            user=user,
            department=user.department,
        )

        from apps.notifications.utils import get_raw_global_approvers, notify_new_request

        eligible_set = get_raw_global_approvers(Role.Name.FLEET_MANAGER)
        
        if len(eligible_set) == 1 and user in eligible_set:
            booking.status = 'APPROVED'
            booking.resolved_by = user
            booking.resolved_at = timezone.now()
            booking.remarks_by_admin = "Auto-approved -- requester is the sole eligible approver for this resource."
            booking.save(update_fields=['status', 'resolved_by', 'resolved_at', 'remarks_by_admin'])
            return

        notify_new_request(
            booking=booking,
            domain='fleet',
            role_name=Role.Name.FLEET_MANAGER,
            exclude_user=user
        )

    def partial_update(self, request, *args, **kwargs):
        booking = self.get_object()

        # Prevent editing past bookings
        if booking.end_datetime <= timezone.now():
            return Response(
                {"error": "Past bookings cannot be modified."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        original_status = booking.status

        serializer = self.get_serializer(
            booking,
            data=request.data,
            partial=True,
        )

        serializer.is_valid(raise_exception=True)

        updated_booking = serializer.save()

        # If an APPROVED booking was edited, send it back for approval
        if original_status == "APPROVED":
            updated_booking.status = "PENDING"
            updated_booking.resolved_by = None
            updated_booking.resolved_at = None
            updated_booking.save()

        return Response(
            self.get_serializer(updated_booking).data
        )

    # ------------------------------------------------------------------
    # REVIEW ACTION — approve / reject (admin only)
    # ------------------------------------------------------------------

    @action(
        detail=True,
        methods=['patch'],
        permission_classes=[IsAuthenticated, IsApprover],
        url_path='review',
    )
    def review(self, request, pk=None):
        booking = self.get_object()

        if booking.status != 'PENDING':
            return Response(
                {"error": f"This booking is already {booking.status}."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        new_status = request.data.get('status', '').upper()
        remarks = request.data.get('remarks', '').strip()

        if new_status not in ['APPROVED', 'REJECTED']:
            return Response(
                {"error": "status must be APPROVED or REJECTED."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if new_status == 'REJECTED' and not remarks:
            return Response(
                {"error": "remarks are required when rejecting a booking."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        booking.status = new_status
        booking.resolved_by = request.user
        booking.resolved_at = timezone.now()
        if remarks:
            booking.remarks_by_admin = remarks

        try:
            booking.save()
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_409_CONFLICT)

        mark_pending_request_notifications_read(booking, domain='fleet')
        notify_booking_status_change(
            booking=booking,
            new_status=new_status,
            domain='fleet',
            resolved_by=request.user,
            remarks=remarks,
        )
        notify_comanagers_actioned(
            booking=booking,
            domain='fleet',
            actioned_by=request.user,
            new_status=new_status,
        )

        serializer = self.get_serializer(booking)
        return Response(serializer.data)

    # ------------------------------------------------------------------
    # CANCEL ACTION — owner can cancel their own PENDING booking
    # ------------------------------------------------------------------

    @action(
        detail=True,
        methods=['patch'],
        permission_classes=[IsAuthenticated],
        url_path='cancel',
    )
    def cancel(self, request, pk=None):
        booking = self.get_object()

        if booking.end_datetime <= timezone.now():
            return Response(
                {"error": "Past bookings cannot be cancelled."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if booking.user != request.user:
            return Response(
                {"error": "You can only cancel your own bookings."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if booking.status not in ['PENDING', 'APPROVED']:
            return Response(
                {"error": f"Cannot cancel a {booking.status} booking."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        booking.status = 'CANCELLED'
        booking.save()

        mark_pending_request_notifications_read(booking, domain='fleet')
        notify_booking_status_change(
            booking=booking,
            new_status='CANCELLED',
            domain='fleet',
            resolved_by=None,
        )
        notify_incharge_cancelled(
            booking=booking,
            domain='fleet',
            role_name='FLEET_MANAGER',
        )

        return Response({
            "message": f"Booking {booking.reference_code} has been cancelled.",
            "reference_code": booking.reference_code,
            "status": booking.status,
        })

    # ------------------------------------------------------------------
    # RESCHEDULE ACTION — admin edits an APPROVED booking
    # ------------------------------------------------------------------

    @action(
        detail=True,
        methods=['patch'],
        permission_classes=[IsAuthenticated, IsApprover],
        url_path='reschedule',
    )
    def reschedule(self, request, pk=None):
        booking = self.get_object()

        if booking.status not in ['APPROVED', 'PENDING']:
            return Response(
                {"error": f"Cannot reschedule a {booking.status} booking."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = self.get_serializer(
            booking,
            data=request.data,
            partial=True,
            context={'request': request},
        )

        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        remarks = request.data.get('remarks_by_admin', '').strip()
        save_kwargs = {'updated_by': request.user}
        if remarks:
            save_kwargs['remarks_by_admin'] = remarks

        try:
            serializer.save(**save_kwargs)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_409_CONFLICT)

        return Response(self.get_serializer(booking).data)