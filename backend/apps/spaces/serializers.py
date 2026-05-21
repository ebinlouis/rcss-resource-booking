import json
import uuid
from datetime import timedelta
from rest_framework import serializers

from apps.approvals.lifecycle import can_user_modify_booking
from apps.users.models import Role
from .models import Block, Space, SpaceBooking, Equipment, SpaceEquipment, EquipmentRequest, SpaceApprover
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
            'id', 'name', 'description', 'space_type', 'approval_category',
            'approval_workflow_type', 'capacity_hard',
            'location', 'image_1', 'is_active', 'is_special_purpose',
            'setup_buffer_minutes', 'teardown_buffer_minutes',
            'built_in_equipment', 'equipment_data',
        ]

    def create(self, validated_data):
        equipment_raw = validated_data.pop('equipment_data', None)
        space = Space.objects.create(**validated_data)
        if equipment_raw:
            for item in json.loads(equipment_raw):
                SpaceEquipment.objects.create(
                    space        = space,
                    equipment_id = item['equipment'],
                    quantity     = item['quantity'],
                )
        return space

    def update(self, instance, validated_data):
        equipment_raw = validated_data.pop('equipment_data', None)
        instance = super().update(instance, validated_data)
        if equipment_raw:
            instance.built_in_equipment.all().delete()
            for item in json.loads(equipment_raw):
                SpaceEquipment.objects.create(
                    space        = instance,
                    equipment_id = item['equipment'],
                    quantity     = item['quantity'],
                )
        return instance


# ==========================================
# 3. BOOKING SERIALIZER
# ==========================================

class EquipmentRequestSerializer(serializers.ModelSerializer):
    equipment_name = serializers.CharField(source='equipment.name', read_only=True)

    class Meta:
        model            = EquipmentRequest
        fields           = ['id', 'equipment', 'equipment_name', 'quantity', 'is_delivered', 'is_returned']
        read_only_fields = ['is_delivered', 'is_returned']


class SpaceBookingSerializer(serializers.ModelSerializer):
    space_details = SpaceSerializer(source='space', read_only=True)

    equipment_requests = EquipmentRequestSerializer(
        source   = 'requested_equipment',
        many     = True,
        required = False,
    )

    # ── Read: role-gated ─────────────────────────────────────────────────────
    purpose_of_booking = serializers.SerializerMethodField()

    # ── Write: accepts incoming purpose from the frontend ────────────────────
    purpose_of_booking_input = serializers.CharField(
        write_only = True,
        required   = True,
        source     = 'purpose_of_booking',
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
        return can_user_modify_booking(obj) and (
            obj.user_id == user.pk or user.is_staff or user.is_superuser
        )

    # ── Write logic ───────────────────────────────────────────────────────────

    def create(self, validated_data):
        equipment_data = validated_data.pop('requested_equipment', [])
        booking_type   = validated_data.get('booking_type', SpaceBooking.BookingType.SINGLE_CONTINUOUS)

        if booking_type == SpaceBooking.BookingType.RECURRING_DAILY:
            start    = validated_data.pop('start_datetime')
            end      = validated_data.pop('end_datetime')
            group_id = uuid.uuid4()
            validated_data['group_id'] = group_id

            days_diff     = (end.date() - start.date()).days
            first_booking = None

            for i in range(days_diff + 1):
                slot_start = start + timedelta(days=i)
                slot_end   = start.replace(
                    hour=end.hour, minute=end.minute, second=end.second
                ) + timedelta(days=i)

                booking = SpaceBooking.objects.create(
                    start_datetime = slot_start,
                    end_datetime   = slot_end,
                    **validated_data
                )

                if not first_booking:
                    first_booking = booking

                for eq_data in equipment_data:
                    EquipmentRequest.objects.create(space_booking=booking, **eq_data)

            return first_booking

        else:
            booking = super().create(validated_data)
            for eq_data in equipment_data:
                EquipmentRequest.objects.create(space_booking=booking, **eq_data)
            return booking

    def update(self, instance, validated_data):
        equipment_data = validated_data.pop('requested_equipment', None)

        new_type  = validated_data.get('booking_type', instance.booking_type)
        new_start = validated_data.get('start_datetime', instance.start_datetime)
        new_end   = validated_data.get('end_datetime', instance.end_datetime)

        # Wipe the old group structure (excluding the instance being edited)
        SpaceBooking.objects.filter(group_id=instance.group_id).exclude(pk=instance.pk).delete()

        if new_type == SpaceBooking.BookingType.RECURRING_DAILY:
            days_diff = (new_end.date() - new_start.date()).days

            # Day 1 end time uses the time component of new_end, not the date
            validated_data['end_datetime'] = new_start.replace(
                hour=new_end.hour, minute=new_end.minute, second=new_end.second, microsecond=0
            )

            instance = super().update(instance, validated_data)

            for i in range(1, days_diff + 1):
                slot_start  = new_start + timedelta(days=i)
                slot_end    = instance.end_datetime + timedelta(days=i)

                new_booking = SpaceBooking.objects.create(
                    group_id           = instance.group_id,
                    booking_type       = new_type,
                    space              = instance.space,
                    user               = instance.user,
                    department         = instance.department,
                    start_datetime     = slot_start,
                    end_datetime       = slot_end,
                    attendee_count     = instance.attendee_count,
                    purpose_of_booking = instance.purpose_of_booking,
                    is_external        = instance.is_external,
                    status             = instance.status,
                    remarks_by_admin   = instance.remarks_by_admin,
                )

                if equipment_data:
                    for eq in equipment_data:
                        EquipmentRequest.objects.create(space_booking=new_booking, **eq)

        else:
            instance = super().update(instance, validated_data)

        if equipment_data is not None:
            instance.requested_equipment.all().delete()
            for eq_data in equipment_data:
                EquipmentRequest.objects.create(space_booking=instance, **eq_data)

        return instance

    # ── Validation ────────────────────────────────────────────────────────────

    def validate(self, data):
        # ── 1. Block edits on expired bookings ─────────────────────────────
        if self.instance and not can_user_modify_booking(self.instance):
            raise serializers.ValidationError(
                {"non_field_errors": ["Cannot modify a booking whose start time has already passed."]}
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

            if booking_type == SpaceBooking.BookingType.RECURRING_DAILY:
                if start.time() >= end.time():
                    raise serializers.ValidationError(
                        {"start_datetime": "For recurring bookings, the daily start time must be before the daily end time."}
                    )

                conflicts = []
                days_diff = (end.date() - start.date()).days

                for i in range(days_diff + 1):
                    slot_start = start + timedelta(days=i)
                    slot_end   = start.replace(
                        hour=end.hour, minute=end.minute, second=end.second
                    ) + timedelta(days=i)

                    overlapping = get_overlapping_bookings(space, slot_start, slot_end, exclude_pk=exclude_pk)
                    if overlapping.exists():
                        conflicts.extend(build_conflict_report(overlapping, self._user()))

                if conflicts:
                    conflict_summary = "; ".join(
                        f"{c['date']} {c['start']}–{c['end']}" for c in conflicts
                    )
                    raise serializers.ValidationError({
                        "non_field_errors": [
                            f"Booking conflicts with existing approved bookings: {conflict_summary}"
                        ]
                    })

            else:
                if start >= end:
                    raise serializers.ValidationError(
                        {"start_datetime": "Must be before end time."}
                    )

                overlapping = get_overlapping_bookings(space, start, end, exclude_pk=exclude_pk)
                if overlapping.exists():
                    conflicts = build_conflict_report(overlapping, self._user())
                    conflict_summary = "; ".join(
                        f"{c['date']} {c['start']}–{c['end']}" for c in conflicts
                    )
                    raise serializers.ValidationError({
                        "non_field_errors": [
                            f"Booking conflicts with existing approved bookings: {conflict_summary}"
                        ]
                    })

        return data


# ==========================================
# 4. BLOCK SERIALIZER
# ==========================================

class BlockSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Block
        fields = [
            'id',
            'name',
            'code',
            'description',
            'is_active',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


# ==========================================
# 5. SPACE APPROVER SERIALIZER
# ==========================================

# Roles that are valid as SpaceApprover assignments.
# IT_ADMIN, HOD, PRINCIPAL etc. manage scope differently and
# must never appear in a SpaceApprover row.
SCOPED_APPROVER_ROLES = {
    Role.Name.RECEPTIONIST,
    Role.Name.LAB_INCHARGE,
    Role.Name.LIBRARIAN,
}


class SpaceApproverSerializer(serializers.ModelSerializer):
    # Read-only display fields — keeps the write surface clean (FK ids only)
    user_email   = serializers.EmailField(source='user.email',            read_only=True)
    user_name    = serializers.CharField(source='user.first_name',        read_only=True)
    role_display = serializers.CharField(source='role.get_name_display',  read_only=True)
    block_name   = serializers.CharField(source='block.name',             read_only=True)
    space_name   = serializers.CharField(source='space.name',             read_only=True)

    class Meta:
        model  = SpaceApprover
        fields = [
            'id',
            'user',        'user_email',   'user_name',
            'role',        'role_display',
            'scope_type',
            'block',       'block_name',
            'space',       'space_name',
            'is_active',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    # ------------------------------------------------------------------
    # Field-level validation
    # ------------------------------------------------------------------

    def validate_role(self, role):
        """
        Only RECEPTIONIST, LAB_INCHARGE, and LIBRARIAN are valid here.
        All other roles manage scope through different mechanisms.
        """
        if role.name not in SCOPED_APPROVER_ROLES:
            raise serializers.ValidationError(
                f"'{role.get_name_display()}' cannot be assigned as a SpaceApprover. "
                f"Valid roles: {', '.join(SCOPED_APPROVER_ROLES)}."
            )
        return role

    # ------------------------------------------------------------------
    # Object-level validation
    # ------------------------------------------------------------------

    def validate(self, data):
        scope_type = data.get('scope_type')
        block      = data.get('block')
        space      = data.get('space')

        # ── Scope consistency ─────────────────────────────────────────
        if scope_type == SpaceApprover.ScopeType.BLOCK:
            if not block:
                raise serializers.ValidationError(
                    {"block": "A block must be provided when scope_type is BLOCK."}
                )
            if space:
                raise serializers.ValidationError(
                    {"space": "space must be empty when scope_type is BLOCK."}
                )

        elif scope_type == SpaceApprover.ScopeType.SPACE:
            if not space:
                raise serializers.ValidationError(
                    {"space": "A space must be provided when scope_type is SPACE."}
                )
            if block:
                raise serializers.ValidationError(
                    {"block": "block must be empty when scope_type is SPACE."}
                )

        # ── Role ↔ user consistency check REMOVED ────────────────────
        # Previously we required the user to already hold the role before
        # creating a SpaceApprover assignment. This caused a chicken-and-egg
        # problem for IT Admins: they had to grant the role separately first.
        #
        # The role is now granted automatically in create() below, making
        # SpaceApprover assignment a single atomic action.

        return data

    # ------------------------------------------------------------------
    # Create: auto-grant the scoped role to the user
    # ------------------------------------------------------------------

    def create(self, validated_data):
        """
        Creates the SpaceApprover assignment and automatically grants the
        associated role to the user if they don't already hold it.

        This makes scope assignment a single IT Admin action rather than
        requiring a separate role-grant step first.
        """
        approver = super().create(validated_data)

        user = approver.user
        role = approver.role

        # Idempotent: only adds the role if the user doesn't already have it.
        # Works whether roles is a M2M field or a through-table —
        # adjust to match your CustomUser.roles field name if different.
        if not user.roles.filter(id=role.id).exists():
            user.roles.add(role)

        return approver

    # ------------------------------------------------------------------
    # Destroy: strip the role if this was the user's last scoped assignment
    # ------------------------------------------------------------------

    def to_representation(self, instance):
        """
        Adds a helper flag so the frontend can show a warning when the
        user will lose their role badge upon deletion (last assignment).
        """
        data = super().to_representation(instance)
        user = instance.user
        role = instance.role

        remaining_assignments = (
            SpaceApprover.objects
            .filter(user=user, role=role, is_active=True)
            .exclude(pk=instance.pk)
            .count()
        )
        data['is_last_assignment_for_role'] = (remaining_assignments == 0)
        return data
