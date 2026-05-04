import uuid
from django.db import models
from django.db.models import Q, F, Func
from django.contrib.postgres.constraints import ExclusionConstraint
from django.contrib.postgres.fields import RangeOperators, DateTimeRangeField
from apps.approvals.models import BaseBooking

class TsTzRange(Func):
    function = 'TSTZRANGE'
    output_field = DateTimeRangeField()

class Vehicle(models.Model):
    name = models.CharField(max_length=100)  
    registration_number = models.CharField(max_length=50, unique=True)
    capacity = models.IntegerField()
    is_active = models.BooleanField(default=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.name} ({self.registration_number})"

class FleetBooking(BaseBooking):
    vehicle = models.ForeignKey(Vehicle, on_delete=models.PROTECT, related_name='bookings')
    purpose = models.TextField()
    
    start_datetime = models.DateTimeField(db_index=True)
    end_datetime = models.DateTimeField(db_index=True)
    
    pickup_location = models.CharField(max_length=255)
    destination = models.CharField(max_length=255)
    total_passengers = models.IntegerField()

    class Meta(BaseBooking.Meta):
        constraints = BaseBooking.Meta.constraints + [
            models.CheckConstraint(
                condition=Q(start_datetime__lt=F('end_datetime')),
                name='fleet_booking_start_before_end'
            ),
            models.CheckConstraint(
                condition=Q(total_passengers__gt=0),
                name='fleet_booking_positive_passengers'
            ),
            ExclusionConstraint(
                name='exclude_overlapping_approved_fleet_bookings',
                expressions=[
                    ('vehicle', RangeOperators.EQUAL),
                    (TsTzRange('start_datetime', 'end_datetime'), RangeOperators.OVERLAPS),
                ],
                condition=Q(status='APPROVED'),
            )
        ]

    def save(self, *args, **kwargs):
        if not self.reference_code:
            self.reference_code = f"FLT-{uuid.uuid4().hex[:8].upper()}"
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.reference_code} - {self.vehicle.name}"