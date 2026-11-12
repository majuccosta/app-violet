"""Encontrar outras usuárias e trocar pedidos de conexão.

Regras de privacidade (app de segurança, então tudo começa fechado):
- só é encontrada quem está verificada, NÃO está no modo anônimo e deixou o perfil visível para "usuárias verificadas"
  (Configurações > Privacidade > Perfil; o padrão é "somente contatos de confiança", ou seja, ninguém acha ninguém por padrão);
- a busca exige pelo menos 3 letras, devolve no máximo 20 resultados e mostra só o nome de exibição (apelido ou primeiro nome);
- quem está no modo anônimo não envia pedidos (o nome dela apareceria para a outra);
- só depois de a outra aceitar existe conversa;
- quem recusou não avisa a outra: do lado de quem pediu o pedido continua "enviado" e não dá para insistir.
"""
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from apps.notificacoes.models import Notificacao
from apps.usuarias.models import Usuaria

from .models import Conexao, Conversa, Participante

MIN_BUSCA = 3
LIMITE_BUSCA = 20
NAO_ENCONTRADA = {"detail": "Usuária não encontrada."}


def pesquisaveis(eu):
    """Quem pode aparecer na busca de `eu`."""
    return Usuaria.objects.filter(
        is_active=True, verificada=True, modo_anonimo=False, preferencias__priv_perfil="verificadas",
    ).exclude(pk=eu.pk)


def pessoa(u, **extra):
    """Só o que as outras usuárias podem ver: nunca e-mail, telefone nem nome completo."""
    return {"id": u.id, "nome": u.nome_exibicao, "tone": (u.id % 4) + 1, **extra}


def conversa_entre(a, b):
    return (Conversa.objects.filter(tipo=Conversa.Tipo.CONTATO, participantes__usuaria=a)
            .filter(participantes__usuaria=b).distinct().first())


def dados_conexao(c, eu):
    enviada = c.de_id == eu.id
    outra = c.para if enviada else c.de
    # Quem pediu não fica sabendo da recusa: continua vendo "pendente"
    st = Conexao.Status.PENDENTE if (enviada and c.status == Conexao.Status.RECUSADA) else c.status
    return {"id": c.id, "status": st, "direcao": "enviada" if enviada else "recebida",
            "pessoa": pessoa(outra), "conversa_id": c.conversa_id, "criado_em": c.criado_em}


class ConexaoViewSet(viewsets.GenericViewSet):
    """/api/conversas/conexoes/ — buscar usuárias, pedir, aceitar, recusar e cancelar."""
    http_method_names = ["get", "post", "delete", "head", "options"]

    def get_queryset(self):
        eu = self.request.user
        return Conexao.objects.filter(Q(de=eu) | Q(para=eu)).select_related("de", "para")

    # ---- GET /conexoes/?tipo=recebidas|enviadas  (só pedidos ainda pendentes) ----
    def list(self, request):
        recebidas = request.query_params.get("tipo", "recebidas") != "enviadas"
        campo = {"para": request.user} if recebidas else {"de": request.user}
        qs = self.get_queryset().filter(status=Conexao.Status.PENDENTE, **campo)
        return Response([dados_conexao(c, request.user) for c in qs])

    # ---- GET /conexoes/buscar/?q=ana ----
    @action(detail=False, methods=["get"])
    def buscar(self, request):
        eu = request.user
        q = (request.query_params.get("q") or "").strip()
        if len(q) < MIN_BUSCA:
            return Response([])
        achadas = list(pesquisaveis(eu).filter(Q(apelido__icontains=q) | Q(nome_completo__icontains=q))
                       .order_by("nome_completo")[:LIMITE_BUSCA])
        ids = [u.id for u in achadas]
        relacoes = {}
        for c in Conexao.objects.filter(Q(de=eu, para__in=ids) | Q(para=eu, de__in=ids)):
            outra = c.para_id if c.de_id == eu.id else c.de_id
            if c.status == Conexao.Status.ACEITA:
                relacoes[outra] = {"relacao": "conectadas", "conversa_id": c.conversa_id}
            elif c.de_id == eu.id and outra not in relacoes:
                relacoes[outra] = {"relacao": "enviada"}            # inclui recusada: não revela a recusa
            elif c.para_id == eu.id and c.status == Conexao.Status.PENDENTE and outra not in relacoes:
                relacoes[outra] = {"relacao": "recebida", "conexao_id": c.id}
        return Response([pessoa(u, **relacoes.get(u.id, {"relacao": "nenhuma"})) for u in achadas])

    # ---- POST /conexoes/  {"usuaria": 12} ----
    def create(self, request):
        eu = request.user
        if eu.modo_anonimo:
            raise ValidationError({"detail": "Desligue o modo anônimo para adicionar outras usuárias."})
        try:
            alvo_id = int(request.data.get("usuaria"))
        except (TypeError, ValueError):
            raise ValidationError({"usuaria": "Informe a usuária."})
        if alvo_id == eu.id:
            raise ValidationError({"detail": "Você não pode adicionar a si mesma."})
        alvo = Usuaria.objects.filter(pk=alvo_id, is_active=True, verificada=True).first()
        if not alvo:
            return Response(NAO_ENCONTRADA, status=status.HTTP_404_NOT_FOUND)

        conexao = (Conexao.objects.filter(status=Conexao.Status.ACEITA)
                   .filter(Q(de=eu, para=alvo) | Q(de=alvo, para=eu)).first())
        if conexao:
            return Response(dados_conexao(conexao, eu))
        reversa = Conexao.objects.filter(de=alvo, para=eu, status=Conexao.Status.PENDENTE).first()
        if reversa:                                              # as duas quiseram: já conecta
            return Response(dados_conexao(self._aceitar(reversa), eu))
        if not pesquisaveis(eu).filter(pk=alvo.pk).exists():
            return Response(NAO_ENCONTRADA, status=status.HTTP_404_NOT_FOUND)

        conexao, criada = Conexao.objects.get_or_create(de=eu, para=alvo)
        if criada:
            Notificacao.objects.create(
                usuaria=alvo, tipo=Notificacao.Tipo.CONTATO, titulo="Novo pedido de conexão",
                texto=f"{eu.nome_exibicao} quer conversar com você.")
        return Response(dados_conexao(conexao, eu), status=status.HTTP_201_CREATED if criada else status.HTTP_200_OK)

    @transaction.atomic
    def _aceitar(self, c):
        if c.status != Conexao.Status.ACEITA:
            conversa = conversa_entre(c.de, c.para)
            if not conversa:
                conversa = Conversa.objects.create(tipo=Conversa.Tipo.CONTATO)
                Participante.objects.create(conversa=conversa, usuaria=c.de)
                Participante.objects.create(conversa=conversa, usuaria=c.para)
            c.status, c.conversa, c.respondido_em = Conexao.Status.ACEITA, conversa, timezone.now()
            c.save(update_fields=["status", "conversa", "respondido_em"])
            Notificacao.objects.create(
                usuaria=c.de, tipo=Notificacao.Tipo.CONTATO, titulo="Pedido aceito",
                texto=f"{c.para.nome_exibicao} aceitou seu pedido. Vocês já podem conversar.")
        return c

    def _recebido(self, request, pk):
        c = self.get_object()
        if c.para_id != request.user.id:
            raise PermissionDenied("Só quem recebeu o pedido pode responder.")
        return c

    # ---- POST /conexoes/{id}/aceitar/ ----
    @action(detail=True, methods=["post"])
    def aceitar(self, request, pk=None):
        c = self._recebido(request, pk)
        if c.status == Conexao.Status.RECUSADA:
            raise ValidationError({"detail": "Esse pedido foi recusado."})
        return Response(dados_conexao(self._aceitar(c), request.user))

    # ---- POST /conexoes/{id}/recusar/ ----
    @action(detail=True, methods=["post"])
    def recusar(self, request, pk=None):
        c = self._recebido(request, pk)
        if c.status == Conexao.Status.PENDENTE:
            c.status, c.respondido_em = Conexao.Status.RECUSADA, timezone.now()
            c.save(update_fields=["status", "respondido_em"])
        return Response({"detail": "Pedido recusado."})

    # ---- DELETE /conexoes/{id}/  (quem pediu cancela um pedido ainda pendente) ----
    def destroy(self, request, pk=None):
        c = self.get_object()
        if c.de_id != request.user.id or c.status != Conexao.Status.PENDENTE:
            raise PermissionDenied("Só dá para cancelar um pedido seu que ainda está pendente.")
        c.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
