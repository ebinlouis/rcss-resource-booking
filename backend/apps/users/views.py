from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone

# Explicit imports matching your app structure
from apps.spaces.models import SpaceBooking
from apps.fleet.models import FleetBooking
from apps.mess.models import MessBooking
from apps.media.models import MediaBooking

class DashboardAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        today = timezone.now().date()

        # 1. Spaces (Uses start_datetime)
        spaces = SpaceBooking.objects.filter(
            user=user, 
            start_datetime__date__gte=today
        ).exclude(status='REJECTED').order_by('start_datetime')

        # 2. Fleet (Uses start_datetime)
        fleet = FleetBooking.objects.filter(
            user=user, 
            start_datetime__date__gte=today
        ).exclude(status='REJECTED').order_by('start_datetime')

        # 3. Mess (Uses booking_date)
        mess = MessBooking.objects.filter(
            user=user, 
            booking_date__gte=today
        ).exclude(status='REJECTED').order_by('booking_date', 'delivery_time')

        # 4. Media (Uses booking_date)
        media = MediaBooking.objects.filter(
            user=user, 
            booking_date__gte=today
        ).exclude(status='REJECTED').order_by('booking_date', 'start_time')

        # Calculate "Action Center" Badge (Total Pending across all modules)
        total_pending = (
            spaces.filter(status='PENDING').count() +
            fleet.filter(status='PENDING').count() +
            mess.filter(status='PENDING').count() +
            media.filter(status='PENDING').count()
        )

        return Response({
            "greeting": {
                "user_name": user.first_name or "User",
                "pending_count": total_pending,
                "date_display": today.strftime("%A, %B %d")
            },
            "modules": {
                "spaces": [
                    {"id": s.id, "ref": s.reference_code, "title": s.space.name, "status": s.status} 
                    for s in spaces
                ],
                "fleet": [
                    {"id": f.id, "ref": f.reference_code, "title": f.vehicle.name, "status": f.status} 
                    for f in fleet
                ],
                "mess": [
                    {"id": m.id, "ref": m.reference_code, "title": f"Catering ({m.total_persons} Pax)", "status": m.status} 
                    for m in mess
                ],
                "media": [
                    {"id": e.id, "ref": e.reference_code, "title": e.event_name, "status": e.status} 
                    for e in media
                ]
            }
        })