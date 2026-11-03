"""Ponto de entrada da IA do Violet.

👉 Coloque aqui o modelo que a equipe já treinou (disciplina de IA, prof. Nikson).
O backend chama SOMENTE a função `analisar` abaixo (ver backend/apps/ia/services.py).

Contrato:
    analisar(caminho_arquivo: str, tipo_mime: str) -> dict
        indicios: bool
        confianca: float (0 a 1)
        rotulos: list[str]
        versao_modelo: str
"""
from pathlib import Path

VERSAO = "violet-ia-0.1"
PASTA_MODELOS = Path(__file__).parent / "modelos"


def analisar(caminho_arquivo, tipo_mime=""):
    if tipo_mime.startswith("video/"):
        return _analisar_video(caminho_arquivo)
    # TODO: tratar imagem (prints/fotos) e áudio se o modelo suportar
    return {"indicios": False, "confianca": 0.0, "rotulos": [], "versao_modelo": f"{VERSAO}-sem-suporte"}


def _analisar_video(caminho_arquivo):
    # TODO: substituir pelo código do protótipo, por exemplo:
    #   modelo = carregar_modelo(PASTA_MODELOS / "modelo.pt")
    #   score = modelo.predict(extrair_frames(caminho_arquivo))
    score = 0.0
    return {
        "indicios": score >= 0.5,
        "confianca": round(float(score), 2),
        "rotulos": ["possível assédio"] if score >= 0.5 else [],
        "versao_modelo": VERSAO,
    }
