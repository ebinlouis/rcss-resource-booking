from django.utils import timezone
from rest_framework import status
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.notifications.models import Notification
from apps.notifications.serializers import NotificationSerializer


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
