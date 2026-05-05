from rest_framework import serializers
from .models import Space, SpaceBooking

class SpaceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Space
        fields = ['id', 'name', 'space_type', 'capacity_hard', 'location', 'is_active']

class SpaceBookingSerializer(serializers.ModelSerializer):
    # We include the space details for read operations, but expect an ID for writes
    space_details = SpaceSerializer(source='space', read_only=True)
    
    class Meta:
        model = SpaceBooking
        fields = [
            'id', 'reference_code', 'user', 'department', 'status', 
            'space', 'space_details', 'start_datetime', 'end_datetime', 
            'attendee_count', 'purpose_of_booking', 'requested_equipment',
            'created_at', 'updated_at'
        ]
        
        # ENTERPRISE SECURITY LOCKDOWN:
        # The frontend cannot send or modify ANY of these fields during a POST or PUT.
        # - user: Prevent impersonation
        # - status: Prevent a user from auto-approving their own booking
        # - reference_code: Prevent ID collisions
        read_only_fields = ['reference_code', 'status', 'created_at', 'updated_at', 'user']

    def validate(self, data):
        """
        Custom Business Logic Validation
        """
        # 1. Capacity Check
        space = data.get('space')
        attendees = data.get('attendee_count')
        
        if space and attendees:
            if attendees > space.capacity_hard:
                raise serializers.ValidationError({
                    "attendee_count": f"This space only holds {space.capacity_hard} people. You requested {attendees}."
                })
        
        return data