# apps/spaces/urls.py

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import SpaceViewSet, SpaceBookingViewSet, EquipmentViewSet, BlockViewSet, SpaceApproverViewSet, faculty_list

router = DefaultRouter()
router.register(r'catalog',   SpaceViewSet,         basename='space')
router.register(r'requests',  SpaceBookingViewSet,  basename='space-booking')
router.register(r'inventory', EquipmentViewSet,     basename='equipment')

# IT Admin infrastructure endpoints
router.register(r'blocks',    BlockViewSet,         basename='block')
router.register(r'approvers', SpaceApproverViewSet, basename='space-approver')

urlpatterns = [
    path('faculty-list/', faculty_list, name='faculty-list'),
    path('', include(router.urls)),
]

# Resulting routes:
#
# BLOCKS (IT_ADMIN only)
#   GET    api/spaces/blocks/              — list all blocks
#   POST   api/spaces/blocks/              — create block
#   GET    api/spaces/blocks/{id}/         — retrieve block
#   PATCH  api/spaces/blocks/{id}/         — update (use to set is_active=false)
#   DELETE api/spaces/blocks/{id}/         — hard delete (blocked by PROTECT if referenced)
#
# APPROVER ASSIGNMENTS (IT_ADMIN only)
#   GET    api/spaces/approvers/           — list assignments (?user=&role=&block=&active=)
#   POST   api/spaces/approvers/           — create assignment
#   GET    api/spaces/approvers/{id}/      — retrieve assignment
#   PATCH  api/spaces/approvers/{id}/      — update scope or toggle is_active
#   DELETE api/spaces/approvers/{id}/      — hard delete
#
# PRINCIPAL CANCEL (add to SpaceBookingViewSet via @action)
#   PATCH  api/spaces/requests/{id}/cancel/  — Principal cancels an APPROVED booking