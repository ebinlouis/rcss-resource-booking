from django.apps import AppConfig

class SpacesConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.approvals'  # <-- THIS IS THE CRITICAL CHANGE