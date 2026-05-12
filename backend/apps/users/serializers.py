from rest_framework import serializers
from django.utils import timezone
from django.db.models import Q
from django.contrib.auth.models import Group
from .models import RoleOverride, CustomUser, Department

# ==========================================
# DEPARTMENT SERIALIZER
# ==========================================
class DepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = ['id', 'department_name', 'department_code']


# ==========================================
# ROLE OVERRIDE SERIALIZER
# ==========================================
class RoleOverrideSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source='user.email', read_only=True)
    user_name = serializers.CharField(source='user.first_name', read_only=True)
    role_name = serializers.CharField(source='overridden_role.name', read_only=True)
    granted_by_name = serializers.CharField(source='granted_by.first_name', read_only=True)

    class Meta:
        model = RoleOverride
        fields = [
            'id', 'user', 'user_email', 'user_name', 
            'overridden_role', 'role_name', 
            'granted_by', 'granted_by_name', 
            'is_active', 'created_at', 'expires_at'
        ]
        read_only_fields = ['id', 'granted_by', 'created_at', 'is_active']

    def validate_expires_at(self, value):
        if value and value <= timezone.now():
            raise serializers.ValidationError("Expiration time must be in the future.")
        return value

    def validate(self, data):
        if self.instance is None:  # Only check on creation
            user = data.get('user')
            if RoleOverride.objects.filter(user=user, is_active=True).exists():
                raise serializers.ValidationError({"user": "This user already has an active role override."})
        return data


# ==========================================
# USER & CAPABILITY SERIALIZER (CBAC)
# ==========================================
class CustomUserSerializer(serializers.ModelSerializer):
    department_code = serializers.CharField(source='department.department_code', read_only=True, default=None)
    effective_role = serializers.SerializerMethodField()
    capabilities = serializers.SerializerMethodField()

    class Meta:
        model = CustomUser
        fields = [
            'id', 'email', 'employee_student_id', 'first_name', 'last_name',
            'is_superuser', 'department_code', 'effective_role', 'capabilities'
        ]

    def _get_effective_group(self, obj):
        """
        Helper method to determine the user's actual role.
        Checks for an active override first, falls back to their base role.
        """
        active_override = obj.role_overrides.filter(is_active=True).first()
        if active_override:
            return active_override.overridden_role
        return obj.role

    def get_effective_role(self, obj):
        group = self._get_effective_group(obj)
        return group.name if group else "Standard User"

    def get_capabilities(self, obj):
        """
        Translates the user's effective role into boolean capabilities for the frontend.
        This removes the need to hardcode group names in React.
        """
        # Superusers automatically receive full clearance
        if obj.is_superuser:
            return {
                "can_access_admin_portal": True,
                "can_manage_system": True,
                "can_manage_spaces": True,
                "can_manage_equipment": True,
                "can_manage_mess": True,
            }

        group = self._get_effective_group(obj)
        group_name = group.name if group else ""

        # Map actual group names to specific capabilities. 
        # If HR renames a role, you only change it here in the backend.
        return {
            "can_access_admin_portal": group_name in ["IT_ADMIN", "HOD", "Mess Admin", "Spaces Admin"],
            "can_manage_system": group_name in ["IT_ADMIN"],
            "can_manage_spaces": group_name in ["IT_ADMIN", "Spaces Admin", "HOD"],
            "can_manage_equipment": group_name in ["IT_ADMIN", "HOD"],
            "can_manage_mess": group_name in ["IT_ADMIN", "Mess Admin"],
        }