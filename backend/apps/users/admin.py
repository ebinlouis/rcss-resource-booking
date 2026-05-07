from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.contrib.auth.forms import UserCreationForm, UserChangeForm
from .models import CustomUser, Department, RoleOverride

# ==========================================
# 1. CUSTOM FORMS (Bypasses 'username' requirement)
# ==========================================
class CustomUserCreationForm(UserCreationForm):
    class Meta:
        model = CustomUser
        # The fields required to initially create a user
        fields = ('email', 'employee_student_id', 'first_name')

class CustomUserChangeForm(UserChangeForm):
    class Meta:
        model = CustomUser
        fields = '__all__'

# ==========================================
# 2. CUSTOM USER ADMIN
# ==========================================
@admin.register(CustomUser)
class CustomUserAdmin(UserAdmin):
    add_form = CustomUserCreationForm
    form = CustomUserChangeForm
    model = CustomUser
    
    list_display = ('email', 'employee_student_id', 'first_name', 'is_staff', 'is_superuser')
    search_fields = ('email', 'first_name', 'employee_student_id')
    ordering = ('email',)
    
    readonly_fields = ('date_joined', 'updated_at', 'last_login')

    # The layout when EDITING an existing user
    fieldsets = (
        (None, {'fields': ('email', 'password')}),
        ('Personal Info', {
            'fields': (
                'first_name', 'middle_name', 'last_name', 
                'phone', 'profile_image'
            )
        }),
        ('RCSS Specific Info', {
            'fields': ('employee_student_id', 'role', 'department', 'designation')
        }),
        ('Permissions', {
            'fields': ('is_active', 'is_verified', 'is_staff', 'is_superuser', 'groups', 'user_permissions')
        }),
        ('Important Dates', {
            'fields': ('last_login', 'date_joined', 'updated_at')
        }),
    )

    # The layout when ADDING a new user
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            # FIXED: Django internally uses 'password1' and 'password2'
            'fields': ('email', 'employee_student_id', 'first_name', 'password1', 'password2'),
        }),
    )

# ==========================================
# 3. OTHER ADMIN REGISTRATIONS
# ==========================================
@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    list_display = ('department_name', 'department_code', 'is_active')
    search_fields = ('department_name', 'department_code')
    list_filter = ('is_active',)

@admin.register(RoleOverride)
class RoleOverrideAdmin(admin.ModelAdmin):
    list_display = ('user', 'overridden_role', 'granted_by', 'is_active', 'expires_at')
    list_filter = ('is_active', 'overridden_role')
    search_fields = ('user__email', 'granted_by__email')