from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('mess', '0008_alter_messbooking_status'),
    ]

    operations = [
        migrations.AddField(
            model_name='messbooking',
            name='event_group_id',
            field=models.UUIDField(blank=True, db_index=True, null=True),
        ),
    ]
