from django.db import transaction
from django.utils import timezone
from django.db.models import Sum, Q
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import ValidationError

from apps.media.models import MediaBooking, MediaEquipmentRequest
from apps.media.serializers import MediaBookingSerializer
from apps.spaces.models import Equipment
from apps.users.models import RoleOverride

# ── Role resolution ───────────────────────────────────────────────────────────
# Lowercase constant so DB casing ('Media', 'MEDIA', 'media') never matters.
MEDIA_ROLE = 'media'


def _normalize(role):
    """Lowercase + strip so DB casing never matters for comparisons."""
    return (role or "").strip().lower()


def _get_effective_role(user):
    """
    Resolve the user's active role name (raw, as stored in DB).
    Priority: active RoleOverride -> user.role FK -> first Django group.
    is_superuser / is_staff are deliberately excluded — they are
    Django-admin concerns only and must not grant module access.
    """
    now = timezone.now()

    active_override = RoleOverride.objects.filter(
        user=user,
        is_active=True,
    ).filter(
        Q(expires_at__isnull=True) | Q(expires_at__gt=now)
    ).first()

    if active_override:
        return active_override.overridden_role.name

    if getattr(user, 'role', None):
        return user.role.name

    if user.groups.exists():
        return user.groups.first().name

    return ""


def _is_media_admin(user):
    """Returns True only if the user's effective role resolves to the media role."""
    return _normalize(_get_effective_role(user)) == MEDIA_ROLE


# ── ViewSet ───────────────────────────────────────────────────────────────────

class MediaBookingViewSet(viewsets.ModelViewSet):
    serializer_class   = MediaBookingSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user       = self.request.user
        view_param = self.request.query_params.get('view', 'mine')
        is_admin   = _is_media_admin(user)

        qs = MediaBooking.objects.select_related(
            'space', 'user', 'department'
        ).prefetch_related('equipment_requests__equipment')

        # Admin-only views — non-media-admins get an empty queryset for these.
        # The frontend guard is UX only; this is the real enforcement.
        if view_param == 'pending':
            if not is_admin:
                return qs.none()
            return qs.filter(status='PENDING').order_by('-created_at')

        if view_param == 'active':
            if not is_admin:
                return qs.none()
            return qs.filter(status='APPROVED').order_by('booking_date', 'setup_start_time')

        if view_param == 'resolved_by_me':
            if not is_admin:
                return qs.none()
            return qs.filter(resolved_by=user).order_by('-resolved_at')

        if view_param == 'general':
            if is_admin:
                return qs.order_by('-created_at')
            # Regular users: own bookings excluding rejected
            return qs.filter(user=user).exclude(status='REJECTED').order_by('booking_date', 'setup_start_time')

        # Default: 'mine' — always scoped to the requesting user regardless of role
        return qs.filter(user=user).order_by('-created_at')

    @transaction.atomic
    def perform_create(self, serializer):
        user      = self.request.user
        user_dept = getattr(user, 'department', None)

        if not user_dept:
            raise ValidationError({
                "non_field_errors": (
                    "Your user profile is not assigned to a department. "
                    "Please contact an administrator before booking."
                )
            })

        serializer.save(user=user, department=user_dept)

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def check_availability(self, request):
        """
        Strict Inventory Math Endpoint.
        GET /api/media/bookings/check_availability/?date=2026-05-15&start=09:00&end=14:00
        """
        booking_date = request.query_params.get('date')
        req_start    = request.query_params.get('start')  # maps to setup_start_time
        req_end      = request.query_params.get('end')    # maps to teardown_end_time

        if not all([booking_date, req_start, req_end]):
            return Response(
                {"error": "date, start, and end parameters are required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Find all bookings on this date that OVERLAP with the requested time window.
        # Logic: (Existing Setup < Requested Teardown) AND (Existing Teardown > Requested Setup)
        # Exclude REJECTED and CANCELLED bookings.
        overlapping_bookings = MediaBooking.objects.filter(
            booking_date=booking_date,
            setup_start_time__lt=req_end,
            teardown_end_time__gt=req_start
        ).exclude(status__in=['REJECTED', 'CANCELLED'])

        checked_out_gear = MediaEquipmentRequest.objects.filter(
            media_booking__in=overlapping_bookings
        ).values('equipment_id').annotate(total_used=Sum('quantity'))

        used_map = {item['equipment_id']: item['total_used'] for item in checked_out_gear}

        all_equipment = Equipment.objects.filter(is_active=True, is_portable=True)
        availability  = []

        for eq in all_equipment:
            used      = used_map.get(eq.id, 0)
            available = max(0, eq.total_owned - used)
            availability.append({
                "id":                  eq.id,
                "name":                eq.name,
                "category":            eq.category,
                "total_owned":         eq.total_owned,
                "currently_available": available,
            })

        return Response(availability, status=status.HTTP_200_OK)

    @action(detail=True, methods=['patch'], permission_classes=[IsAuthenticated])
    @transaction.atomic
    def review(self, request, pk=None):
        if not _is_media_admin(request.user):
            return Response(
                {"detail": "Only the Media administrator can review requests."},
                status=status.HTTP_403_FORBIDDEN,
            )

        booking    = self.get_object()
        new_status = request.data.get('status')
        remarks    = request.data.get('remarks_by_admin', '')

        if new_status not in ['APPROVED', 'REJECTED']:
            return Response(
                {"error": "Invalid status. Must be APPROVED or REJECTED."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if new_status == 'REJECTED' and not remarks.strip():
            return Response(
                {"error": "Remarks are required when rejecting a booking."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        booking.status           = new_status
        booking.remarks_by_admin = remarks
        booking.resolved_by      = request.user
        booking.resolved_at      = timezone.now()
        booking.save()

        serializer = self.get_serializer(booking)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='my-bookings')
    def my_bookings(self, request):
        """
        GET /api/media/bookings/my-bookings/
        Always returns only the authenticated user's own bookings regardless of role.
        Media admins checking their personal bookings use this, not the list endpoint.
        """
        bookings = MediaBooking.objects.filter(
            user=request.user
        ).order_by('-created_at')

        serializer = self.get_serializer(bookings, many=True)
        return Response(serializer.data)