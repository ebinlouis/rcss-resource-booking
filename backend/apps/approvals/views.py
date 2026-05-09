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
        # Prefetch requested_equipment and the related equipment catalog row
        # so the loop below does not issue per-booking N+1 queries.
        spaces = (
            SpaceBooking.objects
            .filter(status='PENDING')
            .select_related('user', 'space')
            .prefetch_related('requested_equipment__equipment')
        )
        fleet = FleetBooking.objects.filter(status='PENDING').select_related('user', 'vehicle')
        mess = MessBooking.objects.filter(status='PENDING').select_related('user')
        media = MediaBooking.objects.filter(status='PENDING').select_related('user')

        # --- 3. SCOPE FILTERING ---
        if user.is_superuser or effective_role == 'IT_ADMIN':
            pass

        elif effective_role == 'HOD':
            if getattr(user, 'department', None):
                spaces = spaces.filter(user__department=user.department)
                fleet = fleet.filter(user__department=user.department)
                mess = mess.filter(user__department=user.department)
                media = media.filter(user__department=user.department)
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
            # Build a human-readable list of requested equipment names so the
            # admin UI can display them without a separate API call.
            equipment_list = [
                {
                    "id": er.id,
                    "equipment_id": er.equipment_id,
                    "equipment_name": er.equipment.name,
                    "quantity": er.quantity,
                }
                for er in item.requested_equipment.all()
            ]

            unified_queue.append({
                "id": item.id,
                "domain": "spaces",
                "reference_code": item.reference_code,
                "requester": item.user.email,
                "department": (
                    str(item.user.department)
                    if getattr(item.user, 'department', None)
                    else 'General'
                ),
                "created_at": item.created_at,
                "start_datetime": getattr(item, 'start_datetime', None),
                "end_datetime": getattr(item, 'end_datetime', None),
                "attendee_count": getattr(item, 'attendee_count', None),
                "resource_name": getattr(item.space, 'name', 'Space Resource'),
                "purpose": item.purpose_of_booking,
                # These two fields were previously absent, causing Bug 1 and Bug 2.
                "user_notes": item.user_notes or "",
                "equipment_requests": equipment_list,
            })

        for item in fleet:
            unified_queue.append({
                "id": item.id,
                "domain": "fleet",
                "reference_code": item.reference_code,
                "requester": item.user.email,
                "department": (
                    str(item.user.department)
                    if getattr(item.user, 'department', None)
                    else 'General'
                ),
                "created_at": item.created_at,
                "start_datetime": getattr(item, 'start_datetime', getattr(item, 'departure_time', None)),
                "end_datetime": getattr(item, 'end_datetime', getattr(item, 'return_time', None)),
                "attendee_count": getattr(item, 'passenger_count', getattr(item, 'passengers', None)),
                "resource_name": getattr(item.vehicle, 'name', 'Fleet Vehicle'),
                "purpose": getattr(item, 'purpose', 'No purpose provided'),
            })

        for item in mess:
            unified_queue.append({
                "id": item.id,
                "domain": "mess",
                "reference_code": item.reference_code,
                "requester": item.user.email,
                "department": (
                    str(item.user.department)
                    if getattr(item.user, 'department', None)
                    else 'General'
                ),
                "created_at": item.created_at,
                "start_datetime": getattr(item, 'date_of_programme', getattr(item, 'delivery_time', None)),
                "end_datetime": getattr(item, 'end_time', None),
                "attendee_count": getattr(item, 'total_persons', None),
                "resource_name": f"Catering ({getattr(item, 'total_persons', 0)} Pax)",
                "purpose": getattr(item, 'purpose_of_programme', 'No purpose provided'),
            })

        for item in media:
            unified_queue.append({
                "id": item.id,
                "domain": "media",
                "reference_code": item.reference_code,
                "requester": item.user.email,
                "department": (
                    str(item.user.department)
                    if getattr(item.user, 'department', None)
                    else 'General'
                ),
                "created_at": item.created_at,
                "start_datetime": getattr(item, 'event_date', getattr(item, 'start_datetime', None)),
                "end_datetime": getattr(item, 'end_datetime', None),
                "attendee_count": getattr(item, 'attendees', None),
                "resource_name": "Equipment/Media Support",
                "purpose": getattr(item, 'event_name', getattr(item, 'purpose', 'No purpose provided')),
            })

        # --- 5. SORT BY OLDEST FIRST ---
        unified_queue.sort(key=lambda x: x['created_at'])

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
        'fleet': FleetBooking,
        'mess': MessBooking,
        'media': MediaBooking,
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

        booking.status = new_status
        booking.resolved_by = request.user
        booking.resolved_at = timezone.now()

        if remarks:
            booking.remarks_by_admin = remarks

        try:
            booking.save()
            return Response({
                "message": f"Booking {booking.reference_code} successfully {new_status.lower()}.",
                "ref": booking.reference_code,
                "status": booking.status,
            })
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_409_CONFLICT)