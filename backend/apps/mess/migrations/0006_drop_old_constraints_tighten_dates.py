# Generated migration — Step 3 of 4
# Removes the three CheckConstraints on MessBooking that reference columns
# which are about to be deleted (total_persons, veg_persons, nonveg_persons).
# Also tightens start_date / end_date to NOT NULL now that 0005 has backfilled them,
# and adds the new start_lte_end constraint.
# Still no columns are deleted here.

from django.db import migrations, models
from django.db.models import F, Q


class Migration(migrations.Migration):

    dependencies = [
        ('mess', '0005_data_migrate_to_dailymessmenu'),
    ]

    operations = [
        # ── 1. Drop the three constraints referencing columns to be removed ───
        migrations.RemoveConstraint(
            model_name='messbooking',
            name='mess_booking_positive_total_persons',
        ),
        migrations.RemoveConstraint(
            model_name='messbooking',
            name='mess_booking_headcount_math_check',
        ),
        migrations.RemoveConstraint(
            model_name='messbooking',
            name='mess_booking_no_negative_meals',
        ),

        # ── 2. Tighten start_date / end_date: remove null=True now that 0005
        #       has populated every row ─────────────────────────────────────
        migrations.AlterField(
            model_name='messbooking',
            name='start_date',
            field=models.DateField(db_index=True),
        ),
        migrations.AlterField(
            model_name='messbooking',
            name='end_date',
            field=models.DateField(db_index=True),
        ),

        # ── 3. Add the new date-range integrity constraint ────────────────────
        migrations.AddConstraint(
            model_name='messbooking',
            constraint=models.CheckConstraint(
                condition=Q(start_date__lte=F('end_date')),
                name='mess_booking_start_lte_end',
            ),
        ),
    ]