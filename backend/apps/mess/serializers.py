import datetime
from django.utils import timezone
from rest_framework import serializers
from apps.mess.models import MessBooking

class MessBookingSerializer(serializers.ModelSerializer):
    class Meta:
        model = MessBooking
        fields = [
            'id', 'reference_code', 'user', 'department', 'status',
            'approved_by', 'updated_by', 'remarks_by_admin', 'user_notes',
            'resolved_at', 'created_at', 'updated_at',
            'booking_date', 'delivery_time', 'delivery_location', 
            'purpose_of_programme', 'total_persons', 'veg_persons', 
            'nonveg_persons', 'breakfast_required', 'breakfast_menu',
            'morning_tea_required', 'morning_snack_option',
            'lunch_required', 'lunch_menu', 'evening_tea_required', 
            'evening_snack_option', 'dinner_required', 'dinner_menu',
        ]
        read_only_fields = [
            'id', 'reference_code', 'user', 'status', # Security: user is now read-only
            'approved_by', 'updated_by', 'resolved_at', 
            'created_at', 'updated_at',
        ]

    def validate(self, data):
        total = data.get('total_persons', 0)
        veg = data.get('veg_persons', 0)
        nonveg = data.get('nonveg_persons', 0)
        booking_date = data.get('booking_date')

        # Rule 1 — Headcount math
        if veg + nonveg != total:
            raise serializers.ValidationError({
                "non_field_errors": f"Veg ({veg}) + Non-Veg ({nonveg}) must equal Total ({total})."
            })

        # Rule 2 — Minimum check
        if total <= 0:
            raise serializers.ValidationError({"total_persons": "Total persons must be greater than zero."})

        # Rule 3 — 24-hour advance booking SLA
        if booking_date:
            today = timezone.localdate()
            earliest_allowed = today + datetime.timedelta(days=1)
            if booking_date < earliest_allowed:
                raise serializers.ValidationError({
                    "booking_date": f"Mess bookings require 24h notice. Earliest date is {earliest_allowed}."
                })

        return data