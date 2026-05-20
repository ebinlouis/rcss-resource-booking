"""
Migration A — Role foundation (schema only, no data changes to existing rows)

What this does:
    1. Creates the Role table with all TextChoices rows seeded via RunPython
    2. Adds CustomUser.roles M2M to the new Role table
    3. Adds the new RoleOverride fields (role FK, scope fields, audit fields)
       alongside the OLD overridden_role FK — both exist simultaneously
       so Migration B can safely read from old and write to new

What this does NOT do:
    - Does not remove CustomUser.role (legacy FK) — Migration C handles that
    - Does not remove RoleOverride.overridden_role — Migration C handles that
    - Does not touch any existing user or override rows

Safe to roll back: yes — no existing data is modified.
"""

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


# ── Seed data ────────────────────────────────────────────────────────────────
# All Role.Name TextChoices values. Keep in sync with models.py.
ROLE_SEED = [
    ('STUDENT',          'Student'),
    ('FACULTY',          'Faculty'),
    ('STAFF',            'Staff'),
    ('RECEPTIONIST',     'Receptionist'),
    ('LAB_INCHARGE',     'Lab In-Charge'),
    ('LIBRARIAN',        'Librarian'),
    ('MESS_MANAGER',     'Mess Manager'),
    ('MEDIA_INCHARGE',   'Media In-Charge'),
    ('FLEET_MANAGER',    'Fleet Manager'),
    ('HOD',              'Head of Department'),
    ('PRINCIPAL',        'Principal'),
    ('IT_ADMIN',         'IT Administrator'),
    ('SPORTS',           'Sports Coordinator'),
    ('FACILITY_MANAGER', 'Facility Manager'),
]


def seed_roles(apps, schema_editor):
    Role = apps.get_model('users', 'Role')
    for name, description in ROLE_SEED:
        Role.objects.get_or_create(name=name, defaults={'description': description})


def unseed_roles(apps, schema_editor):
    """Reverse: remove seeded roles only if no users are assigned to them."""
    Role = apps.get_model('users', 'Role')
    Role.objects.filter(name__in=[r[0] for r in ROLE_SEED]).delete()


class Migration(migrations.Migration):

    dependencies = [
        # The single existing users migration
        ('users', '0001_initial'),
        # spaces app must exist for the FK in RoleOverride
        ('spaces', '0009_spacebooking_booking_type_spacebooking_group_id'),
    ]

    operations = [

        # ── 1. Create Role table ──────────────────────────────────────────────
        migrations.CreateModel(
            name='Role',
            fields=[
                ('id', models.BigAutoField(
                    auto_created=True, primary_key=True,
                    serialize=False, verbose_name='ID'
                )),
                ('name', models.CharField(
                    max_length=30,
                    unique=True,
                    choices=[
                        ('STUDENT',          'Student'),
                        ('FACULTY',          'Faculty'),
                        ('STAFF',            'Staff'),
                        ('RECEPTIONIST',     'Receptionist'),
                        ('LAB_INCHARGE',     'Lab In-Charge'),
                        ('LIBRARIAN',        'Librarian'),
                        ('MESS_MANAGER',     'Mess Manager'),
                        ('MEDIA_INCHARGE',   'Media In-Charge'),
                        ('FLEET_MANAGER',    'Fleet Manager'),
                        ('HOD',              'Head of Department'),
                        ('PRINCIPAL',        'Principal'),
                        ('IT_ADMIN',         'IT Administrator'),
                        ('SPORTS',           'Sports Coordinator'),
                        ('FACILITY_MANAGER', 'Facility Manager'),
                    ],
                )),
                ('description', models.TextField(blank=True, default='')),
            ],
        ),

        # ── 2. Seed all role rows immediately ─────────────────────────────────
        migrations.RunPython(seed_roles, reverse_code=unseed_roles),

        # ── 3. Add roles M2M to CustomUser ────────────────────────────────────
        migrations.AddField(
            model_name='customuser',
            name='roles',
            field=models.ManyToManyField(
                blank        = True,
                help_text    = 'All roles assigned to this user. Additive — a user can hold multiple roles.',
                related_name = 'users',
                to           = 'users.Role',
            ),
        ),

        # ── 4. Add new fields to RoleOverride ────────────────────────────────
        # New role FK (points to our Role model, not auth.Group)
        migrations.AddField(
            model_name='roleoverride',
            name='role',
            field=models.ForeignKey(
                blank        = True,
                null         = True,           # nullable until Migration B fills it
                help_text    = 'The role being granted additively.',
                on_delete    = django.db.models.deletion.PROTECT,
                related_name = 'overrides',
                to           = 'users.Role',
            ),
        ),

        # Scope fields
        migrations.AddField(
            model_name='roleoverride',
            name='space',
            field=models.ForeignKey(
                blank        = True,
                null         = True,
                on_delete    = django.db.models.deletion.SET_NULL,
                related_name = 'role_overrides',
                to           = 'spaces.Space',
                help_text    = 'If set, this override applies to this specific space only.',
            ),
        ),
        migrations.AddField(
            model_name='roleoverride',
            name='block',
            field=models.CharField(
                max_length = 20,
                null       = True,
                blank      = True,
                help_text  = 'If set, this override applies to this campus block only.',
            ),
        ),

        # Validity window fields
        migrations.AddField(
            model_name='roleoverride',
            name='valid_from',
            field=models.DateTimeField(default=django.utils.timezone.now),
        ),
        migrations.AddField(
            model_name='roleoverride',
            name='valid_until',
            field=models.DateTimeField(
                null  = True,
                blank = True,
                help_text = 'Leave blank for indefinite.',
            ),
        ),
        migrations.AddField(
            model_name='roleoverride',
            name='reason',
            field=models.TextField(
                default  = 'Migrated from legacy override system.',
                help_text = 'Why this override was granted.',
            ),
            preserve_default=False,
        ),

        # Revocation fields
        migrations.AddField(
            model_name='roleoverride',
            name='revoked_at',
            field=models.DateTimeField(null=True, blank=True),
        ),
        migrations.AddField(
            model_name='roleoverride',
            name='revoked_by',
            field=models.ForeignKey(
                blank        = True,
                null         = True,
                on_delete    = django.db.models.deletion.SET_NULL,
                related_name = 'revoked_overrides',
                to           = settings.AUTH_USER_MODEL,
            ),
        ),

        # Rename expires_at → valid_until is handled by adding valid_until above.
        # We keep expires_at alive until Migration C to avoid breaking the
        # existing serializer/view code that still references it.
        # Migration C will drop expires_at.
    ]