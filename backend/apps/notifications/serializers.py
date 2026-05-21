from rest_framework import serializers

from apps.notifications.models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    category_display = serializers.CharField(source='get_category_display', read_only=True)

    class Meta:
        model  = Notification
        fields = [
            'id',
            'category',
            'category_display',
            'title',
            'message',
            'link',
            'domain',
            'reference_code',
            'is_read',
            'is_actionable',
            'read_at',
            'created_at',
        ]
        read_only_fields = fields
