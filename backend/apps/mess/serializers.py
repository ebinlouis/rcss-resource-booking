import datetime
from django.utils import timezone
from django.db import transaction
from rest_framework import serializers

from apps.approvals.lifecycle import can_user_modify_booking
from apps.mess.models import MessBooking, DailyMessMenu


# ─────────────────────────────────────────────────────────────────────────────
# Child serializer
# ─────────────────────────────────────────────────────────────────────────────

class DailyMessMenuSerializer(serializers.ModelSerializer):

    class Meta:
        model  = DailyMessMenu
        fields = [
            'id', 'date',
            'total_persons', 'veg_persons', 'nonveg_persons',
            'breakfast_time', 'breakfast_menu',
            'morning_tea_time', 'morning_snack_option',
            'lunch_time', 'lunch_menu',
            'evening_tea_time', 'evening_snack_option',
            'dinner_time', 'dinner_menu',
            'notified_kitchen',
        ]
        read_only_fields = ['id', 'notified_kitchen']

    # ── Per-day validation ────────────────────────────────────────────────────

    def validate(self, data):
        # ── Headcount math ────────────────────────────────────────────────────
        total  = data.get('total_persons',  getattr(self.instance, 'total_persons',  0))
        veg    = data.get('veg_persons',    getattr(self.instance, 'veg_persons',    0))
        nonveg = data.get('nonveg_persons', getattr(self.instance, 'nonveg_persons', 0))

        if total <= 0:
            raise serializers.ValidationError(
                {"total_persons": "Total persons must be greater than zero."}
            )
        if veg + nonveg != total:
            raise serializers.ValidationError({
                "non_field_errors": (
                    f"Veg ({veg}) + Non-Veg ({nonveg}) must equal Total ({total})."
                )
            })

        # ── At least one meal must be filled in ───────────────────────────────
        meal_time_fields = [
            'breakfast_time', 'morning_tea_time',
            'lunch_time', 'evening_tea_time', 'dinner_time',
        ]
        has_any_meal = any(
            data.get(f, getattr(self.instance, f, None)) for f in meal_time_fields
        )
        if not has_any_meal:
            raise serializers.ValidationError({
                "non_field_errors": "At least one meal must be specified for each day."
            })

        # ── If a time is given, the matching menu/option must be filled in ────
        meal_pairs = [
            ('breakfast_time',   'breakfast_menu',       'Breakfast'),
            ('morning_tea_time', 'morning_snack_option', 'Morning Tea'),
            ('lunch_time',       'lunch_menu',           'Lunch'),
            ('evening_tea_time', 'evening_snack_option', 'Evening Tea'),
            ('dinner_time',      'dinner_menu',          'Dinner'),
        ]
        for time_field, menu_field, label in meal_pairs:
            time_val = data.get(time_field, getattr(self.instance, time_field, None))
            menu_val = data.get(menu_field, getattr(self.instance, menu_field, None))
            if time_val and not str(menu_val or '').strip():
                raise serializers.ValidationError({
                    menu_field: f"Please provide menu/option details for {label}."
                })

        return data


# ─────────────────────────────────────────────────────────────────────────────
# Parent serializer
# ─────────────────────────────────────────────────────────────────────────────

class MessBookingSerializer(serializers.ModelSerializer):
    requester_name  = serializers.ReadOnlyField(source='user.first_name')
    department_name = serializers.ReadOnlyField(source='department.department_name')
    can_modify      = serializers.SerializerMethodField()

    # Writable nested list — sent by the frontend as one payload
    daily_menus = DailyMessMenuSerializer(many=True)

    class Meta:
        model  = MessBooking
        fields = [
            'id', 'reference_code', 'user', 'department', 'status',
            'event_group_id',
            'requester_name', 'department_name',
            'user_notes', 'created_at', 'updated_at',
            'start_date', 'end_date',
            'delivery_location', 'purpose_of_programme',
            'rejection_remark',
            'daily_menus',
            'can_modify',
        ]
        read_only_fields = [
            'id', 'reference_code', 'user', 'department', 'status',
            'created_at', 'updated_at', 'rejection_remark',
        ]

    def get_can_modify(self, obj):
        request = self.context.get('request')
        user = request.user if request else None
        return bool(user and obj.user_id == user.pk and can_user_modify_booking(obj))

    # ── Top-level validation ──────────────────────────────────────────────────

    def validate(self, data):
        start = data.get('start_date', getattr(self.instance, 'start_date', None))
        end   = data.get('end_date',   getattr(self.instance, 'end_date',   None))

        if start and end and start > end:
            raise serializers.ValidationError({
                "end_date": "End date must be on or after start date."
            })

        if self.instance and not can_user_modify_booking(self.instance):
            raise serializers.ValidationError({
                "non_field_errors": "Cannot modify a mess booking whose first meal time has already passed."
            })

        daily_menus = data.get('daily_menus', [])

        if not daily_menus:
            raise serializers.ValidationError({
                "daily_menus": "At least one daily menu entry is required."
            })

        # ── Every day in the range must have a menu entry ─────────────────────
        if start and end:
            from datetime import timedelta
            expected_dates = set()
            cursor = start
            while cursor <= end:
                expected_dates.add(cursor)
                cursor += timedelta(days=1)

            submitted_dates = {m['date'] for m in daily_menus}
            missing = expected_dates - submitted_dates
            if missing:
                raise serializers.ValidationError({
                    "daily_menus": (
                        f"Missing menu entries for: "
                        f"{', '.join(str(d) for d in sorted(missing))}."
                    )
                })

            extra = submitted_dates - expected_dates
            if extra:
                raise serializers.ValidationError({
                    "daily_menus": (
                        f"Menu entries outside the booking range: "
                        f"{', '.join(str(d) for d in sorted(extra))}."
                    )
                })

        # ── 24-hour advance notice: earliest meal across all days ─────────────
        all_times = []
        for menu in daily_menus:
            for tf in ('breakfast_time', 'morning_tea_time', 'lunch_time',
                       'evening_tea_time', 'dinner_time'):
                t = menu.get(tf)
                if t:
                    all_times.append((menu['date'], t))

        if start and all_times:
            # Check the very first meal only (earliest date + earliest time that day)
            first_date, first_time = min(all_times, key=lambda x: (x[0], x[1]))
            delivery_dt = timezone.make_aware(
                datetime.datetime.combine(first_date, first_time),
                timezone.get_current_timezone(),
            )
            if delivery_dt < timezone.now() + datetime.timedelta(hours=24):
                raise serializers.ValidationError({
                    "start_date": (
                        "Mess bookings require at least 24 hours of notice "
                        "before the first meal delivery."
                    )
                })

        return data

    # ── Nested create ─────────────────────────────────────────────────────────

    @transaction.atomic
    def create(self, validated_data):
        daily_menus_data = validated_data.pop('daily_menus')
        booking = MessBooking.objects.create(**validated_data)
        DailyMessMenu.objects.bulk_create([
            DailyMessMenu(booking=booking, **day) for day in daily_menus_data
        ])
        return booking

    # ── Nested update ─────────────────────────────────────────────────────────

    @transaction.atomic
    def update(self, instance, validated_data):
        daily_menus_data = validated_data.pop('daily_menus', None)

        # Force status back to PENDING and clear resolution on any edit
        validated_data['status']       = 'PENDING'
        validated_data['rejection_remark'] = ''
        validated_data['resolved_by']  = None
        validated_data['resolved_at']  = None

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if daily_menus_data is not None:
            # Full replace strategy: delete existing children, recreate from payload.
            # Simpler and safer than diffing by date — the frontend always sends
            # the complete set for the booking's date range.
            instance.daily_menus.all().delete()
            DailyMessMenu.objects.bulk_create([
                DailyMessMenu(booking=instance, **day) for day in daily_menus_data
            ])

        return instance
