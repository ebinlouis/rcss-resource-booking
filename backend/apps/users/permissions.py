from rest_framework import permissions
from django.utils import timezone
from django.db.models import Q
from .models import RoleOverride

class IsSuperUser(permissions.BasePermission):
    """
    STRICT: Only for absolute backend System Admins.
    Bypasses all role checks.
    """
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_superuser)


class HasDynamicRole(permissions.BasePermission):
    """
    BASE CLASS: Do not use directly in views.
    Checks if a user has a required role either permanently (user.role) 
    or temporarily via an unexpired RoleOverride.
    """
    required_roles = []  # Subclasses must define this (e.g., ['IT_ADMIN', 'HOD'])

    def has_permission(self, request, view):
        # 1. Must be logged in
        if not bool(request.user and request.user.is_authenticated):
            return False

        # 2. Superusers automatically pass all role checks
        if request.user.is_superuser:
            return True

        # 3. Check permanent role (using your custom ForeignKey 'role' field)
        if request.user.role and request.user.role.name in self.required_roles:
            return True

        # 4. Check temporary Role Override
        now = timezone.now()
        has_active_override = RoleOverride.objects.filter(
            user=request.user,
            is_active=True,
            overridden_role__name__in=self.required_roles
        ).filter(
            # Must either have no expiration, OR expiration is strictly in the future
            Q(expires_at__isnull=True) | Q(expires_at__gt=now)
        ).exists()

        return has_active_override


# --- IMPLEMENTATIONS FOR YOUR VIEWS ---

class IsITAdmin(HasDynamicRole):
    """Allows access only to IT Admins (or temporary IT Admins)."""
    required_roles = ['IT_ADMIN']


class IsDepartmentHead(HasDynamicRole):
    """Allows access to HODs. (IT_ADMIN is included as they usually have global override)."""
    required_roles = ['HOD', 'IT_ADMIN']


class IsStaffOrFaculty(HasDynamicRole):
    """Allows access to general staff, faculty, HODs, and IT Admins."""
    required_roles = ['STAFF', 'FACULTY', 'HOD', 'IT_ADMIN']


class IsApprover(HasDynamicRole):
    """
    Allows access to users designated as approvers.
    This dynamically checks their base role AND temporary overrides.
    """
    # Adjust these string values to match the exact names of your approval groups in the DB
    required_roles = ['HOD', 'IT_ADMIN', 'APPROVER', 'FACULTY']


class IsAdminOrReadOnly(HasDynamicRole):
    """
    The request is authenticated as a user, or is a read-only request.
    Write permissions are strictly limited to IT Admins (permanent or temporary).
    """
    # Roles allowed to make POST/PUT/PATCH/DELETE requests
    required_roles = ['IT_ADMIN'] 

    def has_permission(self, request, view):
        # Always require the user to be logged in first
        if not bool(request.user and request.user.is_authenticated):
            return False

        # SAFE_METHODS are GET, HEAD, or OPTIONS. Allow them for any logged-in user.
        if request.method in permissions.SAFE_METHODS:
            return True

        # If it's a write method (creating/editing a space), use our dynamic engine check
        return super().has_permission(request, view)