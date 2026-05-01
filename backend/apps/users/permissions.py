from rest_framework.permissions import BasePermission, SAFE_METHODS

class IsApprover(BasePermission):
    """
    Allows access only to admin/staff users who have approval rights.
    """
    def has_permission(self, request, view):
        # Check if the user is logged in AND is marked as staff/admin
        return bool(request.user and request.user.is_authenticated and request.user.is_staff)

class IsAdminOrReadOnly(BasePermission):
    """
    Allows anyone to view (GET), but only admins can create/edit (POST, PATCH, DELETE).
    """
    def has_permission(self, request, view):
        # SAFE_METHODS are GET, HEAD, OPTIONS (just reading data)
        if request.method in SAFE_METHODS:
            return request.user and request.user.is_authenticated
            
        # If they are trying to POST or DELETE, they must be staff
        return bool(request.user and request.user.is_staff)