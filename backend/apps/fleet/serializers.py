from rest_framework import serializers
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from apps.fleet.models import Vehicle, FleetBooking


# ==========================================
# VEHICLE SERIALIZER
# ==========================================
class VehicleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Vehicle
        fields = ['id', 'name', 'registration_number', 'capacity', 'is_active']
        read_only_fields = ['id']


# ==========================================
# FLEET BOOKING SERIALIZER
# ==========================================
class FleetBookingSerializer(serializers.ModelSerializer):
    # Nested read-only vehicle details for frontend display
    vehicle_details = VehicleSerializer(source='vehicle', read_only=True)

    # Resolved-by user info (read-only, mirrors spaces/mess pattern)
    resolved_by_name = serializers.SerializerMethodField()

    # Computed: can the current request owner modify this booking?
    can_modify = serializers.SerializerMethodField()

    class Meta:
        model = FleetBooking
        fields = [
            # --- BaseBooking fields ---
            'id', 'reference_code', 'user', 'department', 'status',
            'resolved_by', 'resolved_by_name',
            'updated_by',
            'remarks_by_admin', 'user_notes',
            'resolved_at', 'created_at', 'updated_at',

            # --- FleetBooking-specific fields ---
            'vehicle', 'vehicle_details',
            'purpose',
            'start_datetime', 'end_datetime',
            'pickup_location', 'destination',
            'total_passengers',

            # --- Computed ---
            'can_modify',
        ]
        read_only_fields = [
            'id', 'reference_code', 'user', 'department', 'status',
            'resolved_by', 'updated_by',
            'resolved_at', 'created_at', 'updated_at',
        ]

    # ------------------------------------------------------------------
    # COMPUTED FIELDS
    # ------------------------------------------------------------------

    def get_resolved_by_name(self, obj):
        if obj.resolved_by:
            return obj.resolved_by.first_name or obj.resolved_by.email
        return None

    def get_can_modify(self, obj):
        """
        Mirrors the spaces/mess pattern:
        A booking can be modified only while it is still PENDING.
        Admins bypass this (handled in the viewset via IsOwnerOrAdminOrReadOnly).
        """
        return obj.status == 'PENDING'

    # ------------------------------------------------------------------
    # VALIDATION
    # ------------------------------------------------------------------

    def validate(self, data):
        vehicle = data.get('vehicle')
        passengers = data.get('total_passengers')
        start = data.get('start_datetime')
        end = data.get('end_datetime')

        # Coerce naive datetimes to the current timezone so comparisons work
        # correctly regardless of whether the frontend sends a naive or aware
        # ISO string.  Django's DateTimeField already does this when
        # USE_TZ=True, but defensive coercion here prevents the
        # "can't compare offset-naive and offset-aware datetimes" TypeError
        # that surfaces when Django receives a naive string and the serializer
        # field has not yet attached tzinfo.
        if start and timezone.is_naive(start):
            start = timezone.make_aware(start)
            data['start_datetime'] = start
        if end and timezone.is_naive(end):
            end = timezone.make_aware(end)
            data['end_datetime'] = end

        # 1. End must be after start
        if start and end and start >= end:
            raise serializers.ValidationError({
                "end_datetime": "Booking end time must be after the start time."
            })

        # 2. Cannot book in the past
        if start and start < timezone.now():
            raise serializers.ValidationError({
                "start_datetime": "You cannot book a vehicle for a past time slot."
            })

        # 3. Capacity check
        if vehicle and passengers is not None:
            if passengers < 1:
                raise serializers.ValidationError({
                    "total_passengers": "At least 1 passenger is required."
                })
            if passengers > vehicle.capacity:
                raise serializers.ValidationError({
                    "total_passengers": (
                        f"'{vehicle.name}' only holds {vehicle.capacity} people. "
                        f"You requested {passengers}."
                    )
                })

        # 4. Overlap / conflict check (PENDING or APPROVED blocks the slot)
        if vehicle and start and end:
            overlapping = FleetBooking.objects.filter(
                vehicle=vehicle,
                status__in=['APPROVED', 'PENDING'],
                start_datetime__lt=end,
                end_datetime__gt=start,
            )
            # Exclude self when updating
            if self.instance:
                overlapping = overlapping.exclude(pk=self.instance.pk)

            if overlapping.exists():
                raise serializers.ValidationError({
                    "vehicle": (
                        f"'{vehicle.name}' is already reserved or has a pending "
                        "request during this time slot."
                    )
                })

        return data
