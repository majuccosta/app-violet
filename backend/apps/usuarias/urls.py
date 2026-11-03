from django.urls import path

from .views import AlterarSenhaView, ExcluirContaView, MeView, VerificacaoView

urlpatterns = [
    path("me/", MeView.as_view(), name="me"),
    path("me/senha/", AlterarSenhaView.as_view(), name="alterar-senha"),
    path("me/excluir/", ExcluirContaView.as_view(), name="excluir-conta"),
    path("verificacao/", VerificacaoView.as_view(), name="verificacao"),
]
