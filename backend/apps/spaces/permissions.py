from rest_framework.permissions import BasePermission, SAFE_METHODS


class IsOwnerOrAdminOrReadOnly(BasePermission):
    """
    - SAFE methods: always allowed for authenticated users.
    - Unsafe methods: only the booking owner OR staff/superuser.
    - Owners may edit PENDING and APPROVED bookings.
      The view's perform_update handles the APPROVED → PENDING demotion.
    """
    def has_object_permission(self, request, view, obj):
        if request.method in SAFE_METHODS:
            return True
        return obj.user == request.user or request.user.is_staff or request.user.is_superuser


class IsAdminOrSpaceManagerOrReadOnly(BasePermission):
    """
    Allows safe methods for everyone.
    Allows writes for IT Admin.
    Allows updates (PUT/PATCH) for assigned Space Approvers to their assigned spaces.
    """
    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        if not request.user or not request.user.is_authenticated:
            return False
        from apps.users.models import Role
        if request.method in ['POST', 'DELETE']:
            return request.user.has_role(Role.Name.IT_ADMIN)
        # allow PUT/PATCH to reach object level
        return True

    def has_object_permission(self, request, view, obj):
        if request.method in SAFE_METHODS:
            return True
        from apps.users.models import Role
        if request.user.has_role(Role.Name.IT_ADMIN):
            return True
            
        if hasattr(obj, 'approver_chain'):
            if obj.approver_chain.fallback_approver == request.user:
                return True
                
        assignments = request.user.space_approver_assignments.filter(is_active=True)
        for a in assignments:
            if a.scope_type == 'SPACE' and a.space_id == obj.id:
                return True
            if a.scope_type == 'BLOCK' and a.block_id == obj.block_id:
                return True
        return False