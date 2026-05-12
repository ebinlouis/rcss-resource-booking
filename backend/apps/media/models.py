import uuid
from django.db import models
from django.db.models import Q, F
from apps.approvals.models import BaseBooking


class MediaBooking(BaseBooking):
    space = models.ForeignKey('spaces.Space', on_delete=models.PROTECT, related_name='media_bookings')
    event_name = models.CharField(max_length=200)

    booking_date = models.DateField(db_index=True)
    
    # -- Precise Time Separation --
    setup_start_time  = models.TimeField()
    event_start_time  = models.TimeField()
    event_end_time    = models.TimeField()
    teardown_end_time = models.TimeField()

    requested_services = models.TextField(blank=True, null=True)
   
    is_external_event = models.BooleanField(
        default=False,
        help_text="True if this event is organised by an external party outside the college."
    )

    class Meta(BaseBooking.Meta):
        constraints = BaseBooking.Meta.constraints + [
            # 1. Setup must start before or exactly when the event starts
            models.CheckConstraint(
                condition=Q(setup_start_time__lte=F('event_start_time')),
                name='media_setup_before_event_start'
            ),
            # 2. Event start must be strictly before event end
            models.CheckConstraint(
                condition=Q(event_start_time__lt=F('event_end_time')),
                name='media_event_start_before_end'
            ),
            # 3. Teardown must end after or exactly when the event ends
            models.CheckConstraint(
                condition=Q(event_end_time__lte=F('teardown_end_time')),
                name='media_event_end_before_teardown'
            )
        ]

    def save(self, *args, **kwargs):
        if not self.reference_code:
            self.reference_code = f"MED-{uuid.uuid4().hex[:8].upper()}"
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.reference_code} - {self.event_name}"


class MediaEquipmentRequest(models.Model):
    """
    Links a specific Media Booking to the master Equipment catalog in the spaces app.
    """
    media_booking = models.ForeignKey(
        MediaBooking, 
        on_delete=models.CASCADE, 
        related_name='equipment_requests'
    )
    # Using string reference to avoid circular imports between spaces/media apps
    equipment = models.ForeignKey('spaces.Equipment', on_delete=models.RESTRICT)
    quantity  = models.PositiveIntegerField(default=1)

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=Q(quantity__gt=0),
                name='media_equipment_quantity_positive'
            ),
            models.UniqueConstraint(
                fields=['media_booking', 'equipment'],
                name='unique_equipment_per_media_booking'
            )
        ]

    def __str__(self):
        return f"{self.quantity}x {self.equipment.name} for {self.media_booking.reference_code}"