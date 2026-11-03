from django.conf import settings
from django.db import models


class GrupoTrajeto(models.Model):
    criadora = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="grupos_criados")
    nome = models.CharField(max_length=80)
    ponto_encontro = models.CharField(max_length=200)
    destino = models.CharField(max_length=200)
    horario = models.DateTimeField()
    vagas = models.PositiveSmallIntegerField(default=5)
    ativo = models.BooleanField(default=True)
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "grupo de trajeto"
        verbose_name_plural = "grupos de trajeto"
        ordering = ["horario"]


class ParticipacaoGrupo(models.Model):
    grupo = models.ForeignKey(GrupoTrajeto, on_delete=models.CASCADE, related_name="participantes")
    usuaria = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    entrou_em = models.DateTimeField(auto_now_add=True)
    saiu_em = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ("grupo", "usuaria")


class SolicitacaoAcompanhamento(models.Model):
    class Status(models.TextChoices):
        PENDENTE = "pendente"
        ACEITA = "aceita"
        RECUSADA = "recusada"

    solicitante = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="solicitacoes_enviadas")
    destinataria = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="solicitacoes_recebidas")
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDENTE)
    criado_em = models.DateTimeField(auto_now_add=True)


class CompartilhamentoLocalizacao(models.Model):
    """Autorização temporária de localização (a usuária pode encerrar antes)."""
    usuaria = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="compartilhamentos")
    grupo = models.ForeignKey(GrupoTrajeto, on_delete=models.CASCADE, null=True, blank=True)
    inicio = models.DateTimeField(auto_now_add=True)
    expira_em = models.DateTimeField()
    encerrado = models.BooleanField(default=False)
