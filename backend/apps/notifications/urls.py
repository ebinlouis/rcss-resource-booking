from django.urls import path

from apps.notifications.views import (
    NotificationListAPIView,
    NotificationMarkAllReadAPIView,
    NotificationMarkBookingReadAPIView,
    NotificationMarkReadAPIView,
    NotificationUnreadCountAPIView,
    TokenApprovalView,
)


urlpatterns = [
    path('', NotificationListAPIView.as_view(), name='notification-list'),
    path('unread-count/', NotificationUnreadCountAPIView.as_view(), name='notification-unread-count'),
    path('mark-all-read/', NotificationMarkAllReadAPIView.as_view(), name='notification-mark-all-read'),
    path('booking/<str:reference>/read/', NotificationMarkBookingReadAPIView.as_view(), name='notification-mark-booking-read'),
    path('<int:pk>/read/', NotificationMarkReadAPIView.as_view(), name='notification-mark-read'),
    path('action/', TokenApprovalView.as_view(), name='token-approval'),
]
