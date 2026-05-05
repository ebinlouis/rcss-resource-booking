from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from .views import (
    CookieTokenObtainPairView, 
    LogoutView, 
    CurrentUserView, 
    DashboardAPIView,
    RoleOverrideViewSet
)

# Initialize the router for viewsets
router = DefaultRouter()
router.register(r'role-overrides', RoleOverrideViewSet, basename='role-override')

urlpatterns = [
    path('login/', CookieTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('logout/', LogoutView.as_view(), name='logout'),
    
    # Endpoint for session verification
    path('me/', CurrentUserView.as_view(), name='current-user'),
    
    # The aggregator for the Home/Dashboard view
    path('dashboard/', DashboardAPIView.as_view(), name='user-dashboard'),
    
    # NEW: Include the router for role overrides
    path('', include(router.urls)),
]