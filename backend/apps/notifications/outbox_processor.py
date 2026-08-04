"""Concurrency-safe polling and retry logic for notification outbox rows."""

import logging
from datetime import timedelta

from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from apps.notifications.models import NotificationOutbox
from apps.notifications.outbox_dispatcher import TerminalDispatchError, dispatch_outbox_event

logger = logging.getLogger(__name__)

STALE_PROCESSING_AFTER = timedelta(minutes=5)
MAX_BACKOFF = timedelta(minutes=30)


def _backoff_for_attempt(attempt):
    return min(timedelta(seconds=30 * (2 ** max(0, attempt - 1))), MAX_BACKOFF)


def _recover_stale_claims(now):
    """Make rows claimable after a worker crash, without ever claiming FAILED."""
    return NotificationOutbox.objects.filter(
        status=NotificationOutbox.Status.PROCESSING,
        last_attempted_at__lt=now - STALE_PROCESSING_AFTER,
    ).update(
        status=NotificationOutbox.Status.PENDING,
        next_attempt_at=now,
        last_error='Recovered after stale processing claim.',
    )


def _claim(entry_id, now):
    with transaction.atomic():
        entry = NotificationOutbox.objects.select_for_update(skip_locked=True).filter(
            pk=entry_id,
            status=NotificationOutbox.Status.PENDING,
        ).first()
        if entry is None:
            return None
        entry.status = NotificationOutbox.Status.PROCESSING
        entry.attempts += 1
        entry.last_attempted_at = now
        entry.last_error = ''
        entry.save(update_fields=['status', 'attempts', 'last_attempted_at', 'last_error'])
        return entry


def _mark_sent(entry_id, now):
    NotificationOutbox.objects.filter(
        pk=entry_id,
        status=NotificationOutbox.Status.PROCESSING,
    ).update(
        status=NotificationOutbox.Status.SENT,
        sent_at=now,
        next_attempt_at=None,
        last_error='',
    )


def _mark_failure(entry_id, error, now, terminal=False):
    with transaction.atomic():
        entry = NotificationOutbox.objects.select_for_update().get(pk=entry_id)
        is_terminal = terminal or entry.attempts >= entry.max_attempts
        entry.status = (
            NotificationOutbox.Status.FAILED
            if is_terminal
            else NotificationOutbox.Status.PENDING
        )
        entry.last_error = str(error)[:4000]
        entry.next_attempt_at = None if is_terminal else now + _backoff_for_attempt(entry.attempts)
        entry.save(update_fields=['status', 'last_error', 'next_attempt_at'])


def process_pending_outbox(limit=100):
    """Claim and dispatch pending rows.  Returns counters for jobs and commands."""
    now = timezone.now()
    recovered = _recover_stale_claims(now)
    pending_ids = list(
        NotificationOutbox.objects.filter(
            status=NotificationOutbox.Status.PENDING,
        ).filter(
            Q(next_attempt_at__isnull=True) | Q(next_attempt_at__lte=now)
        ).order_by('created_at').values_list('id', flat=True)[:limit]
    )
    result = {'sent': 0, 'retried': 0, 'failed': 0, 'recovered': recovered}

    for entry_id in pending_ids:
        entry = _claim(entry_id, timezone.now())
        if entry is None:
            continue
        try:
            dispatch_outbox_event(entry)
        except TerminalDispatchError as exc:
            logger.warning('Notification outbox %s cannot be dispatched: %s', entry_id, exc)
            _mark_failure(entry_id, exc, timezone.now(), terminal=True)
            result['failed'] += 1
        except Exception as exc:  # dispatcher/broker failures are retryable
            logger.exception('Notification outbox %s dispatch failed', entry_id)
            _mark_failure(entry_id, exc, timezone.now())
            refreshed = NotificationOutbox.objects.only('status').get(pk=entry_id)
            result['failed' if refreshed.status == NotificationOutbox.Status.FAILED else 'retried'] += 1
        else:
            _mark_sent(entry_id, timezone.now())
            result['sent'] += 1

    return result
