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
from apps.users.models import RoleOverride

# ── Role resolution ───────────────────────────────────────────────────────────
# Lowercase constant so DB casing ('Mess', 'MESS', 'mess') never matters.
MESS_ROLE = 'mess'


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


def _is_mess_admin(user):
    """Returns True only if the user's effective role resolves to the mess role."""
    return _normalize(_get_effective_role(user)) == MESS_ROLE


# ── ViewSet ───────────────────────────────────────────────────────────────────

class MessBookingViewSet(viewsets.ModelViewSet):
    queryset           = MessBooking.objects.all().order_by('-created_at')
    serializer_class   = MessBookingSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """
        Mess admins see all bookings.
        Everyone else sees only their own.
        No is_staff / is_superuser shortcut — role is the only gate.
        """
        user = self.request.user

        if _is_mess_admin(user):
            return MessBooking.objects.all().order_by('-created_at')

        return MessBooking.objects.filter(user=user).order_by('-created_at')

    @transaction.atomic
    def perform_create(self, serializer):
        """
        Booking is always tied to the authenticated user and their department.
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
        GET /api/mess/bookings/my-bookings/

        Always returns only the authenticated user's own bookings regardless
        of role. Mess admins checking their personal bookings use this, not
        the list endpoint.
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
        PATCH /api/mess/bookings/{id}/approve/
        Mess admin only.
        """
        if not _is_mess_admin(request.user):
            return Response(
                {"detail": "Only the Mess administrator can approve catering requests."},
                status=status.HTTP_403_FORBIDDEN,
            )

        booking = self.get_object()

        if booking.status == 'confirmed':
            return Response(
                {"detail": "This booking is already confirmed."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        booking.status = 'confirmed'
        booking.save()

        return Response({"status": "confirmed", "message": "Booking approved."})

    @action(detail=True, methods=['patch'])
    @transaction.atomic
    def reject(self, request, pk=None):
        """
        PATCH /api/mess/bookings/{id}/reject/
        Mess admin only. Requires a non-empty rejection_remark.
        """
        if not _is_mess_admin(request.user):
            return Response(
                {"detail": "Only the Mess administrator can reject catering requests."},
                status=status.HTTP_403_FORBIDDEN,
            )

        booking = self.get_object()

        if booking.status == 'rejected':
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

        booking.status           = 'rejected'
        booking.rejection_remark = remark
        booking.save()

        return Response({"status": "rejected", "message": "Booking rejected."})