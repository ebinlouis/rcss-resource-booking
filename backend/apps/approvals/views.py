from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.utils import timezone
from django.db.models import Q

from apps.users.permissions import IsApprover
from apps.users.models import RoleOverride

from apps.spaces.models import SpaceBooking
from apps.fleet.models import FleetBooking
from apps.mess.models import MessBooking
from apps.media.models import MediaBooking

# ==========================================
# CONSTANTS
# ==========================================

VALID_DOMAINS = {'spaces', 'fleet', 'mess', 'media'}

# ==========================================
# HELPER
# ==========================================

def _requester_info(user):
    full_name = f"{user.first_name} {user.last_name}".strip() or user.email
    dept = getattr(user, 'department', None)
    dept_name = dept.department_name if dept else 'General'
    dept_code = dept.department_code if dept else 'General'
    phone = getattr(user, 'phone', None) or getattr(user, 'phone_number', None) or ''

    return {
        "requester":       full_name,
        "requester_email": user.email,
        "requester_phone": phone,
        "department":      dept_code,
        "department_name": dept_name,
    }


def _build_queue_entry(domain, item, **extra_fields):
    return {
        "id":             item.id,
        "domain":         domain,
        "reference_code": item.reference_code,
        **_requester_info(item.user),
        "created_at":     item.created_at,
        "is_external":    getattr(item, 'is_external', False),
        "status":         getattr(item, 'status', 'PENDING'),
        "resolved_by_id": getattr(item, 'resolved_by_id', None),
        **extra_fields,
    }


# ==========================================
# 1. ADMIN QUEUE (GET)
# ==========================================

class UnifiedApprovalQueueView(APIView):
    permission_classes = [IsApprover]

    def get(self, request):
        user = request.user
        now  = timezone.now()

        requested_domains_param = request.query_params.get('domain', '').strip()
        requested_status = request.query_params.get('status', 'PENDING').upper()

        if not requested_domains_param:
            return Response(
                {"error": f"A 'domain' query parameter is required. Valid values: {', '.join(sorted(VALID_DOMAINS))}."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        requested_domains = {d.strip().lower() for d in requested_domains_param.split(',')}
        invalid = requested_domains - VALID_DOMAINS
        if invalid:
            return Response(
                {"error": f"Unknown domain(s): {', '.join(sorted(invalid))}. Valid values: {', '.join(sorted(VALID_DOMAINS))}."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        active_override = RoleOverride.objects.filter(
            user=user, is_active=True
        ).filter(Q(expires_at__isnull=True) | Q(expires_at__gt=now)).first()

        effective_role = (
            active_override.overridden_role.name
            if active_override
            else (user.role.name if user.role else None)
        )

        domain_querysets = self._get_domain_querysets(
            requested_domains, user, effective_role, requested_status
        )

        unified_queue = []
        for domain, qs in domain_querysets.items():
            for item in qs:
                entry = self._serialise_domain(domain, item)
                if entry:
                    unified_queue.append(entry)

        unified_queue.sort(
            key=lambda x: (not x.get('is_external', False), x['created_at'])
        )

        return Response({
            "total_pending": len(unified_queue),
            "queue":         unified_queue,
        })

    def _get_domain_querysets(self, requested_domains, user, effective_role, requested_status):
        is_superuser_or_it = user.is_superuser or effective_role == 'IT_ADMIN'
        is_hod             = effective_role == 'HOD'
        user_dept          = getattr(user, 'department', None)

        def _apply_role_scope(qs):
            if is_superuser_or_it:
                return qs
            if is_hod and user_dept:
                return qs.filter(user__department=user_dept)
            return qs.none()

        querysets = {}

        if 'spaces' in requested_domains:
            querysets['spaces'] = _apply_role_scope(
                SpaceBooking.objects
                .filter(status=requested_status)
                .select_related('user', 'user__department', 'space')
                .prefetch_related('requested_equipment__equipment')
                # Order by group_id + start so siblings are always adjacent — makes
                # any server-side deduplication or debugging much easier.
                .order_by('group_id', 'start_datetime')
            )

        if 'fleet' in requested_domains:
            querysets['fleet'] = _apply_role_scope(
                FleetBooking.objects
                .filter(status=requested_status)
                .select_related('user', 'user__department', 'vehicle')
            )

        if 'mess' in requested_domains:
            querysets['mess'] = _apply_role_scope(
                MessBooking.objects
                .filter(status=requested_status)
                .select_related('user', 'user__department')
            )

        if 'media' in requested_domains:
            querysets['media'] = _apply_role_scope(
                MediaBooking.objects
                .filter(status=requested_status)
                .select_related('user', 'user__department')
            )

        return querysets

    def _serialise_domain(self, domain, item):
        if domain == 'spaces':
            equipment_list = [
                {
                    "id":             er.id,
                    "equipment_id":   er.equipment_id,
                    "equipment_name": er.equipment.name,
                    "quantity":       er.quantity,
                }
                for er in item.requested_equipment.all()
            ]
            return _build_queue_entry(
                domain, item,
                # ── group_id is the stable key that lets the frontend collapse all
                # recurring slots (which share the same UUID) into one card. It must
                # be serialised as a plain string because JSON has no UUID type.
                group_id          = str(item.group_id),
                start_datetime    = getattr(item, 'start_datetime', None),
                end_datetime      = getattr(item, 'end_datetime', None),
                attendee_count    = getattr(item, 'attendee_count', None),
                resource_name     = getattr(item.space, 'name', 'Space Resource'),
                purpose           = item.purpose_of_booking,
                purpose_of_booking= item.purpose_of_booking,
                user_notes        = item.user_notes or "",
                equipment_requests= equipment_list,
                space_details     = {
                    "space_type":    getattr(item.space, 'space_type', None),
                    "capacity_hard": getattr(item.space, 'capacity_hard', None),
                },
            )

        elif domain == 'fleet':
            return _build_queue_entry(
                domain, item,
                start_datetime = getattr(item, 'start_datetime', getattr(item, 'departure_time', None)),
                end_datetime   = getattr(item, 'end_datetime',   getattr(item, 'return_time', None)),
                attendee_count = getattr(item, 'passenger_count', getattr(item, 'passengers', None)),
                resource_name  = getattr(item.vehicle, 'name', 'Fleet Vehicle'),
                purpose        = getattr(item, 'purpose', 'No purpose provided'),
                user_notes     = getattr(item, 'user_notes', '') or "",
            )

        elif domain == 'mess':
            return _build_queue_entry(
                domain, item,
                start_datetime = getattr(item, 'date_of_programme', getattr(item, 'delivery_time', None)),
                end_datetime   = getattr(item, 'end_time', None),
                attendee_count = getattr(item, 'total_persons', None),
                resource_name  = f"Catering ({getattr(item, 'total_persons', 0)} persons)",
                purpose        = getattr(item, 'purpose_of_programme', 'No purpose provided'),
                user_notes     = getattr(item, 'user_notes', '') or "",
            )

        elif domain == 'media':
            return _build_queue_entry(
                domain, item,
                start_datetime = getattr(item, 'event_date', getattr(item, 'start_datetime', None)),
                end_datetime   = getattr(item, 'end_datetime', None),
                attendee_count = getattr(item, 'attendees', None),
                resource_name  = "Equipment/Media Support",
                purpose        = getattr(item, 'event_name', getattr(item, 'purpose', 'No purpose provided')),
                user_notes     = getattr(item, 'user_notes', '') or "",
            )

        return None


# ==========================================
# 2. APPROVAL ENGINE (PATCH)
# ==========================================

class AdminResolveBookingAPIView(APIView):
    permission_classes = [IsApprover]

    MODEL_MAP = {
        'spaces': SpaceBooking,
        'fleet':  FleetBooking,
        'mess':   MessBooking,
        'media':  MediaBooking,
    }

    # Models that support grouped recurring bookings via a shared group_id.
    # When one member of the group is resolved, all siblings are resolved together.
    GROUP_AWARE_MODULES = {'spaces'}

    def patch(self, request):
        module     = request.data.get('module')
        booking_id = request.data.get('id')
        new_status = request.data.get('status')
        remarks    = request.data.get('remarks', '').strip()

        if module not in self.MODEL_MAP:
            return Response(
                {"error": f"Invalid module. Valid values: {', '.join(sorted(self.MODEL_MAP))}."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if new_status not in ['APPROVED', 'REJECTED']:
            return Response(
                {"error": "Status must be APPROVED or REJECTED."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if new_status == 'REJECTED' and not remarks:
            return Response(
                {"error": "You must provide 'remarks' when rejecting/cancelling a request."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        model_class = self.MODEL_MAP[module]
        try:
            booking = model_class.objects.get(id=booking_id)
        except model_class.DoesNotExist:
            return Response(
                {"error": "Booking not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Allow transitioning to APPROVED only if PENDING.
        if new_status == 'APPROVED' and booking.status != 'PENDING':
            return Response(
                {"error": f"Booking is already {booking.status}."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Allow transitioning to REJECTED if PENDING or APPROVED (revocation).
        if new_status == 'REJECTED' and booking.status not in ['PENDING', 'APPROVED']:
            return Response(
                {"error": f"Cannot reject a booking that is currently {booking.status}."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            if module in self.GROUP_AWARE_MODULES:
                self._resolve_group(booking, new_status, remarks, request.user)
            else:
                self._resolve_single(booking, new_status, remarks, request.user)

            return Response({
                "message": f"Booking {booking.reference_code} successfully {new_status.lower()}.",
                "ref":     booking.reference_code,
                "status":  new_status,
            })
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_409_CONFLICT)

    # ── Resolution helpers ────────────────────────────────────────────────────

    def _resolve_single(self, booking, new_status, remarks, resolved_by):
        """Update one booking row. Used for non-group-aware modules."""
        booking.status      = new_status
        booking.resolved_by = resolved_by
        booking.resolved_at = timezone.now()
        if remarks:
            booking.remarks_by_admin = remarks
        booking.save()

    def _resolve_group(self, booking, new_status, remarks, resolved_by):
        """
        Resolve every sibling that shares the same group_id in one pass.

        Recurring SpaceBookings are stored as N individual rows linked by a
        shared group_id UUID. The frontend sends only one representative ID
        (the first child), so we must fan out to all siblings here.

        For non-recurring bookings the SpaceBooking model still assigns a
        unique group_id per booking (uuid4 default), so this query will
        simply return one row — identical behaviour to _resolve_single.
        """
        siblings = (
            SpaceBooking.objects
            .filter(group_id=booking.group_id)
            # Sanity-check: only touch rows that are legally transitionable.
            # APPROVED → we are revoking, so include APPROVED siblings too.
            # PENDING  → normal approval/rejection path.
            .filter(status__in=['PENDING', 'APPROVED'])
        )

        resolved_at = timezone.now()
        for sibling in siblings:
            sibling.status      = new_status
            sibling.resolved_by = resolved_by
            sibling.resolved_at = resolved_at
            if remarks:
                sibling.remarks_by_admin = remarks
            sibling.save()