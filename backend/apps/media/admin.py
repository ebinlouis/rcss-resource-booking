from django.contrib import admin
from apps.media.models import MediaBooking


@admin.register(MediaBooking)
class MediaBookingAdmin(admin.ModelAdmin):
    list_display  = ('reference_code', 'event_name', 'booking_date', 'status', 'created_at')
    search_fields = ('reference_code', 'event_name')
    list_filter   = ('status', 'booking_date')
