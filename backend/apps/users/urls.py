from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from .views import (
    CookieTokenObtainPairView, 
    LogoutView, 
    CurrentUserView, 
    DashboardAPIView,
    RoleOverrideViewSet,
    DepartmentViewSet,
    RoleListView, 
    UserSearchView # <-- NEW IMPORT
)

# Initialize the router for viewsets
router = DefaultRouter()
router.register(r'role-overrides', RoleOverrideViewSet, basename='role-override')
router.register(r'departments', DepartmentViewSet, basename='department')

urlpatterns = [
    path('login/', CookieTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('logout/', LogoutView.as_view(), name='logout'),
    path('me/', CurrentUserView.as_view(), name='current-user'),
    path('dashboard/', DashboardAPIView.as_view(), name='user-dashboard'),
    
    # --- STATIC ENDPOINTS ---
    path('roles/', RoleListView.as_view(), name='role-list'),
    path('users/search/', UserSearchView.as_view(), name='user-search'), # <-- NEW ENDPOINT
    
    # Include the router
    path('', include(router.urls)),
]