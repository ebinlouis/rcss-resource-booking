import uuid # <-- 1. Don't forget to import this!
from django.db import models
from django.db.models import Q, F, Func
from django.contrib.postgres.constraints import ExclusionConstraint
from django.contrib.postgres.fields import RangeOperators, DateTimeRangeField
from apps.approvals.models import BaseBooking

class TsTzRange(Func):
    function = 'TSTZRANGE'
    output_field = DateTimeRangeField()

class Space(models.Model):
    class SpaceType(models.TextChoices):
        GENERAL_HALL = 'GENERAL_HALL', 'General Hall'
        LAB = 'LAB', 'Lab'
        GUEST_ROOM = 'GUEST_ROOM', 'Guest Room'

    name = models.CharField(max_length=100)
    space_type = models.CharField(max_length=20, choices=SpaceType.choices)
    capacity_hard = models.IntegerField()
    location = models.CharField(max_length=100)
    is_active = models.BooleanField(default=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['name', 'location'], name='unique_space_location')
        ]

    def __str__(self):
        return f"{self.name} ({self.location})"


class SpaceBooking(BaseBooking):
    space = models.ForeignKey(Space, on_delete=models.PROTECT, related_name='bookings')
    
    start_datetime = models.DateTimeField(db_index=True)
    end_datetime = models.DateTimeField(db_index=True)
    
    attendee_count = models.IntegerField()
    purpose_of_booking = models.TextField()
    requested_equipment = models.TextField(blank=True, null=True)

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

    # <-- 2. Here is the magic method! -->
    def save(self, *args, **kwargs):
        # If this is a brand new booking, generate a unique reference code
        if not self.reference_code:
            self.reference_code = f"SPC-{uuid.uuid4().hex[:8].upper()}"
        
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.reference_code} - {self.space.name}"