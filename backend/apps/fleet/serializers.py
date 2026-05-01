"""
serializers.py — Fleet, Mess, and Media apps
Follows the SpaceBookingSerializer pattern from apps/spaces/serializers.py
All complex business logic is handled inside the Serializer's validate() method.
"""

from rest_framework import serializers

# ---------------------------------------------------------------------------
# FLEET
# ---------------------------------------------------------------------------
from apps.fleet.models import Vehicle, FleetBooking


class VehicleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Vehicle
        fields = [
            'id', 'name', 'registration_number',
            'capacity', 'is_active',
        ]
        read_only_fields = ['id']


class FleetBookingSerializer(serializers.ModelSerializer):
    # Nested read-only detail, writable via PK on writes — mirrors space/space_details pattern
    vehicle_details = VehicleSerializer(source='vehicle', read_only=True)

    class Meta:
        model = FleetBooking
        fields = [
            # ── Base Booking fields ──────────────────────────────────────────
            'id', 'reference_code', 'user', 'department', 'status',
            'approved_by', 'updated_by',
            'remarks_by_admin', 'user_notes',
            'resolved_at', 'created_at', 'updated_at',
            # ── Fleet-specific fields ────────────────────────────────────────
            'vehicle', 'vehicle_details',
            'purpose',
            'start_datetime', 'end_datetime',
            'pickup_location', 'destination',
            'total_passengers',
        ]
        read_only_fields = [
            'reference_code', 'status',
            'approved_by', 'updated_by',
            'resolved_at', 'created_at', 'updated_at',
        ]

    def validate(self, data):
        """
        Business Logic Validation
        Rule: total_passengers must not exceed vehicle.capacity.
        This mirrors the attendee_count <= capacity_hard check in SpaceBookingSerializer.
        """
        vehicle = data.get('vehicle')
        passengers = data.get('total_passengers')

        if vehicle and passengers is not None:
            if passengers > vehicle.capacity:
                raise serializers.ValidationError({
                    "total_passengers": (
                        f"Vehicle '{vehicle.name}' has a maximum capacity of "
                        f"{vehicle.capacity} passengers. You requested {passengers}."
                    )
                })

        return data