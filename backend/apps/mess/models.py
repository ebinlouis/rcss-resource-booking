import uuid
from django.db import models
from django.db.models import Q, F
from apps.approvals.models import BaseBooking

class MessBooking(BaseBooking):
    booking_date = models.DateField(db_index=True)
    delivery_time = models.TimeField()
    delivery_location = models.CharField(max_length=255)
    purpose_of_programme = models.TextField()
    
    total_persons = models.IntegerField()
    veg_persons = models.IntegerField(default=0)
    nonveg_persons = models.IntegerField(default=0)
    
    breakfast_required = models.BooleanField(default=False)
    breakfast_menu = models.TextField(blank=True, null=True)
    
    morning_tea_required = models.BooleanField(default=False)
    morning_snack_option = models.CharField(max_length=50, blank=True, null=True)
    
    lunch_required = models.BooleanField(default=False)
    lunch_menu = models.TextField(blank=True, null=True)
    
    evening_tea_required = models.BooleanField(default=False)
    evening_snack_option = models.CharField(max_length=50, blank=True, null=True)
    
    dinner_required = models.BooleanField(default=False)
    dinner_menu = models.TextField(blank=True, null=True)

    class Meta(BaseBooking.Meta):
        constraints = BaseBooking.Meta.constraints + [
            models.CheckConstraint(
                condition=Q(total_persons__gt=0),
                name='mess_booking_positive_total_persons'
            ),
            models.CheckConstraint(
                condition=Q(total_persons=F('veg_persons') + F('nonveg_persons')),
                name='mess_booking_headcount_math_check'
            ),
            models.CheckConstraint(
                condition=Q(veg_persons__gte=0) & Q(nonveg_persons__gte=0),
                name='mess_booking_no_negative_meals'
            )
        ]

    def save(self, *args, **kwargs):
        if not self.reference_code:
            self.reference_code = f"MES-{uuid.uuid4().hex[:8].upper()}"
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.reference_code} - Catering for {self.total_persons} on {self.booking_date}"