"""
serializers.py — Fleet, Mess, and Media apps
Follows the SpaceBookingSerializer pattern from apps/spaces/serializers.py
All complex business logic is handled inside the Serializer's validate() method.
"""

from rest_framework import serializers

# ---------------------------------------------------------------------------
# MESS
# ---------------------------------------------------------------------------
from apps.mess.models import MessBooking


class MessBookingSerializer(serializers.ModelSerializer):
    class Meta:
        model = MessBooking
        fields = [
            # ── Base Booking fields ──────────────────────────────────────────
            'id', 'reference_code', 'user', 'department', 'status',
            'approved_by', 'updated_by',
            'remarks_by_admin', 'user_notes',
            'resolved_at', 'created_at', 'updated_at',
            # ── Mess-specific fields ─────────────────────────────────────────
            'booking_date', 'delivery_time',
            'delivery_location', 'purpose_of_programme',
            # Headcount
            'total_persons', 'veg_persons', 'nonveg_persons',
            # Meal toggles & menus
            'breakfast_required', 'breakfast_menu',
            'morning_tea_required', 'morning_snack_option',
            'lunch_required', 'lunch_menu',
            'evening_tea_required', 'evening_snack_option',
            'dinner_required', 'dinner_menu',
        ]
        read_only_fields = [
            'reference_code', 'status',
            'approved_by', 'updated_by',
            'resolved_at', 'created_at', 'updated_at',
        ]

    def validate(self, data):
        """
        Business Logic Validation

        Rule 1: veg_persons + nonveg_persons must exactly equal total_persons.
                (Mirrors the DB-level CheckConstraint; caught here first to return
                a clean DRF 400 before the constraint fires.)

        Rule 2: total_persons must be > 0.
                (Also enforced at DB level, surfaced cleanly here.)

        Note: The 24-hour advance booking blockout SLA is enforced in this
        validate() method as specified in the schema document.
        """
        total = data.get('total_persons', 0)
        veg = data.get('veg_persons', 0)
        nonveg = data.get('nonveg_persons', 0)
        booking_date = data.get('booking_date')

        # Rule 1 — Headcount math
        if veg + nonveg != total:
            raise serializers.ValidationError({
                "non_field_errors": (
                    f"veg_persons ({veg}) + nonveg_persons ({nonveg}) "
                    f"must equal total_persons ({total})."
                )
            })

        # Rule 2 — Must have at least one person
        if total <= 0:
            raise serializers.ValidationError({
                "total_persons": "Total persons must be greater than zero."
            })

        # Rule 3 — 24-hour advance booking SLA
        if booking_date:
            from django.utils import timezone
            import datetime
            today = timezone.localdate()
            earliest_allowed = today + datetime.timedelta(days=1)
            if booking_date < earliest_allowed:
                raise serializers.ValidationError({
                    "booking_date": (
                        "Mess bookings must be submitted at least 24 hours in advance. "
                        f"The earliest date you can book is {earliest_allowed}."
                    )
                })

        return data

