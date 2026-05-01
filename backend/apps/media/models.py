from django.db import models
from django.db.models import Q, F
from apps.approvals.models import BaseBooking

class MediaBooking(BaseBooking):
    # Notice we link this to the Space app using a string to avoid circular imports
    space = models.ForeignKey('spaces.Space', on_delete=models.PROTECT, related_name='media_bookings')
    event_name = models.CharField(max_length=200)
    
    booking_date = models.DateField(db_index=True)
    start_time = models.TimeField()
    end_time = models.TimeField()
    
    requested_equipment = models.TextField()
    requested_services = models.TextField(blank=True, null=True)
    technical_contact_person = models.CharField(max_length=150)

    class Meta(BaseBooking.Meta):
        constraints = BaseBooking.Meta.constraints + [
            # Ensure the event doesn't end before it begins
            models.CheckConstraint(
                condition=Q(start_time__lt=F('end_time')),
                name='media_booking_start_before_end'
            )
        ]

    def __str__(self):
        return f"{self.reference_code} - {self.event_name}"