"""Círculo de Apoio (RQ011) — grupos de trajeto, pedidos de acompanhamento e localização autorizada."""
from datetime import timedelta

from django.conf import settings
from django.utils import timezone
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import CompartilhamentoLocalizacao, GrupoTrajeto, ParticipacaoGrupo, SolicitacaoAcompanhamento
from .serializers import CompartilhamentoLocalizacaoSerializer, GrupoTrajetoSerializer, SolicitacaoAcompanhamentoSerializer


class GrupoTrajetoViewSet(viewsets.ModelViewSet):
    """/api/circulo/grupos/ — ?busca=destino para pesquisar grupos"""
    serializer_class = GrupoTrajetoSerializer

    # Grupos de demonstração (ids 1 a 5 do seed) e quanto tempo à frente cada um "sai"
    DEMO_ATRASOS = {1: timedelta(hours=3), 2: timedelta(hours=5), 3: timedelta(days=2),
                    4: timedelta(days=1), 5: timedelta(hours=8)}

    def _renovar_demo(self):
        """No modo demonstração, grupos de teste que já venceram voltam a "sair em breve",
        assim a lista do Círculo nunca fica vazia na apresentação."""
        if not getattr(settings, "VERIFICACAO_DEMO", False):
            return
        agora = timezone.now()
        vencidos = GrupoTrajeto.objects.filter(id__in=self.DEMO_ATRASOS, horario__lt=agora - timedelta(hours=3))
        for grupo in vencidos:
            grupo.horario = agora + self.DEMO_ATRASOS[grupo.id]
            grupo.save(update_fields=["horario"])

    def get_queryset(self):
        self._renovar_demo()
        # Mostra grupos que ainda não saíram (com 3 h de tolerância)
        qs = (GrupoTrajeto.objects.filter(ativo=True, horario__gte=timezone.now() - timedelta(hours=3))
              .prefetch_related("participantes__usuaria"))
        busca = self.request.query_params.get("busca")
        return qs.filter(destino__icontains=busca) if busca else qs

    def perform_create(self, serializer):
        grupo = serializer.save(criadora=self.request.user)
        ParticipacaoGrupo.objects.create(grupo=grupo, usuaria=self.request.user)

    def _so_criadora(self, grupo):
        if grupo.criadora_id != self.request.user.id:
            raise PermissionDenied("Só quem criou o grupo pode alterar.")

    def perform_update(self, serializer):
        self._so_criadora(serializer.instance)
        serializer.save()

    def perform_destroy(self, instance):
        self._so_criadora(instance)
        instance.delete()

    @action(detail=True, methods=["post"])
    def entrar(self, request, pk=None):
        grupo = self.get_object()
        ativas = grupo.participantes.filter(saiu_em__isnull=True)
        if ativas.filter(usuaria=request.user).exists():
            return Response({"detail": "Você já está no grupo."})
        if ativas.count() >= grupo.vagas:
            return Response({"detail": "Este grupo está lotado."}, status=status.HTTP_400_BAD_REQUEST)
        part, criada = ParticipacaoGrupo.objects.get_or_create(grupo=grupo, usuaria=request.user)
        if not criada:  # tinha saído e voltou
            part.saiu_em = None
            part.save(update_fields=["saiu_em"])
        return Response({"detail": "Você entrou no grupo."})

    @action(detail=True, methods=["post"])
    def sair(self, request, pk=None):
        self.get_object().participantes.filter(usuaria=request.user).update(saiu_em=timezone.now())
        return Response({"detail": "Você saiu do grupo."})

    @action(detail=True, methods=["post"])
    def remover(self, request, pk=None):
        """Só a criadora do grupo pode remover uma participante."""
        grupo = self.get_object()
        if grupo.criadora_id != request.user.id:
            return Response({"detail": "Só quem criou o grupo pode remover participantes."}, status=status.HTTP_403_FORBIDDEN)
        try:
            alvo = int(request.data.get("usuaria"))
        except (TypeError, ValueError):
            return Response({"detail": "Participante inválida."}, status=status.HTTP_400_BAD_REQUEST)
        if alvo == request.user.id:
            return Response({"detail": "Você não pode remover a si mesma. Use “Sair do grupo”."}, status=status.HTTP_400_BAD_REQUEST)
        total = grupo.participantes.filter(usuaria_id=alvo, saiu_em__isnull=True).update(saiu_em=timezone.now())
        if not total:
            return Response({"detail": "Essa participante não está no grupo."}, status=status.HTTP_404_NOT_FOUND)
        return Response({"detail": "Participante removida."})


class SolicitacaoAcompanhamentoViewSet(mixins.ListModelMixin, mixins.CreateModelMixin, viewsets.GenericViewSet):
    """/api/circulo/solicitacoes/ — pedidos recebidos; POST cria um pedido para outra usuária."""
    serializer_class = SolicitacaoAcompanhamentoSerializer

    def get_queryset(self):
        return SolicitacaoAcompanhamento.objects.filter(
            destinataria=self.request.user, status=SolicitacaoAcompanhamento.Status.PENDENTE)

    def perform_create(self, serializer):
        serializer.save(solicitante=self.request.user)

    @action(detail=True, methods=["post"])
    def responder(self, request, pk=None):
        sol = self.get_object()
        aceita = bool(request.data.get("aceita"))
        sol.status = SolicitacaoAcompanhamento.Status.ACEITA if aceita else SolicitacaoAcompanhamento.Status.RECUSADA
        sol.save(update_fields=["status"])
        return Response({"aceita": aceita})


class LocalizacaoView(APIView):
    """/api/circulo/localizacao/ — GET compartilhamento ativo, POST autoriza por N minutos, DELETE encerra antes."""
    LIMITE_MINUTOS = 180

    def _ativo(self, usuaria):
        return CompartilhamentoLocalizacao.objects.filter(
            usuaria=usuaria, encerrado=False, expira_em__gt=timezone.now()).order_by("-inicio").first()

    def get(self, request):
        c = self._ativo(request.user)
        return Response(CompartilhamentoLocalizacaoSerializer(c).data if c else None)

    def post(self, request):
        minutos = min(int(request.data.get("minutos", 30)), self.LIMITE_MINUTOS)
        CompartilhamentoLocalizacao.objects.filter(usuaria=request.user, encerrado=False).update(encerrado=True)
        c = CompartilhamentoLocalizacao.objects.create(
            usuaria=request.user, grupo_id=request.data.get("grupo"),
            expira_em=timezone.now() + timedelta(minutes=minutos))
        return Response(CompartilhamentoLocalizacaoSerializer(c).data, status=status.HTTP_201_CREATED)

    def delete(self, request):
        CompartilhamentoLocalizacao.objects.filter(usuaria=request.user, encerrado=False).update(encerrado=True)
        return Response(status=status.HTTP_204_NO_CONTENT)


class ProximasView(APIView):
    """/api/circulo/proximas/ — quantas usuárias com localização autorizada estão ativas.
    TODO (integrações): filtrar por distância quando a geolocalização for gravada."""

    def get(self, request):
        total = (CompartilhamentoLocalizacao.objects
                 .filter(encerrado=False, expira_em__gt=timezone.now())
                 .exclude(usuaria=request.user).values("usuaria").distinct().count())
        return Response({"total": total})
