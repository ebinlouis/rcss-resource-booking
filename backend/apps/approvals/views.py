from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.utils import timezone

from apps.users.permissions import IsApprover
from apps.users.models import Role

from apps.spaces.models import SpaceBooking, SpaceApprover
from apps.fleet.models import FleetBooking
from apps.mess.models import MessBooking
from apps.media.models import MediaBooking


# ==========================================
# CONSTANTS
# ==========================================

VALID_DOMAINS = {'spaces', 'fleet', 'mess', 'media'}


# ==========================================
# HELPERS
# ==========================================

def _requester_info(user):
    full_name = f"{user.first_name} {user.last_name}".strip() or user.email
    dept      = getattr(user, 'department', None)
    dept_name = dept.department_name if dept else 'General'
    dept_code = dept.department_code if dept else 'General'
    phone     = getattr(user, 'phone', None) or ''

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


def _get_space_queryset_for_user(user, effective_roles, requested_status):
    """
    Builds the SpaceBooking queryset scoped to what this user is allowed to see.

    Scoping rules:
        IT_ADMIN     → all spaces, no filter
        HOD          → only their department's bookings (AI Lab / dept-scoped)
        RECEPTIONIST → spaces in blocks they are assigned to (approval_category=GENERAL)
        LAB_INCHARGE → specific spaces they are assigned to (approval_category=LAB)
        LIBRARIAN    → spaces in blocks they are assigned to (approval_category=LIBRARY)

    Multiple SpaceApprover rows per user are supported — a receptionist
    covering two blocks sees both blocks' bookings unioned together.
    """
    is_it_admin = Role.Name.IT_ADMIN in effective_roles
    is_hod      = Role.Name.HOD in effective_roles
    user_dept   = getattr(user, 'department', None)

    base_qs = (
        SpaceBooking.objects
        .filter(status=requested_status)
        .select_related('user', 'user__department', 'space', 'space__block')
        .prefetch_related('requested_equipment__equipment')
        .order_by('group_id', 'start_datetime')
    )

    # IT_ADMIN sees everything
    if is_it_admin:
        return base_qs

    # HOD sees their department's bookings only
    if is_hod and user_dept:
        return base_qs.filter(user__department=user_dept)

    # Scoped approvers — build filter from SpaceApprover assignments
    assignments = (
        SpaceApprover.objects
        .filter(user=user, is_active=True)
        .select_related('block', 'space', 'role')
    )

    if not assignments.exists():
        return SpaceBooking.objects.none()

    from django.db.models import Q as DQ
    scope_filter = DQ()

    for assignment in assignments:
        role_name = assignment.role.name

        if role_name == Role.Name.RECEPTIONIST:
            # RECEPTIONIST: all GENERAL spaces in their assigned block
            if assignment.scope_type == 'BLOCK' and assignment.block:
                scope_filter |= DQ(
                    space__block=assignment.block,
                    space__approval_category='GENERAL',
                )
            elif assignment.scope_type == 'SPACE' and assignment.space:
                scope_filter |= DQ(space=assignment.space)

        elif role_name == Role.Name.LAB_INCHARGE:
            # LAB_INCHARGE: specific lab spaces they are assigned to
            if assignment.scope_type == 'SPACE' and assignment.space:
                scope_filter |= DQ(space=assignment.space)
            elif assignment.scope_type == 'BLOCK' and assignment.block:
                scope_filter |= DQ(
                    space__block=assignment.block,
                    space__approval_category='LAB',
                )

        elif role_name == Role.Name.LIBRARIAN:
            # LIBRARIAN: all LIBRARY spaces in their assigned block
            if assignment.scope_type == 'BLOCK' and assignment.block:
                scope_filter |= DQ(
                    space__block=assignment.block,
                    space__approval_category='LIBRARY',
                )
            elif assignment.scope_type == 'SPACE' and assignment.space:
                scope_filter |= DQ(space=assignment.space)

    # If no valid scope was built, return nothing
    if not scope_filter.children:
        return SpaceBooking.objects.none()

    return base_qs.filter(scope_filter)


# ==========================================
# 1. UNIFIED APPROVAL QUEUE (GET)
# ==========================================

class UnifiedApprovalQueueView(APIView):
    permission_classes = [IsApprover]

    def get(self, request):
        requested_domains_param = request.query_params.get('domain', '').strip()
        requested_status        = request.query_params.get('status', 'PENDING').upper()

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

        effective_roles = request.user.get_effective_roles()

        domain_querysets = self._get_domain_querysets(
            requested_domains, request.user, effective_roles, requested_status
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

    def _get_domain_querysets(self, requested_domains, user, effective_roles, requested_status):
        is_it_admin = Role.Name.IT_ADMIN in effective_roles
        querysets   = {}

        # ── Spaces ────────────────────────────────────────────────────────────
        is_space_approver = bool(effective_roles & {
            Role.Name.RECEPTIONIST,
            Role.Name.LAB_INCHARGE,
            Role.Name.LIBRARIAN,
            Role.Name.HOD,
            Role.Name.IT_ADMIN,
        })
        if 'spaces' in requested_domains and is_space_approver:
            querysets['spaces'] = _get_space_queryset_for_user(
                user, effective_roles, requested_status
            )

        # ── Fleet ─────────────────────────────────────────────────────────────
        if 'fleet' in requested_domains:
            if is_it_admin or Role.Name.FLEET_MANAGER in effective_roles:
                querysets['fleet'] = (
                    FleetBooking.objects
                    .filter(status=requested_status)
                    .select_related('user', 'user__department', 'vehicle')
                )

        # ── Mess ──────────────────────────────────────────────────────────────
        if 'mess' in requested_domains:
            if is_it_admin or Role.Name.MESS_MANAGER in effective_roles:
                querysets['mess'] = (
                    MessBooking.objects
                    .filter(status=requested_status)
                    .select_related('user', 'user__department')
                )

        # ── Media ─────────────────────────────────────────────────────────────
        if 'media' in requested_domains:
            if is_it_admin or Role.Name.MEDIA_INCHARGE in effective_roles:
                querysets['media'] = (
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
                group_id           = str(item.group_id),
                start_datetime     = getattr(item, 'start_datetime', None),
                end_datetime       = getattr(item, 'end_datetime', None),
                attendee_count     = getattr(item, 'attendee_count', None),
                resource_name      = getattr(item.space, 'name', 'Space Resource'),
                purpose            = item.purpose_of_booking,
                purpose_of_booking = item.purpose_of_booking,
                user_notes         = item.user_notes or "",
                equipment_requests = equipment_list,
                space_details      = {
                    "space_type":        getattr(item.space, 'space_type', None),
                    "approval_category": getattr(item.space, 'approval_category', None),
                    "block":             getattr(item.space.block, 'name', None),
                    "capacity_hard":     getattr(item.space, 'capacity_hard', None),
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
                {"error": "You must provide 'remarks' when rejecting a request."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        model_class = self.MODEL_MAP[module]
        try:
            booking = model_class.objects.get(id=booking_id)
        except model_class.DoesNotExist:
            return Response({"error": "Booking not found."}, status=status.HTTP_404_NOT_FOUND)

        if new_status == 'APPROVED' and booking.status != 'PENDING':
            return Response(
                {"error": f"Booking is already {booking.status}."},
                status=status.HTTP_400_BAD_REQUEST,
            )

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

    def _resolve_single(self, booking, new_status, remarks, resolved_by):
        booking.status      = new_status
        booking.resolved_by = resolved_by
        booking.resolved_at = timezone.now()
        if remarks:
            booking.remarks_by_admin = remarks
        booking.save()

    def _resolve_group(self, booking, new_status, remarks, resolved_by):
        siblings = (
            SpaceBooking.objects
            .filter(group_id=booking.group_id)
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