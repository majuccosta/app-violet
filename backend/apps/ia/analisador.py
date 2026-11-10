"""Analisador de evidências do Violet (IA de apoio).

Usa o classificador de violência física treinado pela equipe (MobileNetV2 + TFLite,
~95% de acerto no conjunto de teste do dataset "Real Life Violence Situations").

Contrato esperado por apps/ia/services.py:

    analisar(caminho_arquivo, tipo_mime) -> dict com
        indicios: bool        # o modelo viu sinais de violência física?
        confianca: float      # 0.0 a 1.0 (probabilidade de violência dada pelo modelo)
        rotulos: list[str]
        versao_modelo: str

O resultado é APOIO à análise humana e NUNCA comprova a ocorrência.

Limites do modelo (importante):
- Analisa apenas IMAGENS e VÍDEOS (cenas). Texto de prints de conversa e ÁUDIO não são avaliados.
- Foi treinado com cenas de filme/câmera de rua: pode errar em ambientes diferentes.
"""
import logging
import threading
from pathlib import Path

import numpy as np
from PIL import Image, ImageOps

logger = logging.getLogger(__name__)

MODELO = Path(__file__).with_name("modelo_violencia.tflite")
TAMANHO = 160          # o modelo espera imagens 160x160 RGB com pixels de 0 a 255
LIMIAR = 0.55          # mesmo limiar usado na demonstração em tempo real da equipe
VERSAO = "violencia-mobilenetv2-1.0"
FRAMES_VIDEO = 8       # quadros amostrados de cada vídeo
EXTENSOES_IMAGEM = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
EXTENSOES_VIDEO = {".mp4", ".mov", ".avi", ".mkv", ".webm", ".m4v"}

_interprete = None
_entrada = None
_saida = None
_trava = threading.Lock()


def _carregar_interprete():
    """Carrega o modelo uma única vez (ai-edge-litert; cai para tflite_runtime ou tensorflow)."""
    global _interprete, _entrada, _saida
    if _interprete is not None:
        return
    Interpreter = None
    for origem in ("ai_edge_litert.interpreter", "tflite_runtime.interpreter"):
        try:
            Interpreter = __import__(origem, fromlist=["Interpreter"]).Interpreter
            break
        except Exception:
            continue
    if Interpreter is None:
        import tensorflow as tf  # alternativa pesada, só se nada acima estiver instalado
        Interpreter = tf.lite.Interpreter
    interp = Interpreter(model_path=str(MODELO))
    interp.allocate_tensors()
    _entrada = interp.get_input_details()[0]
    _saida = interp.get_output_details()[0]
    _interprete = interp


def _prever(rgb):
    """rgb: array (H, W, 3) uint8 em RGB. Devolve P(violência) entre 0 e 1."""
    with _trava:                                                  # o interpretador não é thread-safe
        _carregar_interprete()
        lado = int(_entrada["shape"][1]) if len(_entrada["shape"]) == 4 else TAMANHO
        img = Image.fromarray(rgb).resize((lado, lado))
        x = np.asarray(img)[np.newaxis]                           # pixels 0..255, como no treino
        x = x.astype(np.uint8 if _entrada["dtype"] == np.uint8 else np.float32)
        _interprete.set_tensor(_entrada["index"], x)
        _interprete.invoke()
        return float(_interprete.get_tensor(_saida["index"]).ravel()[0])


def _tipo(caminho, tipo_mime):
    sufixo = Path(caminho).suffix.lower()
    mime = (tipo_mime or "").lower()
    if mime.startswith("image/") or sufixo in EXTENSOES_IMAGEM:
        return "imagem"
    if mime.startswith("video/") or sufixo in EXTENSOES_VIDEO:
        return "video"
    return "outro"


def _prob_imagem(caminho):
    with Image.open(caminho) as im:
        im = ImageOps.exif_transpose(im).convert("RGB")
        return _prever(np.asarray(im))


def _prob_video(caminho):
    import cv2  # opcional: só é necessário para vídeos
    cap = cv2.VideoCapture(str(caminho))
    try:
        total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        if total <= 0:
            raise ValueError("vídeo sem quadros legíveis")
        posicoes = np.linspace(0, max(total - 1, 0), num=min(FRAMES_VIDEO, total), dtype=int)
        probs = []
        for pos in posicoes:
            cap.set(cv2.CAP_PROP_POS_FRAMES, int(pos))
            ok, quadro = cap.read()
            if ok:
                probs.append(_prever(cv2.cvtColor(quadro, cv2.COLOR_BGR2RGB)))
        if not probs:
            raise ValueError("não foi possível ler quadros do vídeo")
        # média dos 3 maiores valores: um único quadro "estranho" não decide sozinho
        return float(np.mean(sorted(probs, reverse=True)[:3]))
    finally:
        cap.release()


def analisar(caminho_arquivo, tipo_mime=""):
    tipo = _tipo(caminho_arquivo, tipo_mime)
    if tipo == "imagem":
        p = _prob_imagem(caminho_arquivo)
    elif tipo == "video":
        p = _prob_video(caminho_arquivo)
    else:
        # áudio, documentos etc.: este modelo não analisa; fica registrado como não analisado
        return {"indicios": False, "confianca": 0.0, "rotulos": [], "versao_modelo": "tipo-nao-analisado"}

    indicios = p >= LIMIAR
    return {
        "indicios": bool(indicios),
        "confianca": round(float(p), 3),
        "rotulos": ["possível violência física na cena"] if indicios else [],
        "versao_modelo": VERSAO,
    }
