from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from apps.spaces.permissions import IsOwnerOrAdminOrReadOnly
from apps.media.models import MediaBooking
from apps.media.serializers import MediaBookingSerializer


class MediaBookingViewSet(viewsets.ModelViewSet):
    serializer_class = MediaBookingSerializer
    permission_classes = [IsAuthenticated, IsOwnerOrAdminOrReadOnly]

    def _is_admin(self, user):
        return user.is_superuser or user.is_staff or (
            user.role and user.role.name in ['IT_ADMIN', 'HOD']
        )

    def get_queryset(self):
        user       = self.request.user
        view_param = self.request.query_params.get('view', 'mine')
        is_admin   = self._is_admin(user)

        qs = MediaBooking.objects.select_related('space', 'user', 'department')

        if is_admin and view_param == 'general':
            # All bookings (usually excluding REJECTED for activity feed, but here we return all)
            return qs.order_by('-created_at')
            
        elif is_admin and view_param == 'pending':
            return qs.filter(status='PENDING').order_by('-created_at')
            
        elif is_admin and view_param == 'active':
            return qs.filter(status='APPROVED').order_by('booking_date', 'start_time')
            
        elif is_admin and view_param == 'resolved_by_me':
            return qs.filter(resolved_by=user).order_by('-resolved_at')

        elif view_param == 'general':
            # Non-admin general feed
            return qs.exclude(status='REJECTED').order_by('booking_date', 'start_time')

        # Default: 'mine' — only this user's own bookings (all statuses)
        return qs.filter(user=user).order_by('-created_at')

    def perform_create(self, serializer):
        """
        Security enforcement: inject user and department automatically.
        Frontend never sends these fields — backend always sets them.
        Mirrors MessBookingViewSet.perform_create() pattern.
        """
        user = self.request.user
        serializer.save(
            user=user,
            department=user.department if hasattr(user, 'department') and user.department else None,
        )

    @action(detail=True, methods=['patch'], permission_classes=[IsAuthenticated])
    def review(self, request, pk=None):
        """
        Admin-only action: approve or reject a media booking.
        Mirrors SpaceBookingViewSet.review() and FleetBookingViewSet.review() exactly.

        PATCH /api/media/bookings/{id}/review/
        Payload: { "status": "APPROVED" }
                 { "status": "REJECTED", "remarks_by_admin": "Reason here" }
        """
        user = request.user
        if not (user.is_staff or user.is_superuser):
            return Response(
                {"detail": "Not authorized to review bookings."},
                status=status.HTTP_403_FORBIDDEN
            )

        booking    = self.get_object()
        new_status = request.data.get('status')
        remarks    = request.data.get('remarks_by_admin', '')

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

        booking.status          = new_status
        booking.remarks_by_admin = remarks
        booking.resolved_by     = user
        booking.resolved_at     = timezone.now()
        booking.save()

        serializer = self.get_serializer(booking)
        return Response(serializer.data, status=status.HTTP_200_OK)
