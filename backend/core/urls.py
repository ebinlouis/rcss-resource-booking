from django.contrib import admin
from django.urls import path, include
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView # <-- Added imports

urlpatterns = [
    path('admin/', admin.site.urls),
    
    # Swagger API Documentation
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'), # The raw JSON map
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'), # The beautiful UI
    
    # Core Infrastructure API
    path('api/auth/', include('apps.users.urls')),
    path('api/approvals/', include('apps.approvals.urls')), # <-- The Master Queue!
    
    # Domain APIs
    path('api/spaces/', include('apps.spaces.urls')),
    
    # Your teammate's routes will go here once they finish!
    path('api/fleet/', include('apps.fleet.urls')),
    path('api/mess/', include('apps.mess.urls')),
    path('api/media/', include('apps.media.urls')),
]