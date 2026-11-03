from rest_framework import permissions, viewsets

from .models import Orientacao
from .serializers import OrientacaoSerializer


class OrientacaoViewSet(viewsets.ReadOnlyModelViewSet):
    """/api/orientacoes/ — conteúdo público, editado pelo admin do Django."""
    queryset = Orientacao.objects.filter(ativo=True)
    serializer_class = OrientacaoSerializer
    permission_classes = [permissions.AllowAny]
    lookup_field = "slug"
