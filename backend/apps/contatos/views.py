from rest_framework import viewsets

from apps.comum.mixins import DaUsuariaMixin

from .models import ContatoConfianca
from .serializers import ContatoConfiancaSerializer


class ContatoConfiancaViewSet(DaUsuariaMixin, viewsets.ModelViewSet):
    """/api/contatos/ — CRUD dos contatos de confiança (RQ005)."""
    queryset = ContatoConfianca.objects.all()
    serializer_class = ContatoConfiancaSerializer
