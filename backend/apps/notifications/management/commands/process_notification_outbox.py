from django.core.management.base import BaseCommand

from apps.notifications.outbox_processor import process_pending_outbox


class Command(BaseCommand):
    help = 'Dispatch pending transactional notification outbox rows.'

    def add_arguments(self, parser):
        parser.add_argument('--limit', type=int, default=100)

    def handle(self, *args, **options):
        result = process_pending_outbox(limit=options['limit'])
        self.stdout.write(self.style.SUCCESS(
            'Notification outbox: '
            f"sent={result['sent']} retried={result['retried']} "
            f"failed={result['failed']} recovered={result['recovered']}"
        ))
