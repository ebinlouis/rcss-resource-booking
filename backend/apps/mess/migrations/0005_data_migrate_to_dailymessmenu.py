# Generated migration — Step 2 of 4
# CRITICAL DATA MIGRATION: Reads every existing MessBooking row and creates
# exactly one DailyMessMenu child row for it, preserving all meal and
# headcount data. Also backfills start_date / end_date from booking_date.
# This migration is entirely reversible.

from django.db import migrations


def forwards_migrate_single_day_bookings(apps, schema_editor):
    """
    For every existing MessBooking:
      1. Copy booking_date → start_date and end_date (single-day, so both equal).
      2. Create one DailyMessMenu row carrying all meal/headcount fields.
    """
    MessBooking   = apps.get_model('mess', 'MessBooking')
    DailyMessMenu = apps.get_model('mess', 'DailyMessMenu')

    daily_menus_to_create = []

    for booking in MessBooking.objects.all().iterator(chunk_size=200):
        # ── Backfill the new date range columns from the old single-day field ─
        booking.start_date = booking.booking_date
        booking.end_date   = booking.booking_date
        booking.save(update_fields=['start_date', 'end_date'])

        # ── Build the child row — carry every meal field across ───────────────
        daily_menus_to_create.append(
            DailyMessMenu(
                booking              = booking,
                date                 = booking.booking_date,

                # Headcount
                total_persons        = booking.total_persons,
                veg_persons          = booking.veg_persons,
                nonveg_persons       = booking.nonveg_persons,

                # Breakfast (null if not required on the old record)
                breakfast_time       = booking.breakfast_time  if booking.breakfast_required  else None,
                breakfast_menu       = booking.breakfast_menu  if booking.breakfast_required  else None,

                # Morning tea/snacks
                morning_tea_time     = booking.morning_tea_time     if booking.morning_tea_required  else None,
                morning_snack_option = booking.morning_snack_option if booking.morning_tea_required  else None,

                # Lunch
                lunch_time           = booking.lunch_time  if booking.lunch_required  else None,
                lunch_menu           = booking.lunch_menu  if booking.lunch_required  else None,

                # Evening tea/snacks
                evening_tea_time     = booking.evening_tea_time     if booking.evening_tea_required  else None,
                evening_snack_option = booking.evening_snack_option if booking.evening_tea_required  else None,

                # Dinner
                dinner_time          = booking.dinner_time  if booking.dinner_required  else None,
                dinner_menu          = booking.dinner_menu  if booking.dinner_required  else None,

                # Kitchen has not been re-notified after migration
                notified_kitchen     = False,
            )
        )

    # Bulk-insert for efficiency; safe because PKs are auto-assigned
    DailyMessMenu.objects.bulk_create(daily_menus_to_create, batch_size=200)

    print(f"\n  [0005] Migrated {len(daily_menus_to_create)} booking(s) → DailyMessMenu rows.")


def backwards_delete_migrated_rows(apps, schema_editor):
    """
    Reverse: delete all DailyMessMenu rows whose booking has a non-null
    start_date (i.e. rows we created in the forward pass). Also clears
    the backfilled start_date / end_date columns.
    """
    MessBooking   = apps.get_model('mess', 'MessBooking')
    DailyMessMenu = apps.get_model('mess', 'DailyMessMenu')

    DailyMessMenu.objects.filter(booking__start_date__isnull=False).delete()

    MessBooking.objects.update(start_date=None, end_date=None)


class Migration(migrations.Migration):

    dependencies = [
        ('mess', '0004_add_dailymessmenu'),
    ]

    operations = [
        migrations.RunPython(
            forwards_migrate_single_day_bookings,
            reverse_code=backwards_delete_migrated_rows,
        ),
    ]