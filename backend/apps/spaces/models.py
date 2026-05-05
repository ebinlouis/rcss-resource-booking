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
        LAB = 'LAB', 'Lab'
        GUEST_ROOM = 'GUEST_ROOM', 'Guest Room'

    name = models.CharField(max_length=100)
    space_type = models.CharField(max_length=20, choices=SpaceType.choices)
    capacity_hard = models.IntegerField()
    location = models.CharField(max_length=100)
    
    # <-- NEW: Image Field for the React UI -->
    image_1 = models.ImageField(upload_to='spaces/', null=True, blank=True)
    
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['name', 'location'], name='unique_space_location')
        ]

    def __str__(self):
        return f"{self.name} ({self.location})"


# ==========================================
# 2. INVENTORY MANAGEMENT (SCALABILITY CORE)
# ==========================================
class EquipmentCategory(models.TextChoices):
    AV = 'AV', 'Audio/Visual'
    IT = 'IT', 'Computers & IT'
    FURNITURE = 'FURNITURE', 'Furniture'
    STATIONERY = 'STATIONERY', 'Stationery & Supplies'
    MEDIA = 'MEDIA', 'Media Production Gear'

class Equipment(models.Model):
    """The Master Inventory Catalog"""
    name = models.CharField(max_length=150, unique=True)
    category = models.CharField(max_length=20, choices=EquipmentCategory.choices)
    
    # Inventory Tracking
    total_owned = models.PositiveIntegerField(default=0)
    total_functional = models.PositiveIntegerField(default=0)
    
    # Behavior Flags
    is_returnable = models.BooleanField(default=True, help_text="False for consumables like tape or markers")
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.name} (Qty: {self.total_functional})"

class SpaceEquipment(models.Model):
    """Junction Table: What is physically built into a specific room?"""
    space = models.ForeignKey(Space, on_delete=models.CASCADE, related_name='built_in_equipment')
    equipment = models.ForeignKey(Equipment, on_delete=models.RESTRICT)
    quantity = models.PositiveIntegerField(default=1)

    class Meta:
        # A room can't have two separate rows for "Projector". It should just be one row with quantity=2.
        constraints = [
            models.UniqueConstraint(fields=['space', 'equipment'], name='unique_space_equipment')
        ]
        verbose_name_plural = "Space Equipment"

    def __str__(self):
        return f"{self.quantity}x {self.equipment.name} in {self.space.name}"


# ==========================================
# 3. BOOKINGS & REQUESTS
# ==========================================
class SpaceBooking(BaseBooking):
    space = models.ForeignKey(Space, on_delete=models.PROTECT, related_name='bookings')
    
    start_datetime = models.DateTimeField(db_index=True)
    end_datetime = models.DateTimeField(db_index=True)
    
    attendee_count = models.IntegerField()
    purpose_of_booking = models.TextField()
    
    # Note: requested_equipment text field removed. We now use the EquipmentRequest table below.

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
    """Temporary gear requested for a specific booking"""
    
    # The Bulletproof Link to a Space Booking
    space_booking = models.ForeignKey(
        SpaceBooking, on_delete=models.CASCADE, related_name='requested_equipment', null=True, blank=True
    )
    
    # Future Phase 3 Link:
    # media_booking = models.ForeignKey(
    #     MediaBooking, on_delete=models.CASCADE, related_name='requested_equipment', null=True, blank=True
    # )

    equipment = models.ForeignKey(Equipment, on_delete=models.RESTRICT)
    quantity = models.PositiveIntegerField(default=1)
    
    # Logistics tracking for the IT/Media team
    is_delivered = models.BooleanField(default=False)
    is_returned = models.BooleanField(default=False)

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=models.Q(space_booking__isnull=False), 
                name='equipment_request_must_have_booking'
            )
        ]

    def __str__(self):
        return f"{self.quantity}x {self.equipment.name} for {self.space_booking.reference_code}"