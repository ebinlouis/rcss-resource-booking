from rest_framework.permissions import BasePermission, SAFE_METHODS

class IsOwnerOrAdminOrReadOnly(BasePermission):
    """
    - SAFE methods (GET, HEAD, OPTIONS): always allowed for authenticated users.
    - Unsafe methods (PUT, PATCH, DELETE): only the booking owner OR staff/superuser.
    """
    def has_object_permission(self, request, view, obj):
        if request.method in SAFE_METHODS:
            return True
        return obj.user == request.user or request.user.is_staff or request.user.is_superuser