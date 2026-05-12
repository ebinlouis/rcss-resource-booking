import datetime
from django.utils import timezone
from rest_framework import serializers
from apps.mess.models import MessBooking


class MessBookingSerializer(serializers.ModelSerializer):
    requester_name = serializers.ReadOnlyField(source='user.first_name')
    department_name = serializers.ReadOnlyField(source='department.department_name')

    class Meta:
        model = MessBooking
        fields = [
            'id', 'reference_code', 'user', 'department', 'status',
            'requester_name', 'department_name',
            'user_notes', 'created_at', 'updated_at',
            'booking_date', 'delivery_location',
            'purpose_of_programme', 'total_persons', 'veg_persons',
            'nonveg_persons',
            'rejection_remark',

            # Meal fields
            'breakfast_required', 'breakfast_time', 'breakfast_menu',
            'morning_tea_required', 'morning_tea_time', 'morning_snack_option',
            'lunch_required', 'lunch_time', 'lunch_menu',
            'evening_tea_required', 'evening_tea_time', 'evening_snack_option',
            'dinner_required', 'dinner_time', 'dinner_menu',
        ]
        read_only_fields = [
            'id', 'reference_code', 'user', 'department', 'status',
            'created_at', 'updated_at', 'rejection_remark',
        ]

    def validate(self, data):
        total = data.get('total_persons', getattr(self.instance, 'total_persons', 0))
        veg = data.get('veg_persons', getattr(self.instance, 'veg_persons', 0))
        nonveg = data.get('nonveg_persons', getattr(self.instance, 'nonveg_persons', 0))

        if veg + nonveg != total:
            raise serializers.ValidationError({
                "non_field_errors": f"Veg ({veg}) + Non-Veg ({nonveg}) must equal Total ({total})."
            })

        if total <= 0:
            raise serializers.ValidationError({
                "total_persons": "Total persons must be greater than zero."
            })

        meal_mappings = {
            'breakfast_required': ('breakfast_menu', 'breakfast_time'),
            'morning_tea_required': ('morning_snack_option', 'morning_tea_time'),
            'lunch_required': ('lunch_menu', 'lunch_time'),
            'evening_tea_required': ('evening_snack_option', 'evening_tea_time'),
            'dinner_required': ('dinner_menu', 'dinner_time'),
        }

        requested_times = []

        for req_field, (menu_field, time_field) in meal_mappings.items():
            is_required = data.get(req_field, getattr(self.instance, req_field, False))

            if is_required:
                menu_text = data.get(menu_field, getattr(self.instance, menu_field, ""))
                meal_time = data.get(time_field, getattr(self.instance, time_field, None))

                friendly_name = req_field.replace('_required', '').replace('_', ' ').title()

                if not str(menu_text).strip():
                    raise serializers.ValidationError({
                        menu_field: f"Please provide menu details since {friendly_name} is requested."
                    })

                if not meal_time:
                    raise serializers.ValidationError({
                        time_field: f"Please specify a delivery time for {friendly_name}."
                    })

                requested_times.append(meal_time)

        if not requested_times:
            raise serializers.ValidationError({
                "non_field_errors": "You must select and provide details for at least one meal."
            })

        booking_date = data.get('booking_date', getattr(self.instance, 'booking_date', None))

        if booking_date and requested_times:
            earliest_time = min(requested_times)
            is_time_modified = True

            if self.instance:
                old_times = [
                    getattr(self.instance, 'breakfast_time', None),
                    getattr(self.instance, 'morning_tea_time', None),
                    getattr(self.instance, 'lunch_time', None),
                    getattr(self.instance, 'evening_tea_time', None),
                    getattr(self.instance, 'dinner_time', None),
                ]
                old_valid_times = [t for t in old_times if t is not None]
                old_earliest = min(old_valid_times) if old_valid_times else None

                if self.instance.booking_date == booking_date and old_earliest == earliest_time:
                    is_time_modified = False

            if is_time_modified:
                delivery_datetime_naive = datetime.datetime.combine(booking_date, earliest_time)
                delivery_datetime = timezone.make_aware(
                    delivery_datetime_naive, timezone.get_current_timezone()
                )
                if delivery_datetime < timezone.now() + datetime.timedelta(hours=24):
                    raise serializers.ValidationError({
                        "booking_date": (
                            "Mess bookings require strictly 24 hours of notice "
                            "prior to the earliest meal delivery time."
                        )
                    })

        return data

    def update(self, instance, validated_data):
        # 1. Force the status back to PENDING on any modification
        validated_data['status'] = 'PENDING'
        
        # 2. Clear out any previous admin rejection/approval remarks
        validated_data['rejection_remark'] = ''
        
        # 3. Clear the resolution tracking fields (assuming inheritance from BaseBooking)
        validated_data['resolved_by'] = None
        validated_data['resolved_at'] = None

        return super().update(instance, validated_data)