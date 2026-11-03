from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response

from apps.comum.mixins import DaUsuariaMixin

from .models import AlertaEmergencia
from .serializers import AlertaEmergenciaSerializer, MidiaAlertaSerializer
from .services import disparar_alerta, encerrar_alerta


class AlertaEmergenciaViewSet(DaUsuariaMixin, mixins.CreateModelMixin, mixins.ListModelMixin,
                              mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """/api/emergencia/alertas/"""
    queryset = AlertaEmergencia.objects.all()
    serializer_class = AlertaEmergenciaSerializer

    def create(self, request, *args, **kwargs):
        ser = self.get_serializer(data=request.data)
        ser.is_valid(raise_exception=True)
        alerta = ser.save(usuaria=request.user)
        total = disparar_alerta(alerta)
        data = self.get_serializer(alerta).data
        data["contatos_notificados"] = total
        return Response(data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def cancelar(self, request, pk=None):
        alerta = encerrar_alerta(self.get_object())
        return Response(self.get_serializer(alerta).data)

    @action(detail=True, methods=["post"], parser_classes=[MultiPartParser, FormParser])
    def midias(self, request, pk=None):
        ser = MidiaAlertaSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        ser.save(alerta=self.get_object())
        return Response(ser.data, status=status.HTTP_201_CREATED)
