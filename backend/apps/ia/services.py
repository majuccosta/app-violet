"""Ponte entre o backend e o modelo de IA (apps/ia/analisador.py).

É AQUI que a IA da equipe é conectada ao sistema. O contrato é simples:

    analisar_evidencia(caminho_arquivo, tipo_mime) -> dict com
        indicios: bool        # encontrou possíveis indícios de violência?
        confianca: float      # 0.0 a 1.0
        rotulos: list[str]    # ex.: ["possível violência física na cena"]
        versao_modelo: str

O resultado é APOIO à análise humana e nunca comprova a ocorrência (RQ004).
"""
import logging

logger = logging.getLogger(__name__)

RESULTADO_VAZIO = {"indicios": False, "confianca": 0.0, "rotulos": [], "versao_modelo": "indisponivel"}


def analisar_evidencia(caminho_arquivo, tipo_mime=""):
    try:
        from .analisador import analisar  # modelo da equipe (apps/ia/analisador.py)
    except Exception:
        logger.exception("Não foi possível carregar o analisador de IA; análise ficará pendente.")
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
