"""Consulta de nomes na API pública do IBGE (Censo), para estimar se um primeiro nome é feminino ou masculino.

É só uma ESTIMATIVA e só é usada quando o documento não informa o gênero. O Violet envia ao IBGE apenas o
primeiro nome (nunca o documento nem o nome completo)."""
import json
import logging
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from functools import lru_cache

log = logging.getLogger(__name__)

BASE = "https://servicodados.ibge.gov.br/api/v2/censos/nomes/"
TIMEOUT = 5


class IbgeErro(Exception):
    """A consulta ao IBGE falhou (fora do ar, resposta inesperada...)."""


def primeiro_nome(nome_completo):
    """'Maria Júlia de Carvalho' -> 'maria' (minúsculo, sem acento)."""
    partes = str(nome_completo or "").strip().split()
    if not partes:
        return ""
    sem_acento = unicodedata.normalize("NFKD", partes[0]).encode("ascii", "ignore").decode()
    return "".join(c for c in sem_acento.lower() if c.isalpha())


def _total(resposta):
    """Soma as frequências de todas as décadas na resposta do IBGE."""
    total = 0
    for item in resposta or []:
        for periodo in item.get("res") or []:
            total += int(periodo.get("frequencia") or 0)
    return total


def _buscar(nome, sexo):
    url = f"{BASE}{urllib.parse.quote(nome)}?sexo={sexo}"
    try:
        with urllib.request.urlopen(url, timeout=TIMEOUT) as r:
            return json.loads(r.read().decode("utf-8"))
    except (urllib.error.URLError, TimeoutError, ValueError, OSError) as e:
        raise IbgeErro(f"IBGE indisponível: {e}") from e


@lru_cache(maxsize=2048)
def frequencias(nome):
    """(quantas pessoas feminino, quantas masculino) com esse primeiro nome no Censo."""
    return _total(_buscar(nome, "F")), _total(_buscar(nome, "M"))


def analisar_nome(nome_completo, limite=0.98, minimo=1000):
    """Analisa o primeiro nome e devolve os detalhes:
    {"nome": "maria", "classe": "F" | "M" | "A", "pct_feminino": 99.7 | None, "total": 11734129}
    classe: 'F' (claramente feminino), 'M' (claramente masculino) ou 'A' (ambíguo, raro ou sem dados).
    Só devolve F ou M se pelo menos `limite` (0 a 1) das pessoas com o nome forem desse sexo e houver ao menos
    `minimo` pessoas no Censo. Levanta IbgeErro se o IBGE não responder."""
    nome = primeiro_nome(nome_completo)
    if not nome:
        return {"nome": "", "classe": "A", "pct_feminino": None, "total": 0}
    fem, masc = frequencias(nome)
    total = fem + masc
    pct = round(100 * fem / total, 1) if total else None
    if total < minimo:
        classe = "A"
    elif fem / total >= limite:
        classe = "F"
    elif masc / total >= limite:
        classe = "M"
    else:
        classe = "A"
    return {"nome": nome, "classe": classe, "pct_feminino": pct, "total": total}


def classificar_nome(nome_completo, limite=0.98, minimo=1000):
    """Só a classe de analisar_nome: 'F', 'M' ou 'A'."""
    return analisar_nome(nome_completo, limite, minimo)["classe"]
