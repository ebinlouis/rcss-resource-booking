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
# HELPER
# ==========================================
def _requester_info(user):
    """
    Returns a dict of display-ready requester fields.
    Centralised so every domain (spaces, fleet, mess, media) stays consistent.
    """
    full_name = f"{user.first_name} {user.last_name}".strip() or user.email

    dept = getattr(user, 'department', None)
    dept_name = dept.department_name if dept else 'General'
    dept_code = dept.department_code if dept else 'General'

    # phone is optional — only include if the field exists on CustomUser
    phone = getattr(user, 'phone', None) or getattr(user, 'phone_number', None) or ''

    return {
        "requester":       full_name,
        "requester_email": user.email,
        "requester_phone": phone,
        "department":      dept_code,   # kept for backward compat
        "department_name": dept_name,   # human-readable label for the UI
    }


# ==========================================
# 1. ADMIN QUEUE (GET)
# ==========================================
class UnifiedApprovalQueueView(APIView):
    permission_classes = [IsApprover]

    def get(self, request):
        user = request.user
        now = timezone.now()

        # --- 1. DETERMINE EFFECTIVE ROLE ---
        active_override = RoleOverride.objects.filter(
            user=user, is_active=True
        ).filter(Q(expires_at__isnull=True) | Q(expires_at__gt=now)).first()

        effective_role = (
            active_override.overridden_role.name
            if active_override
            else (user.role.name if user.role else None)
        )

        # --- 2. BASE QUERIES (PENDING ONLY) ---
        spaces = (
            SpaceBooking.objects
            .filter(status='PENDING')
            .select_related('user', 'user__department', 'space')
            .prefetch_related('requested_equipment__equipment')
        )
        fleet = (
            FleetBooking.objects
            .filter(status='PENDING')
            .select_related('user', 'user__department', 'vehicle')
        )
        mess = (
            MessBooking.objects
            .filter(status='PENDING')
            .select_related('user', 'user__department')
        )
        media = (
            MediaBooking.objects
            .filter(status='PENDING')
            .select_related('user', 'user__department')
        )

        # --- 3. SCOPE FILTERING ---
        if user.is_superuser or effective_role == 'IT_ADMIN':
            pass

        elif effective_role == 'HOD':
            if getattr(user, 'department', None):
                spaces = spaces.filter(user__department=user.department)
                fleet  = fleet.filter(user__department=user.department)
                mess   = mess.filter(user__department=user.department)
                media  = media.filter(user__department=user.department)
            else:
                spaces, fleet, mess, media = (
                    spaces.none(), fleet.none(), mess.none(), media.none()
                )

        else:
            spaces, fleet, mess, media = (
                spaces.none(), fleet.none(), mess.none(), media.none()
            )

        # --- 4. FORMAT FOR REACT TABLE ---
        unified_queue = []

        for item in spaces:
            equipment_list = [
                {
                    "id":             er.id,
                    "equipment_id":   er.equipment_id,
                    "equipment_name": er.equipment.name,
                    "quantity":       er.quantity,
                }
                for er in item.requested_equipment.all()
            ]

            unified_queue.append({
                "id":                item.id,
                "domain":            "spaces",
                "reference_code":    item.reference_code,
                **_requester_info(item.user),
                "created_at":        item.created_at,
                "start_datetime":    getattr(item, 'start_datetime', None),
                "end_datetime":      getattr(item, 'end_datetime', None),
                "attendee_count":    getattr(item, 'attendee_count', None),
                "resource_name":     getattr(item.space, 'name', 'Space Resource'),
                "purpose":           item.purpose_of_booking,
                "user_notes":        item.user_notes or "",
                "equipment_requests": equipment_list,
                "is_external":       getattr(item, 'is_external', False), # <-- ADDED THIS
            })

        for item in fleet:
            unified_queue.append({
                "id":             item.id,
                "domain":         "fleet",
                "reference_code": item.reference_code,
                **_requester_info(item.user),
                "created_at":     item.created_at,
                "start_datetime": getattr(item, 'start_datetime', getattr(item, 'departure_time', None)),
                "end_datetime":   getattr(item, 'end_datetime',   getattr(item, 'return_time', None)),
                "attendee_count": getattr(item, 'passenger_count', getattr(item, 'passengers', None)),
                "resource_name":  getattr(item.vehicle, 'name', 'Fleet Vehicle'),
                "purpose":        getattr(item, 'purpose', 'No purpose provided'),
                "is_external":    getattr(item, 'is_external', False), # Added for safety
            })

        for item in mess:
            unified_queue.append({
                "id":             item.id,
                "domain":         "mess",
                "reference_code": item.reference_code,
                **_requester_info(item.user),
                "created_at":     item.created_at,
                "start_datetime": getattr(item, 'date_of_programme', getattr(item, 'delivery_time', None)),
                "end_datetime":   getattr(item, 'end_time', None),
                "attendee_count": getattr(item, 'total_persons', None),
                "resource_name":  f"Catering ({getattr(item, 'total_persons', 0)} persons)",
                "purpose":        getattr(item, 'purpose_of_programme', 'No purpose provided'),
                "is_external":    getattr(item, 'is_external', False), # Added for safety
            })

        for item in media:
            unified_queue.append({
                "id":             item.id,
                "domain":         "media",
                "reference_code": item.reference_code,
                **_requester_info(item.user),
                "created_at":     item.created_at,
                "start_datetime": getattr(item, 'event_date', getattr(item, 'start_datetime', None)),
                "end_datetime":   getattr(item, 'end_datetime', None),
                "attendee_count": getattr(item, 'attendees', None),
                "resource_name":  "Equipment/Media Support",
                "purpose":        getattr(item, 'event_name', getattr(item, 'purpose', 'No purpose provided')),
                "is_external":    getattr(item, 'is_external', False), # Added for safety
            })

        # --- 5. SORT: PRIORITY (External) FIRST, THEN OLDEST ---
        # `not x.get('is_external')` evaluates to False (0) for external events, and True (1) for internal.
        # This pushes external events to the top, and resolves ties using `created_at`.
        unified_queue.sort(key=lambda x: (not x.get('is_external', False), x['created_at']))

        return Response({
            "total_pending": len(unified_queue),
            "queue": unified_queue,
        })


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

    def patch(self, request):
        """Approves or rejects a specific booking."""
        module     = request.data.get('module')
        booking_id = request.data.get('id')
        new_status = request.data.get('status')
        remarks    = request.data.get('remarks', '').strip()

        if module not in self.MODEL_MAP:
            return Response(
                {"error": "Invalid module provided."},
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
            return Response(
                {"error": "Booking not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if booking.status != 'PENDING':
            return Response(
                {"error": f"Booking is already {booking.status}."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        booking.status      = new_status
        booking.resolved_by = request.user
        booking.resolved_at = timezone.now()

        if remarks:
            booking.remarks_by_admin = remarks

        try:
            booking.save()
            return Response({
                "message": f"Booking {booking.reference_code} successfully {new_status.lower()}.",
                "ref":     booking.reference_code,
                "status":  booking.status,
            })
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_409_CONFLICT)