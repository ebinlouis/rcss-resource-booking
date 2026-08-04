from django.core.management.base import BaseCommand

from apps.notifications.models import NotificationOutbox


class Command(BaseCommand):
    help = 'Report transactional notification outbox health by state.'

    def handle(self, *args, **options):
        for status, label in NotificationOutbox.Status.choices:
            count = NotificationOutbox.objects.filter(status=status).count()
            self.stdout.write(f'{label}: {count}')

        failed = NotificationOutbox.objects.filter(
            status=NotificationOutbox.Status.FAILED,
        ).order_by('-last_attempted_at')[:10]
        for entry in failed:
            self.stdout.write(
                self.style.WARNING(
                    f'FAILED #{entry.id} {entry.event_type}: {entry.last_error}'
                )
            )
