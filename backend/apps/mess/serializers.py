import datetime
from django.utils import timezone
from rest_framework import serializers
from apps.mess.models import MessBooking

class MessBookingSerializer(serializers.ModelSerializer):
    # NEW: Extract actual text names instead of raw database IDs
    # (If your Department model uses a field called 'name' instead of 'department_name', change it below)
    requester_name = serializers.ReadOnlyField(source='user.first_name')
    department_name = serializers.ReadOnlyField(source='department.department_name')

    class Meta:
        model = MessBooking
        fields = [
            'id', 'reference_code', 'user', 'department', 'status',
            'requester_name', 'department_name',  # <-- Added to the payload here
            'user_notes', 'created_at', 'updated_at',
            'booking_date', 'delivery_time', 'delivery_location', 
            'purpose_of_programme', 'total_persons', 'veg_persons', 
            'nonveg_persons', 'breakfast_required', 'breakfast_menu',
            'morning_tea_required', 'morning_snack_option',
            'lunch_required', 'lunch_menu', 'evening_tea_required', 
            'evening_snack_option', 'dinner_required', 'dinner_menu',
        ]
        read_only_fields = [
            'id', 'reference_code', 'user', 'department', 'status', 
            'created_at', 'updated_at',
        ]

    def validate(self, data):
        # Handle partial updates (PATCH) by falling back to instance data if field isn't in payload
        total = data.get('total_persons', getattr(self.instance, 'total_persons', 0))
        veg = data.get('veg_persons', getattr(self.instance, 'veg_persons', 0))
        nonveg = data.get('nonveg_persons', getattr(self.instance, 'nonveg_persons', 0))

        # Rule 1 — Headcount math
        if veg + nonveg != total:
            raise serializers.ValidationError({
                "non_field_errors": f"Veg ({veg}) + Non-Veg ({nonveg}) must equal Total ({total})."
            })

        # Rule 2 — Minimum check
        if total <= 0:
            raise serializers.ValidationError({
                "total_persons": "Total persons must be greater than zero."
            })

        # Rule 3 — Meal Data Integrity (Kitchen Safety)
        meal_mappings = {
            'breakfast_required': 'breakfast_menu',
            'morning_tea_required': 'morning_snack_option',
            'lunch_required': 'lunch_menu',
            'evening_tea_required': 'evening_snack_option',
            'dinner_required': 'dinner_menu'
        }

        for req_field, menu_field in meal_mappings.items():
            is_required = data.get(req_field, getattr(self.instance, req_field, False))
            menu_text = data.get(menu_field, getattr(self.instance, menu_field, ""))
            
            if is_required and not str(menu_text).strip():
                friendly_name = req_field.replace('_required', '').replace('_', ' ').title()
                raise serializers.ValidationError({
                    menu_field: f"Please provide menu details since {friendly_name} is requested."
                })

        # Rule 4 — Smart 24-hour advance booking SLA
        booking_date = data.get('booking_date', getattr(self.instance, 'booking_date', None))
        delivery_time = data.get('delivery_time', getattr(self.instance, 'delivery_time', None))

        if booking_date and delivery_time:
            # Only trigger the SLA check if this is a NEW booking, or the user is CHANGING the time
            is_time_modified = True
            if self.instance:
                if self.instance.booking_date == booking_date and self.instance.delivery_time == delivery_time:
                    is_time_modified = False

            if is_time_modified:
                delivery_datetime_naive = datetime.datetime.combine(booking_date, delivery_time)
                # Safely bind to the current active timezone (Asia/Kolkata)
                delivery_datetime = timezone.make_aware(delivery_datetime_naive, timezone.get_current_timezone())
                
                now = timezone.now()
                if delivery_datetime < now + datetime.timedelta(hours=24):
                    raise serializers.ValidationError({
                        "delivery_time": "Mess bookings require strictly 24 hours of notice from the current time."
                    })

        return data