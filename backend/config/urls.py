"""Rotas da API Violet. Os caminhos batem com frontend/assets/js/api.js (ENDPOINTS)."""
from django.contrib import admin
from django.urls import include, path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from apps.usuarias.views import CadastroView, NovaSenhaView, RecuperarSenhaView, VerificarCodigoView

api = [
    # Autenticação
    path("auth/cadastro/", CadastroView.as_view(), name="cadastro"),
    path("auth/login/", TokenObtainPairView.as_view(), name="login"),
    path("auth/recuperar-senha/", RecuperarSenhaView.as_view(), name="recuperar-senha"),
    path("auth/verificar-codigo/", VerificarCodigoView.as_view(), name="verificar-codigo"),
    path("auth/nova-senha/", NovaSenhaView.as_view(), name="nova-senha"),
    path("auth/refresh/", TokenRefreshView.as_view(), name="refresh"),
    # Módulos
    path("usuarias/", include("apps.usuarias.urls")),
    path("contatos/", include("apps.contatos.urls")),
    path("emergencia/", include("apps.emergencia.urls")),
    path("denuncias/", include("apps.denuncias.urls")),
    path("conversas/", include("apps.conversas.urls")),
    path("notificacoes/", include("apps.notificacoes.urls")),
    path("orientacoes/", include("apps.orientacoes.urls")),
    path("circulo/", include("apps.circulo.urls")),
    path("ia/", include("apps.ia.urls")),
]

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include(api)),
]
