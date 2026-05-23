from django.db import models
from django.db.models import Q
from django.conf import settings

class BaseBooking(models.Model):
    class BookingStatus(models.TextChoices):
        PENDING = 'PENDING', 'Pending'
        APPROVED = 'APPROVED', 'Approved'
        REJECTED = 'REJECTED', 'Rejected'
        CANCELLED = 'CANCELLED', 'Cancelled'
        EXPIRED = 'EXPIRED', 'Expired'
        COMPLETED = 'COMPLETED', 'Completed'

    reference_code = models.CharField(max_length=20, unique=True, db_index=True)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="%(class)s_requests")
    department = models.ForeignKey(
        'users.Department',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
    )

    status = models.CharField(
        max_length=20,
        choices=BookingStatus.choices,
        default=BookingStatus.PENDING,
        db_index=True
    )

    resolved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="%(class)s_resolved"
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="%(class)s_updated"
    )

    remarks_by_admin = models.TextField(blank=True, null=True)
    user_notes = models.TextField(blank=True, null=True)

    resolved_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True
        constraints = [
            models.CheckConstraint(
                condition=~Q(status='REJECTED') | Q(remarks_by_admin__isnull=False),
                name='%(app_label)s_%(class)s_rejected_requires_remarks'
            )
        ]