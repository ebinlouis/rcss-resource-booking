from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('media', '0011_alter_mediabooking_status'),
    ]

    operations = [
        migrations.AddField(
            model_name='mediabooking',
            name='event_group_id',
            field=models.UUIDField(blank=True, db_index=True, null=True),
        ),
    ]
