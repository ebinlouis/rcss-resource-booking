from rest_framework import permissions
from .models import Role


# ==========================================
# BASE ENGINE
# ==========================================

class HasRole(permissions.BasePermission):
    """
    Base permission class for all role-based checks.

    Subclasses declare required_roles as a list of Role.Name values.
    A user passes if their effective role set (base roles + active overrides)
    intersects with required_roles.

    is_superuser and is_staff grant NO access here — those are Django admin
    concerns only. All module access must be explicitly assigned via roles M2M
    or RoleOverride, like any other user.

    Usage:
        class IsReceptionist(HasRole):
            required_roles = [Role.Name.RECEPTIONIST, Role.Name.IT_ADMIN]
    """

    required_roles: list = []

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False

        effective = request.user.get_effective_roles()
        return bool(effective & set(self.required_roles))


class HasRoleOrReadOnly(HasRole):
    """
    Safe methods (GET, HEAD, OPTIONS) pass for any authenticated user.
    Unsafe methods require the declared required_roles.
    """

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.method in permissions.SAFE_METHODS:
            return True
        return super().has_permission(request, view)


# ==========================================
# SYSTEM
# ==========================================

class IsITAdmin(HasRole):
    """Full system access. Testing backdoor — always included in every approver class."""
    required_roles = [Role.Name.IT_ADMIN]


# ==========================================
# SPACE DOMAIN
# ==========================================

class IsReceptionist(HasRole):
    """
    Approves space bookings for their assigned block(s).
    Does not see labs or library spaces.
    Scope (which block) is enforced at the queryset level, not here.
    """
    required_roles = [Role.Name.RECEPTIONIST, Role.Name.IT_ADMIN]


class IsLabIncharge(HasRole):
    """
    Approves lab bookings for their assigned lab(s).
    Scope (which lab) is enforced at the queryset level, not here.
    """
    required_roles = [Role.Name.LAB_INCHARGE, Role.Name.IT_ADMIN]


class IsLibrarian(HasRole):
    """Approves library space bookings."""
    required_roles = [Role.Name.LIBRARIAN, Role.Name.IT_ADMIN]


class IsPrincipal(HasRole):
    """
    Can view all approved space bookings and cancel/rebook.
    Cannot approve other users' pending bookings.
    """
    required_roles = [Role.Name.PRINCIPAL, Role.Name.IT_ADMIN]


class IsHOD(HasRole):
    """
    Approves AI Lab bookings, scoped to their department.
    Scope (department) is enforced at the queryset level, not here.
    """
    required_roles = [Role.Name.HOD, Role.Name.IT_ADMIN]


class IsSpaceApprover(HasRole):
    """
    Union permission: any role that can approve something in the spaces domain.
    Used by the unified approval queue endpoint to gate access.
    The queryset inside the view handles scoping to what each role actually sees.
    """
    required_roles = [
        Role.Name.RECEPTIONIST,
        Role.Name.LAB_INCHARGE,
        Role.Name.LIBRARIAN,
        Role.Name.HOD,
        Role.Name.PRINCIPAL,
        Role.Name.IT_ADMIN,
    ]


# ==========================================
# OTHER DOMAIN APPROVERS
# ==========================================

class IsMessManager(HasRole):
    """Approves mess/catering bookings."""
    required_roles = [Role.Name.MESS_MANAGER, Role.Name.IT_ADMIN]


class IsMediaIncharge(HasRole):
    """Approves media equipment bookings."""
    required_roles = [Role.Name.MEDIA_INCHARGE, Role.Name.IT_ADMIN]


class IsFleetManager(HasRole):
    """Approves vehicle bookings. Fleet module not yet built — role defined for future use."""
    required_roles = [Role.Name.FLEET_MANAGER, Role.Name.IT_ADMIN]


# ==========================================
# GENERAL APPROVER (unified queue gate)
# ==========================================

class IsApprover(HasRole):
    """
    Gates access to the unified approval queue endpoint.
    Any role that manages any approval domain passes.
    IT_ADMIN included as the testing/override backdoor.

    Note: passing this permission does NOT mean the user sees all domains.
    The view's _get_domain_querysets() scopes each domain independently.
    """
    required_roles = [
        Role.Name.RECEPTIONIST,
        Role.Name.LAB_INCHARGE,
        Role.Name.LIBRARIAN,
        Role.Name.HOD,
        Role.Name.MESS_MANAGER,
        Role.Name.MEDIA_INCHARGE,
        Role.Name.FLEET_MANAGER,
        Role.Name.PRINCIPAL,
        Role.Name.IT_ADMIN,
    ]


# ==========================================
# BOOKING SUBMITTERS
# ==========================================

class CanBookResource(HasRole):
    """
    Any user with a recognised institutional role can submit bookings.
    Students, faculty, staff — and also approver roles (they can book too).
    """
    required_roles = [
        Role.Name.STUDENT,
        Role.Name.FACULTY,
        Role.Name.STAFF,
        Role.Name.HOD,
        Role.Name.RECEPTIONIST,
        Role.Name.LAB_INCHARGE,
        Role.Name.LIBRARIAN,
        Role.Name.MESS_MANAGER,
        Role.Name.MEDIA_INCHARGE,
        Role.Name.FLEET_MANAGER,
        Role.Name.PRINCIPAL,
        Role.Name.IT_ADMIN,
    ]


# ==========================================
# CATALOG MANAGEMENT (read-only for all, write for IT_ADMIN)
# ==========================================

class IsAdminOrReadOnly(HasRoleOrReadOnly):
    """
    Safe methods open to all authenticated users.
    Writes (POST/PUT/PATCH/DELETE) restricted to IT_ADMIN.
    Used for Space, Equipment catalog endpoints.
    """
    required_roles = [Role.Name.IT_ADMIN]


class IsEquipmentManagerOrReadOnly(HasRoleOrReadOnly):
    """
    Safe methods open to all authenticated users.
    Equipment catalog writes are allowed for IT Admin, Lab In-Charge, and
    Media In-Charge because both lab rooms and media workflows manage gear.
    """
    required_roles = [
        Role.Name.IT_ADMIN,
        Role.Name.LAB_INCHARGE,
        Role.Name.MEDIA_INCHARGE,
    ]


class IsITAdminOrHOD(HasRole):
    """Allows IT Admin or Head of Department to manage resources/faculty."""
    required_roles = [Role.Name.IT_ADMIN, Role.Name.HOD]

