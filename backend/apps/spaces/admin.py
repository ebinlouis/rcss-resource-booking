from django.contrib import admin
from .models import Space, SpaceBooking

@admin.register(Space)
class SpaceAdmin(admin.ModelAdmin):
    list_display = ('name', 'location', 'space_type', 'is_active')

@admin.register(SpaceBooking)
class SpaceBookingAdmin(admin.ModelAdmin):
    # Shows these columns in the list view for quick review
    list_display = ('reference_code', 'space', 'start_datetime', 'status', 'user')
    list_filter = ('status', 'space')
    search_fields = ('reference_code', 'purpose_of_booking')