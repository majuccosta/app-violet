"""Depois da verificação, o perfil passa a ter o nome e a data de nascimento do DOCUMENTO.
Rode: python manage.py test apps.usuarias.test_nome_documento"""
from datetime import date

from django.core.cache import cache
from django.test import TestCase as _TestCase
from django.test import override_settings

from apps.comum.testes import criar_usuaria
from apps.usuarias import didit, services
from apps.usuarias.models import VerificacaoIdentidade


def decisao(nome="MARIA JÚLIA DE CARVALHO COSTA", nascimento="2005-05-14", genero="F", status="Approved"):
    item = {"gender": genero}
    if nome is not None:
        item["full_name"] = nome
    if nascimento is not None:
        item["date_of_birth"] = nascimento
    return {"status": status, "id_verifications": [item]}


class NomeLegivelTests(_TestCase):
    def test_maiusculas_viram_nome_normal(self):
        self.assertEqual(services.nome_legivel("MARIA JÚLIA DE CARVALHO COSTA"), "Maria Júlia de Carvalho Costa")
        self.assertEqual(services.nome_legivel("ana  dos santos"), "Ana dos Santos")
        self.assertEqual(services.nome_legivel(""), "")
        self.assertEqual(services.nome_legivel(None), "")

    def test_particula_no_comeco_fica_com_maiuscula(self):
        self.assertEqual(services.nome_legivel("DE LA CRUZ"), "De la Cruz")


class DocumentoTests(_TestCase):
    def test_nome_completo_do_documento(self):
        self.assertEqual(didit.nome_completo_do_documento(decisao("Ana Souza")), "Ana Souza")
        sem_completo = {"id_verifications": [{"first_name": "Ana", "last_name": "Souza"}]}
        self.assertEqual(didit.nome_completo_do_documento(sem_completo), "Ana Souza")
        so_primeiro = {"id_verifications": [{"first_name": "Ana"}]}
        self.assertEqual(didit.nome_completo_do_documento(so_primeiro), "")
        self.assertEqual(didit.nome_completo_do_documento(None), "")

    def test_nascimento_do_documento(self):
        self.assertEqual(didit.nascimento_do_documento(decisao()), date(2005, 5, 14))
        self.assertIsNone(didit.nascimento_do_documento(decisao(nascimento=None)))
        self.assertIsNone(didit.nascimento_do_documento(decisao(nascimento="lixo")))
        self.assertIsNone(didit.nascimento_do_documento({}))


@override_settings(DIDIT_API_KEY="chave", DIDIT_WORKFLOW_ID="wf", VERIFICACAO_USAR_NOME_IBGE=False)
class AprovacaoCopiaDadosTests(_TestCase):
    def setUp(self):
        cache.clear()
        self.u = criar_usuaria("violetprojeto@gmail.com", "Violet Projeto")      # nome que veio do e-mail/Google
        self.u.verificada = False
        self.u.data_nascimento = None
        self.u.save()
        self.v = VerificacaoIdentidade.objects.create(usuaria=self.u, id_sessao_didit="s1")

    def test_aprovada_troca_o_nome_e_o_nascimento_pelos_do_documento(self):
        services.aplicar_status(self.v, "Approved", decisao())
        self.u.refresh_from_db()
        self.assertTrue(self.u.verificada)
        self.assertEqual(self.u.nome_completo, "Maria Júlia de Carvalho Costa")
        self.assertEqual(self.u.data_nascimento, date(2005, 5, 14))

    def test_sem_nome_no_documento_mantem_o_que_tinha(self):
        services.aplicar_status(self.v, "Approved", decisao(nome=None, nascimento=None))
        self.u.refresh_from_db()
        self.assertTrue(self.u.verificada)
        self.assertEqual(self.u.nome_completo, "Violet Projeto")

    def test_reprovada_nao_mexe_no_perfil(self):
        services.aplicar_status(self.v, "Declined", decisao(status="Declined"))
        self.u.refresh_from_db()
        self.assertFalse(self.u.verificada)
        self.assertEqual(self.u.nome_completo, "Violet Projeto")

    def test_documento_masculino_recusado_nao_mexe_no_perfil(self):
        services.aplicar_status(self.v, "Approved", decisao(genero="M"))
        self.u.refresh_from_db()
        self.assertFalse(self.u.verificada)
        self.assertEqual(self.u.nome_completo, "Violet Projeto")
