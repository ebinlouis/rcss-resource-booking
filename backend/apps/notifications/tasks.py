import logging

from celery import shared_task
from django.utils import timezone

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def run_booking_lifecycle(self):
    """
    Periodic task that runs every 5 minutes.
    Delegates entirely to refresh_queryset_lifecycle which is the single
    source of truth for expiry logic across all domains.
    """
    try:
        from apps.approvals.lifecycle import refresh_queryset_lifecycle

        total_expired = 0
        total_expired += _run_domain(refresh_queryset_lifecycle, 'spaces')
        total_expired += _run_domain(refresh_queryset_lifecycle, 'fleet')
        total_expired += _run_domain(refresh_queryset_lifecycle, 'media')
        total_expired += _run_domain(refresh_queryset_lifecycle, 'mess')

        logger.info(
            'run_booking_lifecycle completed: %d booking(s) transitioned at %s',
            total_expired,
            timezone.now().isoformat(),
        )
        return {'expired': total_expired}

    except Exception as exc:
        logger.exception('run_booking_lifecycle failed: %s', exc)
        raise self.retry(exc=exc)


def _run_domain(refresh_fn, domain):
    try:
        if domain == 'spaces':
            from apps.spaces.models import SpaceBooking
            qs = SpaceBooking.objects.filter(
                status__in=['PENDING', 'AWAITING_FACULTY', 'FACULTY_ESCALATED', 'APPROVED']
            )
        elif domain == 'fleet':
            from apps.fleet.models import FleetBooking
            qs = FleetBooking.objects.filter(
                status__in=['PENDING', 'APPROVED']
            )
        elif domain == 'media':
            from apps.media.models import MediaBooking
            qs = MediaBooking.objects.filter(
                status__in=['PENDING', 'APPROVED']
            )
        elif domain == 'mess':
            from apps.mess.models import MessBooking
            qs = MessBooking.objects.filter(
                status__in=['PENDING', 'APPROVED']
            )
        else:
            return 0

        return refresh_fn(qs)

    except Exception as exc:
        logger.exception('_run_domain failed for %s: %s', domain, exc)
        return 0


@shared_task(bind=True, max_retries=3, default_retry_delay=30)
def send_notification_email(self, recipient_email, subject, message, from_email):
    """
    Sends a single notification email asynchronously.
    Retries up to 3 times with a 30-second delay on failure.
    """
    try:
        from django.core.mail import send_mail
        send_mail(
            subject=subject,
            message=message,
            from_email=from_email,
            recipient_list=[recipient_email],
            fail_silently=False,
        )
        logger.info('Notification email sent to %s | subject: %s', recipient_email, subject)
    except Exception as exc:
        logger.exception('send_notification_email failed for %s: %s', recipient_email, exc)
        raise self.retry(exc=exc)