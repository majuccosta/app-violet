"""Monta a tabela local de nomes (apps/usuarias/dados/nomes_ibge.json) consultando a API do IBGE.

Rode no seu computador (onde a API do IBGE responde) e envie o arquivo gerado ao GitHub:
    python manage.py baixar_nomes_ibge
Leva alguns minutos. Pode ser interrompido e rodado de novo: ele continua de onde parou."""
import json

from django.core.management.base import BaseCommand

from apps.usuarias import ibge
from apps.usuarias.nomes_comuns import NOMES_COMUNS


class Command(BaseCommand):
    help = "Baixa do IBGE a frequência (feminino/masculino) dos nomes comuns e salva em dados/nomes_ibge.json"

    def add_arguments(self, parser):
        parser.add_argument("nomes", nargs="*", help="Nomes extras (além da lista padrão)")

    def handle(self, *args, **opcoes):
        try:
            tabela = json.loads(ibge.ARQUIVO.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            tabela = {}
        extras = [ibge.primeiro_nome(n) for n in opcoes["nomes"]]
        nomes = sorted(set(NOMES_COMUNS + [n for n in extras if n]))

        def progresso(i, total, nome):
            if i % 25 == 0 or i == total:
                self.stdout.write(f"{i}/{total} nomes...")

        tabela, falhas = ibge.construir_tabela(nomes, tabela, ao_progresso=progresso)
        ibge.ARQUIVO.parent.mkdir(parents=True, exist_ok=True)
        ibge.ARQUIVO.write_text(json.dumps(dict(sorted(tabela.items())), ensure_ascii=False, separators=(",", ":")),
                                encoding="utf-8")
        self.stdout.write(self.style.SUCCESS(f"Tabela salva com {len(tabela)} nomes em {ibge.ARQUIVO}"))
        if falhas:
            self.stdout.write(self.style.WARNING(
                f"{len(falhas)} nomes falharam (rode de novo para tentar outra vez): {', '.join(falhas[:20])}..."))
