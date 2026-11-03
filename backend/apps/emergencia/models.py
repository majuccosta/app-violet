from django.conf import settings
from django.db import models


class AlertaEmergencia(models.Model):
    class Status(models.TextChoices):
        ATIVO = "ativo"
        ENCERRADO = "encerrado"
        CANCELADO = "cancelado"

    usuaria = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="alertas")
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.ATIVO)
    ligue180_acionado = models.BooleanField(default=False)
    criado_em = models.DateTimeField(auto_now_add=True)
    encerrado_em = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "alerta de emergência"
        verbose_name_plural = "alertas de emergência"
        ordering = ["-criado_em"]


class MidiaAlerta(models.Model):
    class Tipo(models.TextChoices):
        AUDIO = "audio"
        FOTO = "foto"
        VIDEO = "video"

    alerta = models.ForeignKey(AlertaEmergencia, on_delete=models.CASCADE, related_name="midias")
    tipo = models.CharField(max_length=5, choices=Tipo.choices)
    arquivo = models.FileField(upload_to="privado/alertas/%Y/%m/")
    criado_em = models.DateTimeField(auto_now_add=True)
