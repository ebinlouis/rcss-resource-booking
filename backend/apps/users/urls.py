from django.urls import path
from .views import CookieTokenObtainPairView, LogoutView
from rest_framework_simplejwt.views import TokenRefreshView

urlpatterns = [
    path('login/', CookieTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('logout/', LogoutView.as_view(), name='logout'),
]