from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.utils import timezone
from apps.users.permissions import IsApprover

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
        # 1. Fetch PENDING requests. 
        spaces = SpaceBooking.objects.filter(status='PENDING').values(
            'id', 'reference_code', 'user__email', 'created_at', 'purpose_of_booking', 'space__name'
        )
        fleet = FleetBooking.objects.filter(status='PENDING').values(
            'id', 'reference_code', 'user__email', 'created_at', 'purpose', 'vehicle__name'
        )
        mess = MessBooking.objects.filter(status='PENDING').values(
            'id', 'reference_code', 'user__email', 'created_at', 'purpose_of_programme', 'total_persons'
        )
        media = MediaBooking.objects.filter(status='PENDING').values(
            'id', 'reference_code', 'user__email', 'created_at', 'event_name'
        )

        # 2. Standardize the shape so the React Table can map over it blindly
        unified_queue = []

        for item in spaces:
            unified_queue.append({
                "id": item['id'],
                "domain": "spaces",
                "reference_code": item['reference_code'],
                "requester": item['user__email'],
                "created_at": item['created_at'],
                "resource_name": item['space__name'],          
                "purpose": item['purpose_of_booking']          
            })

        for item in fleet:
            unified_queue.append({
                "id": item['id'],
                "domain": "fleet",
                "reference_code": item['reference_code'],
                "requester": item['user__email'],
                "created_at": item['created_at'],
                "resource_name": item['vehicle__name'],        
                "purpose": item['purpose']                     
            })

        for item in mess:
            unified_queue.append({
                "id": item['id'],
                "domain": "mess",
                "reference_code": item['reference_code'],
                "requester": item['user__email'],
                "created_at": item['created_at'],
                "resource_name": f"Catering ({item['total_persons']} Pax)", 
                "purpose": item['purpose_of_programme']
            })

        for item in media:
            unified_queue.append({
                "id": item['id'],
                "domain": "media",
                "reference_code": item['reference_code'],
                "requester": item['user__email'],
                "created_at": item['created_at'],
                "resource_name": "Equipment/Media Support",    
                "purpose": item['event_name']
            })

        # 3. Sort the combined list by oldest first (First In, First Out)
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

    # Map the incoming string to the actual Django Model
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

        # 1. Basic Validation
        if module not in self.MODEL_MAP:
            return Response({"error": "Invalid module provided."}, status=status.HTTP_400_BAD_REQUEST)
        
        if new_status not in ['APPROVED', 'REJECTED']:
            return Response({"error": "Status must be APPROVED or REJECTED."}, status=status.HTTP_400_BAD_REQUEST)

        # 2. Business Logic Rule: Rejections MUST have remarks
        if new_status == 'REJECTED' and not remarks:
            return Response(
                {"error": "You must provide 'remarks' when rejecting a request."}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        # 3. Fetch the record
        model_class = self.MODEL_MAP[module]
        try:
            booking = model_class.objects.get(id=booking_id)
        except model_class.DoesNotExist:
            return Response({"error": "Booking not found."}, status=status.HTTP_404_NOT_FOUND)

        # 4. Prevent modifying already resolved bookings
        if booking.status != 'PENDING':
            return Response({"error": f"Booking is already {booking.status}."}, status=status.HTTP_400_BAD_REQUEST)

        # 5. Apply the updates and SLA timestamps
        booking.status = new_status
        booking.resolved_by = request.user
        booking.resolved_at = timezone.now()
        
        if remarks:
            booking.remarks_by_admin = remarks

        # 6. Save (This will safely trigger your database constraints)
        try:
            booking.save()
            return Response({
                "message": f"Booking {booking.reference_code} successfully {new_status.lower()}.",
                "ref": booking.reference_code,
                "status": booking.status
            })
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_409_CONFLICT)