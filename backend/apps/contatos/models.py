from django.conf import settings
from django.db import models


class ContatoConfianca(models.Model):
    usuaria = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="contatos")
    nome = models.CharField(max_length=120)
    telefone = models.CharField(max_length=20)
    relacao = models.CharField(max_length=40, blank=True, default="")
    # False = contato comum (só conversas e grupos); True = pode ser avisado em emergências (máx. 5)
    de_confianca = models.BooleanField(default=True)
    compartilha_localizacao = models.BooleanField(default=True)
    recebe_alertas = models.BooleanField(default=True)
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "contato"
        verbose_name_plural = "contatos"
        ordering = ["nome"]

    def __str__(self):
        return f"{self.nome} ({self.relacao})"
