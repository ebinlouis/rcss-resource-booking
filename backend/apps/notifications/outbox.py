"""Small request-side API for recording notification work durably."""

from apps.notifications.models import NotificationOutbox


def enqueue_notification(event_type, **payload):
    """Create a notification intent without contacting Celery or SMTP."""
    return NotificationOutbox.objects.create(
        event_type=event_type,
        payload=payload,
    )
