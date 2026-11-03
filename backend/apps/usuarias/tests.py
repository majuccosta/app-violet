import io

from django.core import mail
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from PIL import Image
from rest_framework.test import APIClient

from apps.comum.testes import SENHA, cliente_logado, criar_usuaria
from apps.usuarias.models import Usuaria
from apps.usuarias.services import _codigo, _janela_atual


class AutenticacaoTests(TestCase):
    def test_cadastro_e_login(self):
        c = APIClient()
        r = c.post("/api/auth/cadastro/", {"nome_completo": "Bia Lima", "email": "bia@ceub.edu.br",
                                           "senha": SENHA, "data_nascimento": "2003-05-10"}, format="json")
        self.assertEqual(r.status_code, 201)
        r = c.post("/api/auth/login/", {"email": "bia@ceub.edu.br", "password": SENHA}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertIn("access", r.data)

    def test_senha_fraca_e_rejeitada(self):
        r = APIClient().post("/api/auth/cadastro/", {"nome_completo": "X", "email": "x@ceub.edu.br", "senha": "123"}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_rotas_exigem_login(self):
        self.assertEqual(APIClient().get("/api/usuarias/me/").status_code, 401)
        self.assertEqual(APIClient().get("/api/contatos/").status_code, 401)

    def test_perfil_nunca_devolve_senha(self):
        r = cliente_logado(criar_usuaria()).get("/api/usuarias/me/")
        self.assertEqual(r.status_code, 200)
        self.assertNotIn("password", r.data)

    def test_trocar_senha(self):
        u = criar_usuaria()
        r = cliente_logado(u).post("/api/usuarias/me/senha/", {"senha_atual": SENHA, "senha_nova": "Outra@Senha2026"}, format="json")
        self.assertEqual(r.status_code, 200)
        u.refresh_from_db()
        self.assertTrue(u.check_password("Outra@Senha2026"))


class RecuperacaoSenhaTests(TestCase):
    def test_fluxo_completo(self):
        u = criar_usuaria()
        c = APIClient()
        self.assertEqual(c.post("/api/auth/recuperar-senha/", {"destino": u.email}, format="json").status_code, 200)
        self.assertEqual(len(mail.outbox), 1)
        codigo = _codigo(u, _janela_atual())
        self.assertTrue(c.post("/api/auth/verificar-codigo/", {"destino": u.email, "codigo": codigo}, format="json").data["valido"])
        r = c.post("/api/auth/nova-senha/", {"destino": u.email, "codigo": codigo, "senha": "Nova@Senha2026"}, format="json")
        self.assertEqual(r.status_code, 200)
        u.refresh_from_db()
        self.assertTrue(u.check_password("Nova@Senha2026"))
        # o código é de uso único: depois de trocar a senha ele deixa de valer
        r = c.post("/api/auth/nova-senha/", {"destino": u.email, "codigo": codigo, "senha": "Outra@Senha2026"}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_email_inexistente_responde_igual(self):
        r = APIClient().post("/api/auth/recuperar-senha/", {"destino": "naoexiste@ceub.edu.br"}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(mail.outbox), 0)

    def test_codigo_errado(self):
        u = criar_usuaria()
        r = APIClient().post("/api/auth/verificar-codigo/", {"destino": u.email, "codigo": "000000"}, format="json")
        self.assertFalse(r.data["valido"])


def _foto(nome="doc.png"):
    buf = io.BytesIO()
    Image.new("RGB", (20, 20), "white").save(buf, format="PNG")
    return SimpleUploadedFile(nome, buf.getvalue(), content_type="image/png")


class CadastroEVerificacaoTests(TestCase):
    DADOS = {"nome_completo": "Bia Lima", "email": "bia@ceub.edu.br", "senha": SENHA, "data_nascimento": "2003-05-10"}

    def test_data_de_nascimento_obrigatoria_e_valida(self):
        c = APIClient()
        for ruim in (None, "2999-01-01", "1800-01-01", "2024-01-01"):
            dados = {**self.DADOS, "data_nascimento": ruim}
            self.assertEqual(c.post("/api/auth/cadastro/", dados, format="json").status_code, 400, ruim)
        sem = {k: v for k, v in self.DADOS.items() if k != "data_nascimento"}
        self.assertEqual(c.post("/api/auth/cadastro/", sem, format="json").status_code, 400)

    def _logada(self):
        c = APIClient()
        c.post("/api/auth/cadastro/", self.DADOS, format="json")
        token = c.post("/api/auth/login/", {"email": self.DADOS["email"], "password": SENHA}, format="json").data["access"]
        c.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        return c

    def test_conta_sem_verificacao_nao_usa_o_app(self):
        c = self._logada()
        self.assertEqual(c.get("/api/contatos/").status_code, 403)
        self.assertEqual(c.get("/api/usuarias/me/").status_code, 200)   # perfil continua liberado

    @override_settings(VERIFICACAO_DEMO=True)
    def test_verificacao_demo_libera_o_app(self):
        c = self._logada()
        r = c.post("/api/usuarias/verificacao/", {"documento_frente": _foto(), "documento_verso": _foto()}, format="multipart")
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.data["status"], "aprovada")
        self.assertEqual(c.get("/api/contatos/").status_code, 200)

    @override_settings(VERIFICACAO_DEMO=False)
    def test_verificacao_sem_demo_fica_pendente(self):
        c = self._logada()
        r = c.post("/api/usuarias/verificacao/", {"documento_frente": _foto(), "documento_verso": _foto()}, format="multipart")
        self.assertEqual(r.data["status"], "pendente")
        self.assertEqual(c.get("/api/contatos/").status_code, 403)

    def test_arquivo_que_nao_e_imagem_e_recusado(self):
        c = self._logada()
        txt = SimpleUploadedFile("doc.txt", b"nao sou imagem", content_type="text/plain")
        r = c.post("/api/usuarias/verificacao/", {"documento_frente": txt, "documento_verso": txt}, format="multipart")
        self.assertEqual(r.status_code, 400)
