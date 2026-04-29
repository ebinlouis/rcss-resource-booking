from django.db import models
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin, Group, BaseUserManager
from django.db.models import Q

class Department(models.Model):
    department_name = models.CharField(max_length=100, unique=True)
    department_code = models.CharField(max_length=20, unique=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.department_code


class CustomUserManager(BaseUserManager):
    """
    Custom user model manager where email is the unique identifiers
    for authentication instead of usernames.
    """
    def create_user(self, email, employee_student_id, password=None, **extra_fields):
        if not email:
            raise ValueError('The Email must be set')
        if not employee_student_id:
            raise ValueError('The Staff ID / Register No must be set')
        
        email = self.normalize_email(email)
        user = self.model(email=email, employee_student_id=employee_student_id, **extra_fields)
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


class CustomUser(AbstractBaseUser, PermissionsMixin):
    # AbstractBaseUser inherently provides 'password' and 'last_login' fields.
    
    employee_student_id = models.CharField(max_length=50, unique=True)
    first_name = models.CharField(max_length=150)
    middle_name = models.CharField(max_length=150, blank=True, null=True)
    last_name = models.CharField(max_length=150, blank=True, null=True)
    email = models.EmailField(unique=True)
    phone = models.CharField(max_length=20, null=True, blank=True)
    
    # Relationships
    role = models.ForeignKey(Group, on_delete=models.PROTECT, null=True, blank=True)
    department = models.ForeignKey(Department, on_delete=models.PROTECT, null=True, blank=True)
    designation = models.CharField(max_length=100, null=True, blank=True)
    
    # Flags
    is_active = models.BooleanField(default=True)
    is_verified = models.BooleanField(default=False)
    is_staff = models.BooleanField(default=False)
    is_superuser = models.BooleanField(default=False)
    
    # Timestamps & Media
    profile_image = models.ImageField(upload_to='profiles/', null=True, blank=True)
    date_joined = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['employee_student_id', 'first_name']

    objects = CustomUserManager()

    def __str__(self):
        return f"{self.first_name} ({self.employee_student_id})"


class RoleOverride(models.Model):
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='role_overrides')
    overridden_role = models.ForeignKey(Group, on_delete=models.CASCADE)
    granted_by = models.ForeignKey(CustomUser, on_delete=models.PROTECT, related_name='granted_overrides')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['user'], 
                condition=Q(is_active=True), 
                name='unique_active_override'
            )
        ]

    def __str__(self):
        return f"Override for {self.user} -> {self.overridden_role}"