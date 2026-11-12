"""Configurações do backend Violet (Django + DRF + PostgreSQL).
Segredos e credenciais vêm do arquivo .env (copie .env.example)."""
import os
from datetime import timedelta
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent


def env(nome, padrao=None):
    return os.environ.get(nome, padrao)


# Carrega backend/.env sem dependências extras
_env_file = BASE_DIR / ".env"
if _env_file.exists():
    for linha in _env_file.read_text(encoding="utf-8").splitlines():
        if linha.strip() and not linha.startswith("#") and "=" in linha:
            k, v = linha.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip())

SECRET_KEY = env("DJANGO_SECRET_KEY", "troque-esta-chave-no-env")
DEBUG = env("DJANGO_DEBUG", "True") == "True"
# Enquanto a integração com o Didit não existe: com VERIFICACAO_DEMO ligado, qualquer foto de documento válida
# aprova a verificação (só para demonstração). Desligado, a verificação fica "pendente".
VERIFICACAO_DEMO = env("VERIFICACAO_DEMO", "True" if DEBUG else "False") == "True"
ALLOWED_HOSTS = env("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1").split(",")
CSRF_TRUSTED_ORIGINS = [o for o in env("CSRF_ORIGINS", "").split(",") if o]

# Render informa o endereço público automaticamente
_render_host = env("RENDER_EXTERNAL_HOSTNAME")
if _render_host:
    ALLOWED_HOSTS.append(_render_host)
    CSRF_TRUSTED_ORIGINS.append(f"https://{_render_host}")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # terceiros
    "rest_framework",
    "corsheaders",
    # Violet
    "apps.usuarias",
    "apps.contatos",
    "apps.emergencia",
    "apps.denuncias",
    "apps.conversas",
    "apps.notificacoes",
    "apps.orientacoes",
    "apps.circulo",
    "apps.ia",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",  # serve o CSS do /admin em produção
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"

TEMPLATES = [{
    "BACKEND": "django.template.backends.django.DjangoTemplates",
    "DIRS": [],
    "APP_DIRS": True,
    "OPTIONS": {"context_processors": [
        "django.template.context_processors.request",
        "django.contrib.auth.context_processors.auth",
        "django.contrib.messages.context_processors.messages",
    ]},
}]

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": env("DB_NAME", "violet"),
        "USER": env("DB_USER", "violet"),
        "PASSWORD": env("DB_PASSWORD", ""),
        "HOST": env("DB_HOST", "localhost"),
        "PORT": env("DB_PORT", "5432"),
        # Bancos na nuvem (Supabase) exigem conexão criptografada: DB_SSLMODE=require
        "OPTIONS": {"sslmode": env("DB_SSLMODE", "prefer")},
        # Reaproveita a conexão por 60 s em vez de abrir uma nova a cada pedido (muito mais rápido na nuvem)
        "CONN_MAX_AGE": int(env("DB_CONN_MAX_AGE", "60")),
        "CONN_HEALTH_CHECKS": True,
    }
}

AUTH_USER_MODEL = "usuarias.Usuaria"
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator", "OPTIONS": {"min_length": 8}},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "pt-br"
TIME_ZONE = "America/Sao_Paulo"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedStaticFilesStorage"},
}
# Evidências e mídias ficam em área PRIVADA (nunca servidas por link público)
MEDIA_ROOT = BASE_DIR / "media"
MEDIA_URL = "/media-privada/"
FILE_UPLOAD_MAX_MEMORY_SIZE = 25 * 1024 * 1024
DATA_UPLOAD_MAX_MEMORY_SIZE = 30 * 1024 * 1024

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": ["rest_framework_simplejwt.authentication.JWTAuthentication"],
    "DEFAULT_PERMISSION_CLASSES": ["apps.comum.permissoes.IsVerificada"],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 20,
    "DEFAULT_THROTTLE_CLASSES": ["rest_framework.throttling.AnonRateThrottle", "rest_framework.throttling.UserRateThrottle"],
    "DEFAULT_THROTTLE_RATES": {"anon": "30/min", "user": "300/min"},
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=30),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
}

# Front-end rodando no Live Server do VS Code / http.server
CORS_ALLOWED_ORIGINS = env("CORS_ORIGINS", "http://localhost:5500,http://127.0.0.1:5500,http://localhost:8080").split(",")

# E-mails (recuperação de senha): no terminal em desenvolvimento
EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"

# Integrações externas (fase de integrações)
DIDIT_API_KEY = env("DIDIT_API_KEY", "")
DIDIT_WORKFLOW_ID = env("DIDIT_WORKFLOW_ID", "")          # id do workflow criado no console da Didit
DIDIT_WEBHOOK_SECRET = env("DIDIT_WEBHOOK_SECRET", "")    # segredo do webhook (console da Didit)
DIDIT_CALLBACK_URL = env("DIDIT_CALLBACK_URL", "")        # opcional: para onde a Didit devolve a usuária
# Login com Google (Google Cloud Console > Credenciais > ID do cliente OAuth, tipo "Aplicativo da Web")
GOOGLE_CLIENT_ID = env("GOOGLE_CLIENT_ID", "")
# Opcional: só aceita e-mails destes domínios, separados por vírgula (ex.: sempreceub.com,ceub.edu.br). Vazio = qualquer conta Google.
GOOGLE_DOMINIOS_PERMITIDOS = [d for d in env("GOOGLE_DOMINIOS", "").split(",") if d.strip()]
# Só com DIDIT_API_KEY e DIDIT_WORKFLOW_ID preenchidos a verificação real fica ligada; sem eles vale o modo demonstração.

if not DEBUG:
    # Atrás do proxy do Render: confia no cabeçalho que diz que o acesso original era HTTPS
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    SECURE_SSL_REDIRECT = True
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_HSTS_SECONDS = 31536000
