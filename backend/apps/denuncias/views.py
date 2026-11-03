from rest_framework import mixins, status, viewsets
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response

from apps.comum.mixins import DaUsuariaMixin

from .models import Denuncia
from .serializers import DenunciaSerializer
from .services import registrar_denuncia


class DenunciaViewSet(DaUsuariaMixin, mixins.CreateModelMixin, mixins.ListModelMixin,
                      mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """/api/denuncias/ — a usuária só vê o próprio histórico."""
    queryset = Denuncia.objects.prefetch_related("evidencias__analise")
    serializer_class = DenunciaSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        qs = super().get_queryset()
        status_param = self.request.query_params.get("status")
        return qs.filter(status=status_param) if status_param else qs

    def create(self, request, *args, **kwargs):
        data = request.data.copy()
        arquivos = request.FILES.getlist("evidencias")
        ser = self.get_serializer(data=data)
        ser.is_valid(raise_exception=True)
        ser.validated_data.pop("arquivos", None)
        self.get_serializer().validate_arquivos(arquivos)
        denuncia = registrar_denuncia(request.user, ser.validated_data, arquivos)
        return Response(self.get_serializer(denuncia).data, status=status.HTTP_201_CREATED)
