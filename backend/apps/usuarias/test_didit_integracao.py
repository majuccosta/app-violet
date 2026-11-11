"""Testes da verificação de identidade com a Didit (com banco). Rode: python manage.py test apps.usuarias"""
import json
import time
from unittest import mock

from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.comum.testes import cliente_logado, criar_usuaria
from apps.usuarias import didit
from apps.usuarias.models import Usuaria, VerificacaoIdentidade

DIDIT = dict(DIDIT_API_KEY="chave", DIDIT_WORKFLOW_ID="wf-1", DIDIT_WEBHOOK_SECRET="segredo", DIDIT_CALLBACK_URL="")
SESSAO = {"session_id": "sess-1", "url": "https://verify.didit.me/s/1", "status": "Not Started"}


def nao_verificada():
    u = criar_usuaria("nova@ceub.edu.br", "Nova Usuária")
    u.verificada = False
    u.save()
    return u


@override_settings(DIDIT_API_KEY="", DIDIT_WORKFLOW_ID="")
class ModoDemonstracaoTests(TestCase):
    def test_sem_didit_o_app_segue_no_modo_demo(self):
        r = cliente_logado(nao_verificada()).post("/api/usuarias/verificacao/iniciar/", {}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["modo"], "demo")
        self.assertEqual(VerificacaoIdentidade.objects.count(), 0)


@override_settings(**DIDIT)
class IniciarEStatusTests(TestCase):
    def test_iniciar_cria_sessao_e_devolve_url(self):
        u = nao_verificada()
        with mock.patch("apps.usuarias.didit.criar_sessao", return_value=SESSAO) as criar:
            r = cliente_logado(u).post("/api/usuarias/verificacao/iniciar/", {}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data, {"modo": "didit", "url": SESSAO["url"]})
        self.assertEqual(criar.call_args.args[:3], ("chave", "wf-1", u.pk))
        v = VerificacaoIdentidade.objects.get(usuaria=u)
        self.assertEqual((v.status, v.id_sessao_didit), ("pendente", "sess-1"))

    def test_usuaria_ja_verificada_nao_cria_sessao(self):
        r = cliente_logado(criar_usuaria()).post("/api/usuarias/verificacao/iniciar/", {}, format="json")
        self.assertEqual(r.data["modo"], "ja_verificada")
        self.assertEqual(VerificacaoIdentidade.objects.count(), 0)

    def test_falha_da_didit_vira_502_sem_vazar_detalhes(self):
        with mock.patch("apps.usuarias.didit.criar_sessao", side_effect=didit.DiditErro("403 chave invalida")):
            r = cliente_logado(nao_verificada()).post("/api/usuarias/verificacao/iniciar/", {}, format="json")
        self.assertEqual(r.status_code, 502)
        self.assertNotIn("chave", json.dumps(r.data).lower())

    def test_status_aprovado_verifica_a_usuaria(self):
        u = nao_verificada()
        VerificacaoIdentidade.objects.create(usuaria=u, id_sessao_didit="sess-1")
        with mock.patch("apps.usuarias.didit.consultar_decisao", return_value={"status": "Approved"}):
            r = cliente_logado(u).get("/api/usuarias/verificacao/status/")
        self.assertEqual((r.data["verificada"], r.data["status"], r.data["modo"]), (True, "aprovada", "didit"))
        u.refresh_from_db()
        self.assertTrue(u.verificada)

    def test_status_em_analise_continua_pendente(self):
        u = nao_verificada()
        VerificacaoIdentidade.objects.create(usuaria=u, id_sessao_didit="sess-1")
        with mock.patch("apps.usuarias.didit.consultar_decisao", return_value={"status": "In Review"}):
            r = cliente_logado(u).get("/api/usuarias/verificacao/status/")
        self.assertEqual((r.data["verificada"], r.data["status"]), (False, "pendente"))

    def test_status_recusado(self):
        u = nao_verificada()
        VerificacaoIdentidade.objects.create(usuaria=u, id_sessao_didit="sess-1")
        with mock.patch("apps.usuarias.didit.consultar_decisao", return_value={"status": "Declined"}):
            r = cliente_logado(u).get("/api/usuarias/verificacao/status/")
        self.assertEqual((r.data["verificada"], r.data["status"]), (False, "reprovada"))
        u.refresh_from_db()
        self.assertFalse(u.verificada)

    def test_didit_fora_do_ar_nao_derruba_o_status(self):
        u = nao_verificada()
        VerificacaoIdentidade.objects.create(usuaria=u, id_sessao_didit="sess-1")
        with mock.patch("apps.usuarias.didit.consultar_decisao", side_effect=didit.DiditErro("fora do ar")):
            r = cliente_logado(u).get("/api/usuarias/verificacao/status/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["status"], "pendente")

    def test_caminho_demo_fica_fechado_com_didit_ligada(self):
        # ninguém pode pular a verificação real mandando fotos qualquer para o endpoint antigo
        r = cliente_logado(nao_verificada()).post("/api/usuarias/verificacao/", {}, format="multipart")
        self.assertEqual(r.status_code, 409)

    def test_aprovada_nunca_volta_atras(self):
        u = nao_verificada()
        v = VerificacaoIdentidade.objects.create(usuaria=u, id_sessao_didit="s", status="aprovada")
        from apps.usuarias.services import aplicar_status
        aplicar_status(v, "Declined")
        v.refresh_from_db()
        self.assertEqual(v.status, "aprovada")


@override_settings(**DIDIT)
class WebhookTests(TestCase):
    def _enviar(self, corpo, assinatura=None, ts=None, segredo="segredo"):
        bruto = json.dumps(corpo).encode()
        ass = assinatura if assinatura is not None else didit.assinatura_esperada(corpo, segredo)
        return APIClient().post("/api/usuarias/verificacao/webhook/", bruto, content_type="application/json",
                                HTTP_X_SIGNATURE_V2=ass, HTTP_X_TIMESTAMP=str(ts or int(time.time())))

    def test_webhook_aprovado_verifica_a_usuaria(self):
        u = nao_verificada()
        VerificacaoIdentidade.objects.create(usuaria=u, id_sessao_didit="sess-1")
        r = self._enviar({"session_id": "sess-1", "status": "Approved", "webhook_type": "status.updated"})
        self.assertEqual(r.status_code, 200)
        u.refresh_from_db()
        self.assertTrue(u.verificada)

    def test_assinatura_falsa_e_recusada_e_nada_muda(self):
        u = nao_verificada()
        VerificacaoIdentidade.objects.create(usuaria=u, id_sessao_didit="sess-1")
        r = self._enviar({"session_id": "sess-1", "status": "Approved"}, assinatura="0" * 64)
        self.assertEqual(r.status_code, 401)
        u.refresh_from_db()
        self.assertFalse(u.verificada)

    def test_aviso_antigo_e_recusado(self):
        u = nao_verificada()
        VerificacaoIdentidade.objects.create(usuaria=u, id_sessao_didit="sess-1")
        r = self._enviar({"session_id": "sess-1", "status": "Approved"}, ts=int(time.time()) - 3600)
        self.assertEqual(r.status_code, 401)

    def test_sessao_desconhecida_responde_ok(self):
        r = self._enviar({"session_id": "nao-existe", "status": "Approved"})
        self.assertEqual(r.status_code, 200)   # 200 evita que a Didit fique reenviando


@override_settings(DIDIT_API_KEY="chave", DIDIT_WORKFLOW_ID="wf-1", DIDIT_WEBHOOK_SECRET="")
class WebhookSemSegredoTests(TestCase):
    def test_sem_segredo_configurado_recusa_tudo(self):
        corpo = {"session_id": "s", "status": "Approved"}
        r = APIClient().post("/api/usuarias/verificacao/webhook/", json.dumps(corpo).encode(), content_type="application/json",
                             HTTP_X_SIGNATURE_V2=didit.assinatura_esperada(corpo, ""), HTTP_X_TIMESTAMP=str(int(time.time())))
        self.assertEqual(r.status_code, 401)
