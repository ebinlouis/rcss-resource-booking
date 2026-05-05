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
    BASE ENGINE: Checks if a user has a required role permanently (user.role) 
    or temporarily via an unexpired RoleOverride.
    """
    required_roles = []

    def has_permission(self, request, view):
        # 1. Authentication Check
        if not bool(request.user and request.user.is_authenticated):
            print("DEBUG: User is not authenticated")
            return False

        # 2. DEBUG LOG - see exactly what the backend receives
        print(f"DEBUG PERMISSION CHECK ========================")
        print(f"  User        : {request.user}")
        print(f"  User ID     : {request.user.id}")
        print(f"  is_staff    : {request.user.is_staff}")
        print(f"  is_superuser: {request.user.is_superuser}")
        print(f"  role        : {getattr(request.user, 'role', 'NO ROLE ATTR')}")
        print(f"  required    : {self.required_roles}")
        print(f"  class       : {self.__class__.__name__}")
        print(f"================================================")

        # 3. Administrative Bypass
        if request.user.is_superuser or request.user.is_staff:
            print("DEBUG: Bypassed via is_superuser/is_staff")
            return True

        # 4. Permanent Role Check
        if request.user.role and request.user.role.name in self.required_roles:
            print("DEBUG: Passed via permanent role")
            return True

        # 5. Temporary Role Override Check
        now = timezone.now()
        result = RoleOverride.objects.filter(
            user=request.user,
            is_active=True,
            overridden_role__name__in=self.required_roles
        ).filter(
            Q(expires_at__isnull=True) | Q(expires_at__gt=now)
        ).exists()

        print(f"DEBUG: RoleOverride result: {result}")
        return result


# --- STRUCTURAL PERMISSIONS ---

class IsITAdmin(HasDynamicRole):
    """Write access for system settings and space management."""
    required_roles = ['IT_ADMIN']


class IsDepartmentHead(HasDynamicRole):
    """Access for HOD-level approvals and department reports."""
    required_roles = ['HOD', 'IT_ADMIN']


class IsApprover(HasDynamicRole):
    """
    Standardizes who can access the Unified Approval Queue.
    Typically HODs for their departments and IT Admins for global resources.
    """
    required_roles = ['HOD', 'IT_ADMIN']


class CanBookResource(HasDynamicRole):
    """
    Logic for Phase 1 (Faculty/Admins) and Phase 2 (Students).
    Currently allows anyone with a recognized institutional role.
    """
    required_roles = ['FACULTY', 'STAFF', 'IT_ADMIN', 'HOD', 'STUDENT']


class IsAdminOrReadOnly(HasDynamicRole):
    """
    Safe methods (GET) for all authenticated users; 
    Modifications restricted to IT Admins.
    """
    required_roles = ['IT_ADMIN']

    def has_permission(self, request, view):
        if not bool(request.user and request.user.is_authenticated):
            return False

        if request.method in permissions.SAFE_METHODS:
            return True

        return super().has_permission(request, view)