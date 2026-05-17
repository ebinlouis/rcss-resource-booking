# Generated migration — Step 4 of 4
# DESTRUCTIVE: Removes all single-day columns from MessBooking that now live
# in DailyMessMenu. Only run this after verifying 0005 migrated all rows
# correctly (row count check described in the migration walkthrough).

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('mess', '0006_drop_old_constraints_tighten_dates'),
    ]

    operations = [
        # ── Headcount columns (now on DailyMessMenu) ─────────────────────────
        migrations.RemoveField(model_name='messbooking', name='total_persons'),
        migrations.RemoveField(model_name='messbooking', name='veg_persons'),
        migrations.RemoveField(model_name='messbooking', name='nonveg_persons'),

        # ── Old single booking_date (replaced by start_date / end_date) ──────
        migrations.RemoveField(model_name='messbooking', name='booking_date'),

        # ── Breakfast ─────────────────────────────────────────────────────────
        migrations.RemoveField(model_name='messbooking', name='breakfast_required'),
        migrations.RemoveField(model_name='messbooking', name='breakfast_time'),
        migrations.RemoveField(model_name='messbooking', name='breakfast_menu'),

        # ── Morning tea ───────────────────────────────────────────────────────
        migrations.RemoveField(model_name='messbooking', name='morning_tea_required'),
        migrations.RemoveField(model_name='messbooking', name='morning_tea_time'),
        migrations.RemoveField(model_name='messbooking', name='morning_snack_option'),

        # ── Lunch ─────────────────────────────────────────────────────────────
        migrations.RemoveField(model_name='messbooking', name='lunch_required'),
        migrations.RemoveField(model_name='messbooking', name='lunch_time'),
        migrations.RemoveField(model_name='messbooking', name='lunch_menu'),

        # ── Evening tea ───────────────────────────────────────────────────────
        migrations.RemoveField(model_name='messbooking', name='evening_tea_required'),
        migrations.RemoveField(model_name='messbooking', name='evening_tea_time'),
        migrations.RemoveField(model_name='messbooking', name='evening_snack_option'),

        # ── Dinner ────────────────────────────────────────────────────────────
        migrations.RemoveField(model_name='messbooking', name='dinner_required'),
        migrations.RemoveField(model_name='messbooking', name='dinner_time'),
        migrations.RemoveField(model_name='messbooking', name='dinner_menu'),
    ]