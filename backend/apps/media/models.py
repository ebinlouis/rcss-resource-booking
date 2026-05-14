import uuid
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Q, F, Sum
from apps.approvals.models import BaseBooking


class MediaSettings(models.Model):
    max_concurrent_events = models.PositiveIntegerField(default=2)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Media Settings'
        verbose_name_plural = 'Media Settings'

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    @classmethod
    def load(cls):
        settings, _ = cls.objects.get_or_create(pk=1)
        return settings

    def __str__(self):
        return f"Media capacity: {self.max_concurrent_events} concurrent events"


class MediaBooking(BaseBooking):
    space = models.ForeignKey('spaces.Space', on_delete=models.PROTECT, related_name='media_bookings')
    event_name = models.CharField(max_length=200)

    # -- Unified Continuous Timestamps --
    setup_start_datetime  = models.DateTimeField(db_index=True)
    event_start_datetime  = models.DateTimeField()
    event_end_datetime    = models.DateTimeField()
    teardown_end_datetime = models.DateTimeField(db_index=True)

    requested_services = models.TextField(blank=True, null=True)
   
    is_external_event = models.BooleanField(
        default=False,
        help_text="True if this event is organised by an external party outside the college."
    )
    is_team_request = models.BooleanField(
        default=False,
        help_text="True when the requester needs the media team to cover the event."
    )

    class Meta(BaseBooking.Meta):
        constraints = BaseBooking.Meta.constraints + [
            # 1. Setup must start before or exactly when the event starts
            models.CheckConstraint(
                condition=Q(setup_start_datetime__lte=F('event_start_datetime')),
                name='media_setup_before_event_start'
            ),
            # 2. Event start must be strictly before event end
            models.CheckConstraint(
                condition=Q(event_start_datetime__lt=F('event_end_datetime')),
                name='media_event_start_before_end'
            ),
            # 3. Teardown must end after or exactly when the event ends
            models.CheckConstraint(
                condition=Q(event_end_datetime__lte=F('teardown_end_datetime')),
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
    media_booking = models.ForeignKey(
        MediaBooking, 
        on_delete=models.CASCADE, 
        related_name='equipment_requests'
    )
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

    def clean(self):
        super().clean()
        
        if not hasattr(self, 'media_booking') or not hasattr(self, 'equipment'):
            return

        if self.media_booking.status != 'APPROVED':
            return

        # 1. Find all OTHER approved bookings overlapping with this CONTINUOUS time block
        overlapping_bookings = MediaBooking.objects.filter(
            status='APPROVED',
            setup_start_datetime__lt=self.media_booking.teardown_end_datetime,
            teardown_end_datetime__gt=self.media_booking.setup_start_datetime
        ).exclude(pk=self.media_booking.pk)

        # 2. Count how many of THIS specific equipment are already used by others
        used_quantity = MediaEquipmentRequest.objects.filter(
            media_booking__in=overlapping_bookings,
            equipment=self.equipment
        ).aggregate(total_used=Sum('quantity'))['total_used'] or 0

        # 3. Calculate max available (Total Owned - Used by Others)
        available_qty = max(0, self.equipment.total_owned - used_quantity)

        # 4. Block the save if they ask for too many
        if self.quantity > available_qty:
            raise ValidationError({
                'quantity': f"Cannot reserve {self.quantity}. Only {available_qty} '{self.equipment.name}' available during this time block."
            })

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.quantity}x {self.equipment.name} for {self.media_booking.reference_code}"