from django.urls import path
from .views import UnifiedApprovalQueueView, AdminResolveBookingAPIView

urlpatterns = [
    # GET: Fetches the master list of all PENDING requests for the admin table
    path('queue/', UnifiedApprovalQueueView.as_view(), name='unified-queue'),
    
    # PATCH: Endpoint for the admin to transition a request to APPROVED or REJECTED
    path('resolve/', AdminResolveBookingAPIView.as_view(), name='admin-resolve'),
]