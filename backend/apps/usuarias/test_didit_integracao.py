"""Testes da verificação de identidade com a Didit (com banco). Rode: python manage.py test apps.usuarias"""
import json
import time
from unittest import mock

from django.core.cache import cache
from django.test import TestCase as _TestCase
from django.test import override_settings
from rest_framework.test import APIClient

from apps.comum.testes import cliente_logado, criar_usuaria
from apps.usuarias import didit, ibge
from apps.usuarias.models import Usuaria, VerificacaoIdentidade



class TestCase(_TestCase):
    """Limpa o cache (contadores do limite de requisições) entre os testes, para não causar erro 429 em outros testes."""

    def setUp(self):
        super().setUp()
        cache.clear()

    def tearDown(self):
        cache.clear()
        super().tearDown()


DIDIT = dict(DIDIT_API_KEY="chave", DIDIT_WORKFLOW_ID="wf-1", DIDIT_WEBHOOK_SECRET="segredo", DIDIT_CALLBACK_URL="",
             VERIFICACAO_USAR_NOME_IBGE=False)   # nos testes não consultamos o IBGE de verdade
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
        decisao = {"status": "Approved", "id_verifications": [{"gender": "F"}]}
        with mock.patch("apps.usuarias.didit.consultar_decisao", return_value=decisao):
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


def _decisao(genero, status="Approved", nome=None):
    item = {}
    if genero is not None:
        item["gender"] = genero
    if nome:
        item["full_name"] = nome
    return {"status": status, "id_verifications": [item]}


@override_settings(**DIDIT)
class SoMulheresTests(TestCase):
    """O Violet é só para mulheres: a Didit aprova o documento, mas o gênero do documento também conta."""

    def _status(self, decisao):
        u = nao_verificada()
        VerificacaoIdentidade.objects.create(usuaria=u, id_sessao_didit="sess-1")
        with mock.patch("apps.usuarias.didit.consultar_decisao", return_value=decisao):
            r = cliente_logado(u).get("/api/usuarias/verificacao/status/")
        u.refresh_from_db()
        return r, u

    def test_documento_feminino_e_aprovado(self):
        r, u = self._status(_decisao("F"))
        self.assertEqual((r.data["status"], u.verificada), ("aprovada", True))

    def test_documento_masculino_e_recusado_mesmo_com_didit_aprovando(self):
        r, u = self._status(_decisao("M"))
        self.assertEqual((r.data["status"], u.verificada), ("reprovada", False))

    def test_documento_sem_genero_e_aceito_por_padrao(self):
        r, u = self._status(_decisao("U"))
        self.assertEqual((r.data["status"], u.verificada), ("aprovada", True))

    @override_settings(DIDIT_ACEITAR_SEM_GENERO=False)
    def test_documento_sem_genero_pode_ser_recusado_por_configuracao(self):
        r, u = self._status(_decisao(None))
        self.assertEqual((r.data["status"], u.verificada), ("reprovada", False))

    @override_settings(DIDIT_EXIGIR_MULHER=False)
    def test_regra_pode_ser_desligada(self):
        r, u = self._status(_decisao("M"))
        self.assertEqual((r.data["status"], u.verificada), ("aprovada", True))

    def test_webhook_aprovado_de_documento_masculino_nao_verifica(self):
        u = nao_verificada()
        VerificacaoIdentidade.objects.create(usuaria=u, id_sessao_didit="sess-1")
        corpo = {"session_id": "sess-1", "status": "Approved"}
        with mock.patch("apps.usuarias.didit.consultar_decisao", return_value=_decisao("M")):
            r = APIClient().post("/api/usuarias/verificacao/webhook/", json.dumps(corpo).encode(),
                                 content_type="application/json",
                                 HTTP_X_SIGNATURE_V2=didit.assinatura_esperada(corpo, "segredo"),
                                 HTTP_X_TIMESTAMP=str(int(time.time())))
        self.assertEqual(r.status_code, 200)
        u.refresh_from_db()
        self.assertFalse(u.verificada)

    def test_webhook_sem_conseguir_conferir_o_genero_nao_aprova(self):
        u = nao_verificada()
        VerificacaoIdentidade.objects.create(usuaria=u, id_sessao_didit="sess-1")
        corpo = {"session_id": "sess-1", "status": "Approved"}
        with mock.patch("apps.usuarias.didit.consultar_decisao", side_effect=didit.DiditErro("fora do ar")):
            APIClient().post("/api/usuarias/verificacao/webhook/", json.dumps(corpo).encode(),
                             content_type="application/json",
                             HTTP_X_SIGNATURE_V2=didit.assinatura_esperada(corpo, "segredo"),
                             HTTP_X_TIMESTAMP=str(int(time.time())))
        u.refresh_from_db()
        self.assertFalse(u.verificada)


def _analise(classe, pct=None):
    return {"nome": "maria", "classe": classe, "pct_feminino": pct, "total": 1000000}


@override_settings(**{**DIDIT, "VERIFICACAO_USAR_NOME_IBGE": True})
class NomeIbgeTests(TestCase):
    """Documento sem gênero: o primeiro nome decide (base do IBGE)."""

    def _status(self, analise=None, erro=None, decisao=None):
        u = nao_verificada()
        VerificacaoIdentidade.objects.create(usuaria=u, id_sessao_didit="sess-1")
        decisao = decisao or _decisao("U", nome="Maria Júlia de Carvalho")
        efeito = {"side_effect": erro} if erro else {"return_value": analise}
        with mock.patch("apps.usuarias.didit.consultar_decisao", return_value=decisao), \
             mock.patch("apps.usuarias.ibge.analisar_nome", **efeito) as consulta:
            r = cliente_logado(u).get("/api/usuarias/verificacao/status/")
        u.refresh_from_db()
        return r, u, consulta

    def test_nome_feminino_aprova(self):
        r, u, consulta = self._status(_analise("F", 99.7))
        self.assertEqual((r.data["status"], u.verificada), ("aprovada", True))
        self.assertEqual(consulta.call_args.args[0], "Maria Júlia de Carvalho")

    def test_nome_masculino_recusa(self):
        r, u, _ = self._status(_analise("M", 0.4))
        self.assertEqual((r.data["status"], u.verificada), ("reprovada", False))

    def test_nome_ambiguo_fica_pendente(self):
        r, u, _ = self._status(_analise("A", 55.0))
        self.assertEqual((r.data["status"], u.verificada), ("pendente", False))

    def test_ibge_fora_do_ar_fica_pendente(self):
        r, u, _ = self._status(erro=ibge.IbgeErro("fora do ar"))
        self.assertEqual((r.data["status"], u.verificada), ("pendente", False))

    def test_documento_com_genero_nao_consulta_o_ibge(self):
        r, u, consulta = self._status(_analise("M"), decisao=_decisao("F", nome="Carlos"))
        consulta.assert_not_called()
        self.assertTrue(u.verificada)

    def test_resposta_traz_o_passo_a_passo_da_conferencia(self):
        r, _, _ = self._status(_analise("F", 99.7))
        self.assertEqual(r.data["conferencia"], {
            "genero_documento": "U", "nome": "Maria", "metodo": "ibge", "classe": "F",
            "pct_feminino": 99.7, "resultado": "aprovada"})

    def test_conferencia_do_documento_com_genero(self):
        r, _, _ = self._status(decisao=_decisao("F", nome="Ana Paula"))
        self.assertEqual(r.data["conferencia"]["metodo"], "documento")
        self.assertEqual(r.data["conferencia"]["genero_documento"], "F")

    def test_conferencia_mostra_o_ibge_indisponivel(self):
        r, _, _ = self._status(erro=ibge.IbgeErro("fora do ar"))
        self.assertEqual(r.data["conferencia"]["metodo"], "indisponivel")
        self.assertEqual(r.data["conferencia"]["resultado"], "pendente")

    def test_conferencia_so_leva_o_primeiro_nome(self):
        r, _, _ = self._status(_analise("F", 99.7))
        self.assertNotIn("Carvalho", str(r.data["conferencia"]))
