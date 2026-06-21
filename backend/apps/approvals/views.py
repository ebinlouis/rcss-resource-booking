from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.conf import settings
from django.utils import timezone
from datetime import timedelta

from django.db.models import Q, Sum as _Sum

from apps.users.permissions import IsApprover
from apps.users.models import Role, RoleOverride
from apps.approvals.lifecycle import (
    refresh_booking_lifecycle,
)
from apps.notifications.utils import (
    mark_pending_request_notifications_read,
    notify_booking_status_change,
)

from apps.spaces.models import Space, SpaceBooking, SpaceApprover, SpaceApproverChain
from apps.fleet.models import FleetBooking
from apps.mess.models import MessBooking
from apps.media.models import MediaBooking, MediaSettings


# ==========================================
# CONSTANTS
# ==========================================

VALID_DOMAINS = {"spaces", "fleet", "mess", "media"}
AI_LAB_FALLBACK_HOURS = settings.AI_LAB_HOD_FALLBACK_HOURS


# ==========================================
# HELPERS
# ==========================================


def _requester_info(user, request=None):
    full_name = f"{user.first_name} {user.last_name}".strip() or user.email
    dept = getattr(user, "department", None)
    dept_name = dept.department_name if dept else "General"
    dept_code = dept.department_code if dept else "General"
    phone = getattr(user, "phone", None) or ""
    profile_image_url = None
    if user.profile_image:
        profile_image_url = user.profile_image.url
        if request:
            profile_image_url = request.build_absolute_uri(profile_image_url)
        else:
            profile_image_url = f"http://localhost:8000{profile_image_url}"

    return {
        "requester": full_name,
        "requester_email": user.email,
        "requester_phone": phone,
        "department": dept_code,
        "department_name": dept_name,
        "requester_profile_image": profile_image_url,
    }


def _build_queue_entry(domain, item, request=None, **extra_fields):
    return {
        "id": item.id,
        "domain": domain,
        "reference_code": item.reference_code,
        **_requester_info(item.user, request=request),
        "created_at": item.created_at,
        "updated_at": item.updated_at,
        "is_external": getattr(item, "is_external", False),
        "status": getattr(item, "status", "PENDING"),
        "resolved_by_id": getattr(item, "resolved_by_id", None),
        **extra_fields,
    }


def _normalise(value):
    return str(value or "").strip().lower()


def _uses_hod_fallback_workflow(space):
    return (
        getattr(space, "approval_workflow_type", None)
        == Space.ApprovalWorkflowType.HOD_FALLBACK
    )


def _is_cs_department(department):
    if not department:
        return False

    code = _normalise(getattr(department, "department_code", ""))
    name = _normalise(getattr(department, "department_name", ""))
    return code in {"cs", "cse"} or name in {"cs", "cse"} or "computer science" in name


def _is_cs_hod_fallback_booking(booking):
    return _uses_hod_fallback_workflow(booking.space) and _is_cs_department(
        getattr(booking.user, "department", None)
    )


def _ai_lab_fallback_ready(booking):
    fallback_at = booking.created_at + timedelta(hours=AI_LAB_FALLBACK_HOURS)
    return timezone.now() >= fallback_at


def _active_role_override_queryset(now=None):
    now = now or timezone.now()
    return RoleOverride.objects.filter(
        user__is_active=True,
        is_active=True,
        revoked_at__isnull=True,
    ).filter(Q(valid_until__isnull=True) | Q(valid_until__gt=now))


def _assignment_scope_type(assignment):
    if isinstance(assignment, RoleOverride):
        if assignment.space_id:
            return "SPACE"
        if assignment.block_id:
            return "BLOCK"
        return None
    return assignment.scope_type


def _assignment_block_id(assignment):
    if isinstance(assignment, RoleOverride) and assignment.space_id:
        return None
    return assignment.block_id


def _more_specific_space_ids_for_block(role_name, block_id, now=None):
    approver_space_ids = set(SpaceApprover.objects.filter(
        scope_type="SPACE",
        space__block_id=block_id,
        role__name=role_name,
        is_active=True,
        user__is_active=True,
    ).values_list("space_id", flat=True))

    override_space_ids = set(_active_role_override_queryset(now).filter(
        space__block_id=block_id,
        role__name=role_name,
    ).values_list("space_id", flat=True))

    return list(approver_space_ids | override_space_ids)


def _has_more_specific_space_scope(assignment, role_name, space):
    return space.id in _more_specific_space_ids_for_block(
        role_name,
        space.block_id,
    )


def _space_booking_approval_role_name(booking):
    category = booking.space.approval_category
    if category == "LAB":
        return Role.Name.LAB_INCHARGE
    if category == "LIBRARY":
        return Role.Name.LIBRARIAN
    return Role.Name.RECEPTIONIST


def _matches_space_approver_assignment(booking, assignment):
    role_name = assignment.role.name
    space = booking.space
    scope_type = _assignment_scope_type(assignment)
    block_id = _assignment_block_id(assignment)
    space_id = assignment.space_id

    if role_name == Role.Name.RECEPTIONIST:
        if scope_type == "BLOCK" and block_id:
            # Most-specific-wins: if a SPACE-scope assignment exists for this
            # exact space and role, the block-scope user is excluded entirely.
            has_space_override = _has_more_specific_space_scope(
                assignment, role_name, space
            )
            if has_space_override:
                return False
            return (
                space.block_id == block_id
                and space.approval_category == "GENERAL"
            )
        if scope_type == "SPACE" and space_id:
            return space.id == space_id

    if role_name == Role.Name.LAB_INCHARGE:
        if (
            _is_cs_hod_fallback_booking(booking)
            and booking.status == "PENDING"
            and not _ai_lab_fallback_ready(booking)
        ):
            return False
        if scope_type == "SPACE" and space_id:
            return space.id == space_id
        if scope_type == "BLOCK" and block_id:
            # Most-specific-wins guard
            has_space_override = _has_more_specific_space_scope(
                assignment, role_name, space
            )
            if has_space_override:
                return False
            return (
                space.block_id == block_id
                and space.approval_category == "LAB"
            )

    if role_name == Role.Name.LIBRARIAN:
        if scope_type == "BLOCK" and block_id:
            # Most-specific-wins guard
            has_space_override = _has_more_specific_space_scope(
                assignment, role_name, space
            )
            if has_space_override:
                return False
            return (
                space.block_id == block_id
                and space.approval_category == "LIBRARY"
            )
        if scope_type == "SPACE" and space_id:
            return space.id == space_id

    return False


def _user_can_resolve_space_booking(user, effective_roles, booking):
    if Role.Name.IT_ADMIN in effective_roles:
        return True

    # HOD_FALLBACK: check the space's approver chain directly.
    # Only the explicitly assigned primary or fallback approver can resolve.
    if _uses_hod_fallback_workflow(booking.space):
        try:
            chain = booking.space.approver_chain
            if user.id in (chain.primary_approver_id, chain.fallback_approver_id):
                return True
        except Exception:
            pass

    assignments = SpaceApprover.objects.filter(
        user=user, is_active=True
    ).select_related("block", "space", "role")
    return any(
        _matches_space_approver_assignment(booking, assignment)
        for assignment in assignments
    ) or any(
        _matches_space_approver_assignment(booking, override)
        for override in _active_role_override_queryset()
        .filter(user=user, role__name=_space_booking_approval_role_name(booking))
        .select_related("block", "space", "role")
    )


def _get_space_queryset_for_user(user, effective_roles, requested_status):
    """
    Builds the SpaceBooking queryset scoped to what this user is allowed to see.

    Scoping rules:
        IT_ADMIN     → all spaces, no filter
        HOD          → all bookings on HOD_FALLBACK spaces (space type determines
                       visibility, not the booking user's department)
        RECEPTIONIST → block-scoped (approval_category=GENERAL) or space-scoped
        LAB_INCHARGE → space- or block-scoped (approval_category=LAB),
                       excluding ALL bookings on HOD_FALLBACK spaces still within
                       the fallback waiting window (not CS-dept restricted)
        LIBRARIAN    → block-scoped (approval_category=LIBRARY)

    Multiple SpaceApprover rows per user are supported — all scopes are OR-ed.
    All filtering is pushed to the DB via Q objects; no Python booking iteration.
    """
    is_it_admin = Role.Name.IT_ADMIN in effective_roles

    statuses = [requested_status]
    if requested_status == "PENDING":
        statuses.append("FACULTY_ESCALATED")

    base_qs = (
        SpaceBooking.objects.filter(status__in=statuses)
        .select_related("user", "user__department", "space", "space__block")
        .prefetch_related("requested_equipment__equipment")
        .order_by("group_id", "start_datetime")   # preserved — serialiser groups by this
    )

    if is_it_admin:
        return base_qs

    now = timezone.now()

    assignment_list = list(
        SpaceApprover.objects.filter(user=user, is_active=True)
        .select_related("block", "space", "role")
    )

    override_list = list(
        _active_role_override_queryset(now)
        .filter(user=user)
        .select_related("block", "space", "role")
    )

    # Check if user is named as primary or fallback approver on any HOD_FALLBACK chain.
    is_chain_approver = SpaceApproverChain.objects.filter(
        Q(primary_approver=user) | Q(fallback_approver=user)
    ).exists()

    if not is_chain_approver and not assignment_list and not override_list:
        return SpaceBooking.objects.none()

    # _uses_hod_fallback_workflow()
    _hod_fallback_q = Q(
        space__approval_workflow_type=Space.ApprovalWorkflowType.HOD_FALLBACK
    )

    # LAB_INCHARGE exclusion zone: any booking on a HOD_FALLBACK space that is
    # still PENDING and hasn't yet cleared the fallback window is invisible to
    # LAB_INCHARGE — the HOD gets first action regardless of who made the booking.
    _lab_exclusion_q = (
        _hod_fallback_q
        & Q(status="PENDING")
        & Q(created_at__gt=now - timedelta(hours=AI_LAB_FALLBACK_HOURS))
    )

    scope_q = Q()

    # Chain approvers: sees only the HOD_FALLBACK bookings for spaces
    # where they are explicitly assigned as primary or fallback approver.
    if is_chain_approver:
        scope_q |= (
            Q(space__approver_chain__primary_approver=user)
            | Q(space__approver_chain__fallback_approver=user)
        )

    for assignment in assignment_list:
        role_name = assignment.role.name

        if role_name == Role.Name.RECEPTIONIST:
            if assignment.scope_type == "BLOCK" and assignment.block_id:
                overridden = _more_specific_space_ids_for_block(
                    Role.Name.RECEPTIONIST,
                    assignment.block_id,
                    now,
                )
                block_q = Q(space__block_id=assignment.block_id, space__approval_category="GENERAL")
                if overridden:
                    block_q &= ~Q(space_id__in=overridden)
                scope_q |= block_q
            elif assignment.scope_type == "SPACE" and assignment.space_id:
                scope_q |= Q(space_id=assignment.space_id)

        elif role_name == Role.Name.LAB_INCHARGE:
            if assignment.scope_type == "SPACE" and assignment.space_id:
                scope_q |= Q(space_id=assignment.space_id) & ~_lab_exclusion_q
            elif assignment.scope_type == "BLOCK" and assignment.block_id:
                overridden = _more_specific_space_ids_for_block(
                    Role.Name.LAB_INCHARGE,
                    assignment.block_id,
                    now,
                )
                block_q = Q(space__block_id=assignment.block_id, space__approval_category="LAB")
                if overridden:
                    block_q &= ~Q(space_id__in=overridden)
                scope_q |= block_q & ~_lab_exclusion_q

        elif role_name == Role.Name.LIBRARIAN:
            if assignment.scope_type == "BLOCK" and assignment.block_id:
                overridden = _more_specific_space_ids_for_block(
                    Role.Name.LIBRARIAN,
                    assignment.block_id,
                    now,
                )
                block_q = Q(space__block_id=assignment.block_id, space__approval_category="LIBRARY")
                if overridden:
                    block_q &= ~Q(space_id__in=overridden)
                scope_q |= block_q

    for override in override_list:
        role_name = override.role.name

        if role_name == Role.Name.RECEPTIONIST:
            if override.space_id:
                scope_q |= Q(space_id=override.space_id)
            elif override.block_id:
                overridden = _more_specific_space_ids_for_block(
                    Role.Name.RECEPTIONIST,
                    override.block_id,
                    now,
                )
                block_q = Q(
                    space__block_id=override.block_id,
                    space__approval_category="GENERAL",
                )
                if overridden:
                    block_q &= ~Q(space_id__in=overridden)
                scope_q |= block_q

        elif role_name == Role.Name.LAB_INCHARGE:
            if override.space_id:
                scope_q |= Q(space_id=override.space_id) & ~_lab_exclusion_q
            elif override.block_id:
                overridden = _more_specific_space_ids_for_block(
                    Role.Name.LAB_INCHARGE,
                    override.block_id,
                    now,
                )
                block_q = Q(
                    space__block_id=override.block_id,
                    space__approval_category="LAB",
                )
                if overridden:
                    block_q &= ~Q(space_id__in=overridden)
                scope_q |= block_q & ~_lab_exclusion_q

        elif role_name == Role.Name.LIBRARIAN:
            if override.space_id:
                scope_q |= Q(space_id=override.space_id)
            elif override.block_id:
                overridden = _more_specific_space_ids_for_block(
                    Role.Name.LIBRARIAN,
                    override.block_id,
                    now,
                )
                block_q = Q(
                    space__block_id=override.block_id,
                    space__approval_category="LIBRARY",
                )
                if overridden:
                    block_q &= ~Q(space_id__in=overridden)
                scope_q |= block_q


    if not scope_q:
        return SpaceBooking.objects.none()

    return base_qs.filter(scope_q)


# ==========================================
# MEDIA-SPECIFIC APPROVAL HELPERS
# ==========================================


def _overlapping_approved_team_bookings(booking):
    """Return approved team bookings that overlap with the given booking's time block."""
    return MediaBooking.objects.filter(
        status="APPROVED",
        is_team_request=True,
        setup_start_datetime__lt=booking.teardown_end_datetime,
        teardown_end_datetime__gt=booking.setup_start_datetime,
    ).exclude(pk=booking.pk)


def _media_team_capacity_available(booking, media_settings):
    """True if approving this team request would not exceed the concurrent event cap."""
    overlapping_count = _overlapping_approved_team_bookings(booking).count()
    return overlapping_count < media_settings.max_concurrent_events


def _check_media_equipment_availability(booking):
    """
    Checks whether all equipment requested by this booking is available
    (i.e. not over-committed by already-APPROVED overlapping bookings).

    Returns (True, "") on success, or (False, "<error message>") on failure.
    """
    from apps.media.models import MediaEquipmentRequest

    overlapping_bookings = MediaBooking.objects.filter(
        status="APPROVED",
        setup_start_datetime__lt=booking.teardown_end_datetime,
        teardown_end_datetime__gt=booking.setup_start_datetime,
    ).exclude(pk=booking.pk)

    used_map = {
        row["equipment_id"]: row["total_used"]
        for row in MediaEquipmentRequest.objects.filter(
            media_booking__in=overlapping_bookings
        )
        .values("equipment_id")
        .annotate(total_used=_Sum("quantity"))
    }

    for req in booking.equipment_requests.select_related("equipment"):
        eq = req.equipment
        needed_qty = req.quantity
        available_qty = max(0, eq.total_owned - used_map.get(eq.id, 0))
        if available_qty < needed_qty:
            return False, (
                f"Not enough '{eq.name}'. "
                f"Need {needed_qty}, but only {available_qty} available for this time block."
            )

    return True, ""


def _reserve_standard_team_kit(booking):
    """
    Attaches the standard media kit equipment to a team-request booking.
    Only equipment that passes the availability check (via model-level clean)
    will be attached — others are silently skipped to avoid crashing the
    approval flow.
    """
    from apps.spaces.models import Equipment
    from apps.media.models import MediaEquipmentRequest
    from django.core.exceptions import ValidationError as DjangoValidationError

    standard_gear = Equipment.objects.filter(
        is_active=True,
        is_portable=True,
        is_standard_media_kit=True,
    )
    for gear in standard_gear:
        try:
            request_obj, created = MediaEquipmentRequest.objects.get_or_create(
                media_booking=booking,
                equipment=gear,
                defaults={"quantity": 1},
            )
            if not created and request_obj.quantity < 1:
                request_obj.quantity = 1
                request_obj.save(update_fields=["quantity"])
        except DjangoValidationError:
            # Not enough of this particular kit item available — skip it.
            # The admin can use the update_loadout action to assign gear manually.
            pass


# ==========================================
# 1. UNIFIED APPROVAL QUEUE (GET)
# ==========================================


class UnifiedApprovalQueueView(APIView):
    permission_classes = [IsApprover]

    def get(self, request):
        requested_domains_param = request.query_params.get("domain", "").strip()
        requested_status = request.query_params.get("status", "PENDING").upper()

        if not requested_domains_param:
            return Response(
                {
                    "error": f"A 'domain' query parameter is required. Valid values: {', '.join(sorted(VALID_DOMAINS))}."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        requested_domains = {
            d.strip().lower() for d in requested_domains_param.split(",")
        }
        invalid = requested_domains - VALID_DOMAINS
        if invalid:
            return Response(
                {
                    "error": f"Unknown domain(s): {', '.join(sorted(invalid))}. Valid values: {', '.join(sorted(VALID_DOMAINS))}."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        effective_roles = request.user.get_effective_roles()

        domain_querysets = self._get_domain_querysets(
            requested_domains, request.user, effective_roles, requested_status
        )

        unified_queue = []
        for domain, qs in domain_querysets.items():
            for item in qs:
                entry = self._serialise_domain(domain, item, request=request)
                if entry:
                    unified_queue.append(entry)

        unified_queue.sort(
            key=lambda x: (
                not x.get("is_external", False),
                -(x.get("updated_at") or x["created_at"]).timestamp(),
            )
        )

        return Response(
            {
                "total_pending": len(unified_queue),
                "queue": unified_queue,
            }
        )

    def _get_domain_querysets(
        self, requested_domains, user, effective_roles, requested_status
    ):
        is_it_admin = Role.Name.IT_ADMIN in effective_roles
        querysets = {}

        # ── Spaces ────────────────────────────────────────────────────────────
        is_space_approver = bool(
            effective_roles
            & {
                Role.Name.RECEPTIONIST,
                Role.Name.LAB_INCHARGE,
                Role.Name.LIBRARIAN,
                Role.Name.HOD,
                Role.Name.IT_ADMIN,
            }
        )
        if "spaces" in requested_domains and is_space_approver:
            querysets["spaces"] = _get_space_queryset_for_user(
                user, effective_roles, requested_status
            )

        # ── Fleet ──────────────────────────────────────────────────────────────
        if "fleet" in requested_domains:
            if is_it_admin or Role.Name.FLEET_MANAGER in effective_roles:
                querysets["fleet"] = (
                    FleetBooking.objects.filter(status=requested_status)
                    .select_related("user", "user__department", "vehicle")
                    .order_by("-updated_at", "-created_at")
                )

        # ── Mess ───────────────────────────────────────────────────────────────
        if "mess" in requested_domains:
            if is_it_admin or Role.Name.MESS_MANAGER in effective_roles:
                querysets["mess"] = (
                    MessBooking.objects.filter(status=requested_status)
                    .select_related("user", "user__department")
                    .order_by("-updated_at", "-created_at")
                )

        # ── Media ──────────────────────────────────────────────────────────────
        if "media" in requested_domains:
            if is_it_admin or Role.Name.MEDIA_INCHARGE in effective_roles:
                querysets["media"] = (
                    MediaBooking.objects.filter(status=requested_status)
                    .select_related("user", "user__department")
                    .prefetch_related("equipment_requests__equipment")
                    .order_by("-updated_at", "-created_at")
                )

        return querysets

    def _serialise_domain(self, domain, item, request=None):
        if domain == "spaces":
            equipment_list = [
                {
                    "id": er.id,
                    "equipment_id": er.equipment_id,
                    "equipment_name": er.equipment.name,
                    "quantity": er.quantity,
                }
                for er in item.requested_equipment.all()
            ]
            return _build_queue_entry(
                domain,
                item,
                request=request,
                group_id=str(item.group_id),
                start_datetime=getattr(item, "start_datetime", None),
                end_datetime=getattr(item, "end_datetime", None),
                attendee_count=getattr(item, "attendee_count", None),
                resource_name=getattr(item.space, "name", "Space Resource"),
                purpose=item.purpose_of_booking,
                purpose_of_booking=item.purpose_of_booking,
                user_notes=item.user_notes or "",
                equipment_requests=equipment_list,
                space_details={
                    "space_type": getattr(item.space, "space_type", None),
                    "approval_category": getattr(item.space, "approval_category", None),
                    "block": getattr(item.space.block, "name", None),
                    "capacity_hard": getattr(item.space, "capacity_hard", None),
                },
                faculty_sponsor_name=(
                    f"{item.faculty_sponsor.first_name} {item.faculty_sponsor.last_name}".strip()
                    or item.faculty_sponsor.email
                    if getattr(item, "faculty_sponsor", None)
                    else None
                ),
                faculty_timed_out=getattr(item, "faculty_timed_out", False),
                faculty_phone=getattr(item.faculty_sponsor, "phone", None) if getattr(item, "faculty_sponsor", None) else None,
                is_student_booking=bool(getattr(item, "faculty_sponsor_id", None)),
            )

        elif domain == "fleet":
            return _build_queue_entry(
                domain,
                item,
                request=request,
                start_datetime=getattr(
                    item, "start_datetime", getattr(item, "departure_time", None)
                ),
                end_datetime=getattr(
                    item, "end_datetime", getattr(item, "return_time", None)
                ),
                attendee_count=getattr(
                    item, "passenger_count", getattr(item, "passengers", None)
                ),
                resource_name=getattr(item.vehicle, "name", "Fleet Vehicle"),
                purpose=getattr(item, "purpose", "No purpose provided"),
                user_notes=getattr(item, "user_notes", "") or "",
            )

        elif domain == "mess":
            return _build_queue_entry(
                domain,
                item,
                request=request,
                start_datetime=getattr(item, "start_date", None),
                end_datetime=getattr(item, "end_date", None),
                attendee_count=getattr(item, "total_persons", None),
                resource_name=f"Catering ({getattr(item, 'total_persons', 0)} persons)",
                purpose=getattr(item, "purpose_of_programme", "No purpose provided"),
                user_notes=getattr(item, "user_notes", "") or "",
            )

        elif domain == "media":
            return _build_queue_entry(
                domain,
                item,
                request=request,
                start_datetime=getattr(item, "setup_start_datetime", None),
                end_datetime=getattr(item, "teardown_end_datetime", None),
                attendee_count=getattr(item, "attendees", None),
                resource_name="Equipment/Media Support",
                purpose=getattr(
                    item, "event_name", getattr(item, "purpose", "No purpose provided")
                ),
                user_notes=getattr(item, "user_notes", "") or "",
            )

        return None


# ==========================================
# 2. APPROVAL ENGINE (PATCH)
# ==========================================


class AdminResolveBookingAPIView(APIView):
    permission_classes = [IsApprover]

    MODEL_MAP = {
        "spaces": SpaceBooking,
        "fleet": FleetBooking,
        "mess": MessBooking,
        "media": MediaBooking,
    }

    GROUP_AWARE_MODULES = {"spaces"}

    def _can_resolve_booking(self, module, booking, user):
        effective_roles = user.get_effective_roles()

        if Role.Name.IT_ADMIN in effective_roles:
            return True

        if module == "spaces":
            return _user_can_resolve_space_booking(user, effective_roles, booking)
        if module == "fleet":
            return Role.Name.FLEET_MANAGER in effective_roles
        if module == "mess":
            return Role.Name.MESS_MANAGER in effective_roles
        if module == "media":
            return Role.Name.MEDIA_INCHARGE in effective_roles

        return False

    def patch(self, request):
        module = request.data.get("module")
        booking_id = request.data.get("id")
        new_status = request.data.get("status")
        remarks = request.data.get("remarks", "").strip()

        if module not in self.MODEL_MAP:
            return Response(
                {
                    "error": f"Invalid module. Valid values: {', '.join(sorted(self.MODEL_MAP))}."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if new_status not in ["APPROVED", "REJECTED"]:
            return Response(
                {"error": "Status must be APPROVED or REJECTED."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if new_status == "REJECTED" and not remarks:
            return Response(
                {"error": "You must provide 'remarks' when rejecting a request."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        model_class = self.MODEL_MAP[module]
        try:
            booking = model_class.objects.get(id=booking_id)
        except model_class.DoesNotExist:
            return Response(
                {"error": "Booking not found."}, status=status.HTTP_404_NOT_FOUND
            )

        if module in self.GROUP_AWARE_MODULES:
            booking.refresh_from_db()
        else:
            refresh_booking_lifecycle(booking)
            booking.refresh_from_db()

        if not self._can_resolve_booking(module, booking, request.user):
            return Response(
                {"error": "You are not authorized to resolve this booking."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if new_status == "APPROVED" and booking.status not in [
            "PENDING",
            "FACULTY_ESCALATED",
        ]:
            return Response(
                {"error": f"Booking is already {booking.status}."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if new_status == "REJECTED" and booking.status not in [
            "PENDING",
            "FACULTY_ESCALATED",
            "APPROVED",
        ]:
            return Response(
                {
                    "error": f"Cannot reject a booking that is currently {booking.status}."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            if module in self.GROUP_AWARE_MODULES:
                self._resolve_group(booking, new_status, remarks, request.user)
            else:
                self._resolve_single(booking, new_status, remarks, request.user, module)

            return Response(
                {
                    "message": f"Booking {booking.reference_code} successfully {new_status.lower()}.",
                    "ref": booking.reference_code,
                    "status": new_status,
                }
            )
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_409_CONFLICT)

    def _resolve_single(self, booking, new_status, remarks, resolved_by, module):
        """
        Resolves a single (non-group) booking.

        For media approvals, this method mirrors the checks performed by
        MediaBookingViewSet.review() to ensure the unified approval queue
        cannot bypass equipment availability or team capacity constraints.
        """
        if module == "media" and new_status == "APPROVED":
            self._validate_media_approval(booking)

        booking.status = new_status
        booking.resolved_by = resolved_by
        booking.resolved_at = timezone.now()
        if remarks:
            booking.remarks_by_admin = remarks
        booking.save()
        mark_pending_request_notifications_read(booking, domain=module)
        notify_booking_status_change(
            booking, new_status, module, resolved_by, remarks=remarks
        )

    def _validate_media_approval(self, booking):
        """
        Runs all media-specific pre-approval checks and raises an Exception
        with a descriptive message if any check fails.

        Checks performed (in order):
          1. Ensure team requests have equipment (reserve standard kit if needed).
          2. Team capacity: no more than max_concurrent_events at the same time.
          3. Equipment availability: no over-commitment against approved bookings.
        """
        media_settings = MediaSettings.load()

        # 1. Ensure team requests have their standard kit attached.
        if booking.is_team_request and not booking.equipment_requests.exists():
            _reserve_standard_team_kit(booking)

        # 2. Team capacity check.
        if booking.is_team_request and not _media_team_capacity_available(
            booking, media_settings
        ):
            raise Exception(
                "Media team capacity is full for this event's time block. "
                f"The team can handle at most {media_settings.max_concurrent_events} concurrent events."
            )

        # 3. Equipment availability check (against already-APPROVED bookings).
        is_available, error_message = _check_media_equipment_availability(booking)
        if not is_available:
            raise Exception(error_message)

    def _resolve_group(self, booking, new_status, remarks, resolved_by):
        siblings = SpaceBooking.objects.filter(group_id=booking.group_id).filter(
            status__in=["PENDING", "FACULTY_ESCALATED", "APPROVED"]
        )
        resolved_at = timezone.now()
        for sibling in siblings:
            if new_status == "APPROVED" and sibling.status not in [
                "PENDING",
                "FACULTY_ESCALATED",
            ]:
                continue
            sibling.status = new_status
            sibling.resolved_by = resolved_by
            sibling.resolved_at = resolved_at
            if remarks:
                sibling.remarks_by_admin = remarks
            sibling.save()
            mark_pending_request_notifications_read(sibling, domain="spaces")
            notify_booking_status_change(
                sibling, new_status, "spaces", resolved_by, remarks=remarks
            )
