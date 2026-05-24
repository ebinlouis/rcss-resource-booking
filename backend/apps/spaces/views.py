import json
from datetime import timedelta
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import ValidationError

from apps.approvals.lifecycle import (
    can_user_modify_booking,
    refresh_booking_lifecycle,
    refresh_queryset_lifecycle,
)
from apps.notifications.utils import (
    notify_booking_status_change, notify_group_status_change, notify_new_request,
    notify_faculty_new_request, notify_faculty_approved, notify_faculty_rejected,
    notify_faculty_details_changed, notify_incharge_escalated, notify_incharge_booking_returned,
    notify_faculty_resent, notify_student_cancelled_faculty, notify_incharge_booking_edited
)
from apps.users.models import Role, CustomUser
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
from .linked_bookings import (
    cancel_linked_siblings_for_space,
    capture_space_anchor,
    sync_linked_siblings_after_space_edit,
)


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

        # Faculty actions need to see bookings they sponsor, not own
        if self.action in ('faculty_approve', 'faculty_reject'):
            return SpaceBooking.objects.filter(
                faculty_sponsor=user
            ).select_related('space', 'user')

        # Incharge actions need to see escalated bookings
        if self.action in ('incharge_resend',):
            return SpaceBooking.objects.all().select_related('space', 'user')

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
            .order_by('-updated_at')
        )

    def perform_create(self, serializer):
        booking = serializer.save(user=self.request.user)

        is_student = 'STUDENT' in self.request.user.get_effective_roles()
        if is_student and booking.faculty_sponsor_id:
            booking.status = 'AWAITING_FACULTY'
            booking.faculty_response_deadline = timezone.now() + timedelta(hours=24)
            booking.save(update_fields=['status', 'faculty_response_deadline'])
            notify_faculty_new_request(booking)
            return

        # Determine which admin handles this space
        category = booking.space.approval_category
        if category == Space.ApprovalCategory.LAB:
            role = Role.Name.LAB_INCHARGE
        elif category == Space.ApprovalCategory.LIBRARY:
            role = Role.Name.LIBRARIAN
        else:
            role = Role.Name.RECEPTIONIST

        # Fire the notification to the correct space admin
        notify_new_request(
            booking=booking,
            domain='spaces',
            role_name=role
        )

    def perform_update(self, serializer):
        user     = self.request.user
        instance = serializer.instance
        previous_anchor = capture_space_anchor(instance)
        was_approved = instance.status == 'APPROVED'   # capture before save

        if user.is_staff or user.is_superuser:
            booking = serializer.save(updated_by=user)
            sync_linked_siblings_after_space_edit(
                booking,
                previous_anchor=previous_anchor,
                actor=user,
            )
            return

        extra_fields = {"updated_by": user}
        
        # FACULTY APPROVAL EDIT CASCADE
        if instance.faculty_sponsor_id and instance.status not in ['CANCELLED', 'REJECTED', 'EXPIRED', 'COMPLETED']:
            extra_fields.update({
                "status": "AWAITING_FACULTY",
                "resolved_by": None,
                "resolved_at": None,
                "remarks_by_admin": None,
                "faculty_response_deadline": timezone.now() + timedelta(hours=24),
            })
            booking = serializer.save(**extra_fields)
            sync_linked_siblings_after_space_edit(
                booking,
                previous_anchor=previous_anchor,
                actor=user,
            )
            notify_faculty_details_changed(booking)
            if was_approved or instance.status == 'FACULTY_ESCALATED':
                # We intentionally don't send a notification to the incharge right now
                # so we don't spam them. They will get notified once the faculty approves.
                pass
            return

        if was_approved:
            extra_fields.update({
                "status":           'PENDING',
                "resolved_by":      None,
                "resolved_at":      None,
                "remarks_by_admin": None,
            })

        booking = serializer.save(**extra_fields)
        sync_linked_siblings_after_space_edit(
            booking,
            previous_anchor=previous_anchor,
            actor=user,
        )

        # Notify the space admin that an approved booking was edited and needs re-review
        if was_approved and booking.status == 'PENDING':
            category = booking.space.approval_category
            if category == Space.ApprovalCategory.LAB:
                role = Role.Name.LAB_INCHARGE
            elif category == Space.ApprovalCategory.LIBRARY:
                role = Role.Name.LIBRARIAN
            else:
                role = Role.Name.RECEPTIONIST
            notify_incharge_booking_edited(
                booking=booking,
                domain='spaces',
                role_name=role
            )

    def perform_destroy(self, instance):
        refresh_booking_lifecycle(instance)
        if not can_user_modify_booking(instance):
            raise ValidationError({"detail": "Cannot cancel a booking whose start time has already passed."})
        status_before = instance.status

        if instance.faculty_sponsor_id:
            notify_student_cancelled_faculty(instance)
            
        instance.status = 'CANCELLED'
        instance.resolved_at = timezone.now()
        instance.remarks_by_admin = 'Cancelled by requester.'
        instance.save(update_fields=['status', 'resolved_at', 'remarks_by_admin', 'updated_at'])
        cancel_linked_siblings_for_space(instance, reason='Linked Space booking was cancelled by requester.')

        if status_before in ['PENDING', 'APPROVED', 'FACULTY_ESCALATED']:
            category = instance.space.approval_category
            if category == Space.ApprovalCategory.LAB:
                role = Role.Name.LAB_INCHARGE
            elif category == Space.ApprovalCategory.LIBRARY:
                role = Role.Name.LIBRARIAN
            else:
                role = Role.Name.RECEPTIONIST
            from apps.notifications.utils import notify_incharge_cancelled
            notify_incharge_cancelled(instance, 'spaces', role)

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

        if new_status not in ['APPROVED', 'REJECTED', 'PENDING']:
            return Response(
                {"error": "Invalid status. Must be PENDING, APPROVED or REJECTED."},
                status=status.HTTP_400_BAD_REQUEST
            )

        if new_status == 'REJECTED' and not remarks:
            return Response(
                {"error": "Remarks are required when rejecting a booking."},
                status=status.HTTP_400_BAD_REQUEST
            )

        if new_status == 'APPROVED' and booking.status not in ['PENDING', 'FACULTY_ESCALATED']:
            return Response(
                {"error": f"Cannot approve a booking that is currently {booking.status}."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if new_status == 'REJECTED' and booking.status not in ['PENDING', 'APPROVED', 'FACULTY_ESCALATED']:
            return Response(
                {"error": f"Cannot reject a booking that is currently {booking.status}."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if new_status == 'PENDING' and booking.status != 'FACULTY_ESCALATED':
            return Response(
                {"error": "Can only set PENDING from FACULTY_ESCALATED."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Apply the status change to all siblings in the group
        bookings_in_group = list(SpaceBooking.objects.filter(
            group_id=booking.group_id,
            status__in=['PENDING', 'APPROVED', 'FACULTY_ESCALATED'],
        ).order_by('start_datetime'))

        updated_bookings = []
        for b in bookings_in_group:
            if new_status == 'APPROVED' and b.status not in ['PENDING', 'FACULTY_ESCALATED']:
                continue
            if new_status == 'PENDING' and b.status != 'FACULTY_ESCALATED':
                continue
            b.status           = new_status
            b.remarks_by_admin = remarks
            b.resolved_by      = user if new_status != 'PENDING' else None
            b.resolved_at      = timezone.now() if new_status != 'PENDING' else None
            if new_status == 'PENDING':
                b.faculty_response_deadline = None
            b.save()
            updated_bookings.append(b)

        # Fire a single grouped notification instead of one per booking
        if updated_bookings:
            if new_status == 'PENDING':
                for b in updated_bookings:
                    category = b.space.approval_category
                    if category == Space.ApprovalCategory.LAB:
                        role = Role.Name.LAB_INCHARGE
                    elif category == Space.ApprovalCategory.LIBRARY:
                        role = Role.Name.LIBRARIAN
                    else:
                        role = Role.Name.RECEPTIONIST
                    notify_new_request(b, 'spaces', role)
            else:
                notify_group_status_change(
                    bookings=updated_bookings,
                    new_status=new_status,
                    domain='spaces',
                    resolved_by=user,
                    remarks=remarks
                )

        if new_status == 'REJECTED':
            cancel_linked_siblings_for_space(
                booking,
                reason=remarks or 'Linked Space booking was rejected.',
            )

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

        siblings       = list(SpaceBooking.objects.filter(group_id=booking.group_id, status='APPROVED').order_by('start_datetime'))
        resolved_at    = timezone.now()
        cancelled_refs = []

        for sibling in siblings:
            sibling.status           = 'CANCELLED'
            sibling.resolved_by      = request.user
            sibling.resolved_at      = resolved_at
            sibling.remarks_by_admin = remarks
            sibling.save()
            cancelled_refs.append(sibling.reference_code)

        # Fire a single grouped notification for the full cancellation batch
        if siblings:
            notify_group_status_change(
                bookings=siblings,
                new_status='CANCELLED',
                domain='spaces',
                resolved_by=request.user,
                remarks=remarks
            )
            cancel_linked_siblings_for_space(
                booking,
                reason=remarks or 'Linked Space booking was cancelled by the Principal.',
            )

        return Response(
            {
                "message":      f"{len(cancelled_refs)} booking(s) cancelled successfully.",
                "cancelled":    cancelled_refs,
                "cancelled_by": request.user.email,
            },
            status=status.HTTP_200_OK,
        )

    # ------------------------------------------------------------------
    # FACULTY APPROVAL ENDPOINTS
    # ------------------------------------------------------------------

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def faculty_pending(self, request):
        if 'FACULTY' not in request.user.get_effective_roles():
            return Response({"detail": "Not authorized."}, status=status.HTTP_403_FORBIDDEN)
            
        refresh_queryset_lifecycle(SpaceBooking.objects.filter(faculty_sponsor=request.user))
        
        pending = SpaceBooking.objects.filter(
            faculty_sponsor=request.user,
            status='AWAITING_FACULTY'
        ).order_by('start_datetime')
        
        history = SpaceBooking.objects.filter(
            faculty_sponsor=request.user,
        ).exclude(status='AWAITING_FACULTY').order_by('-updated_at')
        
        return Response({
            "pending": self.get_serializer(pending, many=True).data,
            "history": self.get_serializer(history, many=True).data
        })

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def faculty_approve(self, request, pk=None):
        booking = self.get_object()
        if booking.faculty_sponsor_id != request.user.id:
            return Response({"detail": "Not authorized."}, status=status.HTTP_403_FORBIDDEN)
        if booking.status != 'AWAITING_FACULTY':
            return Response({"error": f"Cannot approve, status is {booking.status}"}, status=status.HTTP_400_BAD_REQUEST)
            
        # check if this is an edited booking (if updated_at is significantly later than created_at)
        is_edited = False
        if booking.updated_at and booking.created_at:
            is_edited = (booking.updated_at - booking.created_at).total_seconds() > 60

        booking.status = 'FACULTY_ESCALATED'
        booking.faculty_response_deadline = None
        booking.save(update_fields=['status', 'faculty_response_deadline', 'updated_at'])
        
        notify_faculty_approved(booking)
        
        category = booking.space.approval_category
        if category == Space.ApprovalCategory.LAB:
            role = Role.Name.LAB_INCHARGE
        elif category == Space.ApprovalCategory.LIBRARY:
            role = Role.Name.LIBRARIAN
        else:
            role = Role.Name.RECEPTIONIST
            
        if is_edited:
            from apps.notifications.utils import notify_incharge_booking_edited
            notify_incharge_booking_edited(booking, 'spaces', role)
        else:
            notify_new_request(booking, 'spaces', role)
        
        return Response(self.get_serializer(booking).data)

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def faculty_reject(self, request, pk=None):
        booking = self.get_object()
        if booking.faculty_sponsor_id != request.user.id:
            return Response({"detail": "Not authorized."}, status=status.HTTP_403_FORBIDDEN)
        if booking.status != 'AWAITING_FACULTY':
            return Response({"error": f"Cannot reject, status is {booking.status}"}, status=status.HTTP_400_BAD_REQUEST)
            
        remarks = request.data.get('rejection_note', '')
        if not remarks:
            return Response({"error": "Rejection note required"}, status=status.HTTP_400_BAD_REQUEST)
            
        booking.status = 'REJECTED'
        booking.remarks_by_admin = remarks
        booking.resolved_by = request.user
        booking.resolved_at = timezone.now()
        booking.faculty_response_deadline = None
        booking.save(update_fields=['status', 'remarks_by_admin', 'resolved_by', 'resolved_at', 'faculty_response_deadline', 'updated_at'])
        
        notify_faculty_rejected(booking)
        cancel_linked_siblings_for_space(booking, reason=remarks)
        return Response(self.get_serializer(booking).data)

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def incharge_escalated(self, request):
        if not (request.user.is_staff or request.user.is_superuser or request.user.space_approver_assignments.filter(is_active=True).exists()):
            return Response({"detail": "Not authorized."}, status=status.HTTP_403_FORBIDDEN)
            
        self._run_lazy_escalation()
        
        qs = SpaceBooking.objects.filter(status='FACULTY_ESCALATED').order_by('start_datetime')
        if not (request.user.is_staff or request.user.is_superuser):
            roles = set(request.user.space_approver_assignments.filter(is_active=True).values_list('role__name', flat=True))
            categories = []
            if Role.Name.LAB_INCHARGE in roles: categories.append(Space.ApprovalCategory.LAB)
            if Role.Name.LIBRARIAN in roles: categories.append(Space.ApprovalCategory.LIBRARY)
            if Role.Name.RECEPTIONIST in roles: categories.append(Space.ApprovalCategory.GENERAL)
            qs = qs.filter(space__approval_category__in=categories)
            
        return Response(self.get_serializer(qs, many=True).data)

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def incharge_resend(self, request, pk=None):
        booking = self.get_object()
        user = request.user
        if not (user.is_staff or user.is_superuser or user.space_approver_assignments.filter(is_active=True).exists()):
            return Response({"detail": "Not authorized."}, status=status.HTTP_403_FORBIDDEN)
            
        if booking.status != 'FACULTY_ESCALATED':
            return Response({"error": f"Can only resend escalated bookings. Status is {booking.status}"}, status=status.HTTP_400_BAD_REQUEST)
            
        booking.status = 'AWAITING_FACULTY'
        booking.faculty_response_deadline = timezone.now() + timedelta(hours=24)
        booking.save(update_fields=['status', 'faculty_response_deadline', 'updated_at'])
        
        notify_faculty_resent(booking)
        return Response(self.get_serializer(booking).data)

    def _run_lazy_escalation(self):
        stale = SpaceBooking.objects.filter(
            status='AWAITING_FACULTY',
            faculty_response_deadline__lt=timezone.now()
        )
        stale_ids = list(stale.values_list('id', flat=True))
        if not stale_ids:
            return
            
        SpaceBooking.objects.filter(id__in=stale_ids).update(
            status='FACULTY_ESCALATED',
            updated_at=timezone.now()
        )
        
        updated_bookings = SpaceBooking.objects.filter(id__in=stale_ids)
        for booking in updated_bookings:
            category = booking.space.approval_category
            if category == Space.ApprovalCategory.LAB:
                role = Role.Name.LAB_INCHARGE
            elif category == Space.ApprovalCategory.LIBRARY:
                role = Role.Name.LIBRARIAN
            else:
                role = Role.Name.RECEPTIONIST
            notify_incharge_escalated(booking, role)



# ==========================================
# BLOCK MANAGEMENT
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
# SPACE APPROVER MANAGEMENT
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

        # Delete the row first so it's excluded from the remaining count
        instance.delete()

        # Strip the role badge only if no other active assignment remains
        remaining = SpaceApprover.objects.filter(
            user=user,
            role=role,
            is_active=True,
        ).count()

        if remaining == 0:
            user.roles.remove(role)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def booking_group_detail(request, event_group_id):
    from apps.media.models import MediaBooking
    from apps.media.serializers import MediaBookingSerializer
    from apps.mess.models import MessBooking
    from apps.mess.serializers import MessBookingSerializer

    space_bookings = (
        SpaceBooking.objects
        .filter(event_group_id=event_group_id)
        .select_related('space', 'user', 'department')
        .order_by('start_datetime')
    )
    mess_booking = (
        MessBooking.objects
        .filter(event_group_id=event_group_id)
        .prefetch_related('daily_menus')
        .order_by('-updated_at')
        .first()
    )
    media_booking = (
        MediaBooking.objects
        .filter(event_group_id=event_group_id)
        .select_related('space', 'user', 'department')
        .prefetch_related('equipment_requests__equipment')
        .order_by('-updated_at')
        .first()
    )

    anchor = space_bookings.first()
    if not anchor and not mess_booking and not media_booking:
        return Response(
            {"detail": "No bookings found for this event group."},
            status=status.HTTP_404_NOT_FOUND,
        )

    can_view = request.user.is_staff or request.user.is_superuser
    owners = [
        getattr(anchor, 'user_id', None),
        getattr(mess_booking, 'user_id', None),
        getattr(media_booking, 'user_id', None),
    ]
    if not can_view and request.user.id not in owners:
        return Response(
            {"detail": "Not authorized to view this booking group."},
            status=status.HTTP_403_FORBIDDEN,
        )

    def summarize_space(booking):
        if not booking:
            return None
        start = timezone.localtime(booking.start_datetime)
        end = timezone.localtime(booking.end_datetime)
        return {
            "type": "space",
            "id": booking.id,
            "reference_code": booking.reference_code,
            "status": booking.status,
            "date": start.date().isoformat(),
            "start_datetime": booking.start_datetime.isoformat(),
            "end_datetime": booking.end_datetime.isoformat(),
            "start_time": start.strftime("%H:%M"),
            "end_time": end.strftime("%H:%M"),
            "space": booking.space_id,
            "space_name": booking.space.name,
        }

    def summarize_mess(booking):
        if not booking:
            return None
        return {
            "id": booking.id,
            "reference_code": booking.reference_code,
            "status": booking.status,
            "start_date": booking.start_date.isoformat(),
            "end_date": booking.end_date.isoformat(),
            "delivery_location": booking.delivery_location,
        }

    def summarize_media(booking):
        if not booking:
            return None
        start = timezone.localtime(booking.event_start_datetime)
        return {
            "id": booking.id,
            "reference_code": booking.reference_code,
            "status": booking.status,
            "date": start.date().isoformat(),
            "event_start_datetime": booking.event_start_datetime.isoformat(),
            "event_end_datetime": booking.event_end_datetime.isoformat(),
            "space": booking.space_id,
            "space_name": booking.space.name,
        }

    return Response({
        "event_group_id": str(event_group_id),
        "anchor": summarize_space(anchor),
        "space_bookings": SpaceBookingSerializer(
            space_bookings,
            many=True,
            context={"request": request},
        ).data,
        "siblings": {
            "mess": summarize_mess(mess_booking),
            "media": summarize_media(media_booking),
        },
        "details": {
            "mess": MessBookingSerializer(
                mess_booking,
                context={"request": request},
            ).data if mess_booking else None,
            "media": MediaBookingSerializer(
                media_booking,
                context={"request": request},
            ).data if media_booking else None,
        },
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def faculty_list(request):
    department = request.user.department
    if not department:
        return Response([])
    faculty_users = CustomUser.objects.filter(
        department=department,
        roles__name=Role.Name.FACULTY,
        is_active=True
    ).order_by('first_name')
    data = [{"id": f.id, "name": f"{f.first_name} {f.last_name}".strip() or f.email} for f in faculty_users]
    return Response(data)
