from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('spaces', '0004_space_description'),
    ]

    operations = [
        migrations.AddField(
            model_name='spacebooking',
            name='is_external',
            field=models.BooleanField(
                default=False,
                help_text='True when the event is organised by an external party. '
                          'External events receive higher priority in admin review.',
            ),
        ),
    ]