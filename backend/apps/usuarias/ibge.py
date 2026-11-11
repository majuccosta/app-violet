"""Estimativa de gênero pelo primeiro nome, com os dados do Censo do IBGE.

É só uma ESTIMATIVA e só é usada quando o documento não informa o gênero. O Violet envia ao IBGE apenas o
primeiro nome (nunca o documento nem o nome completo).

Como funciona:
1. Primeiro procura o nome na tabela local `dados/nomes_ibge.json` (gerada pelo comando `baixar_nomes_ibge`).
   É instantânea e não depende de internet: os servidores de hospedagem no exterior costumam não conseguir falar
   com a API do IBGE.
2. Se o nome não está na tabela, tenta a API pública do IBGE, com tempo curto.
3. Se nada funcionar, levanta IbgeErro e a verificação fica pendente para revisão manual."""
import json
import logging
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

log = logging.getLogger(__name__)

BASE = "https://servicodados.ibge.gov.br/api/v2/censos/nomes/"
ARQUIVO = Path(__file__).resolve().parent / "dados" / "nomes_ibge.json"
TIMEOUT = 4                    # segundos por chamada (o servidor não pode ficar esperando)
ESPERA_APOS_FALHA = 60         # depois de uma falha, não insiste por 60 s (evita travar a fila de requisições)
CABECALHOS = {"User-Agent": "Violet/1.0 (projeto de extensao CEUB)", "Accept": "application/json"}


class IbgeErro(Exception):
    """A consulta ao IBGE falhou (fora do ar, resposta inesperada...)."""


_tabela = None        # tabela local: {"maria": [feminino, masculino], ...}
_memoria = {}         # resultados da API já obtidos nesta execução
_ultima_falha = None  # quando a API falhou pela última vez (time.monotonic)


def limpar_cache():
    """Esquece a tabela carregada, os resultados da API e a última falha (usado nos testes)."""
    global _tabela, _ultima_falha
    _tabela, _ultima_falha = None, None
    _memoria.clear()


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
    """GET na API do IBGE (uma tentativa, tempo curto)."""
    url = f"{BASE}{urllib.parse.quote(nome)}?sexo={sexo}"
    try:
        req = urllib.request.Request(url, headers=CABECALHOS)
        with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
            return json.loads(r.read().decode("utf-8"))
    except (urllib.error.URLError, TimeoutError, ValueError, OSError) as e:
        raise IbgeErro(f"IBGE indisponível ({type(e).__name__}): {e}") from e


def _carregar_tabela():
    global _tabela
    if _tabela is None:
        try:
            _tabela = json.loads(ARQUIVO.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            _tabela = {}
    return _tabela


def frequencias(nome):
    """(quantas pessoas feminino, quantas masculino) com esse primeiro nome no Censo."""
    global _ultima_falha
    local = _carregar_tabela().get(nome)
    if local:
        return int(local[0]), int(local[1])
    if nome in _memoria:
        return _memoria[nome]
    if _ultima_falha is not None and time.monotonic() - _ultima_falha < ESPERA_APOS_FALHA:
        raise IbgeErro("IBGE indisponível (falhou há pouco; nova tentativa em instantes)")
    try:
        resultado = (_total(_buscar(nome, "F")), _total(_buscar(nome, "M")))
    except IbgeErro:
        _ultima_falha = time.monotonic()
        raise
    _memoria[nome] = resultado
    return resultado


def analisar_nome(nome_completo, limite=0.98, minimo=1000):
    """Analisa o primeiro nome e devolve os detalhes:
    {"nome": "maria", "classe": "F" | "M" | "A", "pct_feminino": 99.7 | None, "total": 11734129}
    classe: 'F' (claramente feminino), 'M' (claramente masculino) ou 'A' (ambíguo, raro ou sem dados).
    Só devolve F ou M se pelo menos `limite` (0 a 1) das pessoas com o nome forem desse sexo e houver ao menos
    `minimo` pessoas no Censo. Levanta IbgeErro se não houver como consultar o nome."""
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


def construir_tabela(nomes, tabela=None, buscar=_buscar, esperar=time.sleep, atraso=0.2, ao_progresso=None):
    """Consulta o IBGE para cada nome e monta a tabela local. Devolve (tabela, nomes_que_falharam).
    Nomes que já estão na tabela são pulados, então dá para rodar de novo para completar."""
    tabela = dict(tabela or {})
    falhas = []
    for i, nome in enumerate(nomes, 1):
        if nome not in tabela:
            try:
                tabela[nome] = [_total(buscar(nome, "F")), _total(buscar(nome, "M"))]
            except IbgeErro:
                falhas.append(nome)
            esperar(atraso)
        if ao_progresso:
            ao_progresso(i, len(nomes), nome)
    return tabela, falhas
