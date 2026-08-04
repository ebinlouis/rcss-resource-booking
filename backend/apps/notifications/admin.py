from django.contrib import admin

from apps.notifications.models import Notification, NotificationOutbox


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ('recipient', 'category', 'title', 'email_dispatch_status', 'is_read', 'created_at')
    list_filter = ('category', 'email_dispatch_status', 'is_read', 'created_at')
    search_fields = ('recipient__email', 'recipient__first_name', 'title', 'message')
    readonly_fields = (
        'created_at', 'read_at', 'email_dispatch_status',
        'email_dispatch_attempts', 'email_queued_at',
    )


@admin.register(NotificationOutbox)
class NotificationOutboxAdmin(admin.ModelAdmin):
    list_display = (
        'id', 'event_type', 'status', 'attempts', 'max_attempts',
        'created_at', 'last_attempted_at', 'sent_at',
    )
    list_filter = ('status', 'event_type', 'created_at')
    search_fields = ('event_type', 'payload', 'last_error')
    readonly_fields = (
        'event_type', 'payload', 'attempts', 'max_attempts', 'last_error',
        'created_at', 'last_attempted_at', 'next_attempt_at', 'sent_at',
    )
