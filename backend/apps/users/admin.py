from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import CustomUser, Department, RoleOverride

class CustomUserAdmin(UserAdmin):
    model = CustomUser
    list_display = ('email', 'employee_student_id', 'first_name', 'is_staff', 'is_superuser')
    ordering = ('email',)
    
    # Add this line to handle non-editable fields
    readonly_fields = ('date_joined', 'updated_at')

    # We must redefine fieldsets because the default UserAdmin 
    # fieldsets include 'date_joined' in an editable section.
    fieldsets = (
        (None, {'fields': ('email', 'password')}),
        ('Personal Info', {
            'fields': (
                'first_name', 'middle_name', 'last_name', 
                'employee_student_id', 'phone', 'profile_image'
            )
        }),
        ('Permissions', {
            'fields': ('is_active', 'is_verified', 'is_staff', 'is_superuser', 'groups', 'user_permissions')
        }),
        ('RCSS Specific Info', {
            'fields': ('role', 'department', 'designation')
        }),
        ('Important Dates', {
            'fields': ('date_joined', 'updated_at')
        }),
    )

    # Required for the "Add User" form in Admin
    add_fieldsets = UserAdmin.add_fieldsets + (
        ('RCSS Specific Info', {'fields': ('employee_student_id', 'first_name', 'email')}),
    )

admin.site.register(CustomUser, CustomUserAdmin)
admin.site.register(Department)
admin.site.register(RoleOverride)