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

    # ── Permission-aware computed field ───────────────────────────────────────
    can_modify = serializers.SerializerMethodField()

    class Meta:
        model = MediaBooking
        fields = [
            'id', 'reference_code', 'user', 'department', 'status',
            # FIXED: was 'approved_by' — BaseBooking uses 'resolved_by' / 'resolved_at'
            'resolved_by', 'updated_by', 'remarks_by_admin', 'user_notes',
            'resolved_at', 'created_at', 'updated_at',
            'space', 'space_details',
            'event_name', 'booking_date', 'start_time', 'end_time',
            'requested_equipment', 'requested_services',
            'technical_contact_person', 'organization',
            'can_modify',
        ]
        read_only_fields = [
            'id', 'reference_code', 'user', 'department', 'status',
            'resolved_by', 'updated_by', 'remarks_by_admin',
            'resolved_at', 'created_at', 'updated_at',
        ]

    # ── Helpers ───────────────────────────────────────────────────────────────

    def _user(self):
        req = self.context.get('request')
        return req.user if req else None

    # ── can_modify — same logic as SpaceBookingSerializer / FleetBookingSerializer

    def get_can_modify(self, obj):
        user = self._user()
        if user is None:
            return False
        # Only PENDING bookings can be modified by their owner
        return obj.status == 'PENDING' and obj.user_id == user.pk

    # ── Validation ────────────────────────────────────────────────────────────

    def validate(self, data):
        start        = data.get('start_time')
        end          = data.get('end_time')
        booking_date = data.get('booking_date')

        # 1. Past date check (only on create — instance is None)
        if booking_date and not self.instance:
            if booking_date < timezone.now().date():
                raise serializers.ValidationError({
                    "booking_date": "Media requests cannot be made for past dates."
                })

        # 2. Sequential time check
        if start and end and start >= end:
            raise serializers.ValidationError({
                "start_time": f"Start time ({start}) must be before end time ({end})."
            })

        return data
