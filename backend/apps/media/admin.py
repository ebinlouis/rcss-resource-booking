from django.contrib import admin
from apps.media.models import MediaBooking, MediaSettings, MediaEquipmentRequest


# ==========================================
# EQUIPMENT REQUEST INLINE
# ==========================================

class MediaEquipmentRequestInline(admin.TabularInline):
    model = MediaEquipmentRequest
    extra = 0


# ==========================================
# MEDIA SETTINGS (Singleton)
# ==========================================

@admin.register(MediaSettings)
class MediaSettingsAdmin(admin.ModelAdmin):
    # max_concurrent_events removed — capacity is now crew-driven
    list_display = ('id', 'updated_at')

    def has_add_permission(self, request):
        return not MediaSettings.objects.exists()


# ==========================================
# MEDIA BOOKING
# ==========================================

@admin.register(MediaBooking)
class MediaBookingAdmin(admin.ModelAdmin):
    list_display  = ('reference_code', 'event_name', 'event_start_datetime', 'is_team_request', 'status', 'created_at')
    search_fields = ('reference_code', 'event_name')
    list_filter   = ('status', 'is_team_request', 'event_start_datetime')
    filter_horizontal = ('assigned_crew',)  # makes M2M crew selection usable in admin
    inlines       = [MediaEquipmentRequestInline]


# ==========================================
# MEDIA EQUIPMENT REQUEST (Standalone)
# ==========================================

@admin.register(MediaEquipmentRequest)
class MediaEquipmentRequestAdmin(admin.ModelAdmin):
    list_display  = ('media_booking', 'equipment', 'quantity')
    search_fields = ('media_booking__reference_code', 'equipment__name')