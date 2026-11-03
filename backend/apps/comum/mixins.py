"""Mixins compartilhados pelas views da API."""


class DaUsuariaMixin:
    """Cada usuária só enxerga e cria registros dela mesma."""
    campo_dona = "usuaria"

    def get_queryset(self):
        return super().get_queryset().filter(**{self.campo_dona: self.request.user})

    def perform_create(self, serializer):
        serializer.save(**{self.campo_dona: self.request.user})
