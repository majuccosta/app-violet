"""Regras de negócio das denúncias (RQ002, RQ004, RQ006)."""
from django.db import transaction
from django.db.models import Count
from django.utils import timezone

from apps.ia.services import analisar_evidencia

from .models import AnaliseIA, Denuncia, Evidencia


def gerar_protocolo():
    ano = timezone.now().year
    ultimo = Denuncia.objects.filter(protocolo__startswith=f"PEN-{ano}-").count()
    return f"PEN-{ano}-{ultimo + 1:06d}"


@transaction.atomic
def registrar_denuncia(usuaria, dados, arquivos=()):
    denuncia = Denuncia.objects.create(usuaria=usuaria, protocolo=gerar_protocolo(), **dados)
    for arquivo in arquivos:
        evidencia = Evidencia.objects.create(
            denuncia=denuncia, arquivo=arquivo,
            tipo_mime=arquivo.content_type or "", tamanho_bytes=arquivo.size,
        )
        # Toda evidência anexada passa pela IA (<<include>> Analisar evidências com IA)
        resultado = analisar_evidencia(evidencia.arquivo.path, evidencia.tipo_mime)
        AnaliseIA.objects.create(evidencia=evidencia, **resultado)
    return denuncia


def padroes_de_ocorrencia():
    """Agrupa denúncias por local/envolvido/categoria para identificar padrões.
    O resultado é apoio à análise e NÃO confirma culpa de ninguém."""
    return (
        Denuncia.objects.values("local", "envolvido", "categoria")
        .annotate(total=Count("id"))
        .filter(total__gte=2)
        .order_by("-total")
    )
