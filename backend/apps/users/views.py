from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.viewsets import ModelViewSet
from rest_framework.decorators import action  # <-- ADDED
from django.conf import settings
from django.utils import timezone
from django.db.models import Q

from apps.spaces.models import SpaceBooking
from apps.fleet.models import FleetBooking
from apps.mess.models import MessBooking
from apps.media.models import MediaBooking

from .models import RoleOverride, Department, CustomUser, Role
from .serializers import RoleOverrideSerializer, DepartmentSerializer
from .permissions import IsITAdmin


# ==========================================
# DEPARTMENT VIEWSET
# ==========================================

class DepartmentViewSet(ModelViewSet):
    serializer_class = DepartmentSerializer

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsITAdmin()]

    def get_queryset(self):
        queryset = Department.objects.all().order_by('department_name')
        if self.request.query_params.get('active') == 'true':
            queryset = queryset.filter(is_active=True)
        return queryset


# ==========================================
# AUTHENTICATION VIEWS
# ==========================================

class CookieTokenObtainPairView(TokenObtainPairView):
    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)

        if response.status_code == 200:
            access_token  = response.data.get('access')
            refresh_token = response.data.get('refresh')

            response.set_cookie(
                'access_token',
                access_token,
                max_age  = settings.SIMPLE_JWT['ACCESS_TOKEN_LIFETIME'].total_seconds(),
                httponly = True,
                samesite = 'Lax',
            )
            response.set_cookie(
                'refresh_token',
                refresh_token,
                max_age  = settings.SIMPLE_JWT['REFRESH_TOKEN_LIFETIME'].total_seconds(),
                httponly = True,
                samesite = 'Lax',
            )

            del response.data['access']
            del response.data['refresh']
            response.data['message'] = 'Login successful. Tokens securely stored in cookies.'

        return response


class LogoutView(APIView):
    def post(self, request):
        response = Response({'message': 'Successfully logged out.'})
        response.delete_cookie('access_token')
        response.delete_cookie('refresh_token')
        return response


# ==========================================
# CURRENT USER VIEW
# ==========================================

def _build_user_response(user):
    """
    Builds the standard user response dict used by both
    CurrentUserView (GET) and UserProfileUpdateView (PATCH).
    Uses get_effective_roles() — the single source of truth.
    """
    effective_roles = user.get_effective_roles()

    # Active overrides metadata (for frontend display only)
    now = timezone.now()
    active_overrides = (
        RoleOverride.objects
        .filter(user=user, is_active=True)
        .filter(Q(valid_until__isnull=True) | Q(valid_until__gt=now))
        .filter(revoked_at__isnull=True)
        .select_related('role')
    )
    has_active_override  = active_overrides.exists()
    override_expires_at  = (
        active_overrides.filter(valid_until__isnull=False)
        .order_by('valid_until')
        .values_list('valid_until', flat=True)
        .first()
    )

    # Capabilities
    ADMIN_PORTAL_ROLES = {
        Role.Name.IT_ADMIN, Role.Name.HOD,
        Role.Name.RECEPTIONIST, Role.Name.LAB_INCHARGE, Role.Name.LIBRARIAN,
        Role.Name.MESS_MANAGER, Role.Name.MEDIA_INCHARGE, Role.Name.FLEET_MANAGER,
        Role.Name.PRINCIPAL,
    }
    SPACE_MANAGEMENT_ROLES = {
        Role.Name.RECEPTIONIST, Role.Name.LAB_INCHARGE,
        Role.Name.LIBRARIAN, Role.Name.IT_ADMIN,
    }
    LAB_MANAGEMENT_ROLES = {
        Role.Name.LAB_INCHARGE, Role.Name.HOD, Role.Name.IT_ADMIN,
    }

    capabilities = {
        'can_access_admin_portal':   bool(effective_roles & ADMIN_PORTAL_ROLES),
        'can_manage_system':         Role.Name.IT_ADMIN in effective_roles,
        'can_manage_spaces':         bool(effective_roles & SPACE_MANAGEMENT_ROLES),
        'can_manage_labs':           bool(effective_roles & LAB_MANAGEMENT_ROLES),
        'can_manage_mess':           Role.Name.MESS_MANAGER in effective_roles,
        'can_manage_media':          Role.Name.MEDIA_INCHARGE in effective_roles,
        'can_manage_fleet':          Role.Name.FLEET_MANAGER in effective_roles,
        'can_manage_principal_view': Role.Name.PRINCIPAL in effective_roles,
    }

    # Superuser override — gets full capabilities
    if user.is_superuser:
        capabilities = {
            'can_access_admin_portal':   True,
            'can_manage_system':         True,
            'can_manage_spaces':         True,
            'can_manage_labs':           True,
            'can_manage_mess':           False,
            'can_manage_media':          False,
            'can_manage_fleet':          True,
            'can_manage_principal_view': True,
        }

    return {
        'id':                   user.id,
        'email':                user.email,
        'name':                 user.first_name,
        'first_name':           user.first_name,
        'last_name':            user.last_name,
        'phone':                user.phone,
        'designation':          user.designation,
        'employee_student_id':  user.employee_student_id,
        'department':           user.department_id,
        'department_name':      user.department.department_name if user.department else None,
        # New role fields
        'effective_roles':      list(effective_roles),
        'has_active_override':  has_active_override,
        'override_expires_at':  override_expires_at,
        # Django flags
        'is_staff':             user.is_staff,
        'is_superuser':         user.is_superuser,
        'capabilities':         capabilities,
    }


class CurrentUserView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(_build_user_response(request.user))


# ==========================================
# USER PROFILE UPDATE VIEW
# ==========================================

class UserProfileUpdateView(APIView):
    permission_classes = [IsAuthenticated]

    UPDATABLE_FIELDS = ['first_name', 'last_name', 'phone', 'designation', 'department']

    def patch(self, request):
        user   = request.user
        errors = {}

        for field in self.UPDATABLE_FIELDS:
            if field not in request.data:
                continue
            value = request.data[field]

            if field == 'department':
                if value in (None, '', 0):
                    user.department = None
                else:
                    try:
                        user.department = Department.objects.get(pk=int(value))
                    except (Department.DoesNotExist, ValueError):
                        errors['department'] = 'Invalid department selected.'
            elif field == 'first_name':
                if not str(value).strip():
                    errors['first_name'] = 'First name cannot be blank.'
                else:
                    setattr(user, field, str(value).strip())
            elif field == 'phone':
                setattr(user, field, str(value).strip() if value else None)
            else:
                setattr(user, field, str(value).strip() if value else None)

        if errors:
            return Response(errors, status=status.HTTP_400_BAD_REQUEST)

        user.save(update_fields=[
            'first_name', 'last_name', 'phone', 'designation', 'department_id',
        ])

        return Response(_build_user_response(user))


# ==========================================
# DASHBOARD AGGREGATOR VIEW
# ==========================================

class DashboardAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user  = request.user
        today = timezone.now().date()

        spaces = (
            SpaceBooking.objects
            .filter(user=user, start_datetime__date__gte=today)
            .exclude(status='REJECTED')
            .order_by('start_datetime')
        )
        fleet = (
            FleetBooking.objects
            .filter(user=user, start_datetime__date__gte=today)
            .exclude(status='REJECTED')
            .order_by('start_datetime')
        )
        mess = (
            MessBooking.objects
            .filter(user=user, booking_date__gte=today)
            .exclude(status='REJECTED')
            .order_by('booking_date')
        )
        media = (
            MediaBooking.objects
            .filter(user=user, booking_date__gte=today)
            .exclude(status='REJECTED')
            .order_by('booking_date', 'start_time')
        )

        total_pending = (
            spaces.filter(status='PENDING').count()
            + fleet.filter(status='PENDING').count()
            + mess.filter(status='PENDING').count()
            + media.filter(status='PENDING').count()
        )

        return Response({
            'greeting': {
                'user_name':     user.first_name or 'User',
                'pending_count': total_pending,
                'date_display':  today.strftime('%A, %B %d'),
            },
            'modules': {
                'spaces': [
                    {'id': s.id, 'ref': s.reference_code, 'title': s.space.name, 'status': s.status}
                    for s in spaces
                ],
                'fleet': [
                    {'id': f.id, 'ref': f.reference_code, 'title': f.vehicle.name, 'status': f.status}
                    for f in fleet
                ],
                'mess': [
                    {'id': m.id, 'ref': m.reference_code, 'title': f'Catering ({m.total_persons} Pax)', 'status': m.status}
                    for m in mess
                ],
                'media': [
                    {'id': e.id, 'ref': e.reference_code, 'title': e.event_name, 'status': e.status}
                    for e in media
                ],
            },
        })


# ==========================================
# ADMIN MANAGEMENT VIEWS
# ==========================================

class RoleOverrideViewSet(ModelViewSet):
    serializer_class   = RoleOverrideSerializer
    permission_classes = [IsAuthenticated, IsITAdmin]

    def get_queryset(self):
        queryset = (
            RoleOverride.objects.all()
            .select_related('user', 'role', 'granted_by', 'revoked_by')
            .order_by('-created_at')
        )
        if self.request.query_params.get('active') == 'true':
            now = timezone.now()
            queryset = queryset.filter(
                is_active=True
            ).filter(
                Q(valid_until__isnull=True) | Q(valid_until__gt=now)
            ).filter(revoked_at__isnull=True)
        return queryset

    def perform_create(self, serializer):
        serializer.save(granted_by=self.request.user)

    # --- ADDED REVOKE ACTION ---
    @action(detail=True, methods=['post'])
    def revoke(self, request, pk=None):
        """
        Custom endpoint to trigger the soft-revoke method on the model.
        URL: POST /api/auth/role-overrides/<id>/revoke/
        """
        override = self.get_object()
        
        if not override.is_active:
            return Response({'error': 'This override is already revoked.'}, status=status.HTTP_400_BAD_REQUEST)
            
        override.revoke(revoked_by=request.user)
        return Response({'message': 'Access successfully revoked.'}, status=status.HTTP_200_OK)


class RoleListView(APIView):
    """Returns all available roles. Used by IT Admin when assigning roles."""
    permission_classes = [IsAuthenticated, IsITAdmin]

    def get(self, request):
        roles = Role.objects.all().values('id', 'name', 'description')
        return Response(list(roles))


class UserSearchView(APIView):
    permission_classes = [IsAuthenticated, IsITAdmin]

    def get(self, request):
        query = request.query_params.get('q', '').strip()
        if len(query) < 2:
            return Response([])

        users = CustomUser.objects.filter(
            Q(email__icontains=query)
            | Q(first_name__icontains=query)
            | Q(employee_student_id__icontains=query)
        ).values('id', 'email', 'first_name', 'employee_student_id')[:10]

        return Response(list(users))