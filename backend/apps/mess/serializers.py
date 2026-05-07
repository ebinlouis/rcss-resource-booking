import datetime
from django.utils import timezone
from rest_framework import serializers
from apps.mess.models import MessBooking

class MessBookingSerializer(serializers.ModelSerializer):
    class Meta:
        model = MessBooking
        # Removed missing audit fields: approved_by, updated_by, remarks_by_admin, resolved_at
        fields = [
            'id', 'reference_code', 'user', 'department', 'status',
            'user_notes', 'created_at', 'updated_at',
            'booking_date', 'delivery_time', 'delivery_location', 
            'purpose_of_programme', 'total_persons', 'veg_persons', 
            'nonveg_persons', 'breakfast_required', 'breakfast_menu',
            'morning_tea_required', 'morning_snack_option',
            'lunch_required', 'lunch_menu', 'evening_tea_required', 
            'evening_snack_option', 'dinner_required', 'dinner_menu',
        ]
        # Department is now read-only to be set automatically in ViewSet
        read_only_fields = [
            'id', 'reference_code', 'user', 'department', 'status', 
            'created_at', 'updated_at',
        ]

    def validate(self, data):
        total = data.get('total_persons', 0)
        veg = data.get('veg_persons', 0)
        nonveg = data.get('nonveg_persons', 0)
        booking_date = data.get('booking_date')
        delivery_time = data.get('delivery_time')

        # Rule 1 — Headcount math
        if veg + nonveg != total:
            raise serializers.ValidationError({
                "non_field_errors": f"Veg ({veg}) + Non-Veg ({nonveg}) must equal Total ({total})."
            })

        # Rule 2 — Minimum check
        if total <= 0:
            raise serializers.ValidationError({"total_persons": "Total persons must be greater than zero."})

        # Rule 3 — Strict 24-hour advance booking SLA
        if booking_date and delivery_time:
            # Combine date and time into a naive datetime
            delivery_datetime_naive = datetime.datetime.combine(booking_date, delivery_time)
            
            # Make it timezone aware using settings.TIME_ZONE (Asia/Kolkata)
            delivery_datetime = timezone.make_aware(delivery_datetime_naive)
            
            # Check if the requested delivery is strictly 24+ hours from NOW
            now = timezone.now()
            if delivery_datetime < now + datetime.timedelta(hours=24):
                raise serializers.ValidationError({
                    "delivery_time": "Mess bookings require strictly 24 hours of notice from the current time."
                })

        return data