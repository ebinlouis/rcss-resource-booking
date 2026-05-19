from rest_framework import serializers
from django.utils import timezone
from .models import RoleOverride, CustomUser, Department, Role


# ==========================================
# DEPARTMENT SERIALIZER
# ==========================================

class DepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Department
        fields = ['id', 'department_name', 'department_code']


# ==========================================
# ROLE OVERRIDE SERIALIZER
# ==========================================

class RoleOverrideSerializer(serializers.ModelSerializer):
    user_email     = serializers.EmailField(source='user.email', read_only=True)
    user_name      = serializers.CharField(source='user.first_name', read_only=True)
    role_name      = serializers.CharField(source='role.get_name_display', read_only=True)
    granted_by_name = serializers.CharField(source='granted_by.first_name', read_only=True)

    class Meta:
        model  = RoleOverride
        fields = [
            'id',
            'user', 'user_email', 'user_name',
            'role', 'role_name',
            'granted_by', 'granted_by_name',
            'space', 'block',
            'valid_from', 'valid_until',
            'reason',
            'is_active',
            'revoked_at', 'revoked_by',
            'created_at',
        ]
        read_only_fields = ['id', 'granted_by', 'created_at', 'is_active', 'revoked_at', 'revoked_by']

    def validate_valid_until(self, value):
        if value and value <= timezone.now():
            raise serializers.ValidationError("valid_until must be in the future.")
        return value

    def validate(self, data):
        if self.instance is None:  # creation only
            user = data.get('user')
            role = data.get('role')
            if RoleOverride.objects.filter(user=user, role=role, is_active=True).exists():
                raise serializers.ValidationError({
                    "user": f"This user already has an active override for the {role} role."
                })
        return data


# ==========================================
# USER & CAPABILITY SERIALIZER
# ==========================================

class CustomUserSerializer(serializers.ModelSerializer):
    department_code = serializers.CharField(
        source='department.department_code', read_only=True, default=None
    )
    effective_roles  = serializers.SerializerMethodField()
    capabilities     = serializers.SerializerMethodField()

    class Meta:
        model  = CustomUser
        fields = [
            'id', 'email', 'employee_student_id',
            'first_name', 'last_name',
            'is_superuser', 'department_code',
            'effective_roles', 'capabilities',
        ]

    def get_effective_roles(self, obj):
        """
        Returns the full list of role names the user currently holds,
        including active overrides. The frontend can use this for debugging
        or displaying role badges.
        """
        if obj.is_superuser:
            return [Role.Name.IT_ADMIN]
        return list(obj.get_effective_roles())

    def get_capabilities(self, obj):
        """
        Translates the user's effective role set into boolean capability flags.

        The frontend reads these flags to decide which UI sections to show.
        Role names never leak into the frontend — only these boolean flags do.
        Adding a new role means adding it to the relevant sets below, nowhere else.
        """
        if obj.is_superuser:
            return {
                "can_access_admin_portal":   True,
                "can_manage_system":         True,
                "can_manage_spaces":         True,
                "can_manage_labs":           True,
                "can_manage_mess":           False,
                "can_manage_media":          False,
                "can_manage_fleet":          True,
                "can_manage_principal_view": True,
            }

        roles = obj.get_effective_roles()

        # Roles that get access to the admin portal
        ADMIN_PORTAL_ROLES = {
            Role.Name.IT_ADMIN,
            Role.Name.HOD,
            Role.Name.RECEPTIONIST,
            Role.Name.LAB_INCHARGE,
            Role.Name.LIBRARIAN,
            Role.Name.MESS_MANAGER,
            Role.Name.MEDIA_INCHARGE,
            Role.Name.FLEET_MANAGER,
            Role.Name.PRINCIPAL,
        }

        # Roles that can approve/manage space-related bookings
        SPACE_MANAGEMENT_ROLES = {
            Role.Name.RECEPTIONIST,
            Role.Name.LAB_INCHARGE,
            Role.Name.LIBRARIAN,
            Role.Name.IT_ADMIN,
        }

        # Roles that can approve/manage lab bookings
        LAB_MANAGEMENT_ROLES = {
            Role.Name.LAB_INCHARGE,
            Role.Name.HOD,
            Role.Name.IT_ADMIN,
        }

        return {
            # Who sees the admin portal at all
            "can_access_admin_portal": bool(roles & ADMIN_PORTAL_ROLES),

            # IT_ADMIN only — user management, role grants, system config
            "can_manage_system": Role.Name.IT_ADMIN in roles,

            # Receptionist, Lab In-charge, Librarian, IT_ADMIN
            "can_manage_spaces": bool(roles & SPACE_MANAGEMENT_ROLES),

            # Lab In-charge, HOD, IT_ADMIN
            "can_manage_labs": bool(roles & LAB_MANAGEMENT_ROLES),

            # Mess Manager only (IT_ADMIN excluded per product decision)
            "can_manage_mess": Role.Name.MESS_MANAGER in roles,

            # Media In-charge only (IT_ADMIN excluded per product decision)
            "can_manage_media": Role.Name.MEDIA_INCHARGE in roles,

            # Fleet Manager only — parked until fleet module is built
            "can_manage_fleet": Role.Name.FLEET_MANAGER in roles,

            # Principal only — separate view: see all approved, cancel + rebook
            "can_manage_principal_view": Role.Name.PRINCIPAL in roles,
        }