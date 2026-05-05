from rest_framework import serializers
from .models import Space, SpaceBooking, Equipment, SpaceEquipment, EquipmentRequest

# ==========================================
# 1. INVENTORY SERIALIZERS
# ==========================================
class EquipmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Equipment
        fields = ['id', 'name', 'category', 'total_owned', 'total_functional', 'is_returnable', 'is_active']

class SpaceEquipmentSerializer(serializers.ModelSerializer):
    # We want the API to return the actual name of the equipment, not just the ID
    equipment_name = serializers.CharField(source='equipment.name', read_only=True)
    category = serializers.CharField(source='equipment.category', read_only=True)

    class Meta:
        model = SpaceEquipment
        fields = ['id', 'equipment', 'equipment_name', 'category', 'quantity']


# ==========================================
# 2. SPACE SERIALIZER
# ==========================================
class SpaceSerializer(serializers.ModelSerializer):
    # Nest the built-in equipment so the React RoomCard can display exactly what is in the room
    built_in_equipment = SpaceEquipmentSerializer(many=True, read_only=True)
    
    class Meta:
        model = Space
        # Added image_1 and built_in_equipment
        fields = ['id', 'name', 'space_type', 'capacity_hard', 'location', 'image_1', 'is_active', 'built_in_equipment']


# ==========================================
# 3. BOOKING & REQUEST SERIALIZERS
# ==========================================
class EquipmentRequestSerializer(serializers.ModelSerializer):
    equipment_name = serializers.CharField(source='equipment.name', read_only=True)

    class Meta:
        model = EquipmentRequest
        fields = ['id', 'equipment', 'equipment_name', 'quantity', 'is_delivered', 'is_returned']
        read_only_fields = ['is_delivered', 'is_returned']

class SpaceBookingSerializer(serializers.ModelSerializer):
    space_details = SpaceSerializer(source='space', read_only=True)
    
    # Allow the frontend to send a list of requested gear when making a booking
    equipment_requests = EquipmentRequestSerializer(many=True, required=False)
    
    class Meta:
        model = SpaceBooking
        fields = [
            'id', 'reference_code', 'user', 'department', 'status', 
            'space', 'space_details', 'start_datetime', 'end_datetime', 
            'attendee_count', 'purpose_of_booking', 'user_notes', 
            'equipment_requests', 'created_at', 'updated_at'
        ]
        
        # Enterprise Security Lockdown
        read_only_fields = ['reference_code', 'status', 'created_at', 'updated_at', 'user']

    def create(self, validated_data):
        """
        Intercept the creation to handle the nested Equipment Requests
        """
        # Pop the equipment data out of the payload before saving the SpaceBooking
        equipment_data = validated_data.pop('equipment_requests', [])
        
        # Save the SpaceBooking first so we have an ID to link to
        booking = super().create(validated_data)
        
        # Create the associated EquipmentRequest rows
        for eq_data in equipment_data:
            EquipmentRequest.objects.create(space_booking=booking, **eq_data)
            
        return booking

    def validate(self, data):
        """
        Custom Business Logic Validation
        """
        space = data.get('space')
        attendees = data.get('attendee_count')
        start = data.get('start_datetime')
        end = data.get('end_datetime')
        
        # 1. Capacity Check
        if space and attendees:
            if attendees > space.capacity_hard:
                raise serializers.ValidationError({
                    "attendee_count": f"This space only holds {space.capacity_hard} people. You requested {attendees}."
                })

        # 2. Time & Overlap Check
        if start and end and space:
            if start >= end:
                raise serializers.ValidationError({
                    "start_datetime": "Start time must be before end time."
                })
            
            # Check for overlaps purely at the API level to prevent 500 DB errors
            overlapping = SpaceBooking.objects.filter(
                space=space,
                status='APPROVED',
                start_datetime__lt=end,
                end_datetime__gt=start
            ).exists()
            
            if overlapping:
                raise serializers.ValidationError({
                    "non_field_errors": ["This space is already booked for the requested time."]
                })

        return data