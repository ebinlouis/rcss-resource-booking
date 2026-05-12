from rest_framework import serializers
from django.utils import timezone
from apps.media.models import MediaBooking, MediaEquipmentRequest
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
            'is_external_event',
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
        if user is None:
            return False
        return obj.status == 'PENDING' and obj.user_id == user.pk

    def get_user_details(self, obj):
        user = obj.user
        department = obj.department or getattr(user, 'department', None)
        name_parts = [
            user.first_name,
            getattr(user, 'middle_name', None),
            user.last_name,
        ]
        full_name = ' '.join(part for part in name_parts if part).strip()

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
        booking_date = data.get('booking_date')

        setup    = data.get('setup_start_time', getattr(self.instance, 'setup_start_time', None))
        estart   = data.get('event_start_time', getattr(self.instance, 'event_start_time', None))
        eend     = data.get('event_end_time', getattr(self.instance, 'event_end_time', None))
        teardown = data.get('teardown_end_time', getattr(self.instance, 'teardown_end_time', None))

        if booking_date and not self.instance:
            if booking_date < timezone.now().date():
                raise serializers.ValidationError({
                    "booking_date": "Media requests cannot be made for past dates."
                })

        if setup and estart and eend and teardown:
            if not (setup <= estart < eend <= teardown):
                raise serializers.ValidationError({
                    "non_field_errors": "Chronology error: Setup must precede Event Start, Event Start must precede Event End, and Event End must precede Teardown."
                })

        return data

    def create(self, validated_data):
        equipment_data = validated_data.pop('equipment_requests', [])
        booking = MediaBooking.objects.create(**validated_data)
        for item in equipment_data:
            MediaEquipmentRequest.objects.create(
                media_booking=booking,
                equipment=item['equipment'],
                quantity=item.get('quantity', 1)
            )
        return booking

    def update(self, instance, validated_data):
        equipment_data = validated_data.pop('equipment_requests', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if equipment_data is not None:
            instance.equipment_requests.all().delete()
            for item in equipment_data:
                MediaEquipmentRequest.objects.create(
                    media_booking=instance,
                    equipment=item['equipment'],
                    quantity=item.get('quantity', 1)
                )

        return instance