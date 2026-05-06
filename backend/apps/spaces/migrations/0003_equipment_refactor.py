from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('spaces', '0002_equipment_remove_spacebooking_requested_equipment_and_more'),
    ]

    operations = [
        # 1. Add new fields
        migrations.AddField(
            model_name='equipment',
            name='description',
            field=models.TextField(blank=True, default=''),
        ),
        migrations.AddField(
            model_name='equipment',
            name='is_portable',
            field=models.BooleanField(default=True, help_text='False for fixed/built-in items like ceiling projectors'),
        ),

        # 2. Update category choices to match frontend
        migrations.AlterField(
            model_name='equipment',
            name='category',
            field=models.CharField(
                max_length=20,
                choices=[
                    ('AV',         'Audio / Visual'),
                    ('LIGHTING',   'Lighting'),
                    ('FURNITURE',  'Furniture'),
                    ('COMPUTING',  'Computing'),
                    ('NETWORKING', 'Networking'),
                    ('OTHER',      'Other'),
                ],
            ),
        ),

        # 3. Remove fields we no longer need
        migrations.RemoveField(
            model_name='equipment',
            name='total_functional',
        ),
        migrations.RemoveField(
            model_name='equipment',
            name='is_returnable',
        ),
    ]