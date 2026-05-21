from django.contrib import admin

from apps.notifications.models import Notification


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ('recipient', 'category', 'title', 'is_read', 'created_at')
    list_filter = ('category', 'is_read', 'created_at')
    search_fields = ('recipient__email', 'recipient__first_name', 'title', 'message')
    readonly_fields = ('created_at', 'read_at')
