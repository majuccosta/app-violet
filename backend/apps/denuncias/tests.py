from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings

from apps.comum.testes import SENHA, cliente_logado, criar_usuaria
from apps.denuncias.models import Denuncia
from apps.usuarias.models import Usuaria

DADOS = {"categoria": "assedio", "local": "Bloco 3", "data_ocorrencia": "2026-10-20",
         "descricao": "Relato de teste.", "anonima": True}


class DenunciaTests(TestCase):
    def test_denuncia_anonima_nao_expoe_a_usuaria(self):
        u = criar_usuaria()
        r = cliente_logado(u).post("/api/denuncias/", DADOS, format="json")
        self.assertEqual(r.status_code, 201)
        self.assertTrue(r.data["protocolo"].startswith("PEN-"))
        for chave in ("usuaria", "usuaria_id", "email", "nome_completo"):
            self.assertNotIn(chave, r.data)
        # internamente a identidade continua guardada
        self.assertEqual(Denuncia.objects.get().usuaria_id, u.id)

    def test_cada_usuaria_ve_so_as_proprias_denuncias(self):
        a, b = criar_usuaria("a@ceub.edu.br", "Ana"), criar_usuaria("b@ceub.edu.br", "Bia")
        cliente_logado(a).post("/api/denuncias/", DADOS, format="json")
        self.assertEqual(len(cliente_logado(b).get("/api/denuncias/").data["results"]), 0)
        self.assertEqual(len(cliente_logado(a).get("/api/denuncias/").data["results"]), 1)

    def test_protocolos_sao_unicos(self):
        c = cliente_logado(criar_usuaria())
        p1 = c.post("/api/denuncias/", DADOS, format="json").data["protocolo"]
        p2 = c.post("/api/denuncias/", DADOS, format="json").data["protocolo"]
        self.assertNotEqual(p1, p2)

    def test_excluir_conta_com_denuncia_nao_quebra(self):
        u = criar_usuaria()
        c = cliente_logado(u)
        c.post("/api/denuncias/", DADOS, format="json")
        r = c.post("/api/usuarias/me/excluir/", {"senha": SENHA}, format="json")
        self.assertEqual(r.status_code, 204)
        u.refresh_from_db()
        self.assertFalse(u.is_active)
        self.assertEqual(Denuncia.objects.count(), 1)

    def test_formato_nao_aceito(self):
        arq = SimpleUploadedFile("x.exe", b"abc", content_type="application/x-msdownload")
        r = cliente_logado(criar_usuaria()).post("/api/denuncias/", {**DADOS, "evidencias": arq}, format="multipart")
        self.assertEqual(r.status_code, 400)
