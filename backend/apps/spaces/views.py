import json
import logging
from datetime import timedelta
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.exceptions import ValidationError

from apps.approvals.lifecycle import (
    can_user_modify_booking,
    refresh_booking_lifecycle,
)
from apps.notifications.utils import (
    notify_booking_status_change, notify_group_status_change, notify_new_request,
    notify_faculty_new_request, notify_faculty_approved, notify_faculty_rejected,
    notify_faculty_details_changed, notify_incharge_escalated, notify_incharge_booking_returned,
    notify_faculty_resent, notify_student_cancelled_faculty, notify_incharge_booking_edited,
    mark_pending_request_notifications_read,
)
from apps.users.models import Role, CustomUser
from apps.users.permissions import IsAdminOrReadOnly, IsEquipmentManagerOrReadOnly, IsITAdmin, IsPrincipal
from .permissions import IsOwnerOrAdminOrReadOnly, IsAdminOrSpaceManagerOrReadOnly
from .models import Block, Space, SpaceBooking, Equipment, SpaceApprover
from .serializers import (
    BlockSerializer,
    SpaceSerializer,
    SpaceBookingSerializer,
    EquipmentSerializer,
    SpaceApproverSerializer,
)
from .utils import get_overlapping_bookings, build_conflict_report
from .linked_bookings import (
    cancel_linked_siblings_for_space,
    capture_space_anchor,
    sync_linked_siblings_after_space_edit,
)


logger = logging.getLogger(__name__)


# ==========================================
# RESOURCE CATALOG MANAGEMENT
# ==========================================

class EquipmentViewSet(viewsets.ModelViewSet):
    serializer_class   = EquipmentSerializer
    permission_classes = [IsEquipmentManagerOrReadOnly]

    def get_queryset(self):
        qs = Equipment.objects.filter(is_active=True)

        # Hide media kits if the frontend is asking for Space gear
        if self.request.query_params.get('for_space') == 'true':
            qs = qs.filter(is_standard_media_kit=False)

        return qs


class SpaceViewSet(viewsets.ModelViewSet):
    serializer_class   = SpaceSerializer
    permission_classes = [IsAdminOrSpaceManagerOrReadOnly]

    def _is_timetable_manager(self, request, space):
        user = request.user
        if not user.is_authenticated:
            return False
        if user.is_superuser:
            return True
        if hasattr(space, 'approver_chain'):
            chain = space.approver_chain
            if user.id in [chain.primary_approver_id, chain.fallback_approver_id]:
                return True
        from .models import SpaceApprover
        if SpaceApprover.objects.filter(user=user, space=space, scope_type='SPACE').exists():
            return True
        if space.block_id and SpaceApprover.objects.filter(user=user, block_id=space.block_id, scope_type='BLOCK').exists():
            return True
        return False

    def get_permissions(self):
        # Venue catalog is publicly browsable — no login required
        if self.action in ('list', 'retrieve'):
            return [AllowAny()]
        if self.action == 'timetable' and self.request.method == 'GET':
            return [AllowAny()]
        return super().get_permissions()

    def get_queryset(self):
        qs = Space.objects.filter(is_active=True)

        min_capacity = self.request.query_params.get('min_capacity')
        if min_capacity is not None:
            try:
                qs = qs.filter(capacity_hard__gte=int(min_capacity))
            except ValueError:
                pass

        if self.request.query_params.get('for_suggestion') == 'true':
            qs = qs.filter(is_special_purpose=False)

        if self.request.query_params.get('manage') == 'true':
            user = self.request.user
            if user.is_authenticated and not user.has_role(Role.Name.IT_ADMIN):
                assignments = user.space_approver_assignments.filter(is_active=True)
                space_ids = set()
                for a in assignments:
                    if a.scope_type == 'SPACE' and a.space_id:
                        space_ids.add(a.space_id)
                    elif a.scope_type == 'BLOCK' and a.block_id:
                        space_ids.update(Space.objects.filter(block_id=a.block_id).values_list('id', flat=True))
                
                space_ids.update(Space.objects.filter(approver_chain__fallback_approver=user).values_list('id', flat=True))
                
                qs = qs.filter(id__in=space_ids)

        return qs

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def check_availability(self, request, pk=None):
        space = self.get_object()

        start_raw    = request.data.get('start_datetime')
        end_raw      = request.data.get('end_datetime')
        booking_type = request.data.get('booking_type', SpaceBooking.BookingType.SINGLE_CONTINUOUS)

        if not start_raw or not end_raw:
            return Response(
                {"error": "Both start_datetime and end_datetime are required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        from django.utils.dateparse import parse_datetime
        start_dt = parse_datetime(start_raw)
        end_dt   = parse_datetime(end_raw)

        if not start_dt or not end_dt:
            return Response(
                {"error": "Invalid datetime format. Use ISO 8601."},
                status=status.HTTP_400_BAD_REQUEST
            )

        from django.utils import timezone as tz
        if tz.is_naive(start_dt):
            start_dt = tz.make_aware(start_dt)
        else:
            start_dt = tz.localtime(start_dt)
            
        if tz.is_naive(end_dt):
            end_dt = tz.make_aware(end_dt)
        else:
            end_dt = tz.localtime(end_dt)

        exclude_pk = request.data.get('exclude_booking_id')
        if exclude_pk:
            try:
                exclude_pk = int(exclude_pk)
            except (TypeError, ValueError):
                exclude_pk = None

        conflicts = []

        if booking_type == SpaceBooking.BookingType.RECURRING_DAILY:
            if start_dt.time() >= end_dt.time():
                return Response(
                    {"error": "For recurring bookings, daily start time must be before end time."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            days_diff = (end_dt.date() - start_dt.date()).days
            if days_diff < 0:
                return Response(
                    {"error": "start_datetime must be before end_datetime."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            for i in range(days_diff + 1):
                slot_start = start_dt + timedelta(days=i)
                slot_end   = slot_start.replace(
                    hour        = end_dt.hour,
                    minute      = end_dt.minute,
                    second      = end_dt.second,
                    microsecond = end_dt.microsecond,
                )

                overlapping = get_overlapping_bookings(space, slot_start, slot_end, exclude_pk=exclude_pk)
                if overlapping.exists():
                    conflicts.extend(build_conflict_report(overlapping, request.user))

                from .models import SpaceTimetableBlock
                overlaps_tt = SpaceTimetableBlock.objects.filter(
                    space=space,
                    date=slot_start.date(),
                    start_time__lt=slot_end.time(),
                    end_time__gt=slot_start.time()
                )
                for block in overlaps_tt:
                    conflicts.append({
                        "date": block.date.strftime("%Y-%m-%d"),
                        "start": block.start_time.strftime("%H:%M"),
                        "end": block.end_time.strftime("%H:%M"),
                        "label": block.label or "Class Timetable",
                        "reference_code": "TIMETABLE"
                    })

        else:
            if start_dt >= end_dt:
                return Response(
                    {"error": "start_datetime must be before end_datetime."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            overlapping = get_overlapping_bookings(space, start_dt, end_dt, exclude_pk=exclude_pk)
            if overlapping.exists():
                conflicts.extend(build_conflict_report(overlapping, request.user))

            from .models import SpaceTimetableBlock
            from datetime import time
            days_diff = (end_dt.date() - start_dt.date()).days
            for i in range(days_diff + 1):
                current_date = start_dt.date() + timedelta(days=i)
                slot_start_time = start_dt.time() if i == 0 else time(0, 0)
                slot_end_time = end_dt.time() if i == days_diff else time(23, 59, 59)

                overlaps_tt = SpaceTimetableBlock.objects.filter(
                    space=space,
                    date=current_date,
                    start_time__lt=slot_end_time,
                    end_time__gt=slot_start_time
                )
                for block in overlaps_tt:
                    conflicts.append({
                        "date": block.date.strftime("%Y-%m-%d"),
                        "start": block.start_time.strftime("%H:%M"),
                        "end": block.end_time.strftime("%H:%M"),
                        "label": block.label or "Class Timetable",
                        "reference_code": "TIMETABLE"
                    })

        unique_conflicts = []
        seen = set()
        for c in conflicts:
            sig = (c['date'], c['start'], c['end'], c.get('reference_code', ''))
            if sig not in seen:
                seen.add(sig)
                unique_conflicts.append(c)

        if not unique_conflicts:
            return Response({
                "available": True,
                "conflicts": [],
                "message":   "Space is available.",
            }, status=status.HTTP_200_OK)

        count = len(unique_conflicts)
        return Response({
            "available": False,
            "conflicts": unique_conflicts,
            "message":   f"{count} conflict{'s' if count != 1 else ''} found across your selected range.",
        }, status=status.HTTP_200_OK)

    # ==========================================
    # SPACE CONFIG & TIMETABLE
    # ==========================================

    @action(detail=True, methods=['get', 'put'], permission_classes=[IsITAdmin])
    def approver_config(self, request, pk=None):
        from .models import SpaceApproverChain
        space = self.get_object()
        
        if request.method == 'GET':
            try:
                chain = space.approver_chain
                
                def get_name(user):
                    if not user: return None
                    return f"{user.first_name} {user.last_name}".strip() or user.email
                
                return Response({
                    'primary_approver': chain.primary_approver_id,
                    'primary_approver_name': get_name(chain.primary_approver),
                    'fallback_approver': chain.fallback_approver_id,
                    'fallback_approver_name': get_name(chain.fallback_approver),
                    'escalation_hours': chain.escalation_hours,
                    'requires_reason': chain.requires_reason,
                    'earliest_start': chain.earliest_start,
                    'latest_end': chain.latest_end,
                })
            except SpaceApproverChain.DoesNotExist:
                return Response(status=status.HTTP_404_NOT_FOUND)
                
        elif request.method == 'PUT':
            from apps.users.models import CustomUser
            primary_id = request.data.get('primary_approver')
            fallback_id = request.data.get('fallback_approver')
                
            escalation_hours = int(request.data.get('escalation_hours', 24))
            requires_reason = bool(request.data.get('requires_reason', True))
            earliest_start = request.data.get('earliest_start') or None
            latest_end = request.data.get('latest_end') or None
            
            if not primary_id or not fallback_id:
                return Response({"error": "Primary and fallback approvers are required"}, status=status.HTTP_400_BAD_REQUEST)
                
            SpaceApproverChain.objects.update_or_create(
                space=space,
                defaults={
                    'primary_approver_id': primary_id,
                    'fallback_approver_id': fallback_id,
                    'escalation_hours': escalation_hours,
                    'requires_reason': requires_reason,
                    'earliest_start': earliest_start,
                    'latest_end': latest_end,
                }
            )
            return Response({"status": "updated"})

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def suggestions(self, request):
        space_id = request.query_params.get('space_id')
        attendee_count = request.query_params.get('attendee_count')
        date_str = request.query_params.get('date')
        start_time_str = request.query_params.get('start_time')
        end_time_str = request.query_params.get('end_time')

        if not all([space_id, attendee_count, date_str, start_time_str, end_time_str]):
            return Response([])

        # Trigger reason controls which capacity band to search.
        # Accepted values: "unavailable", "low_occupancy", "exceeds_capacity".
        # Any unrecognised value falls back to "unavailable".
        VALID_REASONS = {'unavailable', 'low_occupancy', 'exceeds_capacity'}
        trigger_reason = request.query_params.get('trigger_reason', 'unavailable')
        if trigger_reason not in VALID_REASONS:
            trigger_reason = 'unavailable'

        # booking_type is used to decide whether to check all dates in a range.
        booking_type = request.query_params.get('booking_type', 'SINGLE')

        try:
            attendee_count = int(attendee_count)
            from datetime import datetime
            start_date = datetime.strptime(date_str, '%Y-%m-%d').date()
            start_time = datetime.strptime(start_time_str, '%H:%M').time()
            end_time = datetime.strptime(end_time_str, '%H:%M').time()
        except ValueError:
            return Response([])

        from .models import Space, SpaceCategoryAffinity, SpaceTimetableBlock
        try:
            requested_space = Space.objects.get(id=space_id)
        except Space.DoesNotExist:
            return Response([])

        affinity = SpaceCategoryAffinity.objects.filter(from_category=requested_space.space_type).first()
        if not affinity or not affinity.allowed_categories:
            logger.warning(
                "suggestions: no SpaceCategoryAffinity found for space_type=%s (space_id=%s)",
                requested_space.space_type,
                space_id,
            )
            return Response({'no_affinity': True, 'results': []})

        # Capacity bands differ by trigger reason.
        if trigger_reason == 'low_occupancy':
            min_capacity = attendee_count
            max_capacity = min(int(attendee_count * 3), requested_space.capacity_hard - 1)
        else:
            # 'unavailable' and 'exceeds_capacity' both use the same ×1.5 ceiling.
            min_capacity = attendee_count
            max_capacity = int(attendee_count * 1.5)

        exclude_ids_raw = request.query_params.get('exclude_ids', '')
        exclude_ids = [
            int(i) for i in exclude_ids_raw.split(',')
            if i.strip().isdigit()
        ]
        if requested_space.id not in exclude_ids:
            exclude_ids.append(requested_space.id)

        candidate_spaces = Space.objects.filter(
            is_active=True,
            is_special_purpose=False,
            space_type__in=affinity.allowed_categories,
            capacity_hard__gte=min_capacity,
            capacity_hard__lte=max_capacity
        ).exclude(id__in=exclude_ids)

        # Build the list of dates to check.
        # For RECURRING bookings the end_date query param is expected alongside date (the start).
        # For SINGLE (or unspecified) only start_date is checked.
        from django.utils import timezone as tz
        import datetime as dt
        from .utils import get_overlapping_bookings

        end_date_str = request.query_params.get('end_date', date_str)
        try:
            end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()
        except ValueError:
            end_date = start_date
        days_diff = (end_date - start_date).days
        dates_to_check = [
            start_date + dt.timedelta(days=i)
            for i in range(max(days_diff, 0) + 1)
        ]

        available_spaces = []
        for space in candidate_spaces:
            space_is_free = True
            for i, check_date in enumerate(dates_to_check):
                if booking_type == 'RECURRING':
                    slot_start = tz.make_aware(dt.datetime.combine(check_date, start_time))
                    slot_end   = tz.make_aware(dt.datetime.combine(check_date, end_time))
                else:
                    if i == 0 and len(dates_to_check) == 1:
                        s_time = start_time
                        e_time = end_time
                    elif i == 0:
                        s_time = start_time
                        e_time = dt.time(23, 59, 59)
                    elif i == len(dates_to_check) - 1:
                        s_time = dt.time(0, 0)
                        e_time = end_time
                    else:
                        s_time = dt.time(0, 0)
                        e_time = dt.time(23, 59, 59)
                    slot_start = tz.make_aware(dt.datetime.combine(check_date, s_time))
                    slot_end   = tz.make_aware(dt.datetime.combine(check_date, e_time))

                overlaps = get_overlapping_bookings(space, slot_start, slot_end)
                if overlaps.filter(
                    status__in=['PENDING', 'APPROVED', 'AWAITING_FACULTY', 'FACULTY_ESCALATED']
                ).exists():
                    space_is_free = False
                    break

                timetable_conflict = SpaceTimetableBlock.objects.filter(
                    space=space,
                    date=check_date,
                    start_time__lt=slot_end.time(),
                    end_time__gt=slot_start.time()
                ).exists()
                if timetable_conflict:
                    space_is_free = False
                    break

            if space_is_free:
                available_spaces.append(space)

        available_spaces.sort(key=lambda s: abs(s.capacity_hard - attendee_count))
        available_spaces = available_spaces[:5]

        from .serializers import SpaceSerializer
        return Response(SpaceSerializer(available_spaces, many=True, context={'request': request}).data)

    @action(detail=True, methods=['get', 'post'])
    def timetable(self, request, pk=None):
        space = self.get_object()
        
        if request.method == 'GET':
            from .models import SpaceTimetableBlock, TimetableUploadBatch
            
            batches_qs = TimetableUploadBatch.objects.filter(space=space).order_by('-uploaded_at')
            batches_data = []
            for b in batches_qs:
                batches_data.append({
                    'id': b.id,
                    'label': b.upload_label,
                    'created_at': b.uploaded_at.isoformat(),
                    'row_count': b.row_count,
                    'skipped_count': b.skipped_count
                })

            blocks = SpaceTimetableBlock.objects.filter(space=space).order_by('-date', 'start_time')
            blocks_data = []
            for b in blocks:
                blocks_data.append({
                    'id': b.id,
                    'batch_id': b.batch_id,
                    'date': b.date.strftime('%Y-%m-%d'),
                    'start_time': b.start_time.strftime('%H:%M'),
                    'end_time': b.end_time.strftime('%H:%M'),
                    'label': b.label
                })
            return Response({'batches': batches_data, 'blocks': blocks_data})
            
        elif request.method == 'POST':
            if not self._is_timetable_manager(request, space):
                return Response({"detail": "Not authorized. Must be the assigned space approver."}, status=status.HTTP_403_FORBIDDEN)
                
            from .models import TimetableUploadBatch, SpaceTimetableBlock
            import csv
            import io
            from datetime import datetime
            
            if 'file' not in request.FILES:
                return Response({"error": "No file uploaded."}, status=status.HTTP_400_BAD_REQUEST)
                
            file = request.FILES['file']
            upload_label = request.data.get('label', file.name)
            
            try:
                decoded_file = file.read().decode('utf-8-sig')
                io_string = io.StringIO(decoded_file)
                reader = csv.DictReader(io_string)
                if reader.fieldnames:
                    reader.fieldnames = [field.strip() for field in reader.fieldnames if field]
                
                batch = TimetableUploadBatch.objects.create(
                    space=space,
                    uploaded_by=request.user,
                    upload_label=upload_label
                )
                
                blocks = []
                row_count = 0
                skipped_count = 0
                conflict_details = []
                
                from .utils import get_overlapping_bookings
                from django.utils import timezone

                for row in reader:
                    try:
                        date = datetime.strptime(row['date'].strip(), '%Y-%m-%d').date()
                        start_time = datetime.strptime(row['start_time'].strip(), '%H:%M').time()
                        end_time = datetime.strptime(row['end_time'].strip(), '%H:%M').time()
                        label = row['label'].strip()
                        
                        start_dt = timezone.make_aware(datetime.combine(date, start_time))
                        end_dt = timezone.make_aware(datetime.combine(date, end_time))
                        
                        overlaps = get_overlapping_bookings(space, start_dt, end_dt)
                        
                        # Also check existing timetable blocks for the same day/time
                        tt_overlaps = SpaceTimetableBlock.objects.filter(
                            space=space,
                            date=date,
                            start_time__lt=end_time,
                            end_time__gt=start_time
                        )

                        if overlaps.exists() or tt_overlaps.exists():
                            skipped_count += 1
                            conflict_details.append(f"{date} {start_time.strftime('%H:%M')}-{end_time.strftime('%H:%M')} ({label})")
                            continue

                        blocks.append(SpaceTimetableBlock(
                            batch=batch,
                            space=space,
                            date=date,
                            start_time=start_time,
                            end_time=end_time,
                            label=label
                        ))
                        row_count += 1
                    except Exception:
                        skipped_count += 1
                        
                if row_count == 0:
                    batch.delete()
                    res_data = {
                        "batch_id": None,
                        "row_count": 0,
                        "skipped_count": skipped_count
                    }
                    if conflict_details:
                        res_data["message"] = f"Upload failed. All {skipped_count} blocks were skipped due to conflicts or errors."
                        res_data["conflicts"] = conflict_details
                    return Response(res_data, status=status.HTTP_400_BAD_REQUEST)

                SpaceTimetableBlock.objects.bulk_create(blocks)
                batch.row_count = row_count
                batch.skipped_count = skipped_count
                batch.save(update_fields=['row_count', 'skipped_count'])
                
                res_data = {
                    "batch_id": batch.id,
                    "row_count": row_count,
                    "skipped_count": skipped_count
                }
                if conflict_details:
                    res_data["message"] = f"Uploaded {row_count} blocks. Skipped {skipped_count} due to conflicts or errors."
                    res_data["conflicts"] = conflict_details

                return Response(res_data)
            except Exception as e:
                return Response({"error": f"Error parsing CSV: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['patch', 'delete'], url_path=r'timetable/blocks/(?P<block_id>\d+)', permission_classes=[IsAuthenticated])
    def timetable_block_detail(self, request, pk=None, block_id=None):
        space = self.get_object()
        
        if not self._is_timetable_manager(request, space):
            return Response({"detail": "Not authorized. Must be the assigned space approver."}, status=status.HTTP_403_FORBIDDEN)
                
        from .models import SpaceTimetableBlock
        try:
            block = SpaceTimetableBlock.objects.get(id=block_id, space=space)
        except SpaceTimetableBlock.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
            
        if request.method == 'DELETE':
            block.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
            
        elif request.method == 'PATCH':
            from datetime import datetime
            new_date = datetime.strptime(request.data['date'], '%Y-%m-%d').date() if 'date' in request.data else block.date
            new_start = datetime.strptime(request.data['start_time'], '%H:%M').time() if 'start_time' in request.data else block.start_time
            new_end = datetime.strptime(request.data['end_time'], '%H:%M').time() if 'end_time' in request.data else block.end_time

            force = request.query_params.get('force', 'false').lower() == 'true'

            if not force:
                from .utils import get_overlapping_bookings
                from django.utils import timezone
                start_dt = timezone.make_aware(datetime.combine(new_date, new_start))
                end_dt = timezone.make_aware(datetime.combine(new_date, new_end))
                
                overlaps = get_overlapping_bookings(space, start_dt, end_dt)
                tt_overlaps = SpaceTimetableBlock.objects.filter(
                    space=space,
                    date=new_date,
                    start_time__lt=new_end,
                    end_time__gt=new_start
                ).exclude(id=block.id)

                if overlaps.exists() or tt_overlaps.exists():
                    return Response({
                        "error": "conflict_warning", 
                        "message": "This block overlaps with an existing booking or timetable block."
                    }, status=status.HTTP_409_CONFLICT)

            block.date = new_date
            block.start_time = new_start
            block.end_time = new_end
            if 'label' in request.data:
                block.label = request.data['label']
            block.save()
            return Response({"status": "updated"})

    @action(detail=True, methods=['delete'], url_path=r'timetable/blocks', permission_classes=[IsAuthenticated])
    def timetable_blocks(self, request, pk=None):
        space = self.get_object()
        
        if not self._is_timetable_manager(request, space):
            return Response({"detail": "Not authorized. Must be the assigned space approver."}, status=status.HTTP_403_FORBIDDEN)
                
        date_str = request.query_params.get('date')
        if not date_str:
            return Response({"error": "date query parameter required"}, status=status.HTTP_400_BAD_REQUEST)
            
        from .models import SpaceTimetableBlock
        deleted, _ = SpaceTimetableBlock.objects.filter(space=space, date=date_str).delete()
        return Response({"deleted": deleted}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['patch', 'delete'], url_path=r'timetable/(?P<batch_id>\d+)', permission_classes=[IsAuthenticated])
    def timetable_batch_detail(self, request, pk=None, batch_id=None):
        space = self.get_object()
        
        if not self._is_timetable_manager(request, space):
            return Response({"detail": "Not authorized. Must be the assigned space approver."}, status=status.HTTP_403_FORBIDDEN)
                
        from .models import TimetableUploadBatch
        try:
            batch = TimetableUploadBatch.objects.get(id=batch_id, space=space)
        except TimetableUploadBatch.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
            
        if request.method == 'DELETE':
            batch.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
            
        elif request.method == 'PATCH':
            if 'upload_label' in request.data:
                batch.upload_label = request.data['upload_label']
                batch.save(update_fields=['upload_label'])
            
            if 'file' not in request.FILES:
                return Response({"status": "updated"})
                
            # Re-upload handling
            import csv
            import io
            from datetime import datetime
            from .models import SpaceTimetableBlock
            
            file = request.FILES['file']
            try:
                decoded_file = file.read().decode('utf-8-sig')
                io_string = io.StringIO(decoded_file)
                reader = csv.DictReader(io_string)
                if reader.fieldnames:
                    reader.fieldnames = [field.strip() for field in reader.fieldnames if field]
                
                SpaceTimetableBlock.objects.filter(batch=batch).delete()
                
                blocks = []
                row_count = 0
                skipped_count = 0
                for row in reader:
                    try:
                        date = datetime.strptime(row['date'].strip(), '%Y-%m-%d').date()
                        start_time = datetime.strptime(row['start_time'].strip(), '%H:%M').time()
                        end_time = datetime.strptime(row['end_time'].strip(), '%H:%M').time()
                        label = row['label'].strip()
                        
                        blocks.append(SpaceTimetableBlock(
                            batch=batch,
                            space=space,
                            date=date,
                            start_time=start_time,
                            end_time=end_time,
                            label=label
                        ))
                        row_count += 1
                    except Exception:
                        skipped_count += 1
                        
                SpaceTimetableBlock.objects.bulk_create(blocks)
                batch.row_count = row_count
                batch.skipped_count = skipped_count
                if 'label' in request.data:
                    batch.upload_label = request.data['label']
                batch.save()
                
                return Response({
                    "batch_id": batch.id,
                    "row_count": row_count,
                    "skipped_count": skipped_count
                })
            except Exception as e:
                return Response({"error": f"Error parsing CSV: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)


# ==========================================
# BOOKING SUBMISSIONS
# ==========================================

from django.db import transaction

class SpaceBookingViewSet(viewsets.ModelViewSet):
    serializer_class   = SpaceBookingSerializer
    permission_classes = [IsAuthenticated, IsOwnerOrAdminOrReadOnly]

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        """
        Wraps the entire creation process (validation + saving) 
        in a single transaction so select_for_update() can hold its lock.
        """
        return super().create(request, *args, **kwargs)

    def get_permissions(self):
        # Public read-only access for the general campus schedule (no login required)
        view_param = self.request.query_params.get('view', 'mine')
        if self.action == 'list' and view_param == 'general':
            return [AllowAny()]
        return super().get_permissions()

    def get_queryset(self):
        user       = self.request.user
        view_param = self.request.query_params.get('view', 'mine')

        if view_param != 'general':
            pass  # lifecycle refresh handled by Celery task

        if self.action in ('faculty_approve', 'faculty_reject'):
            return SpaceBooking.objects.filter(
                faculty_sponsor=user
            ).select_related('space', 'user')

        if self.action in ('incharge_resend',):
            return SpaceBooking.objects.all().select_related('space', 'user')

        # ── Admin: full booking history for a specific venue ──────────────
        # Used by VenueDetailPage "Booking History" tab.
        # Returns ALL statuses (PENDING, APPROVED, REJECTED, CANCELLED, etc.)
        # No models, serializers, or approval logic are changed.
        if view_param == 'venue_history':
            if not (user.is_authenticated and (user.is_staff or user.is_superuser)):
                return SpaceBooking.objects.none()
            space_id = self.request.query_params.get('space')
            if not space_id:
                return SpaceBooking.objects.none()
            return (
                SpaceBooking.objects
                .filter(space_id=space_id)
                .select_related(
                    'space', 'user', 'department',
                    'space__block', 'faculty_sponsor',
                )
                .prefetch_related(
                    'requested_equipment__equipment',
                    'user__roles',
                )
                .order_by('-created_at')
            )

        if view_param == 'general':
            space_id = self.request.query_params.get('space')
            qs = (
                SpaceBooking.objects
                .select_related('space', 'user', 'department', 'space__block', 'space__approver_chain', 'faculty_sponsor')
                .prefetch_related(
                    'space__built_in_equipment__equipment',
                    'requested_equipment__equipment',
                    'user__roles',
                    'user__role_overrides__role',
                )
                .exclude(status__in=['REJECTED', 'CANCELLED'])
                .order_by('start_datetime')
            )
            if space_id:
                qs = qs.filter(space_id=space_id)
            return qs

        return (
            SpaceBooking.objects
            .filter(user=user)
            .select_related('space', 'user', 'department', 'space__block', 'space__approver_chain', 'faculty_sponsor')
            .prefetch_related(
                'space__built_in_equipment__equipment',
                'requested_equipment__equipment',
                'user__roles',
                'user__role_overrides__role',
            )
            .order_by('-updated_at')
        )

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        view_param = self.request.query_params.get('view', 'mine')

        if view_param == 'general':
            from apps.spaces.models import SpaceTimetableBlock
            from datetime import datetime, timedelta
            from django.utils import timezone

            space_id = request.query_params.get('space')
            today = timezone.localdate()
            blocks_qs = SpaceTimetableBlock.objects.select_related(
                'space', 'batch'
            ).filter(date__gte=today - timedelta(days=1), date__lte=today + timedelta(days=180))
            if space_id:
                blocks_qs = blocks_qs.filter(space_id=space_id)
            blocks = blocks_qs.all()

            timetable_data = []
            for b in blocks:
                start_dt = timezone.make_aware(datetime.combine(b.date, b.start_time))
                end_dt   = timezone.make_aware(datetime.combine(b.date, b.end_time))

                label = getattr(b, 'label', '')
                if not label and getattr(b, 'batch', None):
                    label = getattr(b.batch, 'upload_label', '')

                timetable_data.append({
                    "id": f"tt_{b.id}",
                    "start_datetime": start_dt.isoformat(),
                    "end_datetime": end_dt.isoformat(),
                    "purpose_of_booking": label or "Class Timetable",
                    "status": "APPROVED",
                    "booking_type": "SINGLE",
                    "is_timetable": True,
                    "can_modify": False,
                    "space_details": {
                        "id": b.space.id,
                        "name": b.space.name,
                        "capacity_hard": getattr(b.space, 'capacity_hard', 0),
                    }
                })

            if isinstance(response.data, dict) and 'results' in response.data:
                response.data['results'].extend(timetable_data)
            elif isinstance(response.data, list):
                response.data.extend(timetable_data)

        return response

    def perform_create(self, serializer):
        from apps.spaces.models import SpaceTimetableBlock
        from rest_framework.exceptions import ValidationError
        from datetime import timedelta, time

        space = serializer.validated_data.get('space')
        start_dt = serializer.validated_data.get('start_datetime')
        end_dt = serializer.validated_data.get('end_datetime')
        b_type = serializer.validated_data.get('booking_type', SpaceBooking.BookingType.SINGLE_CONTINUOUS)

        if space and start_dt and end_dt:
            days_diff = (end_dt.date() - start_dt.date()).days
            conflicts = []
            for i in range(days_diff + 1):
                current_date = start_dt.date() + timedelta(days=i)
                if b_type == SpaceBooking.BookingType.RECURRING_DAILY:
                    slot_start_time = start_dt.time()
                    slot_end_time = end_dt.time()
                else:
                    slot_start_time = start_dt.time() if i == 0 else time(0, 0)
                    slot_end_time = end_dt.time() if i == days_diff else time(23, 59, 59)

                overlaps = SpaceTimetableBlock.objects.filter(
                    space=space,
                    date=current_date,
                    start_time__lt=slot_end_time,
                    end_time__gt=slot_start_time
                )
                for block in overlaps:
                    conflicts.append(f"{block.date} {block.start_time.strftime('%H:%M')}-{block.end_time.strftime('%H:%M')} ({block.label})")

            if conflicts:
                raise ValidationError({"non_field_errors": f"Conflicts with class timetable: {', '.join(conflicts)}"})

        booking = serializer.save(user=self.request.user)

        # ── Faculty sponsor workflow (skip for HOD_FALLBACK spaces like AI Lab) ──
        is_student = 'STUDENT' in self.request.user.get_effective_roles()
        uses_hod_fallback = getattr(booking.space, 'approval_workflow_type', '') == Space.ApprovalWorkflowType.HOD_FALLBACK

        if is_student and booking.faculty_sponsor_id and not uses_hod_fallback:
            booking.status = 'AWAITING_FACULTY'
            booking.faculty_response_deadline = timezone.now() + timedelta(hours=24)
            booking.save(update_fields=['status', 'faculty_response_deadline'])
            notify_faculty_new_request(booking)
            return

        # For HOD_FALLBACK spaces, clear any faculty_sponsor that may have
        # slipped through so the booking stays in the normal PENDING flow.
        if uses_hod_fallback and booking.faculty_sponsor_id:
            booking.faculty_sponsor = None
            booking.save(update_fields=['faculty_sponsor'])

        # ── Approver-chain notification (specific primary/fallback user) ──
        chain = getattr(booking.space, 'approver_chain', None)
        if chain:
            from apps.notifications.utils import notify, _resource_name, _booking_reference, _approver_link, notify_auto_approved_informational
            from apps.notifications.models import Notification

            if self.request.user == chain.primary_approver:
                booking.status = 'APPROVED'
                booking.resolved_by = self.request.user
                booking.resolved_at = timezone.now()
                booking.remarks_by_admin = "Auto-approved -- requester is the sole eligible approver for this resource."
                booking.save(update_fields=['status', 'resolved_by', 'resolved_at', 'remarks_by_admin'])
                
                if chain.primary_approver_id != chain.fallback_approver_id and chain.fallback_approver:
                    notify_auto_approved_informational(booking, 'spaces', [chain.fallback_approver])
                return

            if chain.primary_approver:
                notify(
                    chain.primary_approver,
                    Notification.Category.BOOKING_PENDING,
                    "New Booking Request",
                    f"{self.request.user.first_name} requested {_resource_name(booking, 'spaces')}. It requires your approval.",
                    link=_approver_link('spaces', _booking_reference(booking)),
                    domain='spaces',
                    reference_code=_booking_reference(booking),
                    is_actionable=True,
                )
            elif chain.fallback_approver:
                notify(
                    chain.fallback_approver,
                    Notification.Category.BOOKING_PENDING,
                    "New Booking Request",
                    f"{self.request.user.first_name} requested {_resource_name(booking, 'spaces')}. It requires your approval.",
                    link=_approver_link('spaces', _booking_reference(booking)),
                    domain='spaces',
                    reference_code=_booking_reference(booking),
                    is_actionable=True,
                )
            return

        # ── HOD_FALLBACK without a chain: notify the HOD role directly ──
        if uses_hod_fallback:
            notify_new_request(booking=booking, domain='spaces', role_name=Role.Name.HOD, exclude_user=self.request.user)
            return

        # ── Standard role-based notification ──
        category = booking.space.approval_category
        if category == Space.ApprovalCategory.LAB:
            role = Role.Name.LAB_INCHARGE
        elif category == Space.ApprovalCategory.LIBRARY:
            role = Role.Name.LIBRARIAN
        else:
            role = Role.Name.RECEPTIONIST

        from apps.notifications.utils import get_raw_space_approvers, notify_auto_approved_informational
        eligible_set = get_raw_space_approvers(booking.space, role)
        
        if len(eligible_set) == 1 and self.request.user in eligible_set:
            booking.status = 'APPROVED'
            booking.resolved_by = self.request.user
            booking.resolved_at = timezone.now()
            booking.remarks_by_admin = "Auto-approved -- requester is the sole eligible approver for this resource."
            booking.save(update_fields=['status', 'resolved_by', 'resolved_at', 'remarks_by_admin'])
            return

        notify_new_request(
            booking=booking,
            domain='spaces',
            role_name=role,
            exclude_user=self.request.user
        )

    def perform_update(self, serializer):
        user     = self.request.user
        instance = serializer.instance
        previous_anchor = capture_space_anchor(instance)
        was_approved = instance.status == 'APPROVED'   # capture before save

        if user.is_staff or user.is_superuser:
            booking = serializer.save(updated_by=user)
            sync_linked_siblings_after_space_edit(
                booking,
                previous_anchor=previous_anchor,
                actor=user,
            )
            return

        extra_fields = {"updated_by": user}
        
        # FACULTY APPROVAL EDIT CASCADE (skip for HOD_FALLBACK spaces like AI Lab)
        uses_hod_fallback = getattr(instance.space, 'approval_workflow_type', '') == Space.ApprovalWorkflowType.HOD_FALLBACK
        if not uses_hod_fallback and instance.faculty_sponsor_id and instance.status not in ['CANCELLED', 'REJECTED', 'EXPIRED', 'COMPLETED']:
            extra_fields.update({
                "status": "AWAITING_FACULTY",
                "resolved_by": None,
                "resolved_at": None,
                "remarks_by_admin": None,
                "faculty_response_deadline": timezone.now() + timedelta(hours=24),
            })
            booking = serializer.save(**extra_fields)
            sync_linked_siblings_after_space_edit(
                booking,
                previous_anchor=previous_anchor,
                actor=user,
            )
            notify_faculty_details_changed(booking)
            if was_approved or instance.status == 'FACULTY_ESCALATED':
                # We intentionally don't send a notification to the incharge right now
                # so we don't spam them. They will get notified once the faculty approves.
                pass
            return

        if was_approved:
            extra_fields.update({
                "status":           'PENDING',
                "resolved_by":      None,
                "resolved_at":      None,
                "remarks_by_admin": None,
            })

        booking = serializer.save(**extra_fields)
        sync_linked_siblings_after_space_edit(
            booking,
            previous_anchor=previous_anchor,
            actor=user,
        )

        # Notify the space admin that an approved booking was edited and needs re-review
        if was_approved and booking.status == 'PENDING':
            category = booking.space.approval_category
            if category == Space.ApprovalCategory.LAB:
                role = Role.Name.LAB_INCHARGE
            elif category == Space.ApprovalCategory.LIBRARY:
                role = Role.Name.LIBRARIAN
            else:
                role = Role.Name.RECEPTIONIST
            notify_incharge_booking_edited(
                booking=booking,
                domain='spaces',
                role_name=role
            )

    def perform_destroy(self, instance):
        refresh_booking_lifecycle(instance)
        if not can_user_modify_booking(instance):
            raise ValidationError({"detail": "Cannot cancel a booking whose start time has already passed."})
        status_before = instance.status

        if instance.faculty_sponsor_id:
            notify_student_cancelled_faculty(instance)
            
        instance.status = 'CANCELLED'
        instance.resolved_at = timezone.now()
        instance.remarks_by_admin = 'Cancelled by requester.'
        instance.save(update_fields=['status', 'resolved_at', 'remarks_by_admin', 'updated_at'])
        cancel_linked_siblings_for_space(instance, reason='Linked Space booking was cancelled by requester.')

        if status_before in ['PENDING', 'APPROVED', 'FACULTY_ESCALATED']:
            category = instance.space.approval_category
            if category == Space.ApprovalCategory.LAB:
                role = Role.Name.LAB_INCHARGE
            elif category == Space.ApprovalCategory.LIBRARY:
                role = Role.Name.LIBRARIAN
            else:
                role = Role.Name.RECEPTIONIST
            from apps.notifications.utils import notify_incharge_cancelled
            notify_incharge_cancelled(instance, 'spaces', role)

    @action(detail=True, methods=['patch'], permission_classes=[IsAuthenticated])
    def review(self, request, pk=None):
        user = request.user
        if not (user.is_staff or user.is_superuser):
            return Response(
                {"detail": "Not authorized to review bookings."},
                status=status.HTTP_403_FORBIDDEN
            )

        booking    = self.get_object()
        new_status = request.data.get('status')
        remarks    = request.data.get('remarks_by_admin', '')
        refresh_booking_lifecycle(booking)
        booking.refresh_from_db()

        if new_status not in ['APPROVED', 'REJECTED', 'PENDING']:
            return Response(
                {"error": "Invalid status. Must be PENDING, APPROVED or REJECTED."},
                status=status.HTTP_400_BAD_REQUEST
            )

        if new_status == 'REJECTED' and not remarks:
            return Response(
                {"error": "Remarks are required when rejecting a booking."},
                status=status.HTTP_400_BAD_REQUEST
            )

        if new_status == 'APPROVED' and booking.status not in ['PENDING', 'FACULTY_ESCALATED']:
            return Response(
                {"error": f"Cannot approve a booking that is currently {booking.status}."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if new_status == 'REJECTED' and booking.status not in ['PENDING', 'APPROVED', 'FACULTY_ESCALATED']:
            return Response(
                {"error": f"Cannot reject a booking that is currently {booking.status}."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if new_status == 'PENDING' and booking.status != 'FACULTY_ESCALATED':
            return Response(
                {"error": "Can only set PENDING from FACULTY_ESCALATED."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Apply the status change to all siblings in the group
        bookings_in_group = list(SpaceBooking.objects.filter(
            group_id=booking.group_id,
            status__in=['PENDING', 'APPROVED', 'FACULTY_ESCALATED'],
        ).order_by('start_datetime'))

        updated_bookings = []
        for b in bookings_in_group:
            if new_status == 'APPROVED' and b.status not in ['PENDING', 'FACULTY_ESCALATED']:
                continue
            if new_status == 'PENDING' and b.status != 'FACULTY_ESCALATED':
                continue
            b.status           = new_status
            b.remarks_by_admin = remarks
            b.resolved_by      = user if new_status != 'PENDING' else None
            b.resolved_at      = timezone.now() if new_status != 'PENDING' else None
            if new_status == 'PENDING':
                b.faculty_response_deadline = None
            b.save()
            updated_bookings.append(b)

        # Fire a single grouped notification instead of one per booking
        if updated_bookings:
            if new_status == 'PENDING':
                from apps.notifications.utils import mark_pending_request_notifications_read
                for b in updated_bookings:
                    mark_pending_request_notifications_read(b, domain='spaces')
                    chain = getattr(b.space, 'approver_chain', None)
                    if chain:
                        continue # Chain approvals are handled via notify_new_request manually if needed, but 'PENDING' transition for chain spaces usually shouldn't happen via this bulk review method from ESCALATED.
                    
                    category = b.space.approval_category
                    if category == Space.ApprovalCategory.LAB:
                        role = Role.Name.LAB_INCHARGE
                    elif category == Space.ApprovalCategory.LIBRARY:
                        role = Role.Name.LIBRARIAN
                    else:
                        role = Role.Name.RECEPTIONIST
                    notify_new_request(b, 'spaces', role)
            else:
                for b in updated_bookings:
                    chain = getattr(b.space, 'approver_chain', None)
                    if chain:
                        from apps.notifications.utils import (
                            notify_chain_approved_primary,
                            notify_chain_approved_fallback,
                            notify_chain_rejected
                        )
                        if new_status == 'APPROVED':
                            if user == chain.primary_approver:
                                notify_chain_approved_primary(b)
                            else:
                                notify_chain_approved_fallback(b)
                        elif new_status == 'REJECTED':
                            notify_chain_rejected(b)
                    else:
                        notify_group_status_change(
                            bookings=[b],
                            new_status=new_status,
                            domain='spaces',
                            resolved_by=user,
                            remarks=remarks
                        )

        if new_status == 'REJECTED':
            cancel_linked_siblings_for_space(
                booking,
                reason=remarks or 'Linked Space booking was rejected.',
            )

        if new_status in ['APPROVED', 'REJECTED'] and updated_bookings:
            from apps.notifications.utils import notify_comanagers_actioned
            mark_pending_request_notifications_read(booking, domain='spaces')
            notify_comanagers_actioned(
                booking=updated_bookings[0],
                domain='spaces',
                actioned_by=user,
                new_status=new_status,
            )

        booking.refresh_from_db()
        serializer = self.get_serializer(booking)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['patch'], permission_classes=[IsPrincipal])
    def cancel(self, request, pk=None):
        """
        Principal cancels an APPROVED booking and releases the slot.
        """
        booking = self.get_object()
        remarks = request.data.get('remarks', '').strip()
        refresh_booking_lifecycle(booking)
        booking.refresh_from_db()

        if booking.status != 'APPROVED':
            return Response(
                {
                    "error": (
                        f"Only APPROVED bookings can be cancelled by the Principal. "
                        f"This booking is currently '{booking.status}'."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not remarks:
            return Response(
                {"error": "Remarks are required when cancelling a booking."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        siblings       = list(SpaceBooking.objects.filter(group_id=booking.group_id, status='APPROVED').order_by('start_datetime'))
        resolved_at    = timezone.now()
        cancelled_refs = []

        for sibling in siblings:
            sibling.status           = 'CANCELLED'
            sibling.resolved_by      = request.user
            sibling.resolved_at      = resolved_at
            sibling.remarks_by_admin = remarks
            sibling.save()
            cancelled_refs.append(sibling.reference_code)

        # Fire a single grouped notification for the full cancellation batch
        if siblings:
            notify_group_status_change(
                bookings=siblings,
                new_status='CANCELLED',
                domain='spaces',
                resolved_by=request.user,
                remarks=remarks
            )
            cancel_linked_siblings_for_space(
                booking,
                reason=remarks or 'Linked Space booking was cancelled by the Principal.',
            )

        return Response(
            {
                "message":      f"{len(cancelled_refs)} booking(s) cancelled successfully.",
                "cancelled":    cancelled_refs,
                "cancelled_by": request.user.email,
            },
            status=status.HTTP_200_OK,
        )

    # ------------------------------------------------------------------
    # FACULTY APPROVAL ENDPOINTS
    # ------------------------------------------------------------------

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def faculty_pending(self, request):
        if 'FACULTY' not in request.user.get_effective_roles():
            return Response({"detail": "Not authorized."}, status=status.HTTP_403_FORBIDDEN)
            
        
        pending = SpaceBooking.objects.filter(
            faculty_sponsor=request.user,
            status='AWAITING_FACULTY'
        ).order_by('start_datetime')
        
        history = SpaceBooking.objects.filter(
            faculty_sponsor=request.user,
        ).exclude(status='AWAITING_FACULTY').order_by('-updated_at')
        
        return Response({
            "pending": self.get_serializer(pending, many=True).data,
            "history": self.get_serializer(history, many=True).data
        })

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def faculty_approve(self, request, pk=None):
        booking = self.get_object()
        from apps.approvals.views import user_can_approve_faculty_booking
        if not user_can_approve_faculty_booking(request.user, booking):
            return Response({"detail": "Not authorized."}, status=status.HTTP_403_FORBIDDEN)
        if booking.status != 'AWAITING_FACULTY':
            return Response({"error": f"Cannot approve, status is {booking.status}"}, status=status.HTTP_400_BAD_REQUEST)
            
        # check if this is an edited booking (if updated_at is significantly later than created_at)
        is_edited = False
        if booking.updated_at and booking.created_at:
            is_edited = (booking.updated_at - booking.created_at).total_seconds() > 60

        booking.status = 'PENDING'
        booking.faculty_response_deadline = None
        booking.faculty_timed_out = False
        booking.save(update_fields=['status', 'faculty_response_deadline', 'faculty_timed_out', 'updated_at'])
        
        from apps.notifications.utils import mark_pending_request_notifications_read
        mark_pending_request_notifications_read(booking, domain='spaces')
        
        notify_faculty_approved(booking)
        
        workflow_type = getattr(booking.space, 'approval_workflow_type', None)
        chain = getattr(booking.space, 'approver_chain', None) if workflow_type == 'HOD_FALLBACK' else None
        if chain:
            from apps.notifications.utils import notify, _resource_name, _booking_reference, _approver_link
            from apps.notifications.models import Notification
            if chain.primary_approver:
                notify(
                    chain.primary_approver,
                    Notification.Category.BOOKING_PENDING,
                    "New Booking Request",
                    f"A faculty-approved booking for {_resource_name(booking, 'spaces')} requires your approval.",
                    link=_approver_link('spaces', _booking_reference(booking)),
                    domain='spaces',
                    reference_code=_booking_reference(booking),
                    is_actionable=True,
                )
            elif chain.fallback_approver:
                notify(
                    chain.fallback_approver,
                    Notification.Category.BOOKING_PENDING,
                    "New Booking Request",
                    f"A faculty-approved booking for {_resource_name(booking, 'spaces')} requires your approval.",
                    link=_approver_link('spaces', _booking_reference(booking)),
                    domain='spaces',
                    reference_code=_booking_reference(booking),
                    is_actionable=True,
                )
            return

        category = booking.space.approval_category
        if category == Space.ApprovalCategory.LAB:
            role = Role.Name.LAB_INCHARGE
        elif category == Space.ApprovalCategory.LIBRARY:
            role = Role.Name.LIBRARIAN
        else:
            role = Role.Name.RECEPTIONIST
            
        if is_edited:
            from apps.notifications.utils import notify_incharge_booking_edited
            notify_incharge_booking_edited(booking, 'spaces', role)
        else:
            notify_new_request(booking, 'spaces', role)
        
        return Response(self.get_serializer(booking).data)

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def faculty_reject(self, request, pk=None):
        booking = self.get_object()
        from apps.approvals.views import user_can_approve_faculty_booking
        if not user_can_approve_faculty_booking(request.user, booking):
            return Response({"detail": "Not authorized."}, status=status.HTTP_403_FORBIDDEN)
        if booking.status != 'AWAITING_FACULTY':
            return Response({"error": f"Cannot reject, status is {booking.status}"}, status=status.HTTP_400_BAD_REQUEST)
            
        remarks = request.data.get('rejection_note', '')
        if not remarks:
            return Response({"error": "Rejection note required"}, status=status.HTTP_400_BAD_REQUEST)
            
        booking.status = 'REJECTED'
        booking.remarks_by_admin = remarks
        booking.resolved_by = request.user
        booking.resolved_at = timezone.now()
        booking.faculty_response_deadline = None
        booking.save(update_fields=['status', 'remarks_by_admin', 'resolved_by', 'resolved_at', 'faculty_response_deadline', 'updated_at'])
        
        notify_faculty_rejected(booking)
        cancel_linked_siblings_for_space(booking, reason=remarks)
        mark_pending_request_notifications_read(booking, domain='spaces')
        return Response(self.get_serializer(booking).data)

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def incharge_escalated(self, request):
        if not (request.user.is_staff or request.user.is_superuser or request.user.space_approver_assignments.filter(is_active=True).exists()):
            return Response({"detail": "Not authorized."}, status=status.HTTP_403_FORBIDDEN)
            
        qs = SpaceBooking.objects.filter(status='FACULTY_ESCALATED').order_by('start_datetime')
        if not (request.user.is_staff or request.user.is_superuser):
            from django.db.models import Q
            assignments = request.user.space_approver_assignments.filter(
                is_active=True
            ).select_related("block", "space", "role")
            
            scope_q = Q()
            for assignment in assignments:
                role_name = assignment.role.name
            
                if role_name == Role.Name.RECEPTIONIST:
                    if assignment.scope_type == "BLOCK" and assignment.block_id:
                        overridden = list(SpaceApprover.objects.filter(
                            scope_type="SPACE",
                            space__block_id=assignment.block_id,
                            role__name=role_name,
                            is_active=True,
                            user__is_active=True,
                        ).values_list("space_id", flat=True))
                        block_q = Q(space__block_id=assignment.block_id, space__approval_category="GENERAL")
                        if overridden:
                            block_q &= ~Q(space_id__in=overridden)
                        scope_q |= block_q
                    elif assignment.scope_type == "SPACE" and assignment.space_id:
                        scope_q |= Q(space_id=assignment.space_id)
            
                elif role_name == Role.Name.LAB_INCHARGE:
                    if assignment.scope_type == "SPACE" and assignment.space_id:
                        scope_q |= Q(space_id=assignment.space_id)
                    elif assignment.scope_type == "BLOCK" and assignment.block_id:
                        overridden = list(SpaceApprover.objects.filter(
                            scope_type="SPACE",
                            space__block_id=assignment.block_id,
                            role__name=role_name,
                            is_active=True,
                            user__is_active=True,
                        ).values_list("space_id", flat=True))
                        block_q = Q(space__block_id=assignment.block_id, space__approval_category="LAB")
                        if overridden:
                            block_q &= ~Q(space_id__in=overridden)
                        scope_q |= block_q
            
                elif role_name == Role.Name.LIBRARIAN:
                    if assignment.scope_type == "BLOCK" and assignment.block_id:
                        overridden = list(SpaceApprover.objects.filter(
                            scope_type="SPACE",
                            space__block_id=assignment.block_id,
                            role__name=role_name,
                            is_active=True,
                            user__is_active=True,
                        ).values_list("space_id", flat=True))
                        block_q = Q(space__block_id=assignment.block_id, space__approval_category="LIBRARY")
                        if overridden:
                            block_q &= ~Q(space_id__in=overridden)
                        scope_q |= block_q
                    elif assignment.scope_type == "SPACE" and assignment.space_id:
                        scope_q |= Q(space_id=assignment.space_id)
            
            if scope_q:
                qs = qs.filter(scope_q)
            else:
                qs = qs.none()
            
        return Response(self.get_serializer(qs, many=True).data)

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def incharge_resend(self, request, pk=None):
        booking = self.get_object()
        user = request.user
        if not (user.is_staff or user.is_superuser or user.space_approver_assignments.filter(is_active=True).exists()):
            return Response({"detail": "Not authorized."}, status=status.HTTP_403_FORBIDDEN)
            
        if booking.status != 'FACULTY_ESCALATED':
            return Response({"error": f"Can only resend escalated bookings. Status is {booking.status}"}, status=status.HTTP_400_BAD_REQUEST)
            
        booking.status = 'AWAITING_FACULTY'
        booking.faculty_response_deadline = timezone.now() + timedelta(hours=24)
        booking.faculty_timed_out = False
        booking.save(update_fields=['status', 'faculty_response_deadline', 'faculty_timed_out', 'updated_at'])
        
        from apps.notifications.utils import mark_pending_request_notifications_read
        mark_pending_request_notifications_read(booking, domain='spaces')
        
        notify_faculty_resent(booking)
        return Response(self.get_serializer(booking).data)




# ==========================================
# BLOCK MANAGEMENT
# ==========================================

class BlockViewSet(viewsets.ModelViewSet):
    serializer_class   = BlockSerializer
    permission_classes = [IsAdminOrReadOnly]

    def get_queryset(self):
        qs = Block.objects.all().order_by('name')

        active_param = self.request.query_params.get('active')
        if active_param is not None:
            qs = qs.filter(is_active=active_param.lower() == 'true')

        return qs

    def destroy(self, request, *args, **kwargs):
        from django.db.models import ProtectedError
        try:
            return super().destroy(request, *args, **kwargs)
        except ProtectedError:
            return Response(
                {
                    "error": (
                        "This block cannot be deleted because spaces or approver "
                        "assignments reference it. "
                        "Set is_active=false to deactivate it instead."
                    )
                },
                status=status.HTTP_409_CONFLICT,
            )


# ==========================================
# SPACE APPROVER MANAGEMENT
# api/spaces/approvers/
# ==========================================

class SpaceApproverViewSet(viewsets.ModelViewSet):
    serializer_class   = SpaceApproverSerializer
    permission_classes = [IsITAdmin]

    def get_queryset(self):
        qs = (
            SpaceApprover.objects
            .select_related('user', 'role', 'block', 'space')
            .order_by('user__first_name', 'role__name')
        )

        user_id      = self.request.query_params.get('user')
        role_name    = self.request.query_params.get('role')
        block_id     = self.request.query_params.get('block')
        space_id     = self.request.query_params.get('space')
        active_param = self.request.query_params.get('active')

        if user_id:
            qs = qs.filter(user_id=user_id)
        if role_name:
            qs = qs.filter(role__name=role_name.upper())
        if block_id:
            qs = qs.filter(block_id=block_id)
        if space_id:
            qs = qs.filter(space_id=space_id)
        if active_param is not None:
            qs = qs.filter(is_active=active_param.lower() == 'true')

        return qs

    def perform_create(self, serializer):
        serializer.save()

    def perform_destroy(self, instance):
        user = instance.user
        role = instance.role

        # Delete the row first so it's excluded from the remaining count
        instance.delete()

        # Strip the role badge only if no other active assignment remains
        remaining = SpaceApprover.objects.filter(
            user=user,
            role=role,
            is_active=True,
        ).count()

        if remaining == 0:
            user.roles.remove(role)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def booking_group_detail(request, event_group_id):
    from apps.media.models import MediaBooking
    from apps.media.serializers import MediaBookingSerializer
    from apps.mess.models import MessBooking
    from apps.mess.serializers import MessBookingSerializer

    space_bookings = (
        SpaceBooking.objects
        .filter(event_group_id=event_group_id)
        .select_related('space', 'user', 'department')
        .order_by('start_datetime')
    )
    mess_booking = (
        MessBooking.objects
        .filter(event_group_id=event_group_id)
        .prefetch_related('daily_menus')
        .order_by('-updated_at')
        .first()
    )
    media_booking = (
        MediaBooking.objects
        .filter(event_group_id=event_group_id)
        .select_related('space', 'user', 'department')
        .prefetch_related('equipment_requests__equipment')
        .order_by('-updated_at')
        .first()
    )

    anchor = space_bookings.first()
    if not anchor and not mess_booking and not media_booking:
        return Response(
            {"detail": "No bookings found for this event group."},
            status=status.HTTP_404_NOT_FOUND,
        )

    can_view = request.user.is_staff or request.user.is_superuser
    owners = [
        getattr(anchor, 'user_id', None),
        getattr(mess_booking, 'user_id', None),
        getattr(media_booking, 'user_id', None),
    ]
    if not can_view and request.user.id not in owners:
        return Response(
            {"detail": "Not authorized to view this booking group."},
            status=status.HTTP_403_FORBIDDEN,
        )

    def summarize_space(booking):
        if not booking:
            return None
        start = timezone.localtime(booking.start_datetime)
        end = timezone.localtime(booking.end_datetime)
        return {
            "type": "space",
            "id": booking.id,
            "reference_code": booking.reference_code,
            "status": booking.status,
            "date": start.date().isoformat(),
            "start_datetime": booking.start_datetime.isoformat(),
            "end_datetime": booking.end_datetime.isoformat(),
            "start_time": start.strftime("%H:%M"),
            "end_time": end.strftime("%H:%M"),
            "space": booking.space_id,
            "space_name": booking.space.name,
        }

    def summarize_mess(booking):
        if not booking:
            return None
        return {
            "id": booking.id,
            "reference_code": booking.reference_code,
            "status": booking.status,
            "start_date": booking.start_date.isoformat(),
            "end_date": booking.end_date.isoformat(),
            "delivery_location": booking.delivery_location,
        }

    def summarize_media(booking):
        if not booking:
            return None
        start = timezone.localtime(booking.event_start_datetime)
        return {
            "id": booking.id,
            "reference_code": booking.reference_code,
            "status": booking.status,
            "date": start.date().isoformat(),
            "event_start_datetime": booking.event_start_datetime.isoformat(),
            "event_end_datetime": booking.event_end_datetime.isoformat(),
            "space": booking.space_id,
            "space_name": booking.space.name,
        }

    return Response({
        "event_group_id": str(event_group_id),
        "anchor": summarize_space(anchor),
        "space_bookings": SpaceBookingSerializer(
            space_bookings,
            many=True,
            context={"request": request},
        ).data,
        "siblings": {
            "mess": summarize_mess(mess_booking),
            "media": summarize_media(media_booking),
        },
        "details": {
            "mess": MessBookingSerializer(
                mess_booking,
                context={"request": request},
            ).data if mess_booking else None,
            "media": MediaBookingSerializer(
                media_booking,
                context={"request": request},
            ).data if media_booking else None,
        },
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def faculty_list(request):
    dept_id = request.query_params.get('department')
    
    if dept_id:
        try:
            dept_id = int(dept_id)
            department = dept_id
        except ValueError:
            department = None
    else:
        department = request.user.department

    if not department:
        return Response([])

    faculty_users = CustomUser.objects.filter(
        department=department,
        roles__name=Role.Name.FACULTY,
        is_active=True
    ).order_by('first_name')

    data = [
        {
            "id": f.id,
            "name": f"{f.first_name} {f.last_name}".strip() or f.email
        }
        for f in faculty_users
    ]

    return Response(data)
