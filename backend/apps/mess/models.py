import uuid
from django.db import models
from django.db.models import Q, F
from apps.approvals.models import BaseBooking


class MessBooking(BaseBooking):
    """
    Parent record — one per catering event, regardless of how many days it spans.
    All event-level fields live here. Per-day details live in DailyMessMenu.
    """
    start_date           = models.DateField(db_index=True)
    end_date             = models.DateField(db_index=True)
    event_group_id       = models.UUIDField(null=True, blank=True, db_index=True)
    delivery_location    = models.CharField(max_length=255)
    purpose_of_programme = models.TextField()
    rejection_remark     = models.TextField(blank=True, null=True)

    class Meta(BaseBooking.Meta):
        constraints = BaseBooking.Meta.constraints + [
            models.CheckConstraint(
                condition=Q(start_date__lte=F('end_date')),
                name='mess_booking_start_lte_end',
            ),
        ]

    def save(self, *args, **kwargs):
        if not self.reference_code:
            self.reference_code = f"MES-{uuid.uuid4().hex[:8].upper()}"
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.reference_code} | {self.start_date} → {self.end_date} | {self.delivery_location}"


class DailyMessMenu(models.Model):
    """
    Child record — one row per day per MessBooking.
    Meal fields are nullable; a null value means that meal was not requested.
    notified_kitchen is flipped to True once the kitchen has been informed.
    """
    booking        = models.ForeignKey(
        MessBooking,
        on_delete=models.CASCADE,
        related_name='daily_menus',
    )
    date           = models.DateField(db_index=True)

    # Headcount for this specific day
    total_persons  = models.IntegerField()
    veg_persons    = models.IntegerField(default=0)
    nonveg_persons = models.IntegerField(default=0)

    # Breakfast — null means not requested
    breakfast_time = models.TimeField(blank=True, null=True)
    breakfast_menu = models.TextField(blank=True, null=True)

    # Morning tea/snacks — null means not requested
    morning_tea_time     = models.TimeField(blank=True, null=True)
    morning_snack_option = models.TextField(blank=True, null=True)

    # Lunch — null means not requested
    lunch_time = models.TimeField(blank=True, null=True)
    lunch_menu = models.TextField(blank=True, null=True)

    # Evening tea/snacks — null means not requested
    evening_tea_time     = models.TimeField(blank=True, null=True)
    evening_snack_option = models.TextField(blank=True, null=True)

    # Dinner — null means not requested
    dinner_time = models.TimeField(blank=True, null=True)
    dinner_menu = models.TextField(blank=True, null=True)

    # Kitchen notification flag — admin flips this after informing the kitchen
    notified_kitchen = models.BooleanField(default=False)

    class Meta:
        ordering = ['date']
        constraints = [
            models.UniqueConstraint(
                fields=['booking', 'date'],
                name='unique_daily_menu_per_booking_date',
            ),
            models.CheckConstraint(
                condition=Q(total_persons__gt=0),
                name='daily_menu_positive_total_persons',
            ),
            models.CheckConstraint(
                condition=Q(total_persons=F('veg_persons') + F('nonveg_persons')),
                name='daily_menu_headcount_math_check',
            ),
            models.CheckConstraint(
                condition=Q(veg_persons__gte=0) & Q(nonveg_persons__gte=0),
                name='daily_menu_no_negative_meals',
            ),
        ]

    def __str__(self):
        return f"{self.booking.reference_code} | {self.date} | {self.total_persons} pax"
