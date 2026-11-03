from django.conf import settings
from django.db import models


class Conversa(models.Model):
    class Tipo(models.TextChoices):
        CONTATO = "contato", "Com contato da rede"
        APOIO = "apoio", "Apoio"
        ANONIMA = "anonima", "Anônima"
        GRUPO = "grupo", "Grupo de conversa"   # diferente do Círculo de Apoio (trajetos)

    tipo = models.CharField(max_length=10, choices=Tipo.choices, default=Tipo.CONTATO)
    nome = models.CharField(max_length=40, blank=True, default="")        # só em grupos
    descricao = models.CharField(max_length=80, blank=True, default="")   # só em grupos
    cor = models.PositiveSmallIntegerField(default=1)                     # 1–4 (tom do avatar do grupo)
    # Grupo de conversa: quem criou e os contatos convidados (nome + id do contato; não precisam ter conta)
    criadora = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL,
                                 related_name="grupos_conversa_criados")
    membros = models.JSONField(default=list, blank=True)
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-criado_em"]

    def __str__(self):
        return self.nome or f"Conversa {self.pk} ({self.get_tipo_display()})"


class Participante(models.Model):
    conversa = models.ForeignKey(Conversa, on_delete=models.CASCADE, related_name="participantes")
    usuaria = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="participacoes")
    # Em conversa anônima o nome nunca é enviado para a outra participante
    anonima = models.BooleanField(default=False)
    silenciada = models.BooleanField(default=False)

    class Meta:
        unique_together = ("conversa", "usuaria")


class Mensagem(models.Model):
    conversa = models.ForeignKey(Conversa, on_delete=models.CASCADE, related_name="mensagens")
    autora = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="mensagens")
    texto = models.TextField(max_length=2000)
    lida = models.BooleanField(default=False)
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name_plural = "mensagens"
        ordering = ["criado_em"]
