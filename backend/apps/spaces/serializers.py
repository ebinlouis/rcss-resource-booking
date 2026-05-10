import json
from django.utils import timezone
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
            'id', 'name', 'description', 'space_type', 'capacity_hard', 'location',
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
            # Wipe and recreate — simple and safe for admin use.
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

    # Uses source='requested_equipment' to match the related_name on EquipmentRequest.
    # required=False so that bookings with no equipment selections remain valid.
    equipment_requests = EquipmentRequestSerializer(
        source='requested_equipment',
        many=True,
        required=False,
    )

    # ── Read: role-gated output ───────────────────────────────────────────────
    # SerializerMethodField is read-only by design — it handles GET responses
    # with privacy rules but never touches incoming write data.
    purpose_of_booking = serializers.SerializerMethodField()

    # ── Write: accepts incoming purpose from the frontend ────────────────────
    # write_only=True keeps it out of responses (purpose_of_booking handles that).
    # source='purpose_of_booking' maps it to the correct model field.
    purpose_of_booking_input = serializers.CharField(
        write_only=True,
        required=True,
        source='purpose_of_booking',
    )

    can_modify = serializers.SerializerMethodField()

    class Meta:
        model  = SpaceBooking
        fields = [
            'id', 'reference_code', 'user', 'department', 'status',
            'space', 'space_details', 'start_datetime', 'end_datetime',
            'attendee_count', 'purpose_of_booking', 'purpose_of_booking_input',
            'user_notes', 'equipment_requests', 'created_at', 'updated_at',
            'can_modify', 'remarks_by_admin',
        ]
        # status and remarks_by_admin are intentionally excluded from
        # read_only_fields. They must remain writable so that perform_update
        # in the view can reset status to PENDING and clear remarks when a
        # user edits an approved booking. Access control is enforced at the
        # view layer, not here.
        read_only_fields = ['reference_code', 'created_at', 'updated_at', 'user']

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

        if user.is_staff or user.is_superuser:
            return obj.purpose_of_booking

        if obj.user_id == user.pk:
            return obj.purpose_of_booking

        # Faculty group check (case-sensitive — matches the group name set in
        # Django admin, e.g. "Faculty").
        if user.groups.filter(name='Faculty').exists():
            return obj.purpose_of_booking

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

    # ── Write logic ───────────────────────────────────────────────────────────
    def create(self, validated_data):
        # Pop the nested equipment list before calling super(), which does not
        # know how to handle it. Then create EquipmentRequest rows manually.
        equipment_data = validated_data.pop('requested_equipment', [])
        booking = super().create(validated_data)
        for eq_data in equipment_data:
            EquipmentRequest.objects.create(space_booking=booking, **eq_data)
        return booking

    def update(self, instance, validated_data):
        # Pop equipment data before delegating to super() for the same reason
        # as create(). Then wipe the existing requests and recreate from the
        # incoming payload so the admin always sees the current selections.
        equipment_data = validated_data.pop('requested_equipment', None)
        instance = super().update(instance, validated_data)

        if equipment_data is not None:
            # Delete existing requests and replace them with the new set.
            # This is intentional: the frontend sends the full desired state
            # on every edit, so a wipe-and-recreate is correct and safe.
            instance.requested_equipment.all().delete()
            for eq_data in equipment_data:
                EquipmentRequest.objects.create(space_booking=instance, **eq_data)

        return instance

    def validate(self, data):
        # Prevent modification of historical/expired records
        if self.instance and self.instance.end_datetime < timezone.now():
            raise serializers.ValidationError(
                {"non_field_errors": ["Cannot modify a booking that has already expired."]}
            )

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