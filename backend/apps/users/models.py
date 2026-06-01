from django.db import models
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin, BaseUserManager
from django.db.models import Q
from django.utils import timezone


# ==========================================
# ROLE DEFINITIONS
# ==========================================

class Role(models.Model):
    """
    First-class role model — replaces auth.Group as the role identity store.

    Using TextChoices as the canonical name list means:
    - Role names are validated at the model layer, never free-text
    - Permission classes reference Role.Name.IT_ADMIN, not magic strings
    - Adding a new role is one line here + one data migration row
    """

    class Name(models.TextChoices):
        # ── Booking-only roles (no admin portal access) ──────────────────────
        STUDENT          = 'STUDENT',          'Student'
        FACULTY          = 'FACULTY',          'Faculty'
        STAFF            = 'STAFF',            'Staff'

        # ── Scoped approvers ─────────────────────────────────────────────────
        RECEPTIONIST     = 'RECEPTIONIST',     'Receptionist'
        LAB_INCHARGE     = 'LAB_INCHARGE',     'Lab In-Charge'
        LIBRARIAN        = 'LIBRARIAN',        'Librarian'
        MESS_MANAGER     = 'MESS_MANAGER',     'Mess Manager'
        MEDIA_INCHARGE   = 'MEDIA_INCHARGE',   'Media In-Charge'
        FLEET_MANAGER    = 'FLEET_MANAGER',    'Fleet Manager'

        # ── Institutional roles ───────────────────────────────────────────────
        HOD              = 'HOD',              'Head of Department'
        PRINCIPAL        = 'PRINCIPAL',        'Principal'

        # ── System roles ──────────────────────────────────────────────────────
        IT_ADMIN         = 'IT_ADMIN',         'IT Administrator'

        # ── Parked (defined now, implemented later) ───────────────────────────
        SPORTS           = 'SPORTS',           'Sports Coordinator'
        FACILITY_MANAGER = 'FACILITY_MANAGER', 'Facility Manager'

    name        = models.CharField(
        max_length=30,
        choices=Name.choices,
        unique=True,
    )
    description = models.TextField(blank=True, default='')

    def __str__(self):
        return self.get_name_display()


# ==========================================
# DEPARTMENT
# ==========================================

class Department(models.Model):
    department_name = models.CharField(max_length=100, unique=True)
    department_code = models.CharField(max_length=20, unique=True)
    is_active       = models.BooleanField(default=True)
    created_at      = models.DateTimeField(auto_now_add=True)
    updated_at      = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.department_code


# ==========================================
# CUSTOM USER MANAGER
# ==========================================

class CustomUserManager(BaseUserManager):
    def create_user(self, email, employee_student_id, password=None, **extra_fields):
        if not email:
            raise ValueError('The Email must be set')
        if not employee_student_id:
            raise ValueError('The Staff ID / Register No must be set')

        email = self.normalize_email(email)
        user  = self.model(
            email               = email,
            employee_student_id = employee_student_id,
            **extra_fields
        )
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, employee_student_id, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('is_active', True)

        if extra_fields.get('is_staff') is not True:
            raise ValueError('Superuser must have is_staff=True.')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Superuser must have is_superuser=True.')

        return self.create_user(email, employee_student_id, password, **extra_fields)


# ==========================================
# CUSTOM USER
# ==========================================

class CustomUser(AbstractBaseUser, PermissionsMixin):
    """
    CustomUser with additive multi-role support via roles M2M.
    All role checks go through get_effective_roles().
    """

    employee_student_id = models.CharField(max_length=50, unique=True)
    first_name          = models.CharField(max_length=150)
    middle_name         = models.CharField(max_length=150, blank=True, null=True)
    last_name           = models.CharField(max_length=150, blank=True, null=True)
    email               = models.EmailField(unique=True)
    phone               = models.CharField(max_length=20, null=True, blank=True)
    designation         = models.CharField(max_length=100, null=True, blank=True)

    # ── Relationships ─────────────────────────────────────────────────────────
    department = models.ForeignKey(
        Department, on_delete=models.PROTECT, null=True, blank=True
    )

    # Additive multi-role M2M — single source of truth for all role checks
    roles = models.ManyToManyField(
        Role,
        blank=True,
        related_name='users',
        help_text='All roles assigned to this user. Additive — a user can hold multiple roles.',
    )

    # ── Flags ─────────────────────────────────────────────────────────────────
    is_active    = models.BooleanField(default=True)
    is_verified  = models.BooleanField(default=False)
    is_staff     = models.BooleanField(default=False)
    is_superuser = models.BooleanField(default=False)

    # ── Media & timestamps ────────────────────────────────────────────────────
    profile_image = models.ImageField(upload_to='profiles/', null=True, blank=True)
    date_joined   = models.DateTimeField(auto_now_add=True)
    updated_at    = models.DateTimeField(auto_now=True)

    USERNAME_FIELD  = 'email'
    REQUIRED_FIELDS = ['employee_student_id', 'first_name']

    objects = CustomUserManager()

    def __str__(self):
        return f"{self.first_name} ({self.employee_student_id})"

    # ── Role helpers ──────────────────────────────────────────────────────────

    def get_effective_roles(self):
        """
        Returns the full set of Role.Name values this user currently holds,
        including any active, non-expired RoleOverrides.

        This is the single source of truth for all permission checks.
        Never query roles M2M directly in permission code — always use this.

        Result is cached on the instance for the duration of the request
        to avoid repeated DB queries.
        """
        if hasattr(self, '_effective_roles_cache'):
            return self._effective_roles_cache

        now = timezone.now()

        # Base roles from M2M
        base = set(self.roles.values_list('name', flat=True))

        # Additive roles from active, non-expired, non-revoked overrides
        override_roles = set(
            RoleOverride.objects.filter(
                user      = self,
                is_active = True,
            )
            .filter(Q(valid_until__isnull=True) | Q(valid_until__gt=now))
            .filter(revoked_at__isnull=True)
            .values_list('role__name', flat=True)
        )

        result = base | override_roles
        self._effective_roles_cache = result
        return result

    def has_role(self, *role_names):
        """
        Convenience check: does this user hold ANY of the given role names?

        Usage:
            user.has_role(Role.Name.IT_ADMIN)
            user.has_role('IT_ADMIN', 'HOD')
        """
        return bool(self.get_effective_roles() & set(role_names))

    def invalidate_roles_cache(self):
        """
        Clears the instance-level role cache set by get_effective_roles().

        Call this after any operation that mutates this user's roles or
        overrides mid-request — e.g. after role assignments in management
        commands, signal handlers, or tests — so the next call to
        get_effective_roles() re-fetches from the DB instead of returning
        stale data.

        Safe to call even if the cache was never populated (no-op).
        """
        self.__dict__.pop('_effective_roles_cache', None)


# ==========================================
# ROLE OVERRIDE
# ==========================================

class RoleOverride(models.Model):
    """
    Grants an additional role to a user for a bounded time period.

    - Additive: does not replace existing roles, only adds to them.
    - Scoped: can be limited to a specific space or block.
    - Auditable: stores who granted it, why, and when it was revoked.
    - Constraint: one active override per user+role pair.
    """

    user       = models.ForeignKey(
        CustomUser, on_delete=models.CASCADE, related_name='role_overrides'
    )
    role       = models.ForeignKey(
        Role,
        on_delete    = models.PROTECT,
        related_name = 'overrides',
        help_text    = 'The role being granted additively.',
    )
    granted_by = models.ForeignKey(
        CustomUser, on_delete=models.PROTECT, related_name='granted_overrides'
    )

    # ── Optional scope ────────────────────────────────────────────────────────
    space = models.ForeignKey(
        'spaces.Space',
        on_delete    = models.SET_NULL,
        null         = True,
        blank        = True,
        related_name = 'role_overrides',
        help_text    = 'If set, this override applies to this specific space only.',
    )
    block = models.ForeignKey(
        'spaces.Block',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='role_overrides',
        help_text='If set, this override applies to this campus block only.',
    )

    # ── Validity window ───────────────────────────────────────────────────────
    valid_from  = models.DateTimeField(default=timezone.now)
    valid_until = models.DateTimeField(
        null      = True,
        blank     = True,
        help_text = 'Leave blank for indefinite. Expires automatically at this time.',
    )
    reason = models.TextField(
        help_text = 'Why this override was granted. Required for audit trail.',
    )

    # ── Revocation ────────────────────────────────────────────────────────────
    is_active  = models.BooleanField(default=True)
    revoked_at = models.DateTimeField(null=True, blank=True)
    revoked_by = models.ForeignKey(
        CustomUser,
        on_delete    = models.SET_NULL,
        null         = True,
        blank        = True,
        related_name = 'revoked_overrides',
    )

    # ── Audit timestamps ──────────────────────────────────────────────────────
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields    = ['user', 'role'],
                condition = Q(is_active=True),
                name      = 'unique_active_override_per_user_role',
            )
        ]

    def __str__(self):
        until = self.valid_until.strftime('%Y-%m-%d') if self.valid_until else 'indefinite'
        return f"{self.user} → {self.role} (until {until})"

    def revoke(self, revoked_by):
        """Soft-revoke this override. Idempotent."""
        if self.is_active:
            self.is_active  = False
            self.revoked_at = timezone.now()
            self.revoked_by = revoked_by
            self.save(update_fields=['is_active', 'revoked_at', 'revoked_by', 'updated_at'])