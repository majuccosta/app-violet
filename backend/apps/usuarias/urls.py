from django.urls import path

from .views import (
    AlterarEmailView, AlterarSenhaView, DiditWebhookView, ExcluirContaView, MeView, VerificacaoIniciarView, VerificacaoStatusView,
    VerificacaoView,
)

urlpatterns = [
    path("me/", MeView.as_view(), name="me"),
    path("me/email/", AlterarEmailView.as_view(), name="alterar-email"),
    path("me/senha/", AlterarSenhaView.as_view(), name="alterar-senha"),
    path("me/excluir/", ExcluirContaView.as_view(), name="excluir-conta"),
    path("verificacao/", VerificacaoView.as_view(), name="verificacao"),
    path("verificacao/iniciar/", VerificacaoIniciarView.as_view(), name="verificacao-iniciar"),
    path("verificacao/status/", VerificacaoStatusView.as_view(), name="verificacao-status"),
    path("verificacao/webhook/", DiditWebhookView.as_view(), name="verificacao-webhook"),
]
