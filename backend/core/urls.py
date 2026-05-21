from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

urlpatterns = [
    path('admin/', admin.site.urls),

    # Swagger API Documentation
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),

    # Core Infrastructure API
    path('api/auth/', include('apps.users.urls')),
    path('api/approvals/', include('apps.approvals.urls')),
    path('api/notifications/', include('apps.notifications.urls')),

    # Domain APIs
    path('api/spaces/', include('apps.spaces.urls')),
    path('api/fleet/', include('apps.fleet.urls')),
    path('api/mess/', include('apps.mess.urls')),
    path('api/media/', include('apps.media.urls')),

# Serves uploaded files (images etc.) during development.
# Django does NOT serve media in production — use nginx/S3 there.
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
