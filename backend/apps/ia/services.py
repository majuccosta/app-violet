"""Ponte entre o backend e o modelo de IA que fica na pasta /ia do repositório.

É AQUI que a IA já pronta é conectada ao sistema. O contrato é simples:

    analisar_evidencia(caminho_arquivo, tipo_mime) -> dict com
        indicios: bool        # encontrou possíveis indícios de violência?
        confianca: float      # 0.0 a 1.0
        rotulos: list[str]    # ex.: ["comportamento intimidador"]
        versao_modelo: str

O resultado é APOIO à análise humana e nunca comprova a ocorrência (RQ004).
"""
import logging
import sys
from pathlib import Path

logger = logging.getLogger(__name__)

# Deixa o pacote /ia (raiz do repositório) importável a partir do backend
RAIZ_REPO = Path(__file__).resolve().parents[3]
if str(RAIZ_REPO) not in sys.path:
    sys.path.append(str(RAIZ_REPO))

RESULTADO_VAZIO = {"indicios": False, "confianca": 0.0, "rotulos": [], "versao_modelo": "indisponivel"}


def analisar_evidencia(caminho_arquivo, tipo_mime=""):
    try:
        from ia.analisador import analisar  # implementado pela equipe em /ia/analisador.py
    except ImportError:
        logger.warning("Módulo ia.analisador não encontrado; análise ficará pendente.")
        return RESULTADO_VAZIO

    try:
        r = analisar(str(caminho_arquivo), tipo_mime)
        return {
            "indicios": bool(r.get("indicios", False)),
            "confianca": float(r.get("confianca", 0.0)),
            "rotulos": list(r.get("rotulos", [])),
            "versao_modelo": str(r.get("versao_modelo", "")),
        }
    except Exception:  # a falha da IA não pode impedir o registro da denúncia
        logger.exception("Falha ao analisar evidência %s", caminho_arquivo)
        return RESULTADO_VAZIO
