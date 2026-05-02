from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from .views import CookieTokenObtainPairView, LogoutView, CurrentUserView

urlpatterns = [
    path('login/', CookieTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('logout/', LogoutView.as_view(), name='logout'),
    
    # NEW: The endpoint React calls to verify the session
    path('me/', CurrentUserView.as_view(), name='current-user'),
]