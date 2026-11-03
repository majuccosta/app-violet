from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from .models import Conversa, Mensagem, Participante
from .serializers import ConversaSerializer, MensagemSerializer


class ConversaViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.CreateModelMixin,
                      mixins.UpdateModelMixin, mixins.DestroyModelMixin, viewsets.GenericViewSet):
    """/api/conversas/ e /api/conversas/{id}/mensagens/ — grupos: criar, renomear, excluir e remover membro."""
    serializer_class = ConversaSerializer
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_queryset(self):
        return Conversa.objects.filter(participantes__usuaria=self.request.user).distinct()

    def perform_create(self, serializer):
        conversa = serializer.save(criadora=self.request.user)
        anonima = conversa.tipo == Conversa.Tipo.ANONIMA
        Participante.objects.create(conversa=conversa, usuaria=self.request.user, anonima=anonima)
        # TODO: escolher a outra participante (contato da rede ou usuária disponível)

    def _so_criadora(self, conversa):
        if conversa.tipo != Conversa.Tipo.GRUPO or conversa.criadora_id != self.request.user.id:
            raise PermissionDenied("Só quem criou o grupo pode alterá-lo.")

    def perform_update(self, serializer):
        self._so_criadora(serializer.instance)
        serializer.save()

    def perform_destroy(self, instance):
        self._so_criadora(instance)
        instance.delete()

    @action(detail=True, methods=["post"], url_path="remover-membro")
    def remover_membro(self, request, pk=None):
        """Só a criadora remove. membro = 'u12' (usuária) ou 'c7' (contato convidado)."""
        conversa = self.get_object()
        self._so_criadora(conversa)
        alvo = str(request.data.get("membro", ""))
        if alvo[:1] == "u" and alvo[1:].isdigit():
            if int(alvo[1:]) == request.user.id:
                return Response({"detail": "Você não pode remover a si mesma."}, status=status.HTTP_400_BAD_REQUEST)
            total, _ = conversa.participantes.filter(usuaria_id=int(alvo[1:])).delete()
            if not total:
                return Response({"detail": "Essa participante não está no grupo."}, status=status.HTTP_404_NOT_FOUND)
        elif alvo[:1] == "c":
            antes = len(conversa.membros or [])
            conversa.membros = [m for i, m in enumerate(conversa.membros or [])
                                if f"c{m.get('id') if m.get('id') is not None else i}" != alvo]
            if len(conversa.membros) == antes:
                return Response({"detail": "Esse contato não está no grupo."}, status=status.HTTP_404_NOT_FOUND)
            conversa.save(update_fields=["membros"])
        else:
            return Response({"detail": "Participante inválida."}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"detail": "Participante removida."})

    @action(detail=True, methods=["get", "post"])
    def mensagens(self, request, pk=None):
        conversa = self.get_object()
        if request.method == "POST":
            ser = MensagemSerializer(data=request.data, context={"request": request})
            ser.is_valid(raise_exception=True)
            ser.save(conversa=conversa, autora=request.user)
            return Response(ser.data, status=status.HTTP_201_CREATED)
        conversa.mensagens.exclude(autora=request.user).update(lida=True)
        msgs = Mensagem.objects.filter(conversa=conversa)
        return Response(MensagemSerializer(msgs, many=True, context={"request": request}).data)
