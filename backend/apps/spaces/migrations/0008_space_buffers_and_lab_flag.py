from django.db import migrations, models


class Migration(migrations.Migration):
    """
    Adds three new fields to the Space model:
        - setup_buffer_minutes    (IntegerField, default=0)
        - teardown_buffer_minutes (IntegerField, default=0)
        - is_lab                  (BooleanField, default=False)

    No changes to SpaceBooking — multi-day bookings are supported by the
    existing start_datetime / end_datetime fields without schema changes.
    The ExclusionConstraint already handles overlap detection for any range.
    """

    dependencies = [
        ('spaces', '0007_equipment_is_standard_media_kit'),  
    ]

    operations = [
        migrations.AddField(
            model_name='space',
            name='setup_buffer_minutes',
            field=models.IntegerField(
                default=0,
                help_text='Minutes blocked before a booking starts (setup/cleaning).'
            ),
        ),
        migrations.AddField(
            model_name='space',
            name='teardown_buffer_minutes',
            field=models.IntegerField(
                default=0,
                help_text='Minutes blocked after a booking ends (teardown/cleaning).'
            ),
        ),
        migrations.AddField(
            model_name='space',
            name='is_lab',
            field=models.BooleanField(
                default=False,
                help_text='Enables lab-specific features: timetable upload, lab admin role.'
            ),
        ),
    ]