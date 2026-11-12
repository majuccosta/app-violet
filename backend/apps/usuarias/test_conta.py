"""Testes da tela Minha conta: nome livre, nascimento, e-mail e conta criada com o Google.
Rode: python manage.py test apps.usuarias.test_conta"""
from datetime import date

from django.core import mail
from django.core.cache import cache
from django.test import TestCase as _TestCase
from django.test import override_settings

from apps.comum.testes import SENHA, cliente_logado, criar_usuaria
from apps.usuarias.models import Usuaria


class TestCase(_TestCase):
    def setUp(self):
        super().setUp()
        cache.clear()

    def tearDown(self):
        cache.clear()
        super().tearDown()


class NomeENascimentoTests(TestCase):
    def test_nome_do_documento_nao_pode_ser_trocado_depois_de_verificada(self):
        u = criar_usuaria("ana@ceub.edu.br", "Ana Souza")          # verificada=True
        r = cliente_logado(u).patch("/api/usuarias/me/", {"nome_completo": "Aninha Souza"}, format="json")
        self.assertEqual(r.status_code, 400)
        u.refresh_from_db()
        self.assertEqual(u.nome_completo, "Ana Souza")

    def test_antes_de_verificar_o_nome_pode_mudar(self):
        u = criar_usuaria("ana@ceub.edu.br", "Ana Souza")
        u.verificada = False
        u.save()
        r = cliente_logado(u).patch("/api/usuarias/me/", {"nome_completo": "Aninha Souza"}, format="json")
        self.assertEqual(r.status_code, 200)

    def test_nascimento_vazio_pode_ser_informado_uma_vez(self):
        u = criar_usuaria()                                        # verificada, sem data (como conta do Google)
        c = cliente_logado(u)
        self.assertEqual(c.patch("/api/usuarias/me/", {"data_nascimento": "2003-05-10"}, format="json").status_code, 200)
        u.refresh_from_db()
        self.assertEqual(u.data_nascimento, date(2003, 5, 10))

    def test_nascimento_ja_preenchido_e_verificada_nao_muda(self):
        u = criar_usuaria()
        u.data_nascimento = date(2003, 5, 10)
        u.save()
        r = cliente_logado(u).patch("/api/usuarias/me/", {"data_nascimento": "2000-01-01"}, format="json")
        self.assertEqual(r.status_code, 400)
        u.refresh_from_db()
        self.assertEqual(u.data_nascimento, date(2003, 5, 10))

    def test_nascimento_segue_as_regras_de_idade(self):
        u = criar_usuaria()
        c = cliente_logado(u)
        for ruim in ("2030-01-01", "2020-01-01", "1900-01-01"):
            self.assertEqual(c.patch("/api/usuarias/me/", {"data_nascimento": ruim}, format="json").status_code, 400, ruim)


class TemSenhaTests(TestCase):
    def test_conta_normal_tem_senha(self):
        r = cliente_logado(criar_usuaria()).get("/api/usuarias/me/")
        self.assertTrue(r.data["tem_senha"])

    def test_conta_do_google_nao_tem_senha(self):
        u = criar_usuaria()
        u.set_unusable_password()
        u.save()
        self.assertFalse(cliente_logado(u).get("/api/usuarias/me/").data["tem_senha"])


class AlterarEmailTests(TestCase):
    def trocar(self, u, email, senha=SENHA):
        return cliente_logado(u).post("/api/usuarias/me/email/", {"email": email, "senha": senha}, format="json")

    def test_troca_o_email_com_a_senha_certa(self):
        u = criar_usuaria("ana@ceub.edu.br")
        r = self.trocar(u, "Nova@CEUB.edu.br")
        self.assertEqual(r.status_code, 200)
        u.refresh_from_db()
        self.assertEqual((u.email, u.username), ("nova@ceub.edu.br", "nova@ceub.edu.br"))

    def test_avisa_o_email_antigo(self):
        u = criar_usuaria("ana@ceub.edu.br")
        self.trocar(u, "nova@ceub.edu.br")
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, ["ana@ceub.edu.br"])

    def test_senha_errada(self):
        u = criar_usuaria("ana@ceub.edu.br")
        self.assertEqual(self.trocar(u, "nova@ceub.edu.br", "errada").status_code, 400)
        u.refresh_from_db()
        self.assertEqual(u.email, "ana@ceub.edu.br")

    def test_email_ja_em_uso(self):
        criar_usuaria("outra@ceub.edu.br", "Outra")
        u = criar_usuaria("ana@ceub.edu.br")
        self.assertEqual(self.trocar(u, "OUTRA@ceub.edu.br").status_code, 400)

    def test_email_invalido(self):
        self.assertEqual(self.trocar(criar_usuaria(), "isso-nao-e-email").status_code, 400)

    def test_conta_do_google_nao_troca_email(self):
        u = criar_usuaria("g@sempreceub.com", "Conta Google")
        u.set_unusable_password()
        u.save()
        r = self.trocar(u, "outro@ceub.edu.br", "qualquer")
        self.assertEqual(r.status_code, 403)
        u.refresh_from_db()
        self.assertEqual(u.email, "g@sempreceub.com")

    def test_precisa_estar_logada(self):
        from rest_framework.test import APIClient
        r = APIClient().post("/api/usuarias/me/email/", {"email": "a@b.com", "senha": SENHA}, format="json")
        self.assertEqual(r.status_code, 401)

    def test_login_continua_com_o_email_novo(self):
        from rest_framework.test import APIClient
        u = criar_usuaria("ana@ceub.edu.br")
        self.trocar(u, "nova@ceub.edu.br")
        r = APIClient().post("/api/auth/login/", {"email": "nova@ceub.edu.br", "password": SENHA}, format="json")
        self.assertEqual(r.status_code, 200)


class ApelidoTests(TestCase):
    def test_apelido_pode_ser_definido_mesmo_verificada(self):
        u = criar_usuaria("ana@ceub.edu.br", "Ana Souza")                  # verificada
        r = cliente_logado(u).patch("/api/usuarias/me/", {"apelido": "  Aninha   "}, format="json")
        self.assertEqual(r.status_code, 200)
        u.refresh_from_db()
        self.assertEqual((u.apelido, u.nome_completo), ("Aninha", "Ana Souza"))     # o nome real não muda
        self.assertEqual(r.data["apelido"], "Aninha")

    def test_apelido_comprido_demais(self):
        r = cliente_logado(criar_usuaria()).patch("/api/usuarias/me/", {"apelido": "x" * 31}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_apelido_vazio_remove(self):
        u = criar_usuaria()
        u.apelido = "Ani"
        u.save()
        cliente_logado(u).patch("/api/usuarias/me/", {"apelido": ""}, format="json")
        u.refresh_from_db()
        self.assertEqual(u.apelido, "")

    def test_nome_exibicao(self):
        u = criar_usuaria("ana@ceub.edu.br", "Ana Souza")
        self.assertEqual(u.nome_exibicao, "Ana")
        u.apelido = "Aninha"
        self.assertEqual(u.nome_exibicao, "Aninha")
