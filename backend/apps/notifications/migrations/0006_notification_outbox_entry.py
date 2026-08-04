# Generated manually for transactional-outbox notification idempotency.

from django.db import migrations, models
from django.db.models import Q


class Migration(migrations.Migration):

    dependencies = [
        ('notifications', '0005_notificationoutbox'),
    ]

    operations = [
        migrations.AddField(
            model_name='notification',
            name='outbox_entry',
            field=models.ForeignKey(blank=True, null=True, on_delete=models.SET_NULL, related_name='notifications', to='notifications.notificationoutbox'),
        ),
        migrations.AddConstraint(
            model_name='notification',
            constraint=models.UniqueConstraint(condition=Q(('outbox_entry__isnull', False)), fields=('outbox_entry', 'recipient'), name='unique_notification_per_outbox_entry_recipient'),
        ),
    ]
