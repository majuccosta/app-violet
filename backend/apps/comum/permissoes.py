"""Permissões compartilhadas pela API."""
from rest_framework import permissions


class IsVerificada(permissions.IsAuthenticated):
    """Só usa o Violet quem concluiu a verificação de identidade.
    Perfil, troca de senha, exclusão de conta e a própria verificação ficam liberados (IsAuthenticated)."""
    message = "Conclua a verificação de identidade para usar o Violet."

    def has_permission(self, request, view):
        return super().has_permission(request, view) and bool(getattr(request.user, "verificada", False))
