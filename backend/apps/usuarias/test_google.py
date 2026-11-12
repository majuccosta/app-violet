"""Testes do login com Google. Rode: python manage.py test apps.usuarias.test_google"""
import io
import json
import urllib.error
from unittest import mock

from django.core.cache import cache
from django.test import TestCase as _TestCase
from django.test import override_settings
from rest_framework.test import APIClient

from apps.comum.testes import cliente_logado, criar_usuaria
from apps.usuarias import google
from apps.usuarias.models import Preferencias, Usuaria

CLIENT = "cliente-123.apps.googleusercontent.com"
AGORA = 1_800_000_000


def resposta(**campos):
    dados = {"aud": CLIENT, "iss": "https://accounts.google.com", "exp": str(AGORA + 600), "email": "Maju@SempreCEUB.com",
             "email_verified": "true", "name": "Maria Júlia Costa", "picture": "https://x/y.png"}
    dados.update(campos)
    corpo = io.BytesIO(json.dumps(dados).encode())
    corpo.__enter__ = lambda s: s
    corpo.__exit__ = lambda *a: False
    return lambda req, timeout=None: corpo


def verificar(**campos):
    return google.verificar_credencial("token", CLIENT, agora=AGORA, abrir=resposta(**campos))


class VerificarCredencialTests(_TestCase):
    def test_token_valido(self):
        self.assertEqual(verificar(), {"email": "maju@sempreceub.com", "nome": "Maria Júlia Costa", "foto": "https://x/y.png"})

    def test_aceita_os_dois_formatos_de_emissor(self):
        self.assertEqual(verificar(iss="accounts.google.com")["email"], "maju@sempreceub.com")

    def test_token_de_outro_aplicativo(self):
        with self.assertRaises(google.GoogleErro):
            verificar(aud="outro-app")

    def test_emissor_invalido(self):
        with self.assertRaises(google.GoogleErro):
            verificar(iss="https://falso.com")

    def test_token_vencido(self):
        with self.assertRaises(google.GoogleErro):
            verificar(exp=str(AGORA - 1))

    def test_email_nao_verificado(self):
        with self.assertRaises(google.GoogleErro):
            verificar(email_verified="false")

    def test_sem_client_id_configurado(self):
        with self.assertRaises(google.GoogleErro) as e:
            google.verificar_credencial("token", "", abrir=resposta())
        self.assertEqual(e.exception.codigo, "indisponivel")

    def test_credencial_vazia_ou_gigante(self):
        for ruim in (None, "", "x" * 5000, 123):
            with self.assertRaises(google.GoogleErro):
                google.verificar_credencial(ruim, CLIENT, abrir=resposta())

    def test_google_recusou_o_token(self):
        def abrir(req, timeout=None):
            raise urllib.error.HTTPError(req.full_url, 400, "bad", {}, None)
        with self.assertRaises(google.GoogleErro) as e:
            google.verificar_credencial("token", CLIENT, abrir=abrir)
        self.assertEqual(e.exception.codigo, "invalido")

    def test_google_fora_do_ar(self):
        def abrir(req, timeout=None):
            raise urllib.error.URLError("sem rede")
        with self.assertRaises(google.GoogleErro) as e:
            google.verificar_credencial("token", CLIENT, abrir=abrir)
        self.assertEqual(e.exception.codigo, "indisponivel")


INFO = {"email": "maju@sempreceub.com", "nome": "Maria Júlia Costa", "foto": ""}


class TestCase(_TestCase):
    def setUp(self):
        super().setUp()
        cache.clear()      # evita o erro 429 do limite de requisições entre testes

    def tearDown(self):
        cache.clear()
        super().tearDown()


@override_settings(GOOGLE_CLIENT_ID=CLIENT, GOOGLE_DOMINIOS_PERMITIDOS=[])
class GoogleLoginViewTests(TestCase):
    def entrar(self, info=INFO, credential="token"):
        with mock.patch("apps.usuarias.google.verificar_credencial", return_value=info):
            return APIClient().post("/api/auth/google/", {"credential": credential}, format="json")

    def test_primeira_entrada_cria_conta_sem_verificacao(self):
        r = self.entrar()
        self.assertEqual(r.status_code, 200)
        self.assertTrue(r.data["access"] and r.data["refresh"])
        u = Usuaria.objects.get(email="maju@sempreceub.com")
        self.assertEqual(u.nome_completo, "Maria Júlia Costa")
        self.assertFalse(u.verificada)                      # ainda passa pela Didit
        self.assertFalse(u.has_usable_password())
        self.assertTrue(Preferencias.objects.filter(usuaria=u).exists())

    def test_o_token_devolvido_funciona(self):
        r = self.entrar()
        c = APIClient()
        c.credentials(HTTP_AUTHORIZATION=f"Bearer {r.data['access']}")
        self.assertEqual(c.get("/api/usuarias/me/").status_code, 200)

    def test_conta_existente_e_reaproveitada(self):
        u = criar_usuaria("maju@sempreceub.com", "Maju")
        self.entrar()
        self.assertEqual(Usuaria.objects.filter(email="maju@sempreceub.com").count(), 1)
        self.assertEqual(Usuaria.objects.get(pk=u.pk).nome_completo, "Maju")
        self.assertTrue(Usuaria.objects.get(pk=u.pk).verificada)    # não perde a verificação

    def test_conta_desativada_nao_entra(self):
        u = criar_usuaria("maju@sempreceub.com", "Maju")
        u.is_active = False
        u.save()
        self.assertEqual(self.entrar().status_code, 403)

    def test_token_invalido(self):
        with mock.patch("apps.usuarias.google.verificar_credencial", side_effect=google.GoogleErro("ruim")):
            r = APIClient().post("/api/auth/google/", {"credential": "x"}, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertEqual(r.data["detail"], "ruim")
        self.assertEqual(Usuaria.objects.count(), 0)

    def test_google_indisponivel_da_502(self):
        with mock.patch("apps.usuarias.google.verificar_credencial",
                        side_effect=google.GoogleErro("fora", "indisponivel")):
            r = APIClient().post("/api/auth/google/", {"credential": "x"}, format="json")
        self.assertEqual(r.status_code, 502)

    def test_sem_credential(self):
        r = APIClient().post("/api/auth/google/", {}, format="json")
        self.assertEqual(r.status_code, 400)


@override_settings(GOOGLE_CLIENT_ID=CLIENT, GOOGLE_DOMINIOS_PERMITIDOS=["sempreceub.com", "ceub.edu.br"])
class DominiosTests(TestCase):
    def entrar(self, email):
        with mock.patch("apps.usuarias.google.verificar_credencial", return_value={**INFO, "email": email}):
            return APIClient().post("/api/auth/google/", {"credential": "t"}, format="json")

    def test_dominio_permitido(self):
        self.assertEqual(self.entrar("a@sempreceub.com").status_code, 200)
        self.assertEqual(self.entrar("b@ceub.edu.br").status_code, 200)

    def test_dominio_de_fora_e_recusado(self):
        r = self.entrar("c@gmail.com")
        self.assertEqual(r.status_code, 403)
        self.assertFalse(Usuaria.objects.filter(email="c@gmail.com").exists())

    def test_subdominio_parecido_nao_passa(self):
        self.assertEqual(self.entrar("d@falsosempreceub.com").status_code, 403)


@override_settings(GOOGLE_CLIENT_ID="")
class DesligadoTests(TestCase):
    def test_sem_client_id_o_login_google_fica_indisponivel(self):
        r = APIClient().post("/api/auth/google/", {"credential": "x"}, format="json")
        self.assertEqual(r.status_code, 503)


class ExcluirContaSoGoogleTests(TestCase):
    def test_conta_sem_senha_exclui_sem_pedir_senha(self):
        u = criar_usuaria("g@sempreceub.com", "Conta Google")
        u.set_unusable_password()
        u.save()
        r = cliente_logado(u).post("/api/usuarias/me/excluir/", {}, format="json")
        self.assertEqual(r.status_code, 204)

    def test_conta_com_senha_continua_exigindo_senha(self):
        u = criar_usuaria("s@sempreceub.com", "Conta Senha")
        r = cliente_logado(u).post("/api/usuarias/me/excluir/", {}, format="json")
        self.assertEqual(r.status_code, 400)
        r = cliente_logado(u).post("/api/usuarias/me/excluir/", {"senha": "errada"}, format="json")
        self.assertEqual(r.status_code, 400)
