from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.viewsets import ModelViewSet
from django.conf import settings
from django.utils import timezone
from django.db.models import Q
from django.contrib.auth.models import Group

from apps.spaces.models import SpaceBooking
from apps.fleet.models import FleetBooking
from apps.mess.models import MessBooking
from apps.media.models import MediaBooking

from .models import RoleOverride, Department, CustomUser
from .serializers import RoleOverrideSerializer, DepartmentSerializer
from .permissions import IsITAdmin


# ── Helpers ───────────────────────────────────────────────────────────────────


def _get_effective_role(user):
    """
    Resolve the user's active role.
    Priority: active RoleOverride → user.role FK → first Django group.
    Returns the raw name from the DB plus override metadata.
    is_superuser / is_staff grant NO role here — module access must be
    explicitly assigned via RoleOverride like every other user.
    """
    now = timezone.now()

    active_override = (
        RoleOverride.objects.filter(
            user=user,
            is_active=True,
        )
        .filter(Q(expires_at__isnull=True) | Q(expires_at__gt=now))
        .first()
    )

    if active_override:
        return active_override.overridden_role.name, True, active_override.expires_at

    base_role = user.role.name if getattr(user, "role", None) else None
    if not base_role and user.groups.exists():
        base_role = user.groups.first().name

    return base_role, False, None


def _normalize(role):
    """Lowercase + strip so DB casing never matters for comparisons."""
    return (role or "").strip().lower()


# ── Role sets — always lowercase ──────────────────────────────────────────────
# Comparisons are done against _normalize(role) so DB casing is irrelevant.
# Add new roles here as lowercase strings only.

_SYSTEM_ADMIN_ROLES = {"it admin"}
_HOD_ROLES          = {"hod"}
_MESS_ROLES         = {"mess"}
_MEDIA_ROLES        = {"media"}
_SPACES_ROLES       = {
    "facility manager",
    "receptionist",
    "lab in-charge",
    "librarian",
    "principal",
}
_EQUIPMENT_ROLES    = {"hod", "it admin"}


# ==========================================
# DEPARTMENT VIEWSET (FULL CRUD)
# ==========================================


class DepartmentViewSet(ModelViewSet):
    serializer_class = DepartmentSerializer

    def get_permissions(self):
        if self.action in ["list", "retrieve"]:
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsITAdmin()]

    def get_queryset(self):
        queryset = Department.objects.all().order_by("department_name")
        if self.request.query_params.get("active") == "true":
            queryset = queryset.filter(is_active=True)
        return queryset


# ==========================================
# AUTHENTICATION VIEWS
# ==========================================


class CookieTokenObtainPairView(TokenObtainPairView):
    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)

        if response.status_code == 200:
            access_token  = response.data.get("access")
            refresh_token = response.data.get("refresh")

            response.set_cookie(
                "access_token",
                access_token,
                max_age=settings.SIMPLE_JWT["ACCESS_TOKEN_LIFETIME"].total_seconds(),
                httponly=True,
                samesite="Lax",
            )
            response.set_cookie(
                "refresh_token",
                refresh_token,
                max_age=settings.SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"].total_seconds(),
                httponly=True,
                samesite="Lax",
            )

            del response.data["access"]
            del response.data["refresh"]
            response.data["message"] = (
                "Login successful. Tokens securely stored in cookies."
            )

        return response


class LogoutView(APIView):
    def post(self, request):
        response = Response({"message": "Successfully logged out."})
        response.delete_cookie("access_token")
        response.delete_cookie("refresh_token")
        return response


class CurrentUserView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user

        effective_role, has_active_override, override_expires_at = _get_effective_role(
            user
        )

        # ── Capability mapping ────────────────────────────────────────────────
        # _normalize() lowercases + strips before set lookup so DB casing
        # ('Mess', 'MESS', 'mess') all resolve correctly.
        # No is_superuser / is_staff shortcuts — those are Django-admin
        # concerns only and must never bleed into module access decisions.

        role = _normalize(effective_role)

        can_manage_system    = role in _SYSTEM_ADMIN_ROLES
        can_manage_mess      = role in _MESS_ROLES
        can_manage_media     = role in _MEDIA_ROLES
        can_manage_spaces    = role in _SPACES_ROLES
        can_manage_equipment = role in _EQUIPMENT_ROLES

        can_access_admin_portal = (
            can_manage_system
            or can_manage_mess
            or can_manage_media
            or can_manage_spaces
            or can_manage_equipment
        )

        return Response(
            {
                "id":    user.id,
                "email": user.email,
                "name":  user.first_name,
                # Full profile fields (used by Profile.jsx)
                "first_name":          user.first_name,
                "last_name":           user.last_name,
                "phone":               user.phone,
                "designation":         user.designation,
                "employee_student_id": user.employee_student_id,
                # department returns the FK id so ProfileForm can pre-select
                "department":      user.department_id,
                "department_name": (
                    user.department.department_name if user.department else None
                ),
                "base_role":            user.role.name if getattr(user, "role", None) else None,
                "effective_role":       effective_role,
                "has_active_override":  has_active_override,
                "override_expires_at":  override_expires_at,
                "is_staff":             user.is_staff,
                "is_superuser":         user.is_superuser,
                "capabilities": {
                    "can_access_admin_portal": can_access_admin_portal,
                    "can_manage_system":       can_manage_system,
                    "can_manage_spaces":       can_manage_spaces,
                    "can_manage_equipment":    can_manage_equipment,
                    "can_manage_mess":         can_manage_mess,
                    "can_manage_media":        can_manage_media,
                },
            }
        )


# ==========================================
# USER PROFILE UPDATE VIEW
# PATCH /api/auth/profile/
# ==========================================


class UserProfileUpdateView(APIView):
    """
    PATCH /api/auth/profile/
    Allows authenticated users to update their own profile fields.
    Updatable fields: first_name, last_name, phone, designation, department.
    """

    permission_classes = [IsAuthenticated]

    UPDATABLE_FIELDS = ["first_name", "last_name", "phone", "designation", "department"]

    def patch(self, request):
        user   = request.user
        errors = {}

        for field in self.UPDATABLE_FIELDS:
            if field not in request.data:
                continue
            value = request.data[field]

            if field == "department":
                if value in (None, "", 0):
                    # Allow clearing department
                    user.department = None
                else:
                    from apps.users.models import Department

                    try:
                        user.department = Department.objects.get(pk=int(value))
                    except (Department.DoesNotExist, ValueError):
                        errors["department"] = "Invalid department selected."
            elif field == "first_name":
                if not str(value).strip():
                    errors["first_name"] = "First name cannot be blank."
                else:
                    setattr(user, field, str(value).strip())
            elif field == "phone":
                setattr(user, field, str(value).strip() if value else None)
            else:
                setattr(user, field, str(value).strip() if value else None)

        if errors:
            return Response(errors, status=status.HTTP_400_BAD_REQUEST)

        # ForeignKey fields must be saved as `_id` column names
        update_fields = [
            "first_name",
            "last_name",
            "phone",
            "designation",
            "department_id",
        ]
        user.save(update_fields=update_fields)

        # Re-use the same shape as GET /auth/me/ so the frontend can
        # update local state without a second fetch.
        effective_role, has_active_override, override_expires_at = _get_effective_role(
            user
        )
        role = _normalize(effective_role)

        can_manage_system    = role in _SYSTEM_ADMIN_ROLES
        can_manage_mess      = role in _MESS_ROLES
        can_manage_media     = role in _MEDIA_ROLES
        can_manage_spaces    = role in _SPACES_ROLES
        can_manage_equipment = role in _EQUIPMENT_ROLES

        can_access_admin_portal = (
            can_manage_system
            or can_manage_mess
            or can_manage_media
            or can_manage_spaces
            or can_manage_equipment
        )

        return Response(
            {
                "id":    user.id,
                "email": user.email,
                "name":  user.first_name,
                "first_name":          user.first_name,
                "last_name":           user.last_name,
                "phone":               user.phone,
                "designation":         user.designation,
                "employee_student_id": user.employee_student_id,
                "department":      user.department_id,
                "department_name": (
                    user.department.department_name if user.department else None
                ),
                "base_role":           user.role.name if getattr(user, "role", None) else None,
                "effective_role":      effective_role,
                "has_active_override": has_active_override,
                "override_expires_at": override_expires_at,
                "is_staff":            user.is_staff,
                "is_superuser":        user.is_superuser,
                "capabilities": {
                    "can_access_admin_portal": can_access_admin_portal,
                    "can_manage_system":       can_manage_system,
                    "can_manage_spaces":       can_manage_spaces,
                    "can_manage_equipment":    can_manage_equipment,
                    "can_manage_mess":         can_manage_mess,
                    "can_manage_media":        can_manage_media,
                },
            }
        )


# ==========================================
# DASHBOARD AGGREGATOR VIEW
# ==========================================


class DashboardAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user  = request.user
        today = timezone.now().date()

        spaces = (
            SpaceBooking.objects.filter(user=user, start_datetime__date__gte=today)
            .exclude(status="REJECTED")
            .order_by("start_datetime")
        )

        fleet = (
            FleetBooking.objects.filter(user=user, start_datetime__date__gte=today)
            .exclude(status="REJECTED")
            .order_by("start_datetime")
        )

        mess = (
            MessBooking.objects.filter(user=user, booking_date__gte=today)
            .exclude(status="REJECTED")
            .order_by("booking_date")
        )

        media = (
            MediaBooking.objects.filter(user=user, booking_date__gte=today)
            .exclude(status="REJECTED")
            .order_by("booking_date", "start_time")
        )

        total_pending = (
            spaces.filter(status="PENDING").count()
            + fleet.filter(status="PENDING").count()
            + mess.filter(status="PENDING").count()
            + media.filter(status="PENDING").count()
        )

        return Response(
            {
                "greeting": {
                    "user_name":     user.first_name or "User",
                    "pending_count": total_pending,
                    "date_display":  today.strftime("%A, %B %d"),
                },
                "modules": {
                    "spaces": [
                        {
                            "id":     s.id,
                            "ref":    s.reference_code,
                            "title":  s.space.name,
                            "status": s.status,
                        }
                        for s in spaces
                    ],
                    "fleet": [
                        {
                            "id":     f.id,
                            "ref":    f.reference_code,
                            "title":  f.vehicle.name,
                            "status": f.status,
                        }
                        for f in fleet
                    ],
                    "mess": [
                        {
                            "id":     m.id,
                            "ref":    m.reference_code,
                            "title":  f"Catering ({m.total_persons} Pax)",
                            "status": m.status,
                        }
                        for m in mess
                    ],
                    "media": [
                        {
                            "id":     e.id,
                            "ref":    e.reference_code,
                            "title":  e.event_name,
                            "status": e.status,
                        }
                        for e in media
                    ],
                },
            }
        )


# ==========================================
# ADMIN MANAGEMENT VIEWS
# ==========================================


class RoleOverrideViewSet(ModelViewSet):
    queryset = (
        RoleOverride.objects.all()
        .select_related("user", "overridden_role", "granted_by")
        .order_by("-created_at")
    )
    serializer_class   = RoleOverrideSerializer
    permission_classes = [IsAuthenticated, IsITAdmin]

    def perform_create(self, serializer):
        serializer.save(granted_by=self.request.user)

    def get_queryset(self):
        queryset  = super().get_queryset()
        is_active = self.request.query_params.get("active", None)
        if is_active == "true":
            queryset = queryset.filter(is_active=True)
        return queryset


class RoleListView(APIView):
    permission_classes = [IsAuthenticated, IsITAdmin]

    def get(self, request):
        roles = Group.objects.all().values("id", "name")
        return Response(roles)


class UserSearchView(APIView):
    permission_classes = [IsAuthenticated, IsITAdmin]

    def get(self, request):
        query = request.query_params.get("q", "").strip()
        if len(query) < 2:
            return Response([])

        users = CustomUser.objects.filter(
            Q(email__icontains=query)
            | Q(first_name__icontains=query)
            | Q(employee_student_id__icontains=query)
        ).values("id", "email", "first_name", "employee_student_id")[:10]

        return Response(list(users))