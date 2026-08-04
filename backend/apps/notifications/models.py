from django.conf import settings
from django.db import models
from django.db.models import Q
from django.utils import timezone


class NotificationOutbox(models.Model):
    """A durable notification intent written with the business transaction.

    Request handlers only create these rows.  A separate worker publishes the
    notification/email work, so an unavailable broker cannot hold an API
    response open after a booking has been saved.
    """

    class Status(models.TextChoices):
        PENDING = 'PENDING', 'Pending'
        PROCESSING = 'PROCESSING', 'Processing'
        SENT = 'SENT', 'Sent'
        FAILED = 'FAILED', 'Failed'

    event_type = models.CharField(max_length=100)
    payload = models.JSONField()
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
    )
    attempts = models.PositiveIntegerField(default=0)
    max_attempts = models.PositiveIntegerField(default=5)
    last_error = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    last_attempted_at = models.DateTimeField(null=True, blank=True)
    next_attempt_at = models.DateTimeField(null=True, blank=True)
    sent_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes = [models.Index(fields=['status', 'created_at'])]
        ordering = ['created_at']

    def __str__(self):
        return f"Outbox #{self.pk}: {self.event_type} ({self.status})"


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

    class EmailDispatchStatus(models.TextChoices):
        PENDING = 'PENDING', 'Pending queue confirmation'
        QUEUED = 'QUEUED', 'Queued'
        NOT_REQUIRED = 'NOT_REQUIRED', 'Not required'

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

    # The inbox row and email task have separate delivery states.  An outbox
    # retry may find this notification already created after a broker publish
    # failure; PENDING tells notify() to try publishing the email again rather
    # than silently treating the row itself as proof of delivery.
    email_dispatch_status = models.CharField(
        max_length=20,
        choices=EmailDispatchStatus.choices,
        default=EmailDispatchStatus.PENDING,
        db_index=True,
    )
    email_dispatch_attempts = models.PositiveIntegerField(default=0)
    email_queued_at = models.DateTimeField(blank=True, null=True)

    # Null for legacy and lifecycle notifications.  When a notification was
    # dispatched from an outbox row, this key makes retries idempotent per
    # recipient without coupling outbox retention to inbox retention.
    outbox_entry = models.ForeignKey(
        'NotificationOutbox',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='notifications',
    )

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['recipient', 'is_read', '-created_at']),
            models.Index(fields=['recipient', 'is_actionable', '-created_at']),
            models.Index(fields=['domain', 'reference_code', 'is_actionable']),
            models.Index(fields=['recipient', '-created_at']),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['outbox_entry', 'recipient'],
                condition=Q(outbox_entry__isnull=False),
                name='unique_notification_per_outbox_entry_recipient',
            ),
        ]

    def __str__(self):
        return f"{self.recipient} | {self.category} | {self.title}"

    def mark_read(self):
        if not self.is_read:
            self.is_read = True
            self.read_at = timezone.now()
            self.save(update_fields=['is_read', 'read_at'])


class ApprovalToken(models.Model):
    class Action(models.TextChoices):
        APPROVE = 'APPROVE', 'Approve'

    token_hash = models.CharField(max_length=64, unique=True, db_index=True)
    domain = models.CharField(max_length=20)
    booking_ref = models.CharField(max_length=50)
    action = models.CharField(max_length=20, choices=Action.choices, default=Action.APPROVE)
    issued_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='approval_tokens',
    )
    expires_at = models.DateTimeField()
    used = models.BooleanField(default=False)
    used_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=['token_hash']),
            models.Index(fields=['booking_ref', 'domain']),
        ]

    def __str__(self):
        return f"ApprovalToken({self.domain}/{self.booking_ref} → {self.issued_to})"
