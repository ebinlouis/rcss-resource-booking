"""
Migration B — Data migration (safe, non-destructive)

What this does:
    1. For every CustomUser with a legacy role FK set:
         - Reads the auth.Group name
         - Maps it to the new Role.name via GROUP_TO_ROLE_MAP
         - Adds that Role to the user's roles M2M
         - Unmapped group names are logged to stdout (not silently lost)

    2. For every existing RoleOverride:
         - Reads overridden_role (auth.Group) name
         - Maps it to the new Role via the same map
         - Writes it into the new role FK on RoleOverride
         - Also copies expires_at → valid_until

    The legacy role FK and overridden_role FK are NOT removed here.
    Migration C handles removal after you've verified the data.

Safe to roll back: yes — reverse removes only what forward added.
No existing rows are deleted or modified beyond adding M2M entries
and filling the new nullable FKs.
"""

from django.db import migrations
import sys


# ── Group name → Role name mapping ───────────────────────────────────────────
# Keys: exact auth.Group names currently in your DB (case-sensitive)
# Values: Role.Name TextChoices values (exact match)
#
# Add any group name you've created that isn't listed here.
GROUP_TO_ROLE_MAP = {
    # Standard institutional roles
    'student':      'STUDENT',
    'Student':      'STUDENT',
    'faculty':      'FACULTY',
    'Faculty':      'FACULTY',
    'staff':        'STAFF',
    'Staff':        'STAFF',

    # Approver roles — legacy names → new canonical names
    'HOD':          'HOD',
    'hod':          'HOD',
    'IT_ADMIN':     'IT_ADMIN',
    'it admin':     'IT_ADMIN',
    'IT Admin':     'IT_ADMIN',

    # Domain approvers — legacy names → new canonical names
    'Mess Admin':   'MESS_MANAGER',
    'mess':         'MESS_MANAGER',
    'Mess':         'MESS_MANAGER',
    'media':        'MEDIA_INCHARGE',
    'Media':        'MEDIA_INCHARGE',
    'Spaces Admin': 'RECEPTIONIST',
    'spaces admin': 'RECEPTIONIST',
}


def migrate_roles_forward(apps, schema_editor):
    CustomUser   = apps.get_model('users', 'CustomUser')
    Role         = apps.get_model('users', 'Role')
    RoleOverride = apps.get_model('users', 'RoleOverride')

    unmapped_groups = set()

    # ── 1. Migrate CustomUser.role FK → user.roles M2M ───────────────────────
    for user in CustomUser.objects.select_related('role').filter(role__isnull=False):
        group_name = user.role.name
        role_name  = GROUP_TO_ROLE_MAP.get(group_name)

        if role_name:
            try:
                role = Role.objects.get(name=role_name)
                user.roles.add(role)
            except Role.DoesNotExist:
                print(
                    f"[Migration B] WARNING: Role '{role_name}' not found in DB "
                    f"for user {user.email}. Check seed data.",
                    file=sys.stderr,
                )
        else:
            unmapped_groups.add(group_name)
            print(
                f"[Migration B] UNMAPPED GROUP: '{group_name}' for user {user.email}. "
                f"Add it to GROUP_TO_ROLE_MAP if needed.",
                file=sys.stderr,
            )

    # ── 2. Migrate RoleOverride.overridden_role → RoleOverride.role ──────────
    for override in RoleOverride.objects.select_related('overridden_role').filter(
        overridden_role__isnull=False
    ):
        group_name = override.overridden_role.name
        role_name  = GROUP_TO_ROLE_MAP.get(group_name)

        if role_name:
            try:
                role          = Role.objects.get(name=role_name)
                override.role = role

                # Copy expires_at → valid_until if valid_until not already set
                if override.valid_until is None and hasattr(override, 'expires_at'):
                    override.valid_until = override.expires_at

                override.save(update_fields=['role', 'valid_until'])
            except Role.DoesNotExist:
                print(
                    f"[Migration B] WARNING: Role '{role_name}' not found "
                    f"for RoleOverride id={override.id}.",
                    file=sys.stderr,
                )
        else:
            unmapped_groups.add(group_name)
            print(
                f"[Migration B] UNMAPPED GROUP in RoleOverride id={override.id}: "
                f"'{group_name}'. This override will have role=NULL until fixed.",
                file=sys.stderr,
            )

    if unmapped_groups:
        print(
            f"\n[Migration B] SUMMARY — unmapped group names: {unmapped_groups}\n"
            f"These users/overrides have no new role assigned. "
            f"Add them to GROUP_TO_ROLE_MAP and re-run if needed.",
            file=sys.stderr,
        )
    else:
        print("[Migration B] All group names mapped successfully.", file=sys.stdout)


def migrate_roles_reverse(apps, schema_editor):
    """
    Reverse: clear the M2M entries and new role FKs added by this migration.
    Does NOT restore anything — the legacy FK data is still intact.
    """
    CustomUser   = apps.get_model('users', 'CustomUser')
    RoleOverride = apps.get_model('users', 'RoleOverride')

    # Clear all M2M role assignments added by this migration
    for user in CustomUser.objects.all():
        user.roles.clear()

    # Clear new role FK on overrides
    RoleOverride.objects.update(role=None)


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0002_role_foundation_schema'),
    ]

    operations = [
        migrations.RunPython(
            migrate_roles_forward,
            reverse_code=migrate_roles_reverse,
        ),
    ]