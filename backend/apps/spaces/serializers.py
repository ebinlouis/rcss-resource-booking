import json
import uuid
from datetime import timedelta
from django.utils import timezone
from rest_framework import serializers
from .models import Space, SpaceBooking, Equipment, SpaceEquipment, EquipmentRequest
from .utils import get_overlapping_bookings, build_conflict_report


# ==========================================
# 1. EQUIPMENT SERIALIZERS
# ==========================================
class EquipmentSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Equipment
        fields = [
            'id', 'name', 'category', 'description',
            'total_owned', 'is_portable', 'is_active',
            'is_standard_media_kit',
        ]


class SpaceEquipmentSerializer(serializers.ModelSerializer):
    equipment_name = serializers.CharField(source='equipment.name', read_only=True)

    class Meta:
        model  = SpaceEquipment
        fields = ['id', 'equipment', 'equipment_name', 'quantity']


# ==========================================
# 2. SPACE SERIALIZER
# ==========================================
class SpaceSerializer(serializers.ModelSerializer):
    built_in_equipment = SpaceEquipmentSerializer(many=True, read_only=True)

    # Accepts a JSON string because multipart/form-data (required for image
    # uploads) cannot send nested JSON arrays directly.
    equipment_data = serializers.CharField(write_only=True, required=False)

    class Meta:
        model  = Space
        fields = [
            'id', 'name', 'description', 'space_type', 'capacity_hard',
            'location', 'image_1', 'is_active', 'is_special_purpose',
            # ── New fields ──
            'setup_buffer_minutes', 'teardown_buffer_minutes', 'is_lab',
            'built_in_equipment', 'equipment_data',
        ]

    def create(self, validated_data):
        equipment_raw = validated_data.pop('equipment_data', None)
        space = Space.objects.create(**validated_data)
        if equipment_raw:
            for item in json.loads(equipment_raw):
                SpaceEquipment.objects.create(
                    space=space,
                    equipment_id=item['equipment'],
                    quantity=item['quantity'],
                )
        return space

    def update(self, instance, validated_data):
        equipment_raw = validated_data.pop('equipment_data', None)
        instance = super().update(instance, validated_data)
        if equipment_raw:
            instance.built_in_equipment.all().delete()
            for item in json.loads(equipment_raw):
                SpaceEquipment.objects.create(
                    space=instance,
                    equipment_id=item['equipment'],
                    quantity=item['quantity'],
                )
        return instance


# ==========================================
# 3. BOOKING SERIALIZER
# ==========================================
class EquipmentRequestSerializer(serializers.ModelSerializer):
    equipment_name = serializers.CharField(source='equipment.name', read_only=True)

    class Meta:
        model  = EquipmentRequest
        fields = ['id', 'equipment', 'equipment_name', 'quantity', 'is_delivered', 'is_returned']
        read_only_fields = ['is_delivered', 'is_returned']


class SpaceBookingSerializer(serializers.ModelSerializer):
    space_details = SpaceSerializer(source='space', read_only=True)

    equipment_requests = EquipmentRequestSerializer(
        source='requested_equipment',
        many=True,
        required=False,
    )

    # ── Read: role-gated ─────────────────────────────────────────────────────
    purpose_of_booking = serializers.SerializerMethodField()

    # ── Write: accepts incoming purpose from the frontend ────────────────────
    purpose_of_booking_input = serializers.CharField(
        write_only=True,
        required=True,
        source='purpose_of_booking',
    )

    can_modify = serializers.SerializerMethodField()

    class Meta:
        model  = SpaceBooking
        fields = [
            'id', 'reference_code', 'group_id', 'booking_type', 'user', 'department', 'status',
            'space', 'space_details', 'start_datetime', 'end_datetime',
            'attendee_count', 'purpose_of_booking', 'purpose_of_booking_input',
            'user_notes', 'equipment_requests', 'is_external',
            'created_at', 'updated_at', 'can_modify', 'remarks_by_admin',
        ]
        read_only_fields = ['reference_code', 'group_id', 'created_at', 'updated_at', 'user']

    # ── Helpers ───────────────────────────────────────────────────────────────
    def _request(self):
        return self.context.get('request')

    def _user(self):
        req = self._request()
        return req.user if req else None

    # ── SerializerMethodField implementations ─────────────────────────────────
    def get_purpose_of_booking(self, obj):
        user = self._user()
        if user is None:
            return "Occupied"
        if user.is_staff or user.is_superuser:
            return obj.purpose_of_booking
        if obj.user_id == user.pk:
            return obj.purpose_of_booking
        if user.groups.filter(name='Faculty').exists():
            return obj.purpose_of_booking
        return "Occupied"

    def get_can_modify(self, obj):
        user = self._user()
        if user is None:
            return False
        return obj.user_id == user.pk or user.is_staff or user.is_superuser

    # ── Write logic ───────────────────────────────────────────────────────────
    def create(self, validated_data):
        equipment_data = validated_data.pop('requested_equipment', [])
        booking_type = validated_data.get('booking_type', SpaceBooking.BookingType.SINGLE_CONTINUOUS)

        if booking_type == SpaceBooking.BookingType.RECURRING_DAILY:
            start = validated_data.pop('start_datetime')
            end = validated_data.pop('end_datetime')
            
            # Generate one group_id for all the recurring slots
            group_id = uuid.uuid4()
            validated_data['group_id'] = group_id
            
            days_diff = (end.date() - start.date()).days
            first_booking = None
            
            for i in range(days_diff + 1):
                # Calculate discrete daily slots
                slot_start = start + timedelta(days=i)
                slot_end = start.replace(hour=end.hour, minute=end.minute, second=end.second) + timedelta(days=i)
                
                booking = SpaceBooking.objects.create(
                    start_datetime=slot_start,
                    end_datetime=slot_end,
                    **validated_data
                )
                
                if not first_booking:
                    first_booking = booking
                    
                for eq_data in equipment_data:
                    EquipmentRequest.objects.create(space_booking=booking, **eq_data)
                    
            # Return the first booking so DRF has an instance to serialize
            return first_booking

        else:
            booking = super().create(validated_data)
            for eq_data in equipment_data:
                EquipmentRequest.objects.create(space_booking=booking, **eq_data)
            return booking

    def update(self, instance, validated_data):
        equipment_data = validated_data.pop('requested_equipment', None)
        
        new_type = validated_data.get('booking_type', instance.booking_type)
        new_start = validated_data.get('start_datetime', instance.start_datetime)
        new_end = validated_data.get('end_datetime', instance.end_datetime)
        
        # 1. WIPE OUT the old group structure (excluding the current instance we are editing)
        SpaceBooking.objects.filter(group_id=instance.group_id).exclude(pk=instance.pk).delete()
        
        if new_type == SpaceBooking.BookingType.RECURRING_DAILY:
            # Morphing into Recurring: The current instance becomes Day 1. We spawn the rest.
            days_diff = (new_end.date() - new_start.date()).days
            
            # Constrain the end_datetime of Day 1 to just the hours/minutes, not the future date
            validated_data['end_datetime'] = new_start.replace(
                hour=new_end.hour, minute=new_end.minute, second=new_end.second, microsecond=0
            )
            
            # Update the primary instance (Day 1)
            instance = super().update(instance, validated_data)
            
            # Spawn the new rows for Day 2 onward
            for i in range(1, days_diff + 1):
                slot_start = new_start + timedelta(days=i)
                slot_end = instance.end_datetime + timedelta(days=i)
                
                new_booking = SpaceBooking.objects.create(
                    group_id=instance.group_id,
                    booking_type=new_type,
                    space=instance.space,
                    user=instance.user,
                    department=instance.department,
                    start_datetime=slot_start,
                    end_datetime=slot_end,
                    attendee_count=instance.attendee_count,
                    purpose_of_booking=instance.purpose_of_booking,
                    is_external=instance.is_external,
                    status=instance.status,
                    remarks_by_admin=instance.remarks_by_admin
                )
                
                # Attach equipment to the spawned days
                if equipment_data:
                    for eq in equipment_data:
                        EquipmentRequest.objects.create(space_booking=new_booking, **eq)
        else:
            # Morphing into Single/Continuous: We just update the one instance to span the whole time
            instance = super().update(instance, validated_data)

        # 3. Handle equipment for the primary instance
        if equipment_data is not None:
            instance.requested_equipment.all().delete()
            for eq_data in equipment_data:
                EquipmentRequest.objects.create(space_booking=instance, **eq_data)
                
        return instance

    # ── Validation ────────────────────────────────────────────────────────────
    def validate(self, data):
        # ── 1. Block edits on expired bookings ─────────────────────────────
        if self.instance and self.instance.end_datetime < timezone.now():
            raise serializers.ValidationError(
                {"non_field_errors": ["Cannot modify a booking that has already expired."]}
            )

        space        = data.get('space')
        attendees    = data.get('attendee_count')
        start        = data.get('start_datetime')
        end          = data.get('end_datetime')
        notes        = data.get('user_notes', '')
        booking_type = data.get('booking_type', SpaceBooking.BookingType.SINGLE_CONTINUOUS)

        # ── 2. Capacity checks ──────────────────────────────────────────────
        if space and attendees:
            if attendees > space.capacity_hard:
                raise serializers.ValidationError(
                    {"attendee_count": f"Max capacity is {space.capacity_hard}."}
                )

            min_expected = space.capacity_hard * 0.30
            if attendees < min_expected and not notes.strip():
                raise serializers.ValidationError({
                    "user_notes": (
                        f"This space seats {space.capacity_hard}. "
                        f"For a group of {attendees}, you must provide a justification in the notes."
                    )
                })

        # ── 3. Datetime & Overlap sanity ────────────────────────────────────
        if space and start and end:
            exclude_pk = self.instance.pk if self.instance else None

            # Handle Recurring vs Single differently
            if booking_type == SpaceBooking.BookingType.RECURRING_DAILY:
                if start.time() >= end.time():
                    raise serializers.ValidationError(
                        {"start_datetime": "For recurring bookings, the daily start time must be before the daily end time."}
                    )

                conflicts = []
                days_diff = (end.date() - start.date()).days
                
                # Check overlap for every individual day in the recurrence
                for i in range(days_diff + 1):
                    slot_start = start + timedelta(days=i)
                    slot_end = start.replace(hour=end.hour, minute=end.minute, second=end.second) + timedelta(days=i)
                    
                    overlapping = get_overlapping_bookings(space, slot_start, slot_end, exclude_pk=exclude_pk)
                    if overlapping.exists():
                        conflicts.extend(build_conflict_report(overlapping, self._user()))

                if conflicts:
                    conflict_summary = "; ".join(f"{c['date']} {c['start']}–{c['end']}" for c in conflicts)
                    raise serializers.ValidationError({
                        "non_field_errors": [f"Booking conflicts with existing approved bookings: {conflict_summary}"]
                    })

            else:
                # Standard Single Continuous Check
                if start >= end:
                    raise serializers.ValidationError(
                        {"start_datetime": "Must be before end time."}
                    )
                
                overlapping = get_overlapping_bookings(space, start, end, exclude_pk=exclude_pk)

                if overlapping.exists():
                    requesting_user = self._user()
                    conflicts = build_conflict_report(overlapping, requesting_user)

                    conflict_summary = "; ".join(
                        f"{c['date']} {c['start']}–{c['end']}"
                        for c in conflicts
                    )
                    raise serializers.ValidationError({
                        "non_field_errors": [
                            f"Booking conflicts with existing approved bookings: {conflict_summary}"
                        ]
                    })

        return data