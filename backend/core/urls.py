from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    
    # Core Infrastructure API
    path('api/auth/', include('apps.users.urls')),
    path('api/approvals/', include('apps.approvals.urls')), # <-- The new Master Queue!
    
    # Domain APIs
    path('api/spaces/', include('apps.spaces.urls')),
    
    # Your teammate's routes will go here once they finish!
    # path('api/fleet/', include('apps.fleet.urls')),
    # path('api/mess/', include('apps.mess.urls')),
    # path('api/media/', include('apps.media.urls')),
]