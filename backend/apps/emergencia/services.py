"""Orquestração do alerta de emergência (RQ001)."""
from django.utils import timezone

from apps.notificacoes.models import Notificacao


def disparar_alerta(alerta):
    """Avisa os contatos de confiança e a central de apoio.

    TODO (integrações): enviar SMS/WhatsApp aos contatos e acionar o Ligue 180.
    """
    contatos = alerta.usuaria.contatos.filter(de_confianca=True, recebe_alertas=True)
    alerta.ligue180_acionado = True
    alerta.save(update_fields=["ligue180_acionado"])
    Notificacao.objects.create(
        usuaria=alerta.usuaria, tipo=Notificacao.Tipo.EMERGENCIA,
        titulo="Alerta enviado", texto=f"{contatos.count()} contato(s) foram avisados.",
    )
    return contatos.count()


def encerrar_alerta(alerta):
    alerta.status = alerta.Status.ENCERRADO
    alerta.encerrado_em = timezone.now()
    alerta.save(update_fields=["status", "encerrado_em"])
    return alerta
