from django.contrib.auth.models import AbstractUser
from django.db import models


class Usuaria(AbstractUser):
    """Usuária do app. A identidade é guardada aqui e NUNCA exposta em denúncias anônimas."""
    email = models.EmailField("e-mail", unique=True)
    nome_completo = models.CharField(max_length=150)
    # Como a pessoa quer ser chamada no app (o nome real, do documento, não muda)
    apelido = models.CharField("apelido", max_length=30, blank=True)
    data_nascimento = models.DateField(null=True, blank=True)
    telefone = models.CharField(max_length=20, blank=True)
    verificada = models.BooleanField(default=False)
    modo_anonimo = models.BooleanField(default=False)
    # Endereço (opcional)
    cep = models.CharField(max_length=9, blank=True)
    logradouro = models.CharField(max_length=120, blank=True)
    numero = models.CharField(max_length=10, blank=True)
    complemento = models.CharField(max_length=60, blank=True)
    bairro = models.CharField(max_length=80, blank=True)
    cidade = models.CharField(max_length=80, blank=True)
    uf = models.CharField(max_length=2, blank=True)
    criado_em = models.DateTimeField(auto_now_add=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["username", "nome_completo"]

    class Meta:
        verbose_name = "usuária"
        verbose_name_plural = "usuárias"

    def __str__(self):
        return self.nome_completo or self.email

    @property
    def nome_exibicao(self):
        """O que as outras usuárias veem: o apelido, ou só o primeiro nome."""
        return self.apelido or (self.nome_completo.split(" ")[0] if self.nome_completo else "")


class Preferencias(models.Model):
    usuaria = models.OneToOneField(Usuaria, on_delete=models.CASCADE, related_name="preferencias")
    notificacoes = models.BooleanField(default=True)
    som = models.BooleanField(default=True)
    vibracao = models.BooleanField(default=True)
    volume = models.PositiveSmallIntegerField(default=70)
    toque = models.CharField(max_length=20, default="padrao")
    usar_pin = models.BooleanField(default=False)
    usar_biometria = models.BooleanField(default=False)
    idioma = models.CharField(max_length=5, default="pt-BR")
    # Privacidade: quem pode ver cada dado (opções em frontend/assets/js/pages/configuracoes.js)
    priv_perfil = models.CharField(max_length=12, default="contatos")
    priv_localizacao = models.CharField(max_length=12, default="alerta")
    priv_historico = models.CharField(max_length=12, default="anonimo")
    priv_contato = models.CharField(max_length=12, default="ninguem")
    visivel_circulo = models.BooleanField(default=True)

    class Meta:
        verbose_name_plural = "preferências"


class VerificacaoIdentidade(models.Model):
    """Resultado da verificação de documento (RG/CNH) feita pela API Didit."""
    class Status(models.TextChoices):
        PENDENTE = "pendente"
        APROVADA = "aprovada"
        REPROVADA = "reprovada"

    class TipoDocumento(models.TextChoices):
        RG = "rg", "RG"
        CNH = "cnh", "CNH"

    usuaria = models.ForeignKey(Usuaria, on_delete=models.CASCADE, related_name="verificacoes")
    tipo_documento = models.CharField(max_length=3, choices=TipoDocumento.choices, default=TipoDocumento.RG)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDENTE)
    id_sessao_didit = models.CharField(max_length=120, blank=True)
    criado_em = models.DateTimeField(auto_now_add=True)
