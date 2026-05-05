from django.contrib import admin
from .models import Department # Add any other models you want to see here

# The simplest way to register a model:
admin.site.register(Department)