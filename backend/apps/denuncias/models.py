from django.conf import settings
from django.db import models


class Denuncia(models.Model):
    class Categoria(models.TextChoices):
        ASSEDIO = "assedio", "Assédio"
        AMEACA = "ameaca", "Ameaça"
        VIOLENCIA = "violencia", "Violência"
        IMPORTUNACAO = "importunacao", "Importunação"
        PERSEGUICAO = "perseguicao", "Perseguição"
        OUTRO = "outro", "Outro"

    class Envolvido(models.TextChoices):
        NAO_INFORMADO = "nao_informado", "Não informado"
        PROFESSOR = "professor", "Professor(a)"
        FUNCIONARIO = "funcionario", "Funcionário(a)"
        ALUNO = "aluno", "Aluno(a)"
        OUTRO = "outro", "Outro"

    class Status(models.TextChoices):
        ANDAMENTO = "andamento", "Em andamento"
        CONCLUIDA = "concluida", "Concluída"

    # A usuária fica registrada internamente, mas não é exposta quando anonima=True
    usuaria = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="denuncias")
    protocolo = models.CharField(max_length=20, unique=True, editable=False)
    categoria = models.CharField(max_length=15, choices=Categoria.choices)
    envolvido = models.CharField(max_length=15, choices=Envolvido.choices, default=Envolvido.NAO_INFORMADO)
    local = models.CharField(max_length=200)
    data_ocorrencia = models.DateField()
    hora_ocorrencia = models.TimeField(null=True, blank=True)
    descricao = models.TextField(max_length=2000)
    anonima = models.BooleanField(default=True)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.ANDAMENTO)
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "denúncia"
        ordering = ["-criado_em"]

    def __str__(self):
        return self.protocolo


class Evidencia(models.Model):
    denuncia = models.ForeignKey(Denuncia, on_delete=models.CASCADE, related_name="evidencias")
    arquivo = models.FileField(upload_to="privado/evidencias/%Y/%m/")
    tipo_mime = models.CharField(max_length=80)
    tamanho_bytes = models.PositiveIntegerField()
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "evidência"


class AnaliseIA(models.Model):
    """Resultado de apoio da IA. Não comprova a ocorrência (RQ004)."""
    evidencia = models.OneToOneField(Evidencia, on_delete=models.CASCADE, related_name="analise")
    indicios = models.BooleanField(default=False)
    confianca = models.FloatField(default=0)
    rotulos = models.JSONField(default=list, blank=True)
    versao_modelo = models.CharField(max_length=40, blank=True)
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "análise de IA"
        verbose_name_plural = "análises de IA"
