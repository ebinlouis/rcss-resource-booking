# Generated migration — Step 1 of 4
# SAFE: Only creates the new DailyMessMenu table.
# Nothing is deleted. All existing data is untouched.

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('mess', '0003_messbooking_rejection_remark'),
    ]

    operations = [
        # ── 1. Add start_date / end_date to parent (keep booking_date for now) ──
        migrations.AddField(
            model_name='messbooking',
            name='start_date',
            field=models.DateField(db_index=True, null=True, blank=True),
        ),
        migrations.AddField(
            model_name='messbooking',
            name='end_date',
            field=models.DateField(db_index=True, null=True, blank=True),
        ),

        # ── 2. Create the DailyMessMenu child table ───────────────────────────
        migrations.CreateModel(
            name='DailyMessMenu',
            fields=[
                ('id',                   models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('booking',              models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='daily_menus', to='mess.messbooking')),
                ('date',                 models.DateField(db_index=True)),
                ('total_persons',        models.IntegerField()),
                ('veg_persons',          models.IntegerField(default=0)),
                ('nonveg_persons',       models.IntegerField(default=0)),
                ('breakfast_time',       models.TimeField(blank=True, null=True)),
                ('breakfast_menu',       models.TextField(blank=True, null=True)),
                ('morning_tea_time',     models.TimeField(blank=True, null=True)),
                ('morning_snack_option', models.TextField(blank=True, null=True)),
                ('lunch_time',           models.TimeField(blank=True, null=True)),
                ('lunch_menu',           models.TextField(blank=True, null=True)),
                ('evening_tea_time',     models.TimeField(blank=True, null=True)),
                ('evening_snack_option', models.TextField(blank=True, null=True)),
                ('dinner_time',          models.TimeField(blank=True, null=True)),
                ('dinner_menu',          models.TextField(blank=True, null=True)),
                ('notified_kitchen',     models.BooleanField(default=False)),
            ],
            options={
                'ordering': ['date'],
            },
        ),

        # ── 3. Add constraints to DailyMessMenu ───────────────────────────────
        migrations.AddConstraint(
            model_name='dailymessmenu',
            constraint=models.UniqueConstraint(
                fields=['booking', 'date'],
                name='unique_daily_menu_per_booking_date',
            ),
        ),
        migrations.AddConstraint(
            model_name='dailymessmenu',
            constraint=models.CheckConstraint(
                condition=models.Q(total_persons__gt=0),
                name='daily_menu_positive_total_persons',
            ),
        ),
        migrations.AddConstraint(
            model_name='dailymessmenu',
            constraint=models.CheckConstraint(
                condition=models.Q(total_persons=models.F('veg_persons') + models.F('nonveg_persons')),
                name='daily_menu_headcount_math_check',
            ),
        ),
        migrations.AddConstraint(
            model_name='dailymessmenu',
            constraint=models.CheckConstraint(
                condition=models.Q(veg_persons__gte=0) & models.Q(nonveg_persons__gte=0),
                name='daily_menu_no_negative_meals',
            ),
        ),
    ]