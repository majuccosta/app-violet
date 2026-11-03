from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.comum.mixins import DaUsuariaMixin

from .models import Notificacao
from .serializers import NotificacaoSerializer


class NotificacaoViewSet(DaUsuariaMixin, mixins.ListModelMixin, mixins.UpdateModelMixin, viewsets.GenericViewSet):
    """/api/notificacoes/"""
    queryset = Notificacao.objects.all()
    serializer_class = NotificacaoSerializer

    @action(detail=False, methods=["post"], url_path="marcar-lidas")
    def marcar_lidas(self, request):
        total = self.get_queryset().filter(lida=False).update(lida=True)
        return Response({"atualizadas": total})
