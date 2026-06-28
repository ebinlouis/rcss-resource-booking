import uuid
from django.db import models
from django.db.models import Q, F, Func
from django.contrib.postgres.constraints import ExclusionConstraint
from django.contrib.postgres.fields import RangeOperators, DateTimeRangeField, ArrayField
from django.conf import settings
from apps.approvals.models import BaseBooking


class TsTzRange(Func):
    function = "TSTZRANGE"
    output_field = DateTimeRangeField()


# ==========================================
# 0. BLOCK
# ==========================================


class Block(models.Model):
    """
    Campus block / building — defines the scope for RECEPTIONIST assignments.
    Managed dynamically by IT Admin via API.
    """

    name = models.CharField(max_length=100, unique=True)
    code = models.CharField(max_length=20, unique=True)
    description = models.TextField(blank=True, default="")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name


# ==========================================
# 1. THE SPACE MODEL
# ==========================================


class Space(models.Model):
    class SpaceType(models.TextChoices):
        GENERAL_HALL = "GENERAL_HALL", "General Hall"
        LAB = "LAB", "Lab"
        GUEST_ROOM = "GUEST_ROOM", "Guest Room"
        CLASSROOM = "CLASSROOM", "Classroom"

    class ApprovalCategory(models.TextChoices):
        GENERAL = "GENERAL", "General"  # approved by RECEPTIONIST
        LAB = "LAB", "Lab"  # approved by LAB_INCHARGE / HOD
        LIBRARY = "LIBRARY", "Library"  # approved by LIBRARIAN

    class ApprovalWorkflowType(models.TextChoices):
        DIRECT = "DIRECT", "Direct Approver"
        HOD_FALLBACK = "HOD_FALLBACK", "HOD with Fallback"

    name = models.CharField(max_length=100)
    space_type = models.CharField(max_length=20, choices=SpaceType.choices)
    approval_category = models.CharField(
        max_length=20,
        choices=ApprovalCategory.choices,
        default=ApprovalCategory.GENERAL,
        help_text="Determines which role type approves bookings for this space.",
    )
    approval_workflow_type = models.CharField(
        max_length=30,
        choices=ApprovalWorkflowType.choices,
        default=ApprovalWorkflowType.DIRECT,
        help_text="Determines whether approvals are direct or routed through a hierarchical fallback workflow.",
    )
    block = models.ForeignKey(
        Block,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="spaces",
        help_text="Campus block this space belongs to. Scopes RECEPTIONIST assignments.",
    )
    department = models.ForeignKey(
        "users.Department",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="spaces",
        help_text="Assigned department for HOD-routed approval workflows.",
    )
    capacity_hard = models.IntegerField()
    location = models.CharField(max_length=100)
    description = models.TextField(blank=True, default="")
    image_1 = models.ImageField(upload_to="spaces/", null=True, blank=True)
    is_active = models.BooleanField(default=True)
    is_special_purpose = models.BooleanField(
        default=False,
        help_text="If True, this space is reserved for specific workflows and won't be auto-suggested.",
    )
    setup_buffer_minutes = models.IntegerField(
        default=0, help_text="Minutes blocked before a booking starts (setup/cleaning)."
    )
    teardown_buffer_minutes = models.IntegerField(
        default=0, help_text="Minutes blocked after a booking ends (teardown/cleaning)."
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["name", "location"], name="unique_space_location"
            )
        ]

    def __str__(self):
        return f"{self.name} ({self.location})"


# ==========================================
# 2. SPACE APPROVER
# ==========================================


class SpaceApprover(models.Model):
    """
    Scoped approver assignment — links a user+role to a block or specific space.

    Examples:
        RECEPTIONIST  → Block A         (manages all GENERAL spaces in Block A)
        LAB_INCHARGE  → Advanced AI Lab (manages that specific lab only)
        LIBRARIAN     → Library Block   (manages all LIBRARY spaces in that block)

    Multiple rows per user are allowed — a receptionist can cover multiple blocks.
    IT Admin manages these assignments via API.
    """

    class ScopeType(models.TextChoices):
        BLOCK = "BLOCK", "Block"  # user manages all spaces in a block
        SPACE = "SPACE", "Space"  # user manages one specific space

    user = models.ForeignKey(
        "users.CustomUser",
        on_delete=models.CASCADE,
        related_name="space_approver_assignments",
    )
    role = models.ForeignKey(
        "users.Role",
        on_delete=models.PROTECT,
        related_name="space_approver_assignments",
        help_text="Must be RECEPTIONIST, LAB_INCHARGE, or LIBRARIAN.",
    )
    scope_type = models.CharField(
        max_length=10,
        choices=ScopeType.choices,
        help_text="Whether this assignment scopes to a block or a specific space.",
    )
    block = models.ForeignKey(
        Block,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="approver_assignments",
        help_text="Set when scope_type=BLOCK.",
    )
    space = models.ForeignKey(
        Space,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="approver_assignments",
        help_text="Set when scope_type=SPACE.",
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["user", "role", "block"],
                condition=Q(is_active=True, scope_type="BLOCK", block__isnull=False),
                name="unique_active_block_assignment",
            ),
            models.UniqueConstraint(
                fields=["user", "role", "space"],
                condition=Q(is_active=True, scope_type="SPACE", space__isnull=False),
                name="unique_active_space_assignment",
            ),
        ]

    def __str__(self):
        scope = (
            self.block.name
            if self.scope_type == "BLOCK"
            else getattr(self.space, "name", "?")
        )
        return f"{self.user} as {self.role} → {scope}"


# ==========================================
# 3. EQUIPMENT CATALOG
# ==========================================


class EquipmentCategory(models.TextChoices):
    AV = "AV", "Audio / Visual"
    LIGHTING = "LIGHTING", "Lighting"
    FURNITURE = "FURNITURE", "Furniture"
    COMPUTING = "COMPUTING", "Computing"
    NETWORKING = "NETWORKING", "Networking"
    OTHER = "OTHER", "Other"


class Equipment(models.Model):
    name = models.CharField(max_length=150, unique=True)
    category = models.CharField(max_length=20, choices=EquipmentCategory.choices)
    description = models.TextField(blank=True, default="")
    total_owned = models.PositiveIntegerField(default=0)
    is_portable = models.BooleanField(
        default=True, help_text="False for fixed/built-in items like ceiling projectors"
    )
    is_standard_media_kit = models.BooleanField(
        default=False,
        help_text="If True, automatically assigns 1 unit to every Media Team request.",
    )
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.name} (x{self.total_owned})"


class SpaceEquipment(models.Model):
    space = models.ForeignKey(
        Space, on_delete=models.CASCADE, related_name="built_in_equipment"
    )
    equipment = models.ForeignKey(Equipment, on_delete=models.RESTRICT)
    quantity = models.PositiveIntegerField(default=1)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["space", "equipment"], name="unique_space_equipment"
            )
        ]
        verbose_name_plural = "Space Equipment"

    def __str__(self):
        return f"{self.quantity}x {self.equipment.name} in {self.space.name}"


# ==========================================
# 4. BOOKINGS
# ==========================================


class SpaceBooking(BaseBooking):
    class BookingType(models.TextChoices):
        SINGLE_CONTINUOUS = "SINGLE", "Single / Continuous"
        RECURRING_DAILY = "RECURRING", "Recurring Daily"

    group_id = models.UUIDField(default=uuid.uuid4, editable=False, db_index=True)
    event_group_id = models.UUIDField(null=True, blank=True, db_index=True)
    booking_type = models.CharField(
        max_length=20,
        choices=BookingType.choices,
        default=BookingType.SINGLE_CONTINUOUS,
    )
    space = models.ForeignKey(Space, on_delete=models.PROTECT, related_name="bookings")
    start_datetime = models.DateTimeField(db_index=True)
    end_datetime = models.DateTimeField(db_index=True)
    attendee_count = models.IntegerField()
    purpose_of_booking = models.TextField()
    is_external = models.BooleanField(default=False)
    faculty_sponsor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="sponsored_bookings",
    )
    faculty_response_deadline = models.DateTimeField(null=True, blank=True)
    faculty_timed_out = models.BooleanField(
        default=False,
help_text="Indicates that approval was escalated after faculty non-response."    )
    chain_escalated_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text=(
            "Set when the fallback approver is notified via the HOD_FALLBACK "
            "chain escalation. Null means escalation has not yet fired."
        ),
    )

    class Meta(BaseBooking.Meta):
        constraints = BaseBooking.Meta.constraints + [
            models.CheckConstraint(
                condition=Q(start_datetime__lt=F("end_datetime")),
                name="space_booking_start_before_end",
            ),
            models.CheckConstraint(
                condition=Q(attendee_count__gt=0),
                name="space_booking_positive_attendees",
            ),
            ExclusionConstraint(
                name="exclude_overlapping_approved_space_bookings",
                expressions=[
                    ("space", RangeOperators.EQUAL),
                    (
                        TsTzRange("start_datetime", "end_datetime"),
                        RangeOperators.OVERLAPS,
                    ),
                ],
                condition=Q(status="APPROVED"),
            ),
        ]

    def save(self, *args, **kwargs):
        if not self.reference_code:
            self.reference_code = f"SPC-{uuid.uuid4().hex[:8].upper()}"
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.reference_code} - {self.space.name}"


class EquipmentRequest(models.Model):
    space_booking = models.ForeignKey(
        SpaceBooking,
        on_delete=models.CASCADE,
        related_name="requested_equipment",
        null=True,
        blank=True,
    )
    equipment = models.ForeignKey(Equipment, on_delete=models.RESTRICT)
    quantity = models.PositiveIntegerField(default=1)
    is_delivered = models.BooleanField(default=False)
    is_returned = models.BooleanField(default=False)

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=models.Q(space_booking__isnull=False),
                name="equipment_request_must_have_booking",
            )
        ]

    def __str__(self):
        return f"{self.quantity}x {self.equipment.name} for {self.space_booking.reference_code}"


# ==========================================
# 5. SPACE APPROVER CHAIN & SYSTEMS
# ==========================================

class SpaceApproverChain(models.Model):
    space = models.OneToOneField(Space, on_delete=models.CASCADE, related_name='approver_chain')
    primary_approver = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='primary_chains')
    fallback_approver = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='fallback_chains')
    escalation_hours = models.PositiveIntegerField(
        default=24,
        help_text="Hours before booking escalates to fallback approver."
    )
    requires_reason = models.BooleanField(
        default=True,
        help_text="If true, booking purpose is mandatory."
    )
    earliest_start = models.TimeField(
        null=True,
        blank=True,
        help_text="Earliest allowed booking start time. Leave blank for no restriction."
    )
    latest_end = models.TimeField(
        null=True,
        blank=True,
        help_text="Latest allowed booking end time. Leave blank for no restriction."
    )

    def __str__(self):
        return f"Chain for {self.space.name}"



# ==========================================
# 6. TIMETABLE BATCHES & BLOCKS
# ==========================================

class TimetableUploadBatch(models.Model):
    space = models.ForeignKey(Space, on_delete=models.CASCADE, related_name='timetable_batches')
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)
    upload_label = models.CharField(max_length=200, default='')
    row_count = models.IntegerField(default=0)
    skipped_count = models.IntegerField(default=0)

    def __str__(self):
        return f"Batch for {self.space.name} ({self.upload_label})"


class SpaceTimetableBlock(models.Model):
    batch = models.ForeignKey(TimetableUploadBatch, on_delete=models.CASCADE, related_name='blocks')
    space = models.ForeignKey(Space, on_delete=models.CASCADE, related_name='timetable_blocks')
    date = models.DateField(db_index=True)
    start_time = models.TimeField()
    end_time = models.TimeField()
    label = models.CharField(max_length=200, default='')

    class Meta:
        indexes = [
            models.Index(fields=['space', 'date', 'start_time', 'end_time'])
        ]

    def __str__(self):
        return f"{self.space.name} {self.date} {self.start_time}-{self.end_time}"


# ==========================================
# 7. CATEGORY AFFINITY
# ==========================================

class SpaceCategoryAffinity(models.Model):
    from_category = models.CharField(max_length=50)
    allowed_categories = ArrayField(models.CharField(max_length=50), default=list, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['from_category'], name='unique_from_category_affinity')
        ]

    def __str__(self):
        return f"{self.from_category} -> {', '.join(self.allowed_categories)}"
