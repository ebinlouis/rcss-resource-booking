from django.contrib import admin
from .models import Space, SpaceBooking, Equipment, SpaceEquipment, EquipmentRequest


# ==========================================
# INLINE: Equipment built into a space
# ==========================================
class SpaceEquipmentInline(admin.TabularInline):
    model      = SpaceEquipment
    extra      = 1
    min_num    = 0
    fields     = ('equipment', 'quantity')
    autocomplete_fields = ['equipment']


# ==========================================
# SPACE
# ==========================================
@admin.register(Space)
class SpaceAdmin(admin.ModelAdmin):
    list_display   = ('name', 'location', 'space_type', 'capacity_hard', 'is_active')
    list_filter    = ('space_type', 'is_active')
    search_fields  = ('name', 'description', 'location')
    list_editable  = ('is_active',)
    inlines        = [SpaceEquipmentInline]
    fieldsets = (
        (None, {
            'fields': ('name', 'description', 'space_type', 'location', 'capacity_hard')
        }),
        ('Media & Status', {
            'fields': ('image_1', 'is_active')
        }),
    )


# ==========================================
# EQUIPMENT
# ==========================================
@admin.register(Equipment)
class EquipmentAdmin(admin.ModelAdmin):
    list_display  = ('name', 'category', 'total_owned', 'is_portable', 'is_active')
    list_filter   = ('category', 'is_portable', 'is_active')
    search_fields = ('name', 'description')
    list_editable = ('is_active',)


# ==========================================
# SPACE BOOKING
# ==========================================
@admin.register(SpaceBooking)
class SpaceBookingAdmin(admin.ModelAdmin):
    list_display   = ('reference_code', 'space', 'start_datetime', 'end_datetime', 'status', 'user')
    list_filter    = ('status', 'space')
    search_fields  = ('reference_code', 'purpose_of_booking')
    readonly_fields = (
        'reference_code', 'user', 'created_at', 'updated_at',
        'resolved_by', 'resolved_at',
    )
    fieldsets = (
        ('Booking Info', {
            'fields': ('reference_code', 'user', 'department', 'space', 'status')
        }),
        ('Schedule', {
            'fields': ('start_datetime', 'end_datetime', 'attendee_count', 'purpose_of_booking')
        }),
        ('Notes & Review', {
            'fields': ('user_notes', 'remarks_by_admin', 'resolved_by', 'resolved_at')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',),
        }),
    )


# ==========================================
# EQUIPMENT REQUEST
# ==========================================
@admin.register(EquipmentRequest)
class EquipmentRequestAdmin(admin.ModelAdmin):
    list_display  = ('space_booking', 'equipment', 'quantity', 'is_delivered', 'is_returned')
    list_filter   = ('is_delivered', 'is_returned')
    search_fields = ('space_booking__reference_code', 'equipment__name')
    list_editable = ('is_delivered', 'is_returned')