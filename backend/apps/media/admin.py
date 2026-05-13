from django.contrib import admin
from apps.media.models import MediaBooking, MediaSettings, MediaEquipmentRequest

# ==========================================
# 1. EQUIPMENT REQUEST INLINE (For Bookings)
# ==========================================
class MediaEquipmentRequestInline(admin.TabularInline):
    model = MediaEquipmentRequest
    extra = 0  # Set to 0 so it only shows gear actually requested, no blank rows

# ==========================================
# MEDIA SETTINGS (Singleton)
# ==========================================
@admin.register(MediaSettings)
class MediaSettingsAdmin(admin.ModelAdmin):
    list_display = ('id', 'max_concurrent_events', 'updated_at')

    def has_add_permission(self, request):
        # Prevents creating a second settings row if one already exists
        return not MediaSettings.objects.exists()

# ==========================================
# MEDIA BOOKING
# ==========================================
@admin.register(MediaBooking)
class MediaBookingAdmin(admin.ModelAdmin):
    list_display  = ('reference_code', 'event_name', 'booking_date', 'is_team_request', 'status', 'created_at')
    search_fields = ('reference_code', 'event_name')
    list_filter   = ('status', 'is_team_request', 'booking_date')
    
    # NEW: This embeds the equipment list directly inside the booking page!
    inlines = [MediaEquipmentRequestInline]

# ==========================================
# MEDIA EQUIPMENT REQUEST (Standalone List)
# ==========================================
@admin.register(MediaEquipmentRequest)
class MediaEquipmentRequestAdmin(admin.ModelAdmin):
    list_display = ('media_booking', 'equipment', 'quantity')
    search_fields = ('media_booking__reference_code', 'equipment__name')