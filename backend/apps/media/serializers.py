from rest_framework import serializers
from django.utils import timezone
from apps.media.models import MediaBooking, MediaEquipmentRequest, MediaSettings
from apps.spaces.models import Space, Equipment


class SpaceSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = Space
        fields = ['id', 'name', 'space_type', 'location', 'capacity_hard']


class MediaEquipmentRequestSerializer(serializers.ModelSerializer):
    equipment_name = serializers.CharField(source='equipment.name', read_only=True)
    equipment = serializers.PrimaryKeyRelatedField(
        queryset=Equipment.objects.filter(is_active=True, is_portable=True)
    )

    class Meta:
        model = MediaEquipmentRequest
        fields = ['id', 'equipment', 'equipment_name', 'quantity']
        read_only_fields = ['id']


class MediaSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = MediaSettings
        fields = ['max_concurrent_events', 'updated_at']
        read_only_fields = ['updated_at']

    def validate_max_concurrent_events(self, value):
        if value < 1:
            raise serializers.ValidationError("Must allow at least 1 concurrent event.")
        if value > 20:
            raise serializers.ValidationError("Cannot exceed 20 concurrent events.")
        return value


class MediaBookingSerializer(serializers.ModelSerializer):
    space_details = SpaceSummarySerializer(source='space', read_only=True)
    equipment_requests = MediaEquipmentRequestSerializer(many=True, required=False)
    can_modify = serializers.SerializerMethodField()
    user_details = serializers.SerializerMethodField()

    class Meta:
        model = MediaBooking
        fields = [
            'id', 'reference_code', 'user', 'department', 'status',
            'resolved_by', 'updated_by', 'remarks_by_admin', 'user_notes',
            'resolved_at', 'created_at', 'updated_at',
            'user_details',
            'space', 'space_details',
            'event_name', 'booking_date',
            'setup_start_time', 'event_start_time', 'event_end_time', 'teardown_end_time',
            'equipment_requests', 'requested_services',
            'is_external_event', 'is_team_request',
            'can_modify',
        ]
        read_only_fields = [
            'id', 'reference_code', 'user', 'department', 'status',
            'resolved_by', 'updated_by', 'remarks_by_admin',
            'resolved_at', 'created_at', 'updated_at',
        ]

    def _user(self):
        req = self.context.get('request')
        return req.user if req else None

    def get_can_modify(self, obj):
        user = self._user()
        # Allows editing if status is PENDING or APPROVED
        return bool(user and obj.status in ['PENDING', 'APPROVED'] and obj.user_id == user.pk)

    def get_user_details(self, obj):
        user = obj.user
        department = obj.department or getattr(user, 'department', None)
        full_name = ' '.join(
            part for part in [user.first_name, getattr(user, 'middle_name', None), user.last_name]
            if part
        ).strip()
        return {
            'id': user.id,
            'name': full_name or str(user),
            'department': getattr(department, 'department_name', None),
            'department_code': getattr(department, 'department_code', None),
            'phone': user.phone,
            'email': user.email,
            'employee_student_id': user.employee_student_id,
        }

    def validate(self, data):
        booking_date    = data.get('booking_date')
        is_team_request = data.get('is_team_request', getattr(self.instance, 'is_team_request', False))
        equipment_data  = data.get('equipment_requests')

        setup    = data.get('setup_start_time',   getattr(self.instance, 'setup_start_time',   None))
        estart   = data.get('event_start_time',   getattr(self.instance, 'event_start_time',   None))
        eend     = data.get('event_end_time',     getattr(self.instance, 'event_end_time',     None))
        teardown = data.get('teardown_end_time',  getattr(self.instance, 'teardown_end_time',  None))

        if booking_date and not self.instance and booking_date < timezone.now().date():
            raise serializers.ValidationError({
                "booking_date": "Media requests cannot be made for past dates."
            })

        if setup and estart and eend and teardown and not (setup <= estart < eend <= teardown):
            raise serializers.ValidationError({
                "non_field_errors": "Chronology error: Setup must precede Event Start, "
                                    "Event Start must precede Event End, and Event End must precede Teardown."
            })

        if is_team_request and equipment_data:
            raise serializers.ValidationError({
                "equipment_requests": "Team requests do not accept manual equipment selections."
            })

        return data

    def create(self, validated_data):
        equipment_data = validated_data.pop('equipment_requests', [])
        booking = MediaBooking.objects.create(**validated_data)
        for item in equipment_data:
            MediaEquipmentRequest.objects.create(
                media_booking=booking,
                equipment=item['equipment'],
                quantity=item.get('quantity', 1),
            )
        return booking

    def update(self, instance, validated_data):
        equipment_data = validated_data.pop('equipment_requests', None)
        
        # Track if the mode is changing
        was_team_request = instance.is_team_request
        is_now_team_request = validated_data.get('is_team_request', was_team_request)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        # ── LOADOUT PROTECTION LOGIC ──
        if is_now_team_request:
            # If switching from Equipment -> Team, wipe the old manual equipment selection
            if not was_team_request:
                instance.equipment_requests.all().delete()
            # If it was ALREADY a team request, we do absolutely nothing. 
            # We ignore equipment_data to protect the admin's custom loadout.
        else:
            # Standard equipment borrowing: update exactly as the user specified
            if equipment_data is not None:
                instance.equipment_requests.all().delete()
                for item in equipment_data:
                    MediaEquipmentRequest.objects.create(
                        media_booking=instance,
                        equipment=item['equipment'],
                        quantity=item.get('quantity', 1),
                    )

        return instance