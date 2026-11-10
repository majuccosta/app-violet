"""Testes do analisador de IA, com um interpretador de mentira (não precisa do runtime do TFLite).

Rode:  python manage.py test apps.ia
"""
import sys
import tempfile
import types
import unittest
from pathlib import Path

import numpy as np
from PIL import Image

from apps.ia import analisador, services


class InterpretadorFalso:
    """Devolve 0.9 para imagens claras e 0.1 para imagens escuras, só para testar o fluxo."""
    def __init__(self, model_path=None):
        self.x = None
    def allocate_tensors(self):
        pass
    def get_input_details(self):
        return [{"index": 0, "shape": [1, 160, 160, 3], "dtype": np.float32}]
    def get_output_details(self):
        return [{"index": 1}]
    def set_tensor(self, indice, x):
        self.x = x
    def invoke(self):
        pass
    def get_tensor(self, indice):
        return np.array([[0.9 if self.x.mean() > 127 else 0.1]], dtype=np.float32)


class AnalisadorTests(unittest.TestCase):
    def setUp(self):
        modulo = types.ModuleType("ai_edge_litert.interpreter")
        modulo.Interpreter = InterpretadorFalso
        pacote = types.ModuleType("ai_edge_litert")
        sys.modules["ai_edge_litert"] = pacote
        sys.modules["ai_edge_litert.interpreter"] = modulo
        analisador._interprete = None
        self.dir = tempfile.TemporaryDirectory()

    def tearDown(self):
        sys.modules.pop("ai_edge_litert", None)
        sys.modules.pop("ai_edge_litert.interpreter", None)
        analisador._interprete = None
        self.dir.cleanup()

    def _imagem(self, cor, nome="foto.png"):
        caminho = Path(self.dir.name) / nome
        Image.new("RGB", (300, 200), cor).save(caminho)
        return str(caminho)

    def test_imagem_com_sinais(self):
        r = analisador.analisar(self._imagem((250, 250, 250)), "image/png")
        self.assertTrue(r["indicios"])
        self.assertEqual(r["confianca"], 0.9)
        self.assertEqual(r["versao_modelo"], analisador.VERSAO)
        self.assertTrue(r["rotulos"])

    def test_imagem_sem_sinais(self):
        r = analisador.analisar(self._imagem((5, 5, 5)), "image/png")
        self.assertFalse(r["indicios"])
        self.assertEqual(r["rotulos"], [])

    def test_audio_nao_e_analisado(self):
        r = analisador.analisar(str(Path(self.dir.name) / "voz.m4a"), "audio/mp4")
        self.assertFalse(r["indicios"])
        self.assertEqual(r["versao_modelo"], "tipo-nao-analisado")

    def test_servico_nao_quebra_quando_falha(self):
        r = services.analisar_evidencia(str(Path(self.dir.name) / "nao-existe.png"), "image/png")
        self.assertEqual(r["versao_modelo"], "indisponivel")

    def test_servico_devolve_o_formato_esperado(self):
        r = services.analisar_evidencia(self._imagem((250, 250, 250)), "image/png")
        self.assertEqual(set(r), {"indicios", "confianca", "rotulos", "versao_modelo"})

    def test_video(self):
        try:
            import cv2
        except ImportError:
            self.skipTest("opencv não instalado")
        caminho = str(Path(self.dir.name) / "cena.avi")
        escritor = cv2.VideoWriter(caminho, cv2.VideoWriter_fourcc(*"MJPG"), 10, (160, 120))
        for _ in range(30):
            escritor.write(np.full((120, 160, 3), 250, dtype=np.uint8))
        escritor.release()
        r = analisador.analisar(caminho, "video/x-msvideo")
        self.assertTrue(r["indicios"])


if __name__ == "__main__":
    unittest.main()
