import environ
import sentry_sdk
from sentry_sdk.integrations.django import DjangoIntegration
from pathlib import Path
from datetime import timedelta

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# Initialize environ
env = environ.Env(
    DEBUG=(bool, False)
)

# Read the .env file explicitly
environ.Env.read_env(BASE_DIR / '.env')

# ==========================================
# SENTRY ERROR TRACKING CONFIGURATION
# ==========================================
SENTRY_DSN = env('SENTRY_DSN', default='')

if SENTRY_DSN:
    sentry_sdk.init(
        dsn=SENTRY_DSN,
        integrations=[DjangoIntegration()],
        traces_sample_rate=1.0,
        send_default_pii=True
    )

SECRET_KEY = env('SECRET_KEY')
DEBUG = env('DEBUG')
ALLOWED_HOSTS = env.list('ALLOWED_HOSTS', default=[])

# Application definition
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    # PostgreSQL Features
    'django.contrib.postgres',

    # Third-party
    'corsheaders',
    'rest_framework',
    'drf_spectacular',
    'django_celery_beat',

    # Local Apps
    'apps.users',
    'apps.approvals',
    'apps.notifications',
    'apps.spaces',
    'apps.fleet',
    'apps.mess',
    'apps.media',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',  # Must be first
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'core.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'core.wsgi.application'

# Database
DATABASES = {
    'default': {
        **env.db('DATABASE_URL', default='postgres://postgres:postgres@localhost:5432/rcss_booking_db'),
        'CONN_MAX_AGE': 60,
        'CONN_HEALTH_CHECKS': True,
    }
}

# ==========================================
# CUSTOM USER MODEL
# ==========================================
AUTH_USER_MODEL = 'users.CustomUser'

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

# Internationalization
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'Asia/Kolkata'
USE_I18N = True
USE_TZ = True

# Static files
STATIC_URL = 'static/'

# Media files (Uploads)
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

# Space approval routing
# Temporary fallback window until the notification/leave workflow is implemented.
AI_LAB_HOD_FALLBACK_HOURS = env.int('AI_LAB_HOD_FALLBACK_HOURS', default=24)

# ==========================================
# EMAIL CONFIGURATION
# ==========================================
#
# Stage 1 — Mailpit (local dev, current):
#   EMAIL_HOST=localhost
#   EMAIL_PORT=1025
#   EMAIL_USE_TLS=False
#   EMAIL_HOST_USER=        (leave blank)
#   EMAIL_HOST_PASSWORD=    (leave blank)
#   DEFAULT_FROM_EMAIL=RCSS Notifications <notifications@rcss.local>
#   NOTIFICATION_EMAIL_STUB=False
#
# Stage 2 — Dummy Gmail (team demo/staging):
#   EMAIL_HOST=smtp.gmail.com
#   EMAIL_PORT=587
#   EMAIL_USE_TLS=True
#   EMAIL_HOST_USER=your-dummy-account@gmail.com
#   EMAIL_HOST_PASSWORD=your-16-char-app-password
#   DEFAULT_FROM_EMAIL=RCSS Notifications <your-dummy-account@gmail.com>
#   NOTIFICATION_EMAIL_STUB=False
#
# Stage 3 — Official college email (production):
#   Update the four EMAIL_* vars above to college SMTP values.
#   No code changes needed anywhere.
#
# To disable all email sending without touching anything else:
#   NOTIFICATION_EMAIL_STUB=True

# When True, notify() skips all email sending (in-app notifications still fire).
NOTIFICATION_EMAIL_STUB = env.bool('NOTIFICATION_EMAIL_STUB', default=True)

EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST = env('EMAIL_HOST', default='localhost')
EMAIL_PORT = env.int('EMAIL_PORT', default=1025)
EMAIL_USE_TLS = env.bool('EMAIL_USE_TLS', default=False)
EMAIL_HOST_USER = env('EMAIL_HOST_USER', default='')
EMAIL_HOST_PASSWORD = env('EMAIL_HOST_PASSWORD', default='')
DEFAULT_FROM_EMAIL = env(
    'DEFAULT_FROM_EMAIL',
    default='RCSS Notifications <notifications@rcss.local>'
)

# ==========================================
# CORS & CSRF CONFIGURATION
# ==========================================
CORS_ALLOW_ALL_ORIGINS = False
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

# Tells Django to accept requests from these origins even with CSRF protection on
CSRF_TRUSTED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

# Must be False so the axios interceptor can read the csrftoken cookie
CSRF_COOKIE_HTTPONLY = False
CSRF_COOKIE_SAMESITE = 'Lax'

# ==========================================
# THIRD-PARTY CONFIGURATIONS
# ==========================================

# DRF Global Settings
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'apps.users.authentication.CustomCookieAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
}

# JWT Configuration
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=60),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=1),
    'SIGNING_KEY': SECRET_KEY,
    'AUTH_HEADER_TYPES': ('Bearer',),
}

# Swagger API Documentation Settings
SPECTACULAR_SETTINGS = {
    'TITLE': 'Campus Resource Booking API',
    'DESCRIPTION': 'Master API for Spaces, Fleet, Mess, and Media bookings.',
    'VERSION': '1.0.0',
    'SERVE_INCLUDE_SCHEMA': False,
}

# ==========================================
# CELERY CONFIGURATION
# ==========================================
CELERY_BROKER_URL = env('CELERY_BROKER_URL', default='redis://localhost:6379/0')
CELERY_RESULT_BACKEND = env('CELERY_RESULT_BACKEND', default='redis://localhost:6379/0')
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_TIMEZONE = TIME_ZONE
CELERY_BEAT_SCHEDULER = 'django_celery_beat.schedulers:DatabaseScheduler'
CELERY_TASK_ALWAYS_EAGER = False
CELERY_WORKER_HIJACK_ROOT_LOGGER = False

CELERY_BEAT_SCHEDULE = {
    'run-booking-lifecycle-every-5-minutes': {
        'task': 'apps.notifications.tasks.run_booking_lifecycle',
        'schedule': 300.0,
    },
}