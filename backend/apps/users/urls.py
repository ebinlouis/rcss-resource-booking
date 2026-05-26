from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from .views import (
    CookieTokenObtainPairView,
    LogoutView,
    CurrentUserView,
    DashboardAPIView,
    AdminUserViewSet,
    RoleOverrideViewSet,
    DepartmentViewSet,
    RoleListView,
    UserSearchView,
    UserProfileUpdateView,
    HODFacultyCSVUploadView,
)

# Initialize the router for viewsets
router = DefaultRouter()
router.register('admin-users', AdminUserViewSet, basename='admin-user')
router.register('role-overrides', RoleOverrideViewSet, basename='role-override')
router.register('departments', DepartmentViewSet, basename='department')

urlpatterns = [
    path('login/', CookieTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('logout/', LogoutView.as_view(), name='logout'),
    path('me/', CurrentUserView.as_view(), name='current-user'),
    path('profile/', UserProfileUpdateView.as_view(), name='user-profile-update'),
    path('dashboard/', DashboardAPIView.as_view(), name='user-dashboard'),
    
    # --- STATIC ENDPOINTS ---
    path('roles/', RoleListView.as_view(), name='role-list'),
    path('users/search/', UserSearchView.as_view(), name='user-search'),

    # --- HOD CSV BULK UPLOAD ---
    path('admin-users/csv-upload/', HODFacultyCSVUploadView.as_view(), name='faculty-csv-upload'),

    # Include the router
    path('', include(router.urls)),
]
