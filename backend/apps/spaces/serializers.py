import json
from rest_framework import serializers
from .models import Space, SpaceBooking, Equipment, SpaceEquipment, EquipmentRequest


# ==========================================
# 1. EQUIPMENT SERIALIZERS
# ==========================================
class EquipmentSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Equipment
        fields = [
            'id', 'name', 'category', 'description',
            'total_owned', 'is_portable', 'is_active',
        ]


class SpaceEquipmentSerializer(serializers.ModelSerializer):
    equipment_name = serializers.CharField(source='equipment.name', read_only=True)

    class Meta:
        model  = SpaceEquipment
        fields = ['id', 'equipment', 'equipment_name', 'quantity']


# ==========================================
# 2. SPACE SERIALIZER (HANDLES IMAGE + GEAR)
# ==========================================
class SpaceSerializer(serializers.ModelSerializer):
    built_in_equipment = SpaceEquipmentSerializer(many=True, read_only=True)

    # Accepts a JSON string because multipart/form-data (required for image
    # uploads) cannot send nested JSON arrays directly.
    equipment_data = serializers.CharField(write_only=True, required=False)

    class Meta:
        model  = Space
        fields = [
            'id', 'name', 'space_type', 'capacity_hard', 'location',
            'image_1', 'is_active', 'built_in_equipment', 'equipment_data',
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
            # Wipe and recreate — simple and safe for admin use
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
    space_details      = SpaceSerializer(source='space', read_only=True)
    equipment_requests = EquipmentRequestSerializer(many=True, required=False)

    # ── Permission-aware computed fields ──────────────────────────────────────
    # Both fields pull the request from serializer context, which DRF populates
    # automatically when the serializer is instantiated inside a ViewSet.

    purpose_of_booking = serializers.SerializerMethodField()
    can_modify         = serializers.SerializerMethodField()

    class Meta:
        model  = SpaceBooking
        fields = [
            'id', 'reference_code', 'user', 'department', 'status',
            'space', 'space_details', 'start_datetime', 'end_datetime',
            'attendee_count', 'purpose_of_booking', 'user_notes',
            'equipment_requests', 'created_at', 'updated_at',
            'can_modify',   # frontend uses this to show/hide edit+delete
        ]
        read_only_fields = ['reference_code', 'status', 'created_at', 'updated_at', 'user']

    # ── Helpers ───────────────────────────────────────────────────────────────

    def _request(self):
        return self.context.get('request')

    def _user(self):
        req = self._request()
        return req.user if req else None

    # ── SerializerMethodField implementations ─────────────────────────────────

    def get_purpose_of_booking(self, obj):
        """
        Role-gated field:
          - Super admin / staff  → always see full purpose
          - Faculty (group name) → see full purpose on all bookings
          - Booking owner        → see their own purpose
          - Student (default)    → sees "Occupied" on others' bookings
        """
        user = self._user()
        if user is None:
            return "Occupied"

        # Staff / superadmin see everything
        if user.is_staff or user.is_superuser:
            return obj.purpose_of_booking

        # Owner always sees their own purpose
        if obj.user_id == user.pk:
            return obj.purpose_of_booking

        # Faculty group check (case-sensitive — matches whatever name you used
        # in Django's admin for the group, e.g. "Faculty")
        if user.groups.filter(name='Faculty').exists():
            return obj.purpose_of_booking

        # Default: student / unknown role
        return "Occupied"

    def get_can_modify(self, obj):
        """
        True when the requesting user is the booking owner OR a staff/superadmin.
        The frontend gates Edit and Delete buttons on this flag.
        """
        user = self._user()
        if user is None:
            return False
        return obj.user_id == user.pk or user.is_staff or user.is_superuser

    # ── Write logic (unchanged from your original) ────────────────────────────

    def create(self, validated_data):
        equipment_data = validated_data.pop('equipment_requests', [])
        booking = super().create(validated_data)
        for eq_data in equipment_data:
            EquipmentRequest.objects.create(space_booking=booking, **eq_data)
        return booking

    def validate(self, data):
        space     = data.get('space')
        attendees = data.get('attendee_count')
        start     = data.get('start_datetime')
        end       = data.get('end_datetime')

        if space and attendees and attendees > space.capacity_hard:
            raise serializers.ValidationError(
                {"attendee_count": f"Max capacity is {space.capacity_hard}."}
            )

        if start and end:
            if start >= end:
                raise serializers.ValidationError(
                    {"start_datetime": "Must be before end time."}
                )

            # Exclude the current instance when validating an update
            qs = SpaceBooking.objects.filter(
                space=space,
                status='APPROVED',
                start_datetime__lt=end,
                end_datetime__gt=start,
            )
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)

            if qs.exists():
                raise serializers.ValidationError(
                    {"non_field_errors": ["Time slot already occupied."]}
                )

        return data