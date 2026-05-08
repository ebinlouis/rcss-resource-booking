from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.viewsets import ModelViewSet
from django.conf import settings
from django.utils import timezone
from django.db.models import Q
from django.contrib.auth.models import Group  

# Explicit imports matching your app structure
from apps.spaces.models import SpaceBooking
from apps.fleet.models import FleetBooking
from apps.mess.models import MessBooking
from apps.media.models import MediaBooking

# Imports for Users & Roles 
from .models import RoleOverride, Department, CustomUser
from .serializers import RoleOverrideSerializer, DepartmentSerializer
from .permissions import IsITAdmin

# ==========================================
# DEPARTMENT VIEWSET (FULL CRUD)
# ==========================================
class DepartmentViewSet(ModelViewSet):
    """
    Handles full CRUD for Departments.
    """
    serializer_class = DepartmentSerializer
    
    def get_permissions(self):
        # Anyone logged in can view the departments (for the booking dropdown)
        if self.action in ['list', 'retrieve']:
            return [IsAuthenticated()]
        # Only IT Admins can create, update, or delete departments
        return [IsAuthenticated(), IsITAdmin()]

    def get_queryset(self):
        # Fetch departments and allow optional filtering for active ones
        queryset = Department.objects.all().order_by('department_name')
        if self.request.query_params.get('active') == 'true':
            queryset = queryset.filter(is_active=True)
        return queryset

# ==========================================
# AUTHENTICATION VIEWS
# ==========================================
class CookieTokenObtainPairView(TokenObtainPairView):
    def post(self, request, *args, **kwargs):
        # Let SimpleJWT generate the tokens first
        response = super().post(request, *args, **kwargs)
        
        if response.status_code == 200:
            access_token = response.data.get('access')
            refresh_token = response.data.get('refresh')
            
            # Lock the access token inside a secure cookie
            response.set_cookie(
                'access_token',
                access_token,
                max_age=settings.SIMPLE_JWT['ACCESS_TOKEN_LIFETIME'].total_seconds(),
                httponly=True,
                samesite='Lax'
            )
            # Lock the refresh token inside a secure cookie
            response.set_cookie(
                'refresh_token',
                refresh_token,
                max_age=settings.SIMPLE_JWT['REFRESH_TOKEN_LIFETIME'].total_seconds(),
                httponly=True,
                samesite='Lax'
            )
            
            # Remove the tokens from the JSON body so they can't be stolen by JS
            del response.data['access']
            del response.data['refresh']
            response.data['message'] = "Login successful. Tokens securely stored in cookies."
            
        return response


class LogoutView(APIView):
    def post(self, request):
        response = Response({"message": "Successfully logged out."})
        response.delete_cookie('access_token')
        response.delete_cookie('refresh_token')
        return response


class CurrentUserView(APIView):
    # This ensures only users with a valid HttpOnly cookie can hit this endpoint
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        now = timezone.now()
        
        # 1. Get base role (Fallback to groups if role FK is null)
        base_role = user.role.name if getattr(user, 'role', None) else None
        if not base_role and user.groups.exists():
            base_role = user.groups.first().name

        effective_role = base_role
        has_active_override = False
        override_expires_at = None

        # 2. Check for active override mathematically
        active_override = RoleOverride.objects.filter(
            user=user,
            is_active=True
        ).filter(
            Q(expires_at__isnull=True) | Q(expires_at__gt=now)
        ).first()

        if active_override:
            effective_role = active_override.overridden_role.name
            has_active_override = True
            override_expires_at = active_override.expires_at

        # 3. SUPERUSER SAFETY NET 
        if not effective_role and user.is_superuser:
            effective_role = 'IT_ADMIN'

        # ==========================================
        # 4. CAPABILITY MAPPING (DYNAMIC CBAC)
        # ==========================================
        safe_role = effective_role.upper() if effective_role else ""
        
        # Define Group Mappings (Added exact matches based on DB screenshot)
        SYSTEM_ADMIN_ROLES = ['IT ADMIN', 'IT_ADMIN', 'SYSTEM OPS']
        HOD_ROLES = ['HOD', 'HEAD OF DEPARTMENT']
        MESS_ADMIN_ROLES = ['MESS', 'MESS ADMIN', 'CATERING MANAGER']
        SPACES_ADMIN_ROLES = ['SPACES', 'SPACES ADMIN', 'FACILITY MANAGER']

        can_manage_system = user.is_superuser or safe_role in SYSTEM_ADMIN_ROLES
        can_manage_spaces = can_manage_system or safe_role in HOD_ROLES or safe_role in SPACES_ADMIN_ROLES
        can_manage_equipment = can_manage_system or safe_role in HOD_ROLES
        can_manage_mess = can_manage_system or safe_role in MESS_ADMIN_ROLES

        can_access_admin_portal = can_manage_system or can_manage_spaces or can_manage_equipment or can_manage_mess or bool(effective_role)

        return Response({
            "id": user.id,
            "email": user.email,
            "name": user.first_name,
            "base_role": base_role,
            "effective_role": effective_role,
            "has_active_override": has_active_override,
            "override_expires_at": override_expires_at,
            "is_staff": user.is_staff,
            "is_superuser": user.is_superuser,
            
            # --- Dynamic Capabilities for Frontend ---
            "capabilities": {
                "can_access_admin_portal": can_access_admin_portal,
                "can_manage_system": can_manage_system,
                "can_manage_spaces": can_manage_spaces,
                "can_manage_equipment": can_manage_equipment,
                "can_manage_mess": can_manage_mess
            }
        })

# ==========================================
# DASHBOARD AGGREGATOR VIEW
# ==========================================
class DashboardAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        today = timezone.now().date()

        # 1. Spaces
        spaces = SpaceBooking.objects.filter(
            user=user, 
            start_datetime__date__gte=today
        ).exclude(status='REJECTED').order_by('start_datetime')

        # 2. Fleet
        fleet = FleetBooking.objects.filter(
            user=user, 
            start_datetime__date__gte=today
        ).exclude(status='REJECTED').order_by('start_datetime')

        # 3. Mess
        mess = MessBooking.objects.filter(
            user=user, 
            booking_date__gte=today
        ).exclude(status='REJECTED').order_by('booking_date', 'delivery_time')

        # 4. Media
        media = MediaBooking.objects.filter(
            user=user, 
            booking_date__gte=today
        ).exclude(status='REJECTED').order_by('booking_date', 'start_time')

        total_pending = (
            spaces.filter(status='PENDING').count() +
            fleet.filter(status='PENDING').count() +
            mess.filter(status='PENDING').count() +
            media.filter(status='PENDING').count()
        )

        return Response({
            "greeting": {
                "user_name": user.first_name or "User",
                "pending_count": total_pending,
                "date_display": today.strftime("%A, %B %d")
            },
            "modules": {
                "spaces": [
                    {"id": s.id, "ref": s.reference_code, "title": s.space.name, "status": s.status} 
                    for s in spaces
                ],
                "fleet": [
                    {"id": f.id, "ref": f.reference_code, "title": f.vehicle.name, "status": f.status} 
                    for f in fleet
                ],
                "mess": [
                    {"id": m.id, "ref": m.reference_code, "title": f"Catering ({m.total_persons} Pax)", "status": m.status} 
                    for m in mess
                ],
                "media": [
                    {"id": e.id, "ref": e.reference_code, "title": e.event_name, "status": e.status} 
                    for e in media
                ]
            }
        })

# ==========================================
# ADMIN MANAGEMENT VIEWS
# ==========================================
class RoleOverrideViewSet(ModelViewSet):
    queryset = RoleOverride.objects.all().select_related('user', 'overridden_role', 'granted_by').order_by('-created_at')
    serializer_class = RoleOverrideSerializer
    permission_classes = [IsAuthenticated, IsITAdmin]

    def perform_create(self, serializer):
        serializer.save(granted_by=self.request.user)

    def get_queryset(self):
        queryset = super().get_queryset()
        is_active = self.request.query_params.get('active', None)
        if is_active == 'true':
            queryset = queryset.filter(is_active=True)
        return queryset

class RoleListView(APIView):
    permission_classes = [IsAuthenticated, IsITAdmin]

    def get(self, request):
        roles = Group.objects.all().values('id', 'name')
        return Response(roles)

class UserSearchView(APIView):
    permission_classes = [IsAuthenticated, IsITAdmin]

    def get(self, request):
        query = request.query_params.get('q', '').strip()
        
        if len(query) < 2:
            return Response([])

        users = CustomUser.objects.filter(
            Q(email__icontains=query) |
            Q(first_name__icontains=query) |
            Q(employee_student_id__icontains=query)
        ).values('id', 'email', 'first_name', 'employee_student_id')[:10]
        
        return Response(list(users))