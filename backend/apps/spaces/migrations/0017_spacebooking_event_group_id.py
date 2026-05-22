from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('spaces', '0016_delete_spaceavailabilitywindow'),
    ]

    operations = [
        migrations.AddField(
            model_name='spacebooking',
            name='event_group_id',
            field=models.UUIDField(blank=True, db_index=True, null=True),
        ),
    ]
