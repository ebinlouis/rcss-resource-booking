"""
Migration C — Drop legacy fields (run ONLY after verifying Migration B data)

STOP. Before running this migration:

    1. Run Migration B and check its output for any UNMAPPED GROUP warnings.
    2. Open Django shell and verify:

        from apps.users.models import CustomUser, Role
        # Every user that had a role FK should now have roles M2M populated
        users_with_role_fk  = CustomUser.objects.filter(role__isnull=False).count()
        users_with_roles_m2m = CustomUser.objects.filter(roles__isnull=False).distinct().count()
        print(users_with_role_fk, users_with_roles_m2m)
        # These numbers should match (or roles_m2m >= role_fk if some users had no group)

        from apps.users.models import RoleOverride
        # Every override should now have the new role FK populated
        nulls = RoleOverride.objects.filter(role__isnull=True).count()
        print(f"Overrides with null new role: {nulls}")  # should be 0

    3. Smoke test: log in as each role type and confirm approvals still work.

    4. Only then: python manage.py migrate users 0004_drop_legacy_role_fields

This migration is NOT reversible — once the legacy FK columns are dropped,
the old auth.Group role data is gone from this table.
The auth.Group rows themselves are untouched — Django admin still works.
"""

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0003_role_data_migration'),
    ]

    operations = [

        # ── 1. Drop legacy role FK from CustomUser ────────────────────────────
        migrations.RemoveField(
            model_name='customuser',
            name='role',
        ),

        # ── 2. Drop legacy overridden_role FK from RoleOverride ───────────────
        migrations.RemoveField(
            model_name='roleoverride',
            name='overridden_role',
        ),

        # ── 3. Drop old expires_at field from RoleOverride ────────────────────
        # Replaced by valid_until (added in Migration A, populated in Migration B).
        migrations.RemoveField(
            model_name='roleoverride',
            name='expires_at',
        ),

        # ── 4. Drop old is_active unique constraint ────────────────────────────
        # The old constraint was: unique_active_override (user, is_active=True)
        # i.e. only one active override per user.
        # The new constraint in models.py is: unique_active_override_per_user_role
        # i.e. one active override per user+role pair (allows multiple roles).
        # We need to remove the old constraint and add the new one.
        migrations.RemoveConstraint(
            model_name='roleoverride',
            name='unique_active_override',
        ),
        migrations.AddConstraint(
            model_name='roleoverride',
            constraint=models.UniqueConstraint(
                fields    = ['user', 'role'],
                condition = models.Q(is_active=True),
                name      = 'unique_active_override_per_user_role',
            ),
        ),

        # ── 5. Make RoleOverride.role non-nullable now that all rows have it ───
        migrations.AlterField(
            model_name='roleoverride',
            name='role',
            field=models.ForeignKey(
                help_text    = 'The role being granted additively.',
                on_delete    = django.db.models.deletion.PROTECT,
                related_name = 'overrides',
                to           = 'users.Role',
            ),
        ),
    ]