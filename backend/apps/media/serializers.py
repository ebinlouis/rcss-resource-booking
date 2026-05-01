from rest_framework import serializers
from django.utils import timezone
from apps.media.models import MediaBooking
from apps.spaces.models import Space

class SpaceSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = Space
        fields = ['id', 'name', 'space_type', 'location', 'capacity_hard']

class MediaBookingSerializer(serializers.ModelSerializer):
    space_details = SpaceSummarySerializer(source='space', read_only=True)

    class Meta:
        model = MediaBooking
        fields = [
            'id', 'reference_code', 'user', 'department', 'status',
            'approved_by', 'updated_by', 'remarks_by_admin', 'user_notes',
            'resolved_at', 'created_at', 'updated_at',
            'space', 'space_details', 'event_name',
            'booking_date', 'start_time', 'end_time',
            'requested_equipment', 'requested_services',
            'technical_contact_person',
        ]
        read_only_fields = [
            'id', 'reference_code', 'user', 'status', # User is now read-only
            'approved_by', 'updated_by', 'resolved_at', 
            'created_at', 'updated_at'
        ]

    def validate(self, data):
        start = data.get('start_time')
        end = data.get('end_time')
        booking_date = data.get('booking_date')

        # 1. Past Date Check
        if booking_date and booking_date < timezone.now().date():
            raise serializers.ValidationError({
                "booking_date": "Media requests cannot be made for past dates."
            })

        # 2. Sequential Time Check
        if start and end and start >= end:
            raise serializers.ValidationError({
                "start_time": f"Start time ({start}) must be before end time ({end})."
            })

        return data