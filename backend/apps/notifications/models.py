from django.conf import settings
from django.db import models
from django.utils import timezone


class Notification(models.Model):
    class Category(models.TextChoices):
        BOOKING_APPROVED       = 'BOOKING_APPROVED',       'Booking Approved'
        BOOKING_REJECTED       = 'BOOKING_REJECTED',       'Booking Rejected'
        BOOKING_CANCELLED      = 'BOOKING_CANCELLED',      'Booking Cancelled'
        BOOKING_PENDING        = 'BOOKING_PENDING',        'Booking Pending'
        SWAP_REQUESTED         = 'SWAP_REQUESTED',         'Swap Requested'
        SWAP_ACCEPTED          = 'SWAP_ACCEPTED',          'Swap Accepted'
        SWAP_DECLINED          = 'SWAP_DECLINED',          'Swap Declined'
        SWAP_EXPIRED           = 'SWAP_EXPIRED',           'Swap Expired'
        OVERRIDE_GRANTED       = 'OVERRIDE_GRANTED',       'Override Granted'
        OVERRIDE_EXPIRING_SOON = 'OVERRIDE_EXPIRING_SOON', 'Override Expiring Soon'
        OVERRIDE_EXPIRED       = 'OVERRIDE_EXPIRED',       'Override Expired'
        SYSTEM                 = 'SYSTEM',                 'System'
        FACULTY_APPROVAL_REQ   = 'FACULTY_APPROVAL_REQ',   'Faculty Approval Required'
        FACULTY_APPROVED       = 'FACULTY_APPROVED',       'Faculty Approved'
        FACULTY_REJECTED       = 'FACULTY_REJECTED',       'Faculty Rejected'
        FACULTY_ESCALATED      = 'FACULTY_ESCALATED',      'Faculty Escalated'
        FACULTY_RESENT         = 'FACULTY_RESENT',         'Faculty Resent'

    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='notifications',
    )
    category = models.CharField(max_length=40, choices=Category.choices, db_index=True)
    title    = models.CharField(max_length=200)
    message  = models.TextField()
    link     = models.CharField(max_length=255, blank=True, null=True)
    domain   = models.CharField(max_length=20, blank=True, default='', db_index=True)
    reference_code = models.CharField(max_length=64, blank=True, default='', db_index=True)

    is_read       = models.BooleanField(default=False, db_index=True)
    is_actionable = models.BooleanField(default=False, db_index=True)
    read_at       = models.DateTimeField(blank=True, null=True)
    created_at    = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['recipient', 'is_read', '-created_at']),
            models.Index(fields=['recipient', 'is_actionable', '-created_at']),
            models.Index(fields=['domain', 'reference_code', 'is_actionable']),
            models.Index(fields=['recipient', '-created_at']),
        ]

    def __str__(self):
        return f"{self.recipient} | {self.category} | {self.title}"

    def mark_read(self):
        if not self.is_read:
            self.is_read = True
            self.read_at = timezone.now()
            self.save(update_fields=['is_read', 'read_at'])
