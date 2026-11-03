from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import GrupoTrajetoViewSet, LocalizacaoView, ProximasView, SolicitacaoAcompanhamentoViewSet

router = DefaultRouter()
router.register("grupos", GrupoTrajetoViewSet, basename="grupo")
router.register("solicitacoes", SolicitacaoAcompanhamentoViewSet, basename="solicitacao")

urlpatterns = [
    path("localizacao/", LocalizacaoView.as_view(), name="circulo-localizacao"),
    path("proximas/", ProximasView.as_view(), name="circulo-proximas"),
] + router.urls
