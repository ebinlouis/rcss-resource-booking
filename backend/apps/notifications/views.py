import hashlib
import logging

from django.db import IntegrityError
from django.http import HttpResponse
from django.utils import timezone
from django.views import View
from rest_framework import status
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.notifications.models import Notification
from apps.notifications.serializers import NotificationSerializer

logger = logging.getLogger(__name__)


def _booking_for_approval_token(token):
    domain = (token.domain or "").lower()

    if domain in {"space", "spaces", "spaces_faculty"}:
        from apps.spaces.models import SpaceBooking
        return (
            SpaceBooking.objects
            .select_related("space", "space__approver_chain", "user")
            .filter(reference_code=token.booking_ref)
            .first()
        )

    if domain == "fleet":
        from apps.fleet.models import FleetBooking
        return (
            FleetBooking.objects
            .select_related("vehicle", "user")
            .filter(reference_code=token.booking_ref)
            .first()
        )

    if domain == "mess":
        from apps.mess.models import MessBooking
        return (
            MessBooking.objects
            .select_related("user")
            .filter(reference_code=token.booking_ref)
            .first()
        )

    return None


def _token_holder_still_eligible(token):
    booking = _booking_for_approval_token(token)
    if booking is None:
        return False

    holder = token.issued_to
    if not holder or not holder.is_active:
        return False

    domain = (token.domain or "").lower()

    if domain == "spaces_faculty":
        from apps.approvals.views import user_can_approve_faculty_booking
        return user_can_approve_faculty_booking(holder, booking)

    if domain in {"space", "spaces"}:
        domain = "spaces"

    if domain in {"spaces", "fleet", "mess"}:
        from apps.approvals.views import user_can_resolve_booking
        return user_can_resolve_booking(domain, booking, holder)

    return False


class NotificationPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


class NotificationListAPIView(APIView):
    permission_classes = [IsAuthenticated]
    pagination_class   = NotificationPagination

    def get(self, request):
        queryset = Notification.objects.filter(recipient=request.user).order_by('-created_at')
        
        actionable_param = request.query_params.get('actionable')
        
        if actionable_param == 'true':
            queryset = queryset.filter(is_actionable=True)
            unread_count = queryset.count()
        elif actionable_param == 'false':
            queryset = queryset.filter(is_actionable=False)
            unread_count = queryset.filter(is_read=False).count()
        else:
            unread_count = queryset.filter(is_read=False).count()

        if request.query_params.get('unread') == 'true':
            queryset = queryset.filter(is_read=False)

        paginator = self.pagination_class()
        page = paginator.paginate_queryset(queryset, request, view=self)
        serializer = NotificationSerializer(page, many=True)

        return Response({
            "unread_count": unread_count,
            "count":        paginator.page.paginator.count,
            "next":         paginator.get_next_link(),
            "previous":     paginator.get_previous_link(),
            "results":      serializer.data,
        })


class NotificationUnreadCountAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        queryset = Notification.objects.filter(recipient=request.user)
        actionable_param = request.query_params.get('actionable')
        
        if actionable_param == 'true':
            return Response({"unread_count": queryset.filter(is_actionable=True).count()})
        elif actionable_param == 'false':
            return Response({"unread_count": queryset.filter(is_actionable=False, is_read=False).count()})
        
        return Response({"unread_count": queryset.filter(is_read=False).count()})


class NotificationMarkReadAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        try:
            notification = Notification.objects.get(pk=pk, recipient=request.user)
        except Notification.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        notification.mark_read()
        return Response(NotificationSerializer(notification).data)


class NotificationMarkAllReadAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request):
        updated = Notification.objects.filter(
            recipient=request.user,
            is_read=False,
            is_actionable=False,
        ).update(
            is_read=True,
            read_at=timezone.now(),
        )
        return Response({"updated": updated})


class NotificationMarkBookingReadAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, reference):
        domain = request.data.get('domain', '') or request.query_params.get('domain', '')
        queryset = Notification.objects.filter(
            recipient=request.user,
            category=Notification.Category.BOOKING_PENDING,
            reference_code=reference,
            is_actionable=True,
        )
        if domain:
            queryset = queryset.filter(domain=domain)

        updated = queryset.update(
            is_actionable=False,
            is_read=True,
            read_at=timezone.now(),
        )

        return Response({"updated": updated})


class TokenApprovalView(View):
    """
    Public one-click approval endpoint. No login required.
    Validates a token from the email link and applies the approval.
    Returns plain HTML — not JSON — because this is opened directly in a browser.
    """

    def get(self, request):
        raw_token = request.GET.get('token', '').strip()
        if not raw_token:
            return self._html_response('Invalid Link', 'This approval link is invalid or incomplete.', success=False)

        token_hash = hashlib.sha256(raw_token.encode()).hexdigest()

        try:
            from apps.notifications.models import ApprovalToken
            token = ApprovalToken.objects.select_related('issued_to').get(token_hash=token_hash)
        except ApprovalToken.DoesNotExist:
            return self._html_response('Invalid Link', 'This approval link is invalid or has already been used.', success=False)

        now = timezone.now()

        # Check: already used
        if token.used:
            return self._html_response(
                'Already Actioned',
                f'This request has already been actioned. This link is no longer valid.',
                success=False,
            )

        # Check: expired
        if token.expires_at <= now:
            return self._html_response(
                'Link Expired',
                'This approval link has expired. The booking\'s scheduled time has passed.',
                success=False,
            )

        # Check: token holder is still authorized for this booking right now.
        if not _token_holder_still_eligible(token):
            logger.warning(
                "ApprovalToken live eligibility rejected token_id=%s domain=%s "
                "booking_ref=%s issued_to_id=%s",
                token.id,
                token.domain,
                token.booking_ref,
                token.issued_to_id,
            )
            return self._html_response(
                'Approval Link No Longer Valid',
                'This approval link is no longer valid because your access to '
                'approve this booking has changed. Please log in to the '
                'dashboard to check its current status.',
                success=False,
            )

        # Route to the correct approval handler
        try:
            result = self._apply_approval(token, now)
        except IntegrityError:
            return self._html_response(
                'Venue No Longer Available',
                'This venue already has an approved booking for the same time slot. '
                'Please log in to review the pending requests.',
                success=False,
            )
        except Exception as e:
            return self._html_response(
                'Approval Failed',
                f'Something went wrong while processing this approval. Please log in to action it manually.',
                success=False,
            )

        # Mark token as used
        token.used = True
        token.used_at = now
        token.save(update_fields=['used', 'used_at'])

        return self._html_response(
            'Approved Successfully',
            result['message'],
            success=True,
            dashboard_url=result.get('dashboard_url', ''),
        )

    def _apply_approval(self, token, now):
        """
        Routes to the correct domain approval logic.
        Returns a dict with 'message' and 'dashboard_url'.
        Raises IntegrityError for space conflicts.
        Raises Exception for any other failure.
        """
        domain = token.domain
        ref = token.booking_ref
        approver = token.issued_to

        if domain == 'spaces':
            return self._approve_space(ref, approver, now)
        if domain == 'fleet':
            return self._approve_fleet(ref, approver, now)
        if domain == 'mess':
            return self._approve_mess(ref, approver, now)
        if domain == 'spaces_faculty':
            return self._approve_faculty(ref, approver, now)
        raise Exception(f'Unknown domain: {domain}')

    def _approve_space(self, ref, approver, now):
        from apps.spaces.models import SpaceBooking
        from apps.notifications.utils import (
            mark_pending_request_notifications_read,
            notify_booking_status_change,
            notify_comanagers_actioned,
        )

        booking = SpaceBooking.objects.select_related('space', 'user').filter(
            reference_code=ref
        ).first()
        if not booking:
            raise Exception('Booking not found.')

        if booking.status not in ('PENDING', 'FACULTY_ESCALATED', 'AWAITING_FACULTY'):
            approver_name = f"{booking.resolved_by.first_name} {booking.resolved_by.last_name}".strip() if booking.resolved_by else 'someone'
            raise Exception(f'Already actioned by {approver_name}.')

        # Approve all siblings in the group (recurring bookings)
        siblings = SpaceBooking.objects.filter(
            group_id=booking.group_id,
            status__in=('PENDING', 'FACULTY_ESCALATED', 'AWAITING_FACULTY'),
        )
        for sibling in siblings:
            sibling.status = 'APPROVED'
            sibling.resolved_by = approver
            sibling.resolved_at = now
            sibling.save()  # IntegrityError raised here if conflict
            mark_pending_request_notifications_read(sibling, domain='spaces')
            notify_booking_status_change(sibling, 'APPROVED', 'spaces', approver)

        notify_comanagers_actioned(booking, 'spaces', approver, 'APPROVED')

        resource = booking.space.name
        requester = f"{booking.user.first_name} {booking.user.last_name}".strip() or booking.user.email
        base_url = getattr(__import__('django.conf', fromlist=['settings']).settings, 'FRONTEND_BASE_URL', 'http://localhost:5173')
        return {
            'message': (
                f"✅ Venue booking approved.\n\n"
                f"Venue: {resource}\n"
                f"Requested by: {requester}\n"
                f"Reference: {ref}\n\n"
                f"The requester has been notified."
            ),
            'dashboard_url': f"{base_url}/admin?tab=history&booking={ref}",
        }

    def _approve_fleet(self, ref, approver, now):
        from apps.fleet.models import FleetBooking
        from apps.notifications.utils import (
            mark_pending_request_notifications_read,
            notify_booking_status_change,
            notify_comanagers_actioned,
        )

        booking = FleetBooking.objects.select_related('vehicle', 'user').filter(
            reference_code=ref
        ).first()
        if not booking:
            raise Exception('Booking not found.')

        if booking.status != 'PENDING':
            approver_name = f"{booking.resolved_by.first_name} {booking.resolved_by.last_name}".strip() if booking.resolved_by else 'someone'
            raise Exception(f'Already actioned by {approver_name}.')

        booking.status = 'APPROVED'
        booking.resolved_by = approver
        booking.resolved_at = now
        booking.save()
        mark_pending_request_notifications_read(booking, domain='fleet')
        notify_booking_status_change(booking, 'APPROVED', 'fleet', approver)
        notify_comanagers_actioned(booking, 'fleet', approver, 'APPROVED')

        resource = booking.vehicle.name if booking.vehicle else 'Vehicle'
        requester = f"{booking.user.first_name} {booking.user.last_name}".strip() or booking.user.email
        base_url = getattr(__import__('django.conf', fromlist=['settings']).settings, 'FRONTEND_BASE_URL', 'http://localhost:5173')
        return {
            'message': (
                f"✅ Fleet booking approved.\n\n"
                f"Vehicle: {resource}\n"
                f"Requested by: {requester}\n"
                f"Reference: {ref}\n\n"
                f"The requester has been notified."
            ),
            'dashboard_url': f"{base_url}/admin/transport?tab=active&booking={ref}",
        }

    def _approve_mess(self, ref, approver, now):
        from apps.mess.models import MessBooking
        from apps.notifications.utils import (
            mark_pending_request_notifications_read,
            notify_booking_status_change,
            notify_comanagers_actioned,
        )

        booking = MessBooking.objects.select_related('user').filter(
            reference_code=ref
        ).first()
        if not booking:
            raise Exception('Booking not found.')

        if booking.status != 'PENDING':
            approver_name = f"{booking.resolved_by.first_name} {booking.resolved_by.last_name}".strip() if booking.resolved_by else 'someone'
            raise Exception(f'Already actioned by {approver_name}.')

        booking.status = 'APPROVED'
        booking.resolved_by = approver
        booking.resolved_at = now
        booking.save()
        mark_pending_request_notifications_read(booking, domain='mess')
        notify_booking_status_change(booking, 'APPROVED', 'mess', approver)
        notify_comanagers_actioned(booking, 'mess', approver, 'APPROVED')

        requester = f"{booking.user.first_name} {booking.user.last_name}".strip() or booking.user.email
        base_url = getattr(__import__('django.conf', fromlist=['settings']).settings, 'FRONTEND_BASE_URL', 'http://localhost:5173')
        return {
            'message': (
                f"✅ Catering request approved.\n\n"
                f"Requested by: {requester}\n"
                f"Reference: {ref}\n\n"
                f"The requester has been notified."
            ),
            'dashboard_url': f"{base_url}/admin/mess?tab=history&booking={ref}",
        }

    def _approve_faculty(self, ref, approver, now):
        from apps.spaces.models import SpaceBooking, Space
        from apps.users.models import Role
        from apps.notifications.utils import (
            mark_pending_request_notifications_read,
            notify_faculty_approved,
            notify_new_request,
            notify_incharge_booking_edited,
            notify,
            _resource_name,
            _booking_reference,
            _approver_link,
        )
        from apps.notifications.models import Notification

        booking = SpaceBooking.objects.select_related('space', 'user', 'space__approver_chain').filter(
            reference_code=ref
        ).first()
        if not booking:
            raise Exception('Booking not found.')

        if booking.status != 'AWAITING_FACULTY':
            approver_name = f"{booking.resolved_by.first_name} {booking.resolved_by.last_name}".strip() if booking.resolved_by else 'someone'
            raise Exception(f'Already actioned by {approver_name}.')

        is_edited = (
            booking.updated_at and booking.created_at and
            (booking.updated_at - booking.created_at).total_seconds() > 60
        )

        booking.status = 'PENDING'
        booking.faculty_response_deadline = None
        booking.faculty_timed_out = False
        booking.save(update_fields=['status', 'faculty_response_deadline', 'faculty_timed_out', 'updated_at'])

        mark_pending_request_notifications_read(booking, domain='spaces')
        notify_faculty_approved(booking)

        # Forward to incharge — mirrors faculty_approve() in SpaceBookingViewSet exactly
        workflow_type = getattr(booking.space, 'approval_workflow_type', None)
        chain = getattr(booking.space, 'approver_chain', None) if workflow_type == 'HOD_FALLBACK' else None
        if chain:
            target = chain.primary_approver or chain.fallback_approver
            if target:
                notify(
                    target,
                    Notification.Category.BOOKING_PENDING,
                    'New Booking Request',
                    f'A faculty-approved booking for {_resource_name(booking, "spaces")} requires your approval.',
                    link=_approver_link('spaces', _booking_reference(booking)),
                    domain='spaces',
                    reference_code=_booking_reference(booking),
                    is_actionable=True,
                )
        else:
            category = booking.space.approval_category
            if category == Space.ApprovalCategory.LAB:
                role = Role.Name.LAB_INCHARGE
            elif category == Space.ApprovalCategory.LIBRARY:
                role = Role.Name.LIBRARIAN
            else:
                role = Role.Name.RECEPTIONIST
            if is_edited:
                notify_incharge_booking_edited(booking, 'spaces', role)
            else:
                notify_new_request(booking, 'spaces', role)

        requester = f"{booking.user.first_name} {booking.user.last_name}".strip() or booking.user.email
        resource = _resource_name(booking, 'spaces')
        base_url = getattr(__import__('django.conf', fromlist=['settings']).settings, 'FRONTEND_BASE_URL', 'http://localhost:5173')
        return {
            'message': (
                f"✅ Faculty approval confirmed.\n\n"
                f"Venue: {resource}\n"
                f"Requested by: {requester}\n"
                f"Reference: {ref}\n\n"
                f"The booking has been forwarded to the venue incharge for final approval."
            ),
            'dashboard_url': f"{base_url}/faculty-approvals",
        }

    def _html_response(self, title, body, success=True, dashboard_url=''):
        color = '#2e7d32' if success else '#c62828'
        icon = '✅' if success else '❌'
        dashboard_link = (
            f'<p style="margin-top:24px;"><a href="{dashboard_url}" '
            f'style="color:#1565c0;">View in Dashboard →</a></p>'
            if dashboard_url else ''
        )
        html = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>RCSS — {title}</title>
  <style>
    body {{ font-family: sans-serif; display: flex; justify-content: center;
            align-items: center; min-height: 100vh; margin: 0; background: #f5f5f5; }}
    .card {{ background: white; border-radius: 8px; padding: 40px 48px;
             max-width: 480px; width: 100%; box-shadow: 0 2px 8px rgba(0,0,0,.12); }}
    h1 {{ color: {color}; font-size: 1.4rem; margin-bottom: 12px; }}
    p {{ color: #333; line-height: 1.6; white-space: pre-line; }}
    a {{ color: #1565c0; }}
  </style>
  </head>
<body>
  <div class="card">
    <h1>{icon} {title}</h1>
    <p>{body}</p>
    {dashboard_link}
    <p style="margin-top:32px;font-size:.85rem;color:#888;">RCSS · Campus Resource Booking System</p>
  </div>
</body>
</html>"""
        status_code = 200 if success else 400
        return HttpResponse(html, content_type='text/html', status=status_code)
