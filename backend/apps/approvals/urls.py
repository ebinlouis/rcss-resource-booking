from django.urls import path
from .views import UnifiedApprovalQueueView

urlpatterns = [
    path('queue/', UnifiedApprovalQueueView.as_view(), name='unified-queue'),
]