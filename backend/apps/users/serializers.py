from rest_framework import serializers
from django.utils import timezone
from django.db.models import Q
from django.contrib.auth.models import Group
from .models import RoleOverride, CustomUser

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
        # When creating a new override, ensure the user doesn't already have an active one.
        # Your DB Q-constraint catches this, but doing it here provides a clean 400 API error.
        if self.instance is None:  # Only check on creation
            user = data.get('user')
            if RoleOverride.objects.filter(user=user, is_active=True).exists():
                raise serializers.ValidationError({"user": "This user already has an active role override."})
        return data