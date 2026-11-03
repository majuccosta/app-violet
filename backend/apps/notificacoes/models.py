from django.conf import settings
from django.db import models


class Notificacao(models.Model):
    class Tipo(models.TextChoices):
        MENSAGEM = "mensagem"
        DENUNCIA = "denuncia"
        CONTATO = "contato"
        EMERGENCIA = "emergencia"
        SISTEMA = "sistema"

    usuaria = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notificacoes")
    tipo = models.CharField(max_length=12, choices=Tipo.choices, default=Tipo.SISTEMA)
    titulo = models.CharField(max_length=120)
    texto = models.CharField(max_length=255)
    lida = models.BooleanField(default=False)
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "notificação"
        verbose_name_plural = "notificações"
        ordering = ["-criado_em"]
