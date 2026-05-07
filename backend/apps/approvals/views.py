from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.utils import timezone
from django.db.models import Q

from apps.users.permissions import IsApprover
from apps.users.models import RoleOverride # <-- NEW IMPORT

from apps.spaces.models import SpaceBooking
from apps.fleet.models import FleetBooking
from apps.mess.models import MessBooking
from apps.media.models import MediaBooking

# ==========================================
# 1. ADMIN QUEUE (GET)
# ==========================================
class UnifiedApprovalQueueView(APIView):
    # Lock the door: Only authorized approvers get in
    permission_classes = [IsApprover] 

    def get(self, request):
        user = request.user
        now = timezone.now()

        # --- 1. DETERMINE EFFECTIVE ROLE ---
        active_override = RoleOverride.objects.filter(
            user=user, is_active=True
        ).filter(Q(expires_at__isnull=True) | Q(expires_at__gt=now)).first()
        
        effective_role = active_override.overridden_role.name if active_override else (user.role.name if user.role else None)

        # --- 2. BASE QUERIES (PENDING ONLY) ---
        spaces = SpaceBooking.objects.filter(status='PENDING').select_related('user', 'space')
        fleet = FleetBooking.objects.filter(status='PENDING').select_related('user', 'vehicle')
        mess = MessBooking.objects.filter(status='PENDING').select_related('user')
        media = MediaBooking.objects.filter(status='PENDING').select_related('user')

        # --- 3. SCOPE FILTERING (THE BOUNCER) ---
        if user.is_superuser or effective_role == 'IT_ADMIN':
            # God Mode: Can see all pending requests across the entire institution
            pass 
            
        elif effective_role == 'HOD':
            # Department Scope: Can only see requests from students/staff in their own department
            if user.department:
                spaces = spaces.filter(user__department=user.department)
                fleet = fleet.filter(user__department=user.department)
                mess = mess.filter(user__department=user.department)
                media = media.filter(user__department=user.department)
            else:
                # Security fallback: If an HOD somehow has no department assigned, show nothing.
                spaces, fleet, mess, media = spaces.none(), fleet.none(), mess.none(), media.none()
                
        # (Optional) You can add other roles here later, e.g.:
        # elif effective_role == 'FACILITY_MANAGER':
        #     mess, media = mess.none(), media.none() # Facility only sees Space/Fleet
            
        else:
            # Absolute fallback: If role doesn't match known approval rules, return empty queues
            spaces, fleet, mess, media = spaces.none(), fleet.none(), mess.none(), media.none()

        # --- 4. FORMAT FOR REACT TABLE ---
        unified_queue = []

        for item in spaces:
            unified_queue.append({
                "id": item.id,
                "domain": "spaces",
                "reference_code": item.reference_code,
                "requester": item.user.email,
                "created_at": item.created_at,
                "resource_name": item.space.name,          
                "purpose": item.purpose_of_booking          
            })

        for item in fleet:
            unified_queue.append({
                "id": item.id,
                "domain": "fleet",
                "reference_code": item.reference_code,
                "requester": item.user.email,
                "created_at": item.created_at,
                "resource_name": item.vehicle.name,        
                "purpose": item.purpose                    
            })

        for item in mess:
            unified_queue.append({
                "id": item.id,
                "domain": "mess",
                "reference_code": item.reference_code,
                "requester": item.user.email,
                "created_at": item.created_at,
                "resource_name": f"Catering ({item.total_persons} Pax)", 
                "purpose": item.purpose_of_programme
            })

        for item in media:
            unified_queue.append({
                "id": item.id,
                "domain": "media",
                "reference_code": item.reference_code,
                "requester": item.user.email,
                "created_at": item.created_at,
                "resource_name": "Equipment/Media Support",    
                "purpose": item.event_name
            })

        # --- 5. SORT BY OLDEST FIRST ---
        unified_queue.sort(key=lambda x: x['created_at'])

        return Response({
            "total_pending": len(unified_queue),
            "queue": unified_queue
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
        'media': MediaBooking
    }

    def patch(self, request):
        """Approves or Rejects a specific booking."""
        module = request.data.get('module')      
        booking_id = request.data.get('id')      
        new_status = request.data.get('status')  
        remarks = request.data.get('remarks', '').strip()

        if module not in self.MODEL_MAP:
            return Response({"error": "Invalid module provided."}, status=status.HTTP_400_BAD_REQUEST)
        
        if new_status not in ['APPROVED', 'REJECTED']:
            return Response({"error": "Status must be APPROVED or REJECTED."}, status=status.HTTP_400_BAD_REQUEST)

        if new_status == 'REJECTED' and not remarks:
            return Response(
                {"error": "You must provide 'remarks' when rejecting a request."}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        model_class = self.MODEL_MAP[module]
        try:
            booking = model_class.objects.get(id=booking_id)
        except model_class.DoesNotExist:
            return Response({"error": "Booking not found."}, status=status.HTTP_404_NOT_FOUND)

        if booking.status != 'PENDING':
            return Response({"error": f"Booking is already {booking.status}."}, status=status.HTTP_400_BAD_REQUEST)

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
                "status": booking.status
            })
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_409_CONFLICT)