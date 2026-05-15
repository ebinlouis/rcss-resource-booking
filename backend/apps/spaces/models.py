import uuid
from django.db import models
from django.db.models import Q, F, Func
from django.contrib.postgres.constraints import ExclusionConstraint
from django.contrib.postgres.fields import RangeOperators, DateTimeRangeField
from apps.approvals.models import BaseBooking


class TsTzRange(Func):
    function = 'TSTZRANGE'
    output_field = DateTimeRangeField()


# ==========================================
# 1. THE SPACE MODEL
# ==========================================
class Space(models.Model):
    class SpaceType(models.TextChoices):
        GENERAL_HALL = 'GENERAL_HALL', 'General Hall'
        LAB          = 'LAB',          'Lab'
        GUEST_ROOM   = 'GUEST_ROOM',   'Guest Room'

    name               = models.CharField(max_length=100)
    space_type         = models.CharField(max_length=20, choices=SpaceType.choices)
    capacity_hard      = models.IntegerField()
    location           = models.CharField(max_length=100)
    description        = models.TextField(blank=True, default='')
    image_1            = models.ImageField(upload_to='spaces/', null=True, blank=True)
    is_active          = models.BooleanField(default=True)
    is_special_purpose = models.BooleanField(
        default=False,
        help_text="If True, this space is reserved for specific workflows and won't be auto-suggested."
    )

    # ── Buffer fields (optional per-space setup/teardown time) ──────────────
    # These define how much time before/after a booking is blocked for
    # cleaning, setup, or AV configuration. The booking record always stores
    # the clean user-facing times; conflict checks use the buffered range.
    setup_buffer_minutes    = models.IntegerField(
        default=0,
        help_text="Minutes blocked before a booking starts (setup/cleaning)."
    )
    teardown_buffer_minutes = models.IntegerField(
        default=0,
        help_text="Minutes blocked after a booking ends (teardown/cleaning)."
    )

    # ── Lab flag — gates bulk timetable upload feature ──────────────────────
    # Only spaces with is_lab=True will expose the timetable upload UI.
    # Also used as a precursor to per-space RBAC (lab admin role).
    is_lab = models.BooleanField(
        default=False,
        help_text="Enables lab-specific features: timetable upload, lab admin role."
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['name', 'location'], name='unique_space_location')
        ]

    def __str__(self):
        return f"{self.name} ({self.location})"


# ==========================================
# 2. EQUIPMENT CATALOG
# ==========================================
class EquipmentCategory(models.TextChoices):
    AV         = 'AV',         'Audio / Visual'
    LIGHTING   = 'LIGHTING',   'Lighting'
    FURNITURE  = 'FURNITURE',  'Furniture'
    COMPUTING  = 'COMPUTING',  'Computing'
    NETWORKING = 'NETWORKING', 'Networking'
    OTHER      = 'OTHER',      'Other'


class Equipment(models.Model):
    """Master catalog of all campus equipment."""
    name        = models.CharField(max_length=150, unique=True)
    category    = models.CharField(max_length=20, choices=EquipmentCategory.choices)
    description = models.TextField(blank=True, default='')
    total_owned = models.PositiveIntegerField(default=0)
    is_portable = models.BooleanField(
        default=True,
        help_text='False for fixed/built-in items like ceiling projectors'
    )
    is_standard_media_kit = models.BooleanField(
        default=False,
        help_text="If True, automatically assigns 1 unit to every Media Team request."
    )
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.name} (x{self.total_owned})"


class SpaceEquipment(models.Model):
    """Junction table: equipment physically built into a specific space."""
    space     = models.ForeignKey(Space, on_delete=models.CASCADE, related_name='built_in_equipment')
    equipment = models.ForeignKey(Equipment, on_delete=models.RESTRICT)
    quantity  = models.PositiveIntegerField(default=1)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['space', 'equipment'], name='unique_space_equipment')
        ]
        verbose_name_plural = 'Space Equipment'

    def __str__(self):
        return f"{self.quantity}x {self.equipment.name} in {self.space.name}"


# ==========================================
# 3. BOOKINGS
# ==========================================
class SpaceBooking(BaseBooking):
    class BookingType(models.TextChoices):
        SINGLE_CONTINUOUS = 'SINGLE', 'Single / Continuous'
        RECURRING_DAILY = 'RECURRING', 'Recurring Daily'

    group_id           = models.UUIDField(default=uuid.uuid4, editable=False, db_index=True)
    booking_type       = models.CharField(max_length=20, choices=BookingType.choices, default=BookingType.SINGLE_CONTINUOUS)

    space              = models.ForeignKey(Space, on_delete=models.PROTECT, related_name='bookings')
    start_datetime     = models.DateTimeField(db_index=True)
    end_datetime       = models.DateTimeField(db_index=True)
    attendee_count     = models.IntegerField()
    purpose_of_booking = models.TextField()
    is_external        = models.BooleanField(default=False)

    class Meta(BaseBooking.Meta):
        constraints = BaseBooking.Meta.constraints + [
            models.CheckConstraint(
                condition=Q(start_datetime__lt=F('end_datetime')),
                name='space_booking_start_before_end'
            ),
            models.CheckConstraint(
                condition=Q(attendee_count__gt=0),
                name='space_booking_positive_attendees'
            ),
            # ── Overlap guard ───────────────────────────────────────────────
            # Uses setup/teardown buffers from the Space model to define the
            # effective blocked range. Two approved bookings for the same
            # space cannot have overlapping effective ranges.
            #
            # NOTE: The buffer expansion happens in the application-layer
            # conflict check (see utils.py). This DB constraint is a safety
            # net for the clean booking times — it prevents any two APPROVED
            # bookings from having overlapping raw start/end times regardless
            # of buffers. The buffer logic in utils.py is stricter.
            ExclusionConstraint(
                name='exclude_overlapping_approved_space_bookings',
                expressions=[
                    ('space', RangeOperators.EQUAL),
                    (TsTzRange('start_datetime', 'end_datetime'), RangeOperators.OVERLAPS),
                ],
                condition=Q(status='APPROVED'),
            )
        ]

    def save(self, *args, **kwargs):
        if not self.reference_code:
            self.reference_code = f"SPC-{uuid.uuid4().hex[:8].upper()}"
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.reference_code} - {self.space.name}"


class EquipmentRequest(models.Model):
    """Temporary gear requested for a specific booking."""
    space_booking = models.ForeignKey(
        SpaceBooking, on_delete=models.CASCADE, related_name='requested_equipment',
        null=True, blank=True
    )
    equipment    = models.ForeignKey(Equipment, on_delete=models.RESTRICT)
    quantity     = models.PositiveIntegerField(default=1)
    is_delivered = models.BooleanField(default=False)
    is_returned  = models.BooleanField(default=False)

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=models.Q(space_booking__isnull=False),
                name='equipment_request_must_have_booking'
            )
        ]

    def __str__(self):
        return f"{self.quantity}x {self.equipment.name} for {self.space_booking.reference_code}"