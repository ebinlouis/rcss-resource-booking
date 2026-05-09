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