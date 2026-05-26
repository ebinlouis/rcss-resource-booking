from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.viewsets import ModelViewSet
from rest_framework.decorators import action  # <-- ADDED
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.utils import timezone
from django.db.models import Q

from apps.spaces.models import SpaceBooking
from apps.fleet.models import FleetBooking
from apps.mess.models import MessBooking
from apps.media.models import MediaBooking

from .models import RoleOverride, Department, CustomUser, Role
from .serializers import AdminUserSerializer, RoleOverrideSerializer, DepartmentSerializer
from .permissions import IsITAdmin, IsITAdminOrHOD, IsHODWithDepartment


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

    def perform_create(self, serializer):
        serializer.save(is_active=False)


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

def _build_user_response(user, request=None):
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
    EQUIPMENT_MANAGEMENT_ROLES = {
        Role.Name.LAB_INCHARGE, Role.Name.MEDIA_INCHARGE, Role.Name.IT_ADMIN,
    }

    can_manage_spaces_base = bool(effective_roles & SPACE_MANAGEMENT_ROLES)
    if not can_manage_spaces_base:
        can_manage_spaces_base = (
            user.fallback_chains.exists() or
            user.space_approver_assignments.filter(is_active=True).exists()
        )

    capabilities = {
        'can_access_admin_portal':   bool(effective_roles & ADMIN_PORTAL_ROLES) or can_manage_spaces_base,
        'can_manage_system':         Role.Name.IT_ADMIN in effective_roles,
        'can_manage_spaces':         can_manage_spaces_base,
        'can_manage_labs':           bool(effective_roles & LAB_MANAGEMENT_ROLES),
        'can_manage_equipment':      bool(effective_roles & EQUIPMENT_MANAGEMENT_ROLES),
        'can_manage_mess':           Role.Name.MESS_MANAGER in effective_roles,
        'can_manage_media':          Role.Name.MEDIA_INCHARGE in effective_roles,
        'can_manage_fleet':          Role.Name.FLEET_MANAGER in effective_roles,
        'can_manage_principal_view': Role.Name.PRINCIPAL in effective_roles,
        'can_approve_faculty':       Role.Name.FACULTY in effective_roles,
        'can_manage_timetables':     Role.Name.LAB_INCHARGE in effective_roles,
        'is_student':                Role.Name.STUDENT in effective_roles,
    }

    # Superuser override — gets full capabilities
    if user.is_superuser:
        capabilities = {
            'can_access_admin_portal':   True,
            'can_manage_system':         True,
            'can_manage_spaces':         True,
            'can_manage_labs':           True,
            'can_manage_equipment':      True,
            'can_manage_mess':           False,
            'can_manage_media':          False,
            'can_manage_fleet':          True,
            'can_manage_principal_view': True,
            'can_approve_faculty':       True,
            'can_manage_timetables':     True,
            'is_student':                False,
        }

    profile_image_url = None
    if user.profile_image:
        profile_image_url = user.profile_image.url
        if request is not None:
            profile_image_url = request.build_absolute_uri(profile_image_url)

    return {
        'id':                   user.id,
        'email':                user.email,
        'name':                 user.first_name,
        'first_name':           user.first_name,
        'last_name':            user.last_name,
        'phone':                user.phone,
        'designation':          user.designation,
        'profile_image':        profile_image_url,
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
        return Response(_build_user_response(request.user, request))


# ==========================================
# USER PROFILE UPDATE VIEW
# ==========================================

class UserProfileUpdateView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    UPDATABLE_FIELDS = [
        'first_name', 'last_name', 'email', 'phone',
        'designation', 'department', 'profile_image',
    ]

    def patch(self, request):
        user   = request.user
        errors = {}
        update_fields = set()

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
                update_fields.add('department_id')
            elif field == 'email':
                email = get_user_model().objects.normalize_email(str(value).strip())
                try:
                    validate_email(email)
                except ValidationError:
                    errors['email'] = 'Enter a valid email address.'
                    continue

                if CustomUser.objects.exclude(pk=user.pk).filter(email__iexact=email).exists():
                    errors['email'] = 'This email address is already in use.'
                    continue

                user.email = email
                update_fields.add('email')
            elif field == 'profile_image':
                uploaded = request.FILES.get('profile_image')
                if not uploaded:
                    continue

                allowed_types = {
                    'image/jpeg',
                    'image/png',
                    'image/webp',
                }
                if uploaded.content_type not in allowed_types:
                    errors['profile_image'] = 'Upload a JPG, PNG, JPEG, or WEBP image.'
                    continue

                user.profile_image = uploaded
                update_fields.add('profile_image')
            elif field == 'first_name':
                if not str(value).strip():
                    errors['first_name'] = 'First name cannot be blank.'
                else:
                    setattr(user, field, str(value).strip())
                    update_fields.add(field)
            elif field == 'phone':
                setattr(user, field, str(value).strip() if value else None)
                update_fields.add(field)
            else:
                setattr(user, field, str(value).strip() if value else None)
                update_fields.add(field)

        if errors:
            return Response(errors, status=status.HTTP_400_BAD_REQUEST)

        if update_fields:
            update_fields.add('updated_at')
            user.save(update_fields=list(update_fields))

        return Response(_build_user_response(user, request))


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


class AdminUserViewSet(ModelViewSet):
    serializer_class = AdminUserSerializer
    permission_classes = [IsAuthenticated, IsITAdminOrHOD]
    http_method_names = ['get', 'patch', 'head', 'options', 'post', 'delete']

    def get_queryset(self):
        user = self.request.user
        effective_roles = user.get_effective_roles()

        queryset = (
            CustomUser.objects
            .select_related('department')
            .prefetch_related('roles')
            .order_by('first_name', 'last_name', 'email')
        )

        if Role.Name.IT_ADMIN in effective_roles or user.is_superuser:
            dept_id = self.request.query_params.get('department')
            if dept_id:
                queryset = queryset.filter(department_id=dept_id)
        elif Role.Name.HOD in effective_roles:
            if user.department_id:
                queryset = queryset.filter(department_id=user.department_id)
                # Filter to only faculty and HOD roles
                queryset = queryset.filter(roles__name__in=[Role.Name.FACULTY, Role.Name.HOD])
            else:
                queryset = queryset.none()
        else:
            queryset = queryset.none()

        query = self.request.query_params.get('q', '').strip()
        role_name = self.request.query_params.get('role', '').strip().upper()

        if query:
            queryset = queryset.filter(
                Q(email__icontains=query)
                | Q(first_name__icontains=query)
                | Q(last_name__icontains=query)
                | Q(employee_student_id__icontains=query)
                | Q(phone__icontains=query)
                | Q(department__department_name__icontains=query)
            )

        if role_name:
            queryset = queryset.filter(roles__name=role_name)

        return queryset.distinct()

    def perform_create(self, serializer):
        user = serializer.save()
        password = self.request.data.get('password') or "Rajagiri@123"
        user.set_password(password)
        
        # Override department for HOD / non-IT-Admin
        if not self.request.user.is_superuser and not self.request.user.has_role(Role.Name.IT_ADMIN):
            user.department = self.request.user.department

        # Manage roles and department activation
        if user.department:
            from django.contrib.auth import get_user_model
            User = get_user_model()
            
            hod_role = Role.objects.filter(name=Role.Name.HOD).first()
            fac_role = Role.objects.filter(name=Role.Name.FACULTY).first()
            staff_role = Role.objects.filter(name=Role.Name.STAFF).first()
            
            # Check if there is an active HOD in this department
            hod_exists = User.objects.filter(
                department=user.department,
                roles=hod_role,
                is_active=True
            ).exclude(id=user.id).exists()
            
            if not hod_exists:
                # FIRST FACULTY RULE: auto assign hod, faculty, staff roles silently
                if hod_role:
                    user.roles.add(hod_role)
                if fac_role:
                    user.roles.add(fac_role)
                if staff_role:
                    user.roles.add(staff_role)
                
                # Activate the department
                user.department.is_active = True
                user.department.save()
            else:
                # If there's an existing HOD and the new user is explicitly marked as HOD, demote other HODs
                user_has_hod = user.roles.filter(name=Role.Name.HOD).exists()
                if user_has_hod:
                    other_hods = User.objects.filter(
                        department=user.department,
                        roles=hod_role,
                        is_active=True
                    ).exclude(id=user.id)
                    for oh in other_hods:
                        oh.roles.remove(hod_role)
                        oh.save()
        else:
            # Assign default role if none and no department
            if not user.roles.exists():
                faculty_role = Role.objects.filter(name=Role.Name.FACULTY).first()
                if faculty_role:
                    user.roles.add(faculty_role)
        
        user.save()

    def perform_update(self, serializer):
        user = serializer.save()
        # Override department for HOD / non-IT-Admin
        if not self.request.user.is_superuser and not self.request.user.has_role(Role.Name.IT_ADMIN):
            user.department = self.request.user.department
            user.save()

        # Manage roles and department activation
        if user.department:
            from django.contrib.auth import get_user_model
            User = get_user_model()
            hod_role = Role.objects.filter(name=Role.Name.HOD).first()
            
            user_has_hod = user.roles.filter(name=Role.Name.HOD).exists()
            if user_has_hod:
                # HOD REPLACEMENT LOGIC: Demote other HODs in this department
                other_hods = User.objects.filter(
                    department=user.department,
                    roles=hod_role,
                    is_active=True
                ).exclude(id=user.id)
                for oh in other_hods:
                    oh.roles.remove(hod_role)
                    oh.save()
                
                # Ensure department is active
                if not user.department.is_active:
                    user.department.is_active = True
                    user.department.save()

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        try:
            self.perform_destroy(instance)
            return Response(status=status.HTTP_204_NO_CONTENT)
        except Exception:
            instance.is_active = False
            instance.save()
            return Response(
                {'message': 'User could not be deleted, so they have been deactivated instead.'},
                status=status.HTTP_200_OK
            )

    @action(detail=True, methods=['post'], url_path='reset-password')
    def reset_password(self, request, pk=None):
        user = self.get_object()
        new_password = request.data.get('password') or "Rajagiri@123"
        user.set_password(new_password)
        user.save()
        return Response({'message': 'Password successfully reset.'}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='set-roles')
    def set_roles(self, request, pk=None):
        """
        Controller action for IT Admin badge updates.
        URL: POST /api/auth/admin-users/<id>/set-roles/
        Body: {"roles": [1, 2, 3]}
        """
        if not isinstance(request.data.get('roles'), list):
            return Response(
                {'roles': 'Expected a list of role IDs.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = self.get_object()
        serializer = self.get_serializer(
            user,
            data={'roles': request.data.get('roles')},
            partial=True,
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_200_OK)


class RoleListView(APIView):
    """Returns all available roles. Used by IT Admin when assigning roles."""
    permission_classes = [IsAuthenticated, IsITAdminOrHOD]

    def get(self, request):
        roles = Role.objects.all().order_by('name')
        return Response([
            {
                'id': role.id,
                'name': role.name,
                'display_name': role.get_name_display(),
                'description': role.description,
            }
            for role in roles
        ])


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
        ).values('id', 'email', 'first_name', 'last_name', 'employee_student_id')[:10]

        return Response(list(users))


# ==========================================
# HOD FACULTY CSV BULK UPLOAD VIEW
# ==========================================

class HODFacultyCSVUploadView(APIView):
    """
    Allows an HOD to bulk-add or update faculty/students in their department
    by uploading a CSV file.

    Security model:
      - IsHODWithDepartment: caller must hold the HOD role AND have a dept set.
      - Department-boundary check: existing users belonging to a different
        department cause the entire upload to be rejected.

    CSV contract:
      Required headers (exact): Sl No, Name, Dept., mail id, Mobile Number
      Encoding: utf-8-sig (strips Excel BOM automatically)

    Transaction model:
      - Validation pass first — zero DB writes if any row is invalid.
      - All DB writes happen inside transaction.atomic(); any unexpected
        exception rolls back everything.
    """

    permission_classes = [IsAuthenticated, IsHODWithDepartment]
    parser_classes     = [MultiPartParser, FormParser]

    # ── Constants ──────────────────────────────────────────────────────────
    REQUIRED_HEADERS = {'Sl No', 'Name', 'Dept.', 'mail id', 'Mobile Number'}
    MAX_ROWS         = 500

    def post(self, request):
        import csv
        import io
        from django.contrib.auth.hashers import make_password

        # ── 1. File presence check ─────────────────────────────────────────
        csv_file = request.FILES.get('file')
        if not csv_file:
            return Response(
                {'detail': 'No file uploaded. Please attach a CSV file with key "file".'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # ── 2. Decode with utf-8-sig to transparently strip Excel BOM ──────
        try:
            decoded = csv_file.read().decode('utf-8-sig')
        except UnicodeDecodeError:
            return Response(
                {'detail': 'File encoding error. Please save your CSV as UTF-8 before uploading.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        reader   = csv.DictReader(io.StringIO(decoded))
        raw_hdrs = set(reader.fieldnames or [])

        # ── 3. Header validation ───────────────────────────────────────────
        missing = self.REQUIRED_HEADERS - raw_hdrs
        if missing:
            return Response(
                {
                    'detail': (
                        f'Invalid CSV structure. Missing headers: {", ".join(sorted(missing))}. '
                        f'Required headers: {", ".join(sorted(self.REQUIRED_HEADERS))}.'
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # ── 4. Read all rows into memory ───────────────────────────────────
        rows = list(reader)

        if len(rows) > self.MAX_ROWS:
            return Response(
                {'detail': f'Upload limit exceeded. Maximum {self.MAX_ROWS} rows allowed; file has {len(rows)}.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not rows:
            return Response(
                {'detail': 'The uploaded CSV file contains no data rows.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # ── 5. Validation pass (no DB writes) ─────────────────────────────
        validation_errors = []
        seen_emails       = {}   # email_lower → first Sl No that used it

        parsed_rows = []  # list of clean dicts ready for DB work

        for row in rows:
            sl_no = str(row.get('Sl No', '')).strip()
            name  = str(row.get('Name', '')).strip()
            email = str(row.get('mail id', '')).strip()
            phone = str(row.get('Mobile Number', '')).strip() or None

            row_errors = []

            # Name must not be empty
            if not name:
                row_errors.append('Name cannot be empty.')

            # Email format validation
            if not email:
                row_errors.append('mail id cannot be empty.')
            else:
                try:
                    validate_email(email)
                    email_lower = email.lower()
                except ValidationError:
                    row_errors.append(f'"{email}" is not a valid email address.')
                    email_lower = None

                if email_lower:
                    if email_lower in seen_emails:
                        row_errors.append(
                            f'Duplicate email "{email}" — already appears at row {seen_emails[email_lower]}.'
                        )
                    else:
                        seen_emails[email_lower] = sl_no or str(len(parsed_rows) + 1)

            if row_errors:
                validation_errors.append({
                    'sl_no':  sl_no,
                    'email':  email,
                    'errors': row_errors,
                })
                continue  # keep collecting errors for all rows

            # Name splitting: safe for single names and multi-space names
            parts      = name.split(' ', 1)
            first_name = parts[0]
            last_name  = parts[1] if len(parts) > 1 else ''

            # Derive email prefix for password / role heuristic
            email_prefix = email.split('@')[0]

            parsed_rows.append({
                'sl_no':        sl_no,
                'name':         name,
                'email':        email,
                'email_lower':  email.lower(),
                'email_prefix': email_prefix,
                'first_name':   first_name,
                'last_name':    last_name,
                'phone':        phone,
            })

        # Reject the entire upload if any row failed validation
        if validation_errors:
            return Response(
                {
                    'detail': f'{len(validation_errors)} row(s) failed validation. No data was imported.',
                    'validation_errors': validation_errors,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # ── 6. Database pass — inside atomic transaction ───────────────────
        hod_department = request.user.department

        created_users = []
        updated_users = []

        try:
            from django.db import transaction

            with transaction.atomic():
                # Pre-fetch roles needed for new-user assignment
                student_role = Role.objects.filter(name=Role.Name.STUDENT).first()
                faculty_role = Role.objects.filter(name=Role.Name.FACULTY).first()

                # Bulk-fetch all matching existing users in one query
                all_emails = [r['email_lower'] for r in parsed_rows]
                existing_map = {
                    u.email.lower(): u
                    for u in CustomUser.objects.filter(email__in=all_emails).select_related('department')
                }

                for pr in parsed_rows:
                    existing = existing_map.get(pr['email_lower'])

                    if existing:
                        # ── Department-boundary security check ─────────────
                        if existing.department and existing.department != hod_department:
                            # Abort the entire upload
                            raise ValueError(
                                f"User {pr['email']} belongs to department "
                                f"'{existing.department.department_name}' and cannot be "
                                f"modified by a Head of Department from "
                                f"'{hod_department.department_name}'."
                            )

                        # ── Update existing user (name + phone only) ───────
                        existing.first_name = pr['first_name']
                        existing.last_name  = pr['last_name']
                        existing.phone      = pr['phone']
                        existing.save(update_fields=['first_name', 'last_name', 'phone', 'updated_at'])

                        updated_users.append({
                            'email': existing.email,
                            'name':  f"{pr['first_name']} {pr['last_name']}".strip(),
                        })

                    else:
                        # ── Create new user ────────────────────────────────
                        # Role heuristic: digits in prefix → STUDENT, else FACULTY
                        has_digits  = any(c.isdigit() for c in pr['email_prefix'])
                        assign_role = student_role if has_digits else faculty_role

                        # Deterministic password: RCSS@<email_prefix>
                        raw_password  = f"RCSS@{pr['email_prefix']}"
                        hashed_pwd    = make_password(raw_password)

                        # Generate a unique employee_student_id
                        import uuid
                        emp_id = f"CSV-{uuid.uuid4().hex[:8].upper()}"

                        new_user = CustomUser(
                            email               = pr['email'],
                            first_name          = pr['first_name'],
                            last_name           = pr['last_name'],
                            phone               = pr['phone'],
                            department          = hod_department,
                            is_active           = True,
                            employee_student_id = emp_id,
                            password            = hashed_pwd,
                        )
                        new_user.save()

                        if assign_role:
                            new_user.roles.add(assign_role)

                        created_users.append({
                            'email': new_user.email,
                            'name':  f"{pr['first_name']} {pr['last_name']}".strip(),
                        })

        except ValueError as exc:
            # Department-boundary violation — raised inside atomic(), already rolled back
            return Response(
                {'detail': str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # ── 7. Success response ────────────────────────────────────────────
        return Response(
            {
                'summary': {
                    'created_count': len(created_users),
                    'updated_count': len(updated_users),
                    'error_count':   0,
                },
                'created': created_users,
                'updated': updated_users,
                'errors':  [],
            },
            status=status.HTTP_200_OK,
        )
