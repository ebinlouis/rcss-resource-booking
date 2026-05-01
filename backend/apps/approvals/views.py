from rest_framework.views import APIView
from rest_framework.response import Response
from apps.users.permissions import IsApprover # <-- Your new custom permission

# We can import these safely because you already built the models!
from apps.spaces.models import SpaceBooking
from apps.fleet.models import FleetBooking
from apps.mess.models import MessBooking
from apps.media.models import MediaBooking

class UnifiedApprovalQueueView(APIView):
    # Lock the door: Only staff/admins get in here now!
    permission_classes = [IsApprover] 

    def get(self, request):
        # 1. Fetch all PENDING requests using Django's ultra-fast .values() query
        spaces = SpaceBooking.objects.filter(status='PENDING').values(
            'id', 'reference_code', 'user__email', 'created_at', 'purpose_of_booking'
        )
        fleet = FleetBooking.objects.filter(status='PENDING').values(
            'id', 'reference_code', 'user__email', 'created_at', 'purpose'
        )
        mess = MessBooking.objects.filter(status='PENDING').values(
            'id', 'reference_code', 'user__email', 'created_at', 'purpose_of_programme'
        )
        media = MediaBooking.objects.filter(status='PENDING').values(
            'id', 'reference_code', 'user__email', 'created_at', 'event_name'
        )

        # 2. Standardize the shape of the data for the React frontend
        unified_queue = []

        for item in spaces:
            unified_queue.append({**item, "domain": "SPACE", "title": item['purpose_of_booking']})
        for item in fleet:
            unified_queue.append({**item, "domain": "FLEET", "title": item['purpose']})
        for item in mess:
            unified_queue.append({**item, "domain": "MESS", "title": item['purpose_of_programme']})
        for item in media:
            unified_queue.append({**item, "domain": "MEDIA", "title": item['event_name']})

        # 3. Sort the combined list by oldest first (First In, First Out)
        unified_queue.sort(key=lambda x: x['created_at'])

        return Response(unified_queue)