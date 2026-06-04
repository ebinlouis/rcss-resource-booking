from django.db import migrations


def seed_general_hall_and_lab(apps, schema_editor):
    SpaceCategoryAffinity = apps.get_model('spaces', 'SpaceCategoryAffinity')
    affinities = [
        ('GENERAL_HALL', ['GENERAL_HALL']),
        ('LAB', ['LAB']),
    ]
    for from_cat, allowed in affinities:
        SpaceCategoryAffinity.objects.get_or_create(
            from_category=from_cat,
            defaults={'allowed_categories': allowed}
        )


def reverse_seed(apps, schema_editor):
    pass  # safe to leave rows on rollback


class Migration(migrations.Migration):

    dependencies = [
        ('spaces', '0026_faculty_timed_out'),
    ]

    operations = [
        migrations.RunPython(seed_general_hall_and_lab, reverse_seed),
    ]
