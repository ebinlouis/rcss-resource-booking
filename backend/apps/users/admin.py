from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.contrib.auth.forms import UserCreationForm, UserChangeForm
from .models import CustomUser, Department, RoleOverride, Role


# ==========================================
# 1. CUSTOM FORMS
# ==========================================

class CustomUserCreationForm(UserCreationForm):
    class Meta:
        model  = CustomUser
        fields = ('email', 'employee_student_id', 'first_name')


class CustomUserChangeForm(UserChangeForm):
    class Meta:
        model  = CustomUser
        fields = '__all__'


# ==========================================
# 2. CUSTOM USER ADMIN
# ==========================================

@admin.register(CustomUser)
class CustomUserAdmin(UserAdmin):
    add_form = CustomUserCreationForm
    form     = CustomUserChangeForm
    model    = CustomUser

    list_display   = ('email', 'employee_student_id', 'first_name', 'is_staff', 'is_superuser')
    search_fields  = ('email', 'first_name', 'employee_student_id')
    ordering       = ('email',)
    readonly_fields = ('date_joined', 'updated_at', 'last_login')

    fieldsets = (
        (None, {'fields': ('email', 'password')}),
        ('Personal Info', {
            'fields': (
                'first_name', 'middle_name', 'last_name',
                'phone', 'profile_image'
            )
        }),
        ('RCSS Specific Info', {
            'fields': ('employee_student_id', 'roles', 'department', 'designation')
        }),
        ('Permissions', {
            'fields': ('is_active', 'is_verified', 'is_staff', 'is_superuser', 'groups', 'user_permissions')
        }),
        ('Important Dates', {
            'fields': ('last_login', 'date_joined', 'updated_at')
        }),
    )

    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('email', 'employee_student_id', 'first_name', 'password1', 'password2'),
        }),
    )


# ==========================================
# 3. ROLE ADMIN
# ==========================================

@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    list_display  = ('name', 'description')
    search_fields = ('name',)
    ordering      = ('name',)


# ==========================================
# 4. OTHER ADMIN REGISTRATIONS
# ==========================================

@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    list_display  = ('department_name', 'department_code', 'is_active')
    search_fields = ('department_name', 'department_code')
    list_filter   = ('is_active',)


@admin.register(RoleOverride)
class RoleOverrideAdmin(admin.ModelAdmin):
    list_display  = ('user', 'role', 'granted_by', 'is_active', 'valid_from', 'valid_until')
    list_filter   = ('is_active', 'role')
    search_fields = ('user__email', 'granted_by__email', 'reason')
    readonly_fields = ('created_at', 'updated_at', 'revoked_at', 'revoked_by')