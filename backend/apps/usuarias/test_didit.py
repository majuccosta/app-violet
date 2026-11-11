"""Testes do cliente Didit (sem banco e sem internet): `python -m unittest apps.usuarias.test_didit -v`."""
import io
import json
import time
import unittest
import urllib.error

from apps.usuarias import didit


class RespostaFalsa:
    def __init__(self, dados):
        self._corpo = json.dumps(dados).encode()

    def read(self):
        return self._corpo

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


class SessaoTests(unittest.TestCase):
    def test_criar_sessao_envia_chave_workflow_e_devolve_url(self):
        visto = {}

        def abrir(req, timeout=None):
            visto["url"], visto["metodo"] = req.full_url, req.get_method()
            visto["chave"] = req.get_header("X-api-key")
            visto["corpo"] = json.loads(req.data)
            return RespostaFalsa({"session_id": "abc-123", "url": "https://verify.didit.me/s/xyz", "status": "Not Started"})

        r = didit.criar_sessao("CHAVE", "WF-1", 7, callback="https://app/v?didit=1", abrir=abrir)
        self.assertEqual(r["url"], "https://verify.didit.me/s/xyz")
        self.assertEqual(visto["url"], "https://verification.didit.me/v3/session/")
        self.assertEqual(visto["metodo"], "POST")
        self.assertEqual(visto["chave"], "CHAVE")
        self.assertEqual(visto["corpo"], {"workflow_id": "WF-1", "vendor_data": "7", "callback": "https://app/v?didit=1"})

    def test_resposta_sem_url_e_erro(self):
        with self.assertRaises(didit.DiditErro):
            didit.criar_sessao("K", "W", 1, abrir=lambda req, timeout=None: RespostaFalsa({"session_id": "x"}))

    def test_erro_http_vira_diditerro(self):
        def abrir(req, timeout=None):
            raise urllib.error.HTTPError(req.full_url, 403, "Forbidden", {}, io.BytesIO(b'{"detail":"bad key"}'))

        with self.assertRaises(didit.DiditErro) as ctx:
            didit.criar_sessao("K", "W", 1, abrir=abrir)
        self.assertIn("403", str(ctx.exception))

    def test_consultar_decisao(self):
        r = didit.consultar_decisao("K", "abc", abrir=lambda req, timeout=None: RespostaFalsa({"status": "Approved"}))
        self.assertEqual(r["status"], "Approved")


class StatusTests(unittest.TestCase):
    def test_traducao(self):
        self.assertEqual(didit.traduzir_status("Approved"), "aprovada")
        for s in ("Declined", "Expired", "Abandoned", "Kyc Expired"):
            self.assertEqual(didit.traduzir_status(s), "reprovada")
        for s in ("In Review", "In Progress", "Not Started", "Awaiting User", "Resubmitted", None, ""):
            self.assertEqual(didit.traduzir_status(s), "pendente")


class AssinaturaTests(unittest.TestCase):
    SEGREDO = "segredo-de-teste"

    def _corpo(self):
        return json.dumps({"session_id": "abc", "status": "Approved", "nota": 1.0, "dentro": {"b": 2, "a": [1.0, 2.5]}}).encode()

    def _assinar(self, corpo):
        return didit.assinatura_esperada(json.loads(corpo), self.SEGREDO)

    def test_assinatura_correta_e_aceita(self):
        c = self._corpo()
        self.assertTrue(didit.assinatura_valida(c, self._assinar(c), str(int(time.time())), self.SEGREDO))

    def test_corpo_alterado_e_recusado(self):
        c = self._corpo()
        ass = self._assinar(c)
        adulterado = c.replace(b"Approved", b"Declined")
        self.assertFalse(didit.assinatura_valida(adulterado, ass, str(int(time.time())), self.SEGREDO))

    def test_segredo_errado_e_recusado(self):
        c = self._corpo()
        self.assertFalse(didit.assinatura_valida(c, self._assinar(c), str(int(time.time())), "outro-segredo"))

    def test_aviso_antigo_e_recusado(self):
        c = self._corpo()
        velho = str(int(time.time()) - 10 * 60)
        self.assertFalse(didit.assinatura_valida(c, self._assinar(c), velho, self.SEGREDO))

    def test_sem_segredo_nunca_aceita(self):
        c = self._corpo()
        self.assertFalse(didit.assinatura_valida(c, self._assinar(c), str(int(time.time())), ""))

    def test_lixo_nao_quebra(self):
        self.assertFalse(didit.assinatura_valida(b"nao e json", "x", str(int(time.time())), self.SEGREDO))
        self.assertFalse(didit.assinatura_valida(self._corpo(), "x", "abc", self.SEGREDO))

    def test_normalizacao_float_inteiro(self):
        # 1.0 e 1 precisam gerar a mesma assinatura (regra da Didit)
        self.assertEqual(didit.assinatura_esperada({"a": 1.0}, "k"), didit.assinatura_esperada({"a": 1}, "k"))

    def test_vetor_independente(self):
        # confere contra uma conta feita à mão (HMAC-SHA256 do JSON compacto com chaves ordenadas)
        import hashlib, hmac
        esperado = hmac.new(b"k", b'{"a":1,"b":[2,3]}', hashlib.sha256).hexdigest()
        self.assertEqual(didit.assinatura_esperada({"b": [2, 3], "a": 1.0}, "k"), esperado)


class GeneroTests(unittest.TestCase):
    def test_le_o_genero_do_documento(self):
        self.assertEqual(didit.genero_do_documento({"id_verifications": [{"gender": "F"}]}), "F")
        self.assertEqual(didit.genero_do_documento({"id_verifications": [{"gender": "m"}]}), "M")
        self.assertEqual(didit.genero_do_documento({"id_verifications": [{"gender": "U"}]}), "U")

    def test_sem_informacao_devolve_none(self):
        for decisao in (None, {}, {"id_verifications": []}, {"id_verifications": [{}]},
                        {"id_verifications": [{"gender": None}]}, {"id_verifications": [{"gender": "X"}]},
                        {"id_verifications": None}):
            self.assertIsNone(didit.genero_do_documento(decisao))


if __name__ == "__main__":
    unittest.main()
