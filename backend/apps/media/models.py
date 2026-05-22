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
    event_group_id = models.UUIDField(null=True, blank=True, db_index=True)
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
        """
        Validates that the requested quantity does not exceed what is available
        during this booking's time block.

        The check is run for ALL terminal-eligible statuses. It is intentionally
        skipped only for REJECTED / CANCELLED / EXPIRED / COMPLETED bookings,
        because those bookings no longer hold any real-world inventory.

        Crucially, this includes PENDING bookings: a user must not be allowed
        to request more equipment than exists in total, even before approval.
        At approval time the view layer re-checks against only APPROVED bookings
        (i.e. confirmed usage), which is the correct gate for actual conflicts.
        """
        super().clean()

        if not hasattr(self, 'media_booking') or not hasattr(self, 'equipment'):
            return

        # Skip validation for bookings that are no longer active / relevant.
        INACTIVE_STATUSES = {'REJECTED', 'CANCELLED', 'EXPIRED', 'COMPLETED'}
        if self.media_booking.status in INACTIVE_STATUSES:
            return

        # Count how much of this equipment is already committed in OTHER
        # APPROVED bookings that overlap with this booking's full time block.
        # We deliberately check only APPROVED here so that multiple simultaneous
        # PENDING requests for the same scarce gear are not blocked against each
        # other — that would make the approval process a race condition.
        # The approval view is responsible for the APPROVED-vs-APPROVED conflict
        # check at decision time.
        overlapping_approved = MediaBooking.objects.filter(
            status='APPROVED',
            setup_start_datetime__lt=self.media_booking.teardown_end_datetime,
            teardown_end_datetime__gt=self.media_booking.setup_start_datetime,
        ).exclude(pk=self.media_booking.pk)

        used_by_approved = (
            MediaEquipmentRequest.objects.filter(
                media_booking__in=overlapping_approved,
                equipment=self.equipment,
            ).aggregate(total_used=Sum('quantity'))['total_used'] or 0
        )

        available_qty = max(0, self.equipment.total_owned - used_by_approved)

        if self.quantity > available_qty:
            raise ValidationError({
                'quantity': (
                    f"Cannot request {self.quantity}x '{self.equipment.name}'. "
                    f"Only {available_qty} unit(s) are available during this time block "
                    f"(total owned: {self.equipment.total_owned}, "
                    f"already committed by approved bookings: {used_by_approved})."
                )
            })

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.quantity}x {self.equipment.name} for {self.media_booking.reference_code}"
