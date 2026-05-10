from django.contrib import admin
from apps.fleet.models import Vehicle, FleetBooking


# ==========================================
# VEHICLE ADMIN
# ==========================================
@admin.register(Vehicle)
class VehicleAdmin(admin.ModelAdmin):
    list_display = ('name', 'registration_number', 'capacity', 'is_active', 'created_at')
    list_filter = ('is_active',)
    search_fields = ('name', 'registration_number')
    ordering = ('name',)
    list_editable = ('is_active',)

    fieldsets = (
        ('Vehicle Info', {
            'fields': ('name', 'registration_number', 'capacity')
        }),
        ('Status', {
            'fields': ('is_active',)
        }),
    )


# ==========================================
# FLEET BOOKING ADMIN
# ==========================================
@admin.register(FleetBooking)
class FleetBookingAdmin(admin.ModelAdmin):
    list_display = (
        'reference_code', 'vehicle', 'user',
        'start_datetime', 'end_datetime',
        'total_passengers', 'status', 'created_at',
    )
    list_filter = ('status', 'vehicle', 'start_datetime')
    search_fields = (
        'reference_code', 'user__email', 'user__first_name',
        'vehicle__name', 'vehicle__registration_number',
        'destination', 'pickup_location',
    )
    ordering = ('-created_at',)
    readonly_fields = (
        'reference_code', 'created_at', 'updated_at',
        'resolved_at', 'resolved_by', 'updated_by',
    )
    date_hierarchy = 'start_datetime'

    fieldsets = (
        ('Booking Reference', {
            'fields': ('reference_code', 'status')
        }),
        ('Requester', {
            'fields': ('user', 'department')
        }),
        ('Vehicle & Trip', {
            'fields': (
                'vehicle', 'purpose',
                'start_datetime', 'end_datetime',
                'pickup_location', 'destination',
                'total_passengers',
            )
        }),
        ('Notes', {
            'fields': ('user_notes', 'remarks_by_admin')
        }),
        ('Approval Metadata', {
            'fields': ('resolved_by', 'resolved_at', 'updated_by'),
            'classes': ('collapse',),
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',),
        }),
    )

    # Quick-action buttons in the list view
    actions = ['approve_selected', 'reject_selected']

    def approve_selected(self, request, queryset):
        from django.utils import timezone
        updated = queryset.filter(status='PENDING').update(
            status='APPROVED',
            resolved_by=request.user,
            resolved_at=timezone.now(),
        )
        self.message_user(request, f"{updated} booking(s) approved.")
    approve_selected.short_description = "Approve selected PENDING bookings"

    def reject_selected(self, request, queryset):
        # Bulk rejection via admin requires remarks — redirect to individual review.
        self.message_user(
            request,
            "Please reject bookings individually to provide required remarks.",
            level='warning',
        )
    reject_selected.short_description = "Reject selected bookings (individual only)"
