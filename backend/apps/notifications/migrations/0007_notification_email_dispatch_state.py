# Generated manually for confirmed email task publication state.

from django.db import migrations, models


def mark_existing_notifications_not_required(apps, schema_editor):
    Notification = apps.get_model('notifications', 'Notification')
    Notification.objects.update(email_dispatch_status='NOT_REQUIRED')


class Migration(migrations.Migration):

    dependencies = [
        ('notifications', '0006_notification_outbox_entry'),
    ]

    operations = [
        migrations.AddField(
            model_name='notification',
            name='email_dispatch_status',
            field=models.CharField(
                choices=[
                    ('PENDING', 'Pending queue confirmation'),
                    ('QUEUED', 'Queued'),
                    ('NOT_REQUIRED', 'Not required'),
                ],
                db_index=True,
                default='PENDING',
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name='notification',
            name='email_dispatch_attempts',
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name='notification',
            name='email_queued_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.RunPython(
            mark_existing_notifications_not_required,
            migrations.RunPython.noop,
        ),
    ]
