from django.db import models


class Orientacao(models.Model):
    slug = models.SlugField(unique=True)
    titulo = models.CharField(max_length=150)
    resumo = models.CharField(max_length=255)
    icone = models.CharField(max_length=40, default="help-circle")
    conteudo = models.JSONField(default=dict, help_text="passos, canais ou faq (ver frontend/assets/js/mock-data.js)")
    aviso = models.CharField(max_length=255, blank=True)
    ordem = models.PositiveSmallIntegerField(default=0)
    ativo = models.BooleanField(default=True)

    class Meta:
        verbose_name = "orientação"
        verbose_name_plural = "orientações"
        ordering = ["ordem"]

    def __str__(self):
        return self.titulo
