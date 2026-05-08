from rest_framework import permissions
from django.utils import timezone
from django.db.models import Q
from .models import RoleOverride


def _normalize(role):
    """Lowercase + strip so DB casing never matters for comparisons."""
    return (role or "").strip().lower()


class IsSuperUser(permissions.BasePermission):
    """
    Strictly for Django admin access only.
    Never use this to gate application module endpoints.
    """
    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.is_superuser
        )


class HasDynamicRole(permissions.BasePermission):
    """
    Base permission engine. Checks if the user holds one of the
    required_roles either permanently (user.role FK) or via an
    active, unexpired RoleOverride.

    All comparisons are case-insensitive — DB casing ('Mess', 'MESS',
    'mess') is irrelevant. Define required_roles as lowercase strings.

    is_superuser and is_staff grant NO access here — those flags are
    Django-admin concerns only. Module access must always be explicitly
    assigned via RoleOverride or user.role, like any other user.
    """
    required_roles = []  # define as lowercase strings in subclasses

    def _normalized_required(self):
        return [_normalize(r) for r in self.required_roles]

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False

        normalized = self._normalized_required()

        # 1. Permanent role check
        if (
            getattr(request.user, 'role', None)
            and _normalize(request.user.role.name) in normalized
        ):
            return True

        # 2. Active RoleOverride check
        # Fetch all active override role names and normalize in Python
        # to avoid case-sensitive DB filtering issues.
        now = timezone.now()
        active_role_names = RoleOverride.objects.filter(
            user=request.user,
            is_active=True,
        ).filter(
            Q(expires_at__isnull=True) | Q(expires_at__gt=now)
        ).values_list('overridden_role__name', flat=True)

        return any(_normalize(name) in normalized for name in active_role_names)


# Concrete permission classes
# required_roles as lowercase — _normalize() handles any DB casing variation.

class IsITAdmin(HasDynamicRole):
    """System configuration, user management, role grants."""
    required_roles = ['it admin']


class IsDepartmentHead(HasDynamicRole):
    """HOD-level approvals and department reports."""
    required_roles = ['hod', 'it admin']


class IsApprover(HasDynamicRole):
    """Unified approval queue — HODs and IT Admin."""
    required_roles = ['hod', 'it admin']


class IsMessAdmin(HasDynamicRole):
    """Mess / catering module — approve, reject, view all bookings."""
    required_roles = ['mess']


class CanBookResource(HasDynamicRole):
    """Anyone with a recognised institutional role can submit bookings."""
    required_roles = ['faculty', 'staff', 'it admin', 'hod', 'student']


class IsAdminOrReadOnly(HasDynamicRole):
    """Safe methods open to all authenticated users; writes restricted to IT Admin."""
    required_roles = ['it admin']

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.method in permissions.SAFE_METHODS:
            return True
        return super().has_permission(request, view)