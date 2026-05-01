from rest_framework import serializers
from django.utils import timezone
from apps.fleet.models import Vehicle, FleetBooking

class VehicleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Vehicle
        fields = ['id', 'name', 'registration_number', 'capacity', 'is_active']
        read_only_fields = ['id']

class FleetBookingSerializer(serializers.ModelSerializer):
    vehicle_details = VehicleSerializer(source='vehicle', read_only=True)

    class Meta:
        model = FleetBooking
        fields = [
            'id', 'reference_code', 'user', 'department', 'status',
            'approved_by', 'updated_by', 'remarks_by_admin', 'user_notes',
            'resolved_at', 'created_at', 'updated_at',
            'vehicle', 'vehicle_details', 'purpose',
            'start_datetime', 'end_datetime', 'pickup_location',
            'destination', 'total_passengers',
        ]
        read_only_fields = [
            'id', 'reference_code', 'user', 'status', 
            'approved_by', 'updated_by', 'resolved_at', 
            'created_at', 'updated_at'
        ]

    def validate(self, data):
        vehicle = data.get('vehicle')
        passengers = data.get('total_passengers')
        start = data.get('start_datetime')
        end = data.get('end_datetime')

        # 1. Logic Check: End time must be after Start time
        if start and end and start >= end:
            raise serializers.ValidationError({
                "end_datetime": "Booking end time must be after the start time."
            })

        # 2. Logic Check: Prevent booking in the past
        if start and start < timezone.now():
             raise serializers.ValidationError({
                "start_datetime": "You cannot book a vehicle for a past time slot."
            })

        # 3. Capacity Check: Total passengers vs Vehicle capacity
        if vehicle and passengers is not None:
            if passengers < 1:
                raise serializers.ValidationError({"total_passengers": "At least 1 passenger is required."})
            
            if passengers > vehicle.capacity:
                raise serializers.ValidationError({
                    "total_passengers": f"'{vehicle.name}' only holds {vehicle.capacity} people. You requested {passengers}."
                })

        # 4. Conflict Check: Prevent Double-Booking the same vehicle
        # We look for any existing booking for the SAME vehicle that overlaps this time range
        if vehicle and start and end:
            overlapping_bookings = FleetBooking.objects.filter(
                vehicle=vehicle,
                status__in=['APPROVED', 'PENDING'],  # Ignore CANCELLED/REJECTED bookings
                start_datetime__lt=end,
                end_datetime__gt=start
            )

            # If we are UPDATING an existing booking, don't count itself as a conflict
            if self.instance:
                overlapping_bookings = overlapping_bookings.exclude(pk=self.instance.pk)

            if overlapping_bookings.exists():
                raise serializers.ValidationError({
                    "vehicle": f"The vehicle '{vehicle.name}' is already reserved or has a pending request during this time slot."
                })

        return data