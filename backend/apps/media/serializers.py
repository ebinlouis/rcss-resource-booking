from rest_framework import serializers
from django.utils import timezone
from apps.approvals.lifecycle import can_user_modify_booking
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
            'space', 'space_details', 'event_group_id',
            'event_name',
            'setup_start_datetime', 'event_start_datetime', 'event_end_datetime', 'teardown_end_datetime',
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
        return bool(user and obj.user_id == user.pk and can_user_modify_booking(obj))

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
        is_team_request = data.get('is_team_request', getattr(self.instance, 'is_team_request', False))
        equipment_data  = data.get('equipment_requests')

        setup    = data.get('setup_start_datetime', getattr(self.instance, 'setup_start_datetime', None))
        estart   = data.get('event_start_datetime', getattr(self.instance, 'event_start_datetime', None))
        eend     = data.get('event_end_datetime',   getattr(self.instance, 'event_end_datetime', None))
        teardown = data.get('teardown_end_datetime', getattr(self.instance, 'teardown_end_datetime', None))

        if setup and estart and eend and teardown and not (setup <= estart < eend <= teardown):
            raise serializers.ValidationError({
                "non_field_errors": "Chronology error: Setup must precede Event Start, "
                                    "Event Start must precede Event End, and Event End must precede Teardown."
            })

        if self.instance and not can_user_modify_booking(self.instance):
            raise serializers.ValidationError({
                "non_field_errors": "Cannot modify a media request whose setup time has already passed."
            })

        # Past Date & Time validation
        if setup:
            now = timezone.now()
            old_setup = getattr(self.instance, 'setup_start_datetime', None) if self.instance else None
            
            is_new_or_changed_time = not self.instance or old_setup != setup

            if is_new_or_changed_time and setup < now:
                raise serializers.ValidationError({
                    "non_field_errors": "Cannot book event start or setup times in the past."
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
        
        was_team_request = instance.is_team_request
        is_now_team_request = validated_data.get('is_team_request', was_team_request)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if is_now_team_request:
            if not was_team_request:
                instance.equipment_requests.all().delete()
        else:
            if equipment_data is not None:
                instance.equipment_requests.all().delete()
                for item in equipment_data:
                    MediaEquipmentRequest.objects.create(
                        media_booking=instance,
                        equipment=item['equipment'],
                        quantity=item.get('quantity', 1),
                    )

        return instance
