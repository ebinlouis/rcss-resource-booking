"""
serializers.py — Fleet, Mess, and Media apps
Follows the SpaceBookingSerializer pattern from apps/spaces/serializers.py
All complex business logic is handled inside the Serializer's validate() method.
"""

from rest_framework import serializers
# ---------------------------------------------------------------------------
# MEDIA
# ---------------------------------------------------------------------------
from apps.media.models import MediaBooking
# Space is in a separate app; import the serializer via string reference is not
# possible, so we import the model directly and build a lightweight inline serializer.
from apps.spaces.models import Space
 
 
class SpaceSummarySerializer(serializers.ModelSerializer):
    """
    Lightweight read-only Space representation embedded in MediaBookingSerializer.
    Intentionally minimal — Media only needs to know which room is involved.
    """
    class Meta:
        model = Space
        fields = ['id', 'name', 'space_type', 'location', 'capacity_hard']
 
 
class MediaBookingSerializer(serializers.ModelSerializer):
    # Read-only nested detail; write via PK — same pattern as space/space_details
    space_details = SpaceSummarySerializer(source='space', read_only=True)
 
    class Meta:
        model = MediaBooking
        fields = [
            # ── Base Booking fields ──────────────────────────────────────────
            'id', 'reference_code', 'user', 'department', 'status',
            'approved_by', 'updated_by',
            'remarks_by_admin', 'user_notes',
            'resolved_at', 'created_at', 'updated_at',
            # ── Media-specific fields ────────────────────────────────────────
            'space', 'space_details',
            'event_name',
            'booking_date', 'start_time', 'end_time',
            'requested_equipment', 'requested_services',
            'technical_contact_person',
        ]
        read_only_fields = [
            'reference_code', 'status',
            'approved_by', 'updated_by',
            'resolved_at', 'created_at', 'updated_at',
        ]
 
    def validate(self, data):
        """
        Business Logic Validation
        Rule: start_time must be strictly before end_time.
        (Mirrors the DB CheckConstraint; surfaced here first for a clean 400.)
        """
        start = data.get('start_time')
        end = data.get('end_time')
 
        if start and end:
            if start >= end:
                raise serializers.ValidationError({
                    "start_time": (
                        f"start_time ({start}) must be strictly before "
                        f"end_time ({end})."
                    )
                })
 
        return data