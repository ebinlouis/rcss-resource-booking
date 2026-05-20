# apps/spaces/admin.py

from django.contrib import admin
from .models import Block, Space, SpaceBooking, Equipment, SpaceEquipment, EquipmentRequest, SpaceApprover


# ==========================================
# INLINE: Equipment built into a space
# ==========================================

class SpaceEquipmentInline(admin.TabularInline):
    model               = SpaceEquipment
    extra               = 1
    min_num             = 0
    fields              = ('equipment', 'quantity')
    autocomplete_fields = ['equipment']


# ==========================================
# BLOCK
# ==========================================

@admin.register(Block)
class BlockAdmin(admin.ModelAdmin):
    list_display  = ('name', 'code', 'description', 'is_active')
    list_filter   = ('is_active',)
    search_fields = ('name', 'code')
    list_editable = ('is_active',)
    fieldsets = (
        (None, {
            'fields': ('name', 'code', 'description', 'is_active')
        }),
    )


# ==========================================
# SPACE APPROVER
# ==========================================

@admin.register(SpaceApprover)
class SpaceApproverAdmin(admin.ModelAdmin):
    list_display   = ('user', 'role', 'scope_type', 'block', 'space', 'is_active')
    list_filter    = ('role', 'scope_type', 'is_active')
    search_fields  = ('user__email', 'user__first_name', 'block__name', 'space__name')
    list_editable  = ('is_active',)
    autocomplete_fields = ['user', 'space']
    fieldsets = (
        ('Assignment', {
            'fields': ('user', 'role', 'is_active')
        }),
        ('Scope', {
            'description': (
                'Set scope_type to BLOCK and fill in block, '
                'OR set scope_type to SPACE and fill in space. Never both.'
            ),
            'fields': ('scope_type', 'block', 'space'),
        }),
    )


# ==========================================
# SPACE
# ==========================================

@admin.register(Space)
class SpaceAdmin(admin.ModelAdmin):
    list_display  = ('name', 'location', 'block', 'space_type', 'approval_category', 'approval_workflow_type', 'capacity_hard', 'is_active', 'is_lab')
    list_filter   = ('space_type', 'approval_category', 'approval_workflow_type', 'is_active', 'is_lab', 'block')
    search_fields = ('name', 'description', 'location')
    list_editable = ('is_active',)
    inlines       = [SpaceEquipmentInline]
    fieldsets = (
        ('Identity', {
            'fields': ('name', 'description', 'location', 'space_type')
        }),
        ('Block & Approval Routing', {
            'description': (
                'block scopes RECEPTIONIST assignments. '
                'approval_category determines which role type approves bookings here. '
                'approval_workflow_type enables hierarchical approval for special spaces like the AI Lab.'
            ),
            'fields': ('block', 'approval_category', 'approval_workflow_type'),
        }),
        ('Capacity & Purpose', {
            'fields': ('capacity_hard', 'is_special_purpose', 'is_lab')
        }),
        ('Buffers', {
            'description': 'Minutes blocked before/after each booking for setup and teardown.',
            'fields': ('setup_buffer_minutes', 'teardown_buffer_minutes'),
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
    list_display  = ('name', 'category', 'total_owned', 'is_portable', 'is_standard_media_kit', 'is_active')
    list_filter   = ('category', 'is_portable', 'is_standard_media_kit', 'is_active')
    search_fields = ('name', 'description')
    list_editable = ('is_active',)


# ==========================================
# SPACE BOOKING
# ==========================================

@admin.register(SpaceBooking)
class SpaceBookingAdmin(admin.ModelAdmin):
    list_display    = ('reference_code', 'space', 'start_datetime', 'end_datetime', 'status', 'user')
    list_filter     = ('status', 'space')
    search_fields   = ('reference_code', 'purpose_of_booking')
    readonly_fields = (
        'reference_code', 'group_id', 'user', 'created_at', 'updated_at',
        'resolved_by', 'resolved_at',
    )
    fieldsets = (
        ('Booking Info', {
            'fields': ('reference_code', 'group_id', 'booking_type', 'user', 'department', 'space', 'status')
        }),
        ('Schedule', {
            'fields': ('start_datetime', 'end_datetime', 'attendee_count', 'purpose_of_booking', 'is_external')
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
