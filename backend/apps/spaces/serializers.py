import json
import uuid
from datetime import timedelta
from rest_framework import serializers

from apps.approvals.lifecycle import can_user_modify_booking
from apps.users.models import Role, RoleOverride
from .models import (
    Block,
    Space,
    SpaceBooking,
    Equipment,
    SpaceEquipment,
    EquipmentRequest,
    SpaceApprover,
    SpaceTimetableBlock,
)
from .utils import get_overlapping_bookings, build_conflict_report, get_space_time_window


SCHEDULE_ENTRY_BASE_FIELDS = (
    "id",
    "start_datetime",
    "end_datetime",
    "subject",
    "purpose_of_booking",
    "instructor",
    "status",
    "booking_type",
    "is_timetable",
    "can_modify",
    "space_details",
    "booked_by_name",
    "booked_by_designation",
    "booked_by_department",
)


# ==========================================
# 1. EQUIPMENT SERIALIZERS
# ==========================================


class EquipmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Equipment
        fields = [
            "id",
            "name",
            "category",
            "description",
            "total_owned",
            "is_portable",
            "is_active",
            "is_standard_media_kit",
        ]


class SpaceEquipmentSerializer(serializers.ModelSerializer):
    equipment_name = serializers.CharField(source="equipment.name", read_only=True)

    class Meta:
        model = SpaceEquipment
        fields = ["id", "equipment", "equipment_name", "quantity"]


# ==========================================
# 2. SPACE SERIALIZER
# ==========================================


class SpaceSerializer(serializers.ModelSerializer):
    built_in_equipment = SpaceEquipmentSerializer(many=True, read_only=True)

    # Accepts a JSON string because multipart/form-data (required for image
    # uploads) cannot send nested JSON arrays directly.
    equipment_data = serializers.CharField(write_only=True, required=False)

    approver_chain = serializers.SerializerMethodField()
    chain_primary_approver   = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    chain_fallback_approver  = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    chain_escalation_hours   = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    chain_requires_reason    = serializers.BooleanField(write_only=True, required=False, allow_null=True)
    chain_earliest_start     = serializers.TimeField(write_only=True, required=False, allow_null=True)
    chain_latest_end         = serializers.TimeField(write_only=True, required=False, allow_null=True)

    
    can_manage_timetable = serializers.SerializerMethodField()

    def get_can_manage_timetable(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        user = request.user
        if user.is_superuser:
            return True
        if hasattr(obj, 'approver_chain'):
            chain = obj.approver_chain
            if user.id in [chain.primary_approver_id, chain.fallback_approver_id]:
                return True
        from .models import SpaceApprover
        if SpaceApprover.objects.filter(user=user, space=obj, scope_type='SPACE').exists():
            return True
        if obj.block_id and SpaceApprover.objects.filter(user=user, block_id=obj.block_id, scope_type='BLOCK').exists():
            return True
        return False

    def get_approver_chain(self, obj):
        try:
            chain = obj.approver_chain
        except Exception:
            return None
        
        def user_repr(user):
            if not user:
                return None
            name = f"{user.first_name} {user.last_name}".strip() or user.email
            return {"id": user.id, "name": name}
        
        return {
            "primary_approver": user_repr(chain.primary_approver),
            "fallback_approver": user_repr(chain.fallback_approver),
            "escalation_hours": chain.escalation_hours,
            "requires_reason": chain.requires_reason,
            "earliest_start": chain.earliest_start.strftime("%H:%M") if chain.earliest_start else None,
            "latest_end": chain.latest_end.strftime("%H:%M") if chain.latest_end else None,
        }

    class Meta:
        model = Space
        fields = [
            "id",
            "name",
            "description",
            "space_type",
            "approval_category",
            "approval_workflow_type",
            "department",
            "block",
            "capacity_hard",
            "location",
            "image_1",
            "is_active",
            "is_special_purpose",
            "setup_buffer_minutes",
            "teardown_buffer_minutes",
            "built_in_equipment",
            "equipment_data",
            "can_manage_timetable",
            "approver_chain",
            "chain_primary_approver",
            "chain_fallback_approver",
            "chain_escalation_hours",
            "chain_requires_reason",
            "chain_earliest_start",
            "chain_latest_end",
        ]

    def validate(self, data):
        if data.get('approval_workflow_type') == 'HOD_FALLBACK':
            if not data.get('chain_primary_approver'):
                raise serializers.ValidationError({
                    "chain_primary_approver": "A primary approver is required for HOD Fallback workflow."
                })
            if not data.get('chain_fallback_approver'):
                raise serializers.ValidationError({
                    "chain_fallback_approver": "A fallback approver is required for HOD Fallback workflow."
                })
        return data
  
    def _handle_chain(self, space, validated_data):
        workflow = validated_data.get(
            'approval_workflow_type',
            getattr(space, 'approval_workflow_type', None)
        )
        
        if workflow != 'HOD_FALLBACK':
            # If workflow changed away from HOD_FALLBACK, delete the chain row
            from .models import SpaceApproverChain
            SpaceApproverChain.objects.filter(space=space).delete()
            return
        
        primary_id   = validated_data.pop('chain_primary_approver', None)
        fallback_id  = validated_data.pop('chain_fallback_approver', None)
        escalation   = validated_data.pop('chain_escalation_hours', 24)
        req_reason   = validated_data.pop('chain_requires_reason', True)
        earliest     = validated_data.pop('chain_earliest_start', None)
        latest       = validated_data.pop('chain_latest_end', None)
        
        if not primary_id or not fallback_id:
            raise serializers.ValidationError({
                "chain_primary_approver": "Primary and fallback approvers are required for HOD Fallback workflow."
            })
        
        from .models import SpaceApproverChain
        SpaceApproverChain.objects.update_or_create(
            space=space,
            defaults={
                'primary_approver_id':  primary_id,
                'fallback_approver_id': fallback_id,
                'escalation_hours':     escalation or 24,
                'requires_reason':      req_reason if req_reason is not None else True,
                'earliest_start':       earliest,
                'latest_end':           latest,
            }
        )

    def create(self, validated_data):
        equipment_raw = validated_data.pop("equipment_data", None)
        chain_data = {
            "chain_primary_approver": validated_data.pop("chain_primary_approver", None),
            "chain_fallback_approver": validated_data.pop("chain_fallback_approver", None),
            "chain_escalation_hours": validated_data.pop("chain_escalation_hours", None),
            "chain_requires_reason": validated_data.pop("chain_requires_reason", None),
            "chain_earliest_start": validated_data.pop("chain_earliest_start", None),
            "chain_latest_end": validated_data.pop("chain_latest_end", None),
        }
        space = Space.objects.create(**validated_data)
        if equipment_raw:
            for item in json.loads(equipment_raw):
                SpaceEquipment.objects.create(
                    space=space,
                    equipment_id=item["equipment"],
                    quantity=item["quantity"],
                )
        self._handle_chain(space, {**validated_data, **chain_data})
        return space

    def update(self, instance, validated_data):
        equipment_raw = validated_data.pop("equipment_data", None)
        chain_data = {
            "chain_primary_approver": validated_data.pop("chain_primary_approver", None),
            "chain_fallback_approver": validated_data.pop("chain_fallback_approver", None),
            "chain_escalation_hours": validated_data.pop("chain_escalation_hours", None),
            "chain_requires_reason": validated_data.pop("chain_requires_reason", None),
            "chain_earliest_start": validated_data.pop("chain_earliest_start", None),
            "chain_latest_end": validated_data.pop("chain_latest_end", None),
        }
        instance = super().update(instance, validated_data)
        if equipment_raw:
            instance.built_in_equipment.all().delete()
            for item in json.loads(equipment_raw):
                SpaceEquipment.objects.create(
                    space=instance,
                    equipment_id=item["equipment"],
                    quantity=item["quantity"],
                )
        self._handle_chain(instance, {**validated_data, **chain_data})
        return instance


# ==========================================
# 3. BOOKING SERIALIZER
# ==========================================


class EquipmentRequestSerializer(serializers.ModelSerializer):
    equipment_name = serializers.CharField(source="equipment.name", read_only=True)

    class Meta:
        model = EquipmentRequest
        fields = [
            "id",
            "equipment",
            "equipment_name",
            "quantity",
            "is_delivered",
            "is_returned",
        ]
        read_only_fields = ["is_delivered", "is_returned"]


class BookingUserFieldsMixin:
    """Shared public requester fields for booking-like schedule entries."""

    def _get_effective_roles_for(self, user):
        if hasattr(user, '_cached_effective_roles'):
            return user._cached_effective_roles

        from django.utils import timezone
        from django.db.models import Q
        now = timezone.now()

        # Use prefetch cache for roles if available — avoids a DB hit
        if hasattr(user, '_prefetched_objects_cache') and 'roles' in user._prefetched_objects_cache:
            base = {r.name for r in user.roles.all()}
        else:
            base = set(user.roles.values_list('name', flat=True))

        # Use prefetch cache for role_overrides if available
        if hasattr(user, '_prefetched_objects_cache') and 'role_overrides' in user._prefetched_objects_cache:
            override_roles = {
                o.role.name for o in user.role_overrides.all()
                if o.is_active
                and (o.valid_until is None or o.valid_until > now)
                and o.revoked_at is None
            }
        else:
            override_roles = set(
                RoleOverride.objects.filter(
                    user=user,
                    is_active=True,
                )
                .filter(Q(valid_until__isnull=True) | Q(valid_until__gt=now))
                .filter(revoked_at__isnull=True)
                .values_list('role__name', flat=True)
            )

        result = base | override_roles
        user._cached_effective_roles = result
        return result

    def _booked_by_name_for(self, user):
        if not user:
            return None

        parts = [user.first_name, user.last_name]
        full_name = " ".join(part for part in parts if part)
        return full_name or user.email

    def _booked_by_designation_for(self, user):
        if not user:
            return None

        if user.designation:
            return user.designation

        role_labels = {
            "IT_ADMIN": "IT Administrator",
            "PRINCIPAL": "Principal",
            "HOD": "Head of Department",
            "RECEPTIONIST": "Receptionist",
            "LAB_INCHARGE": "Lab In-Charge",
            "LIBRARIAN": "Librarian",
            "MESS_MANAGER": "Mess Manager",
            "MEDIA_INCHARGE": "Media In-Charge",
            "FLEET_MANAGER": "Fleet Manager",
            "FACULTY": "Faculty",
            "STAFF": "Staff",
            "STUDENT": "Student",
        }
        priority = [
            "IT_ADMIN",
            "PRINCIPAL",
            "HOD",
            "RECEPTIONIST",
            "LAB_INCHARGE",
            "LIBRARIAN",
            "MESS_MANAGER",
            "MEDIA_INCHARGE",
            "FLEET_MANAGER",
            "FACULTY",
            "STAFF",
            "STUDENT",
        ]
        effective_roles = self._get_effective_roles_for(user)
        for role in priority:
            if role in effective_roles:
                return role_labels[role]

        return None

    @staticmethod
    def _booked_by_department_for(user):
        if not user or not user.department:
            return None
        return user.department.department_name


class SpaceBookingSerializer(BookingUserFieldsMixin, serializers.ModelSerializer):
    space_details = SpaceSerializer(source="space", read_only=True)

    equipment_requests = EquipmentRequestSerializer(
        source="requested_equipment",
        many=True,
        required=False,
    )

    subject = serializers.SerializerMethodField()
    # Deprecated: frontend clients should migrate to ``subject``.
    purpose_of_booking = serializers.SerializerMethodField(
        help_text="Deprecated: use subject instead."
    )
    instructor = serializers.SerializerMethodField()
    is_timetable = serializers.SerializerMethodField()

    purpose_of_booking_input = serializers.CharField(
        write_only=True,
        required=True,
        source="purpose_of_booking",
    )

    can_modify = serializers.SerializerMethodField()

    booked_by_name = serializers.SerializerMethodField()
    booked_by_email = serializers.SerializerMethodField()
    booked_by_designation = serializers.SerializerMethodField()
    booked_by_department = serializers.SerializerMethodField()
    booked_by_phone = serializers.SerializerMethodField()
    booked_by_photo = serializers.SerializerMethodField()

    faculty_sponsor_name = serializers.SerializerMethodField()
    faculty_sponsor_details = serializers.SerializerMethodField()
    faculty_timed_out = serializers.BooleanField(read_only=True)
    faculty_phone = serializers.SerializerMethodField()

    def get_faculty_phone(self, obj):
        if obj.faculty_sponsor:
            return getattr(obj.faculty_sponsor, 'phone', None)
        return None

    def get_faculty_sponsor_details(self, obj):
        if not obj.faculty_sponsor:
            return None
        
        request = self._request()
        profile_image = None
        if getattr(obj.faculty_sponsor, 'profile_image', None):
            if request:
                profile_image = request.build_absolute_uri(obj.faculty_sponsor.profile_image.url)
            else:
                profile_image = obj.faculty_sponsor.profile_image.url

        return {
            "id": obj.faculty_sponsor.id,
            "first_name": getattr(obj.faculty_sponsor, 'first_name', ''),
            "last_name": getattr(obj.faculty_sponsor, 'last_name', ''),
            "email": getattr(obj.faculty_sponsor, 'email', ''),
            "profile_image": profile_image
        }

    class Meta:
        model = SpaceBooking
        fields = [
            "id",
            "reference_code",
            "group_id",
            "event_group_id",
            "booking_type",
            "user",
            "department",
            "status",
            "space",
            "space_details",
            "start_datetime",
            "end_datetime",
            "attendee_count",
            "subject",
            "purpose_of_booking",
            "instructor",
            "is_timetable",
            "booked_by_name",
            "booked_by_email",
            "booked_by_designation",
            "booked_by_department",
            "booked_by_phone",
            "booked_by_photo",
            "purpose_of_booking_input",
            "user_notes",
            "equipment_requests",
            "is_external",
            "created_at",
            "updated_at",
            "can_modify",
            "remarks_by_admin",
            "faculty_sponsor",
            "faculty_sponsor_name",
            "faculty_sponsor_details",
            "faculty_response_deadline",
            "faculty_timed_out",
            "faculty_phone",
        ]
        read_only_fields = [
            "reference_code",
            "group_id",
            "created_at",
            "updated_at",
            "user",
            "faculty_sponsor",
            "faculty_sponsor_details",
            "faculty_response_deadline",
            "faculty_timed_out",
        ]

    def _request(self):
        return self.context.get("request")

    def _user(self):
        req = self._request()
        if not req:
            return None
        user = req.user
        # AnonymousUser has no pk — treat as unauthenticated
        if not user or not user.is_authenticated:
            return None
        return user

    def get_purpose_of_booking(self, obj):
        if not obj.purpose_of_booking:
            return "Occupied"
        user = self._user()

        # Unauthenticated users viewing the public general schedule
        # can see the purpose — it helps them plan around existing bookings.
        if user is None:
            return obj.purpose_of_booking

        if user.is_staff or user.is_superuser:
            return obj.purpose_of_booking

        if obj.user_id == user.pk:
            return obj.purpose_of_booking

        if "FACULTY" in self._get_effective_roles_for(user):
            return obj.purpose_of_booking

        return "Occupied"

    def get_subject(self, obj):
        return self.get_purpose_of_booking(obj)

    def get_instructor(self, obj):
        return ""

    @staticmethod
    def get_is_timetable(obj):
        return False

    def get_can_modify(self, obj):
        user = self._user()

        if user is None:
            return False

        return can_user_modify_booking(obj) and (
            obj.user_id == user.pk or user.is_staff or user.is_superuser
        )

    def get_booked_by_name(self, obj):
        return self._booked_by_name_for(obj.user)

    def get_booked_by_email(self, obj):
        return obj.user.email if obj.user else None

    def get_booked_by_designation(self, obj):
        return self._booked_by_designation_for(obj.user)

    def get_booked_by_department(self, obj):
        if not obj.department:
            return None
        return obj.department.department_name

    def get_booked_by_phone(self, obj):
        requester = self._user()
        if requester is None:
            return None
        effective = self._get_effective_roles_for(requester)
        if requester.is_staff or requester.is_superuser or 'IT_ADMIN' in effective or 'FACULTY' in effective:
            return getattr(obj.user, "phone_number", None) or getattr(obj.user, "phone", None)
        return None

    def get_booked_by_photo(self, obj):
        request = self._request()
        if not obj.user or not obj.user.profile_image:
            return None
        if request:
            return request.build_absolute_uri(obj.user.profile_image.url)
        return obj.user.profile_image.url

    def get_faculty_sponsor_name(self, obj):
        if obj.faculty_sponsor:
            return (
                f"{obj.faculty_sponsor.first_name} {obj.faculty_sponsor.last_name}".strip()
                or obj.faculty_sponsor.email
            )
        return None

    def create(self, validated_data):
        request = self._request()
        if request and request.data.get("faculty_sponsor"):
            validated_data["faculty_sponsor_id"] = request.data.get("faculty_sponsor")

        equipment_data = validated_data.pop("requested_equipment", [])
        booking_type = validated_data.get(
            "booking_type", SpaceBooking.BookingType.SINGLE_CONTINUOUS
        )

        if booking_type == SpaceBooking.BookingType.RECURRING_DAILY:
            start = validated_data.pop("start_datetime")
            end = validated_data.pop("end_datetime")
            group_id = uuid.uuid4()
            validated_data["group_id"] = group_id

            days_diff = (end.date() - start.date()).days
            first_booking = None

            for i in range(days_diff + 1):
                slot_start = start + timedelta(days=i)
                slot_end = start.replace(
                    hour=end.hour, minute=end.minute, second=end.second
                ) + timedelta(days=i)

                booking = SpaceBooking.objects.create(
                    start_datetime=slot_start, end_datetime=slot_end, **validated_data
                )

                if not first_booking:
                    first_booking = booking

                for eq_data in equipment_data:
                    EquipmentRequest.objects.create(space_booking=booking, **eq_data)

            return first_booking

        booking = super().create(validated_data)

        for eq_data in equipment_data:
            EquipmentRequest.objects.create(space_booking=booking, **eq_data)

        return booking

    def update(self, instance, validated_data):
        equipment_data = validated_data.pop("requested_equipment", None)

        new_type = validated_data.get("booking_type", instance.booking_type)
        new_start = validated_data.get("start_datetime", instance.start_datetime)
        new_end = validated_data.get("end_datetime", instance.end_datetime)

        SpaceBooking.objects.filter(group_id=instance.group_id).exclude(
            pk=instance.pk
        ).delete()

        if new_type == SpaceBooking.BookingType.RECURRING_DAILY:
            days_diff = (new_end.date() - new_start.date()).days

            validated_data["end_datetime"] = new_start.replace(
                hour=new_end.hour,
                minute=new_end.minute,
                second=new_end.second,
                microsecond=0,
            )

            instance = super().update(instance, validated_data)

            for i in range(1, days_diff + 1):
                slot_start = new_start + timedelta(days=i)
                slot_end = instance.end_datetime + timedelta(days=i)

                new_booking = SpaceBooking.objects.create(
                    group_id=instance.group_id,
                    event_group_id=instance.event_group_id,
                    booking_type=new_type,
                    space=instance.space,
                    user=instance.user,
                    department=instance.department,
                    start_datetime=slot_start,
                    end_datetime=slot_end,
                    attendee_count=instance.attendee_count,
                    purpose_of_booking=instance.purpose_of_booking,
                    user_notes=instance.user_notes,
                    is_external=instance.is_external,
                    status=instance.status,
                    remarks_by_admin=instance.remarks_by_admin,
                    faculty_sponsor_id=instance.faculty_sponsor_id,
                )

                if equipment_data:
                    for eq in equipment_data:
                        EquipmentRequest.objects.create(space_booking=new_booking, **eq)

        else:
            instance = super().update(instance, validated_data)

        if equipment_data is not None:
            instance.requested_equipment.all().delete()

            for eq_data in equipment_data:
                EquipmentRequest.objects.create(space_booking=instance, **eq_data)

        return instance

    def validate(self, data):
        if self.instance and not can_user_modify_booking(self.instance):
            raise serializers.ValidationError(
                {
                    "non_field_errors": [
                        "Cannot modify a booking whose start time has already passed."
                    ]
                }
            )

        space = data.get("space")
        attendees = data.get("attendee_count")
        start = data.get("start_datetime")
        end = data.get("end_datetime")
        notes = data.get("user_notes", "")
        booking_type = data.get(
            "booking_type", SpaceBooking.BookingType.SINGLE_CONTINUOUS
        )

        # ── Past-date / past-time check (all spaces, IST) ─────────────
        if start:
            from django.utils import timezone
            now_local = timezone.localtime(timezone.now())
            start_local = timezone.localtime(start)

            if start_local.date() < now_local.date():
                raise serializers.ValidationError(
                    {"start_datetime": "Cannot create a booking in the past."}
                )
            if (
                start_local.date() == now_local.date()
                and start_local.time() < now_local.time()
            ):
                raise serializers.ValidationError(
                    {"start_datetime": "Cannot create a booking for a time that has already passed today."}
                )

        # ── Per-space time-window override check ──────────────────────
        if space and start and end:
            earliest, latest = get_space_time_window(space)

            if earliest is not None or latest is not None:
                from django.utils import timezone as tz
                start_time = tz.localtime(start).time()
                end_time = tz.localtime(end).time()

                window_start_str = earliest.strftime("%H:%M") if earliest else "open"
                window_end_str = latest.strftime("%H:%M") if latest else "open"

                if earliest and start_time < earliest:
                    raise serializers.ValidationError(
                        {
                            "start_datetime": (
                                f"This space does not allow bookings before "
                                f"{window_start_str}. "
                                f"Allowed window: {window_start_str}–{window_end_str}."
                            )
                        }
                    )
                if latest and end_time > latest:
                    raise serializers.ValidationError(
                        {
                            "end_datetime": (
                                f"This space does not allow bookings after "
                                f"{window_end_str}. "
                                f"Allowed window: {window_start_str}–{window_end_str}."
                            )
                        }
                    )

        if space and attendees:
            if attendees > space.capacity_hard:
                raise serializers.ValidationError(
                    {"attendee_count": f"Max capacity is {space.capacity_hard}."}
                )

            min_expected = space.capacity_hard * 0.30

            is_hod_fallback_space = (
                getattr(space, "approval_workflow_type", "")
                == Space.ApprovalWorkflowType.HOD_FALLBACK
            )
            if not is_hod_fallback_space and attendees < min_expected and not notes.strip():
                raise serializers.ValidationError(
                    {
                        "user_notes": (
                            f"This space seats {space.capacity_hard}. "
                            f"For a group of {attendees}, provide justification."
                        )
                    }
                )

        if space and start and end:
            exclude_pk = self.instance.pk if self.instance else None

            if booking_type == SpaceBooking.BookingType.RECURRING_DAILY:
                if start.time() >= end.time():
                    raise serializers.ValidationError(
                        {
                            "start_datetime": "For recurring bookings, start must be before end."
                        }
                    )

                conflicts = []
                days_diff = (end.date() - start.date()).days

                for i in range(days_diff + 1):
                    slot_start = start + timedelta(days=i)
                    slot_end = start.replace(
                        hour=end.hour, minute=end.minute, second=end.second
                    ) + timedelta(days=i)

                    overlapping = get_overlapping_bookings(
                        space, slot_start, slot_end, exclude_pk=exclude_pk
                    )

                    if overlapping.exists():
                        conflicts.extend(
                            build_conflict_report(overlapping, self._user())
                        )

                if conflicts:
                    conflict_summary = "; ".join(
                        f"{c['date']} {c['start']}–{c['end']}" for c in conflicts
                    )

                    raise serializers.ValidationError(
                        {"non_field_errors": [f"Booking conflicts: {conflict_summary}"]}
                    )

            else:
                if start >= end:
                    raise serializers.ValidationError(
                        {"start_datetime": "Must be before end time."}
                    )

                overlapping = get_overlapping_bookings(
                    space, start, end, exclude_pk=exclude_pk
                )

                if overlapping.exists():
                    conflicts = build_conflict_report(overlapping, self._user())

                    conflict_summary = "; ".join(
                        f"{c['date']} {c['start']}–{c['end']}" for c in conflicts
                    )

                    raise serializers.ValidationError(
                        {"non_field_errors": [f"Booking conflicts: {conflict_summary}"]}
                    )

        return data


class TimetableScheduleEntrySerializer(BookingUserFieldsMixin, serializers.ModelSerializer):
    """Public general-schedule representation for an imported timetable block."""

    id = serializers.SerializerMethodField()
    start_datetime = serializers.SerializerMethodField()
    end_datetime = serializers.SerializerMethodField()
    subject = serializers.SerializerMethodField()
    # Deprecated: frontend clients should migrate to ``subject``.
    purpose_of_booking = serializers.SerializerMethodField(
        help_text="Deprecated: use subject instead."
    )
    instructor = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()
    booking_type = serializers.SerializerMethodField()
    is_timetable = serializers.SerializerMethodField()
    can_modify = serializers.SerializerMethodField()
    space_details = serializers.SerializerMethodField()
    booked_by_name = serializers.SerializerMethodField()
    booked_by_designation = serializers.SerializerMethodField()
    booked_by_department = serializers.SerializerMethodField()

    class Meta:
        model = SpaceTimetableBlock
        fields = SCHEDULE_ENTRY_BASE_FIELDS

    @staticmethod
    def _subject_for(obj):
        return obj.label or obj.batch.upload_label or "Class Timetable"

    def get_id(self, obj):
        return f"tt_{obj.id}"

    def get_start_datetime(self, obj):
        from datetime import datetime
        from django.utils import timezone

        return timezone.make_aware(datetime.combine(obj.date, obj.start_time)).isoformat()

    def get_end_datetime(self, obj):
        from datetime import datetime
        from django.utils import timezone

        return timezone.make_aware(datetime.combine(obj.date, obj.end_time)).isoformat()

    def get_subject(self, obj):
        return self._subject_for(obj)

    def get_purpose_of_booking(self, obj):
        return self._subject_for(obj)

    def get_instructor(self, obj):
        return obj.instructor or ""

    @staticmethod
    def get_status(obj):
        return "APPROVED"

    @staticmethod
    def get_booking_type(obj):
        return "SINGLE"

    @staticmethod
    def get_is_timetable(obj):
        return True

    @staticmethod
    def get_can_modify(obj):
        return False

    @staticmethod
    def get_space_details(obj):
        return {
            "id": obj.space.id,
            "name": obj.space.name,
            "capacity_hard": obj.space.capacity_hard,
        }

    @staticmethod
    def _uploader_for(obj):
        return obj.batch.uploaded_by if obj.batch_id else None

    def get_booked_by_name(self, obj):
        return self._booked_by_name_for(self._uploader_for(obj))

    def get_booked_by_designation(self, obj):
        return self._booked_by_designation_for(self._uploader_for(obj))

    def get_booked_by_department(self, obj):
        return self._booked_by_department_for(self._uploader_for(obj))


# ==========================================
# 4. BLOCK SERIALIZER
# ==========================================


class BlockSerializer(serializers.ModelSerializer):
    class Meta:
        model = Block
        fields = [
            "id",
            "name",
            "code",
            "description",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


# ==========================================
# 5. SPACE APPROVER SERIALIZER
# ==========================================

# Roles that are valid as SpaceApprover assignments.
# IT_ADMIN, HOD, PRINCIPAL etc. manage scope differently and
# must never appear in a SpaceApprover row.
SCOPED_APPROVER_ROLES = {
    Role.Name.RECEPTIONIST,
    Role.Name.LAB_INCHARGE,
    Role.Name.LIBRARIAN,
}


class SpaceApproverSerializer(serializers.ModelSerializer):
    # Read-only display fields — keeps the write surface clean (FK ids only)
    user_email = serializers.EmailField(source="user.email", read_only=True)
    user_name = serializers.CharField(source="user.first_name", read_only=True)
    role_display = serializers.CharField(source="role.get_name_display", read_only=True)
    block_name = serializers.CharField(source="block.name", read_only=True)
    space_name = serializers.CharField(source="space.name", read_only=True)
    profile_image = serializers.SerializerMethodField()
    space_image = serializers.SerializerMethodField()

    def get_profile_image(self, obj):
        request = self.context.get("request")
        if obj.user and obj.user.profile_image:
            if request:
                return request.build_absolute_uri(obj.user.profile_image.url)
            return obj.user.profile_image.url
        return None

    def get_space_image(self, obj):
        request = self.context.get("request")
        if obj.space and obj.space.image_1:
            if request:
                return request.build_absolute_uri(obj.space.image_1.url)
            return obj.space.image_1.url
        return None

    class Meta:
        model = SpaceApprover
        fields = [
            "id",
            "user",
            "user_email",
            "user_name",
            "profile_image",
            "role",
            "role_display",
            "scope_type",
            "block",
            "block_name",
            "space",
            "space_name",
            "space_image",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    # ------------------------------------------------------------------
    # Field-level validation
    # ------------------------------------------------------------------

    def validate_role(self, role):
        """
        Only RECEPTIONIST, LAB_INCHARGE, and LIBRARIAN are valid here.
        All other roles manage scope through different mechanisms.
        """
        if role.name not in SCOPED_APPROVER_ROLES:
            raise serializers.ValidationError(
                f"'{role.get_name_display()}' cannot be assigned as a SpaceApprover. "
                f"Valid roles: {', '.join(SCOPED_APPROVER_ROLES)}."
            )
        return role

    # ------------------------------------------------------------------
    # Object-level validation
    # ------------------------------------------------------------------

    def validate(self, data):
        scope_type = data.get("scope_type")
        block = data.get("block")
        space = data.get("space")

        # ── Scope consistency ─────────────────────────────────────────
        if scope_type == SpaceApprover.ScopeType.BLOCK:
            if not block:
                raise serializers.ValidationError(
                    {"block": "A block must be provided when scope_type is BLOCK."}
                )
            if space:
                raise serializers.ValidationError(
                    {"space": "space must be empty when scope_type is BLOCK."}
                )

        elif scope_type == SpaceApprover.ScopeType.SPACE:
            if not space:
                raise serializers.ValidationError(
                    {"space": "A space must be provided when scope_type is SPACE."}
                )
            if block:
                raise serializers.ValidationError(
                    {"block": "block must be empty when scope_type is SPACE."}
                )

        return data

    # ------------------------------------------------------------------
    # Create: auto-grant the scoped role to the user
    # ------------------------------------------------------------------

    def create(self, validated_data):
        """
        Creates the SpaceApprover assignment and automatically grants the
        associated role to the user if they don't already hold it.
        """
        approver = super().create(validated_data)

        user = approver.user
        role = approver.role

        if not user.roles.filter(id=role.id).exists():
            user.roles.add(role)

        return approver

    # ------------------------------------------------------------------
    # to_representation: flag last assignment for role
    # ------------------------------------------------------------------

    def to_representation(self, instance):
        """
        Adds a helper flag so the frontend can show a warning when the
        user will lose their role badge upon deletion (last assignment).
        """
        data = super().to_representation(instance)
        user = instance.user
        role = instance.role

        remaining_assignments = (
            SpaceApprover.objects.filter(user=user, role=role, is_active=True)
            .exclude(pk=instance.pk)
            .count()
        )
        data["is_last_assignment_for_role"] = remaining_assignments == 0
        return data
