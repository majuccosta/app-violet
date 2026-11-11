"""Testes da consulta ao IBGE (sem internet). Rode: python manage.py test apps.usuarias.test_ibge"""
import unittest
from unittest import mock

from apps.usuarias import ibge


def resposta(*frequencias):
    return [{"nome": "X", "res": [{"periodo": "1930[", "frequencia": f} for f in frequencias]}]


class PrimeiroNomeTests(unittest.TestCase):
    def test_normaliza(self):
        self.assertEqual(ibge.primeiro_nome("Maria Júlia de Carvalho Costa"), "maria")
        self.assertEqual(ibge.primeiro_nome("  JOÃO  Silva"), "joao")
        self.assertEqual(ibge.primeiro_nome(""), "")
        self.assertEqual(ibge.primeiro_nome(None), "")


class ClassificarTests(unittest.TestCase):
    def setUp(self):
        ibge.limpar_cache()
        ibge._tabela = {}      # ignora a tabela real: esses testes simulam a API
        self.addCleanup(ibge.limpar_cache)

    def _com(self, fem, masc, **kw):
        def falso(nome, sexo):
            return resposta(fem) if sexo == "F" else resposta(masc)
        with mock.patch("apps.usuarias.ibge._buscar", side_effect=falso):
            return ibge.classificar_nome("Alguem Silva", **kw)

    def test_claramente_feminino(self):
        self.assertEqual(self._com(99000, 1000), "F")

    def test_claramente_masculino(self):
        self.assertEqual(self._com(1000, 99000), "M")

    def test_ambiguo(self):
        self.assertEqual(self._com(55000, 45000), "A")

    def test_nome_raro_e_ambiguo(self):
        self.assertEqual(self._com(300, 0), "A")

    def test_nome_vazio_e_ambiguo(self):
        self.assertEqual(ibge.classificar_nome(""), "A")

    def test_ibge_fora_do_ar_levanta_erro(self):
        with mock.patch("apps.usuarias.ibge._buscar", side_effect=ibge.IbgeErro("x")):
            with self.assertRaises(ibge.IbgeErro):
                ibge.classificar_nome("Maria")

    def test_analisar_devolve_os_detalhes(self):
        def falso(nome, sexo):
            return resposta(997) if sexo == "F" else resposta(3)
        with mock.patch("apps.usuarias.ibge._buscar", side_effect=falso):
            r = ibge.analisar_nome("Maria Júlia de Carvalho", minimo=100)
        self.assertEqual(r, {"nome": "maria", "classe": "F", "pct_feminino": 99.7, "total": 1000})

    def test_analisar_nome_vazio(self):
        self.assertEqual(ibge.analisar_nome("")["classe"], "A")

    def test_resposta_vazia_soma_zero(self):
        self.assertEqual(ibge._total([]), 0)
        self.assertEqual(ibge._total(None), 0)
        self.assertEqual(ibge._total([{"res": None}]), 0)


class BuscarTests(unittest.TestCase):
    def test_levanta_ibgeerro_com_o_motivo(self):
        import urllib.error
        with mock.patch("urllib.request.urlopen", side_effect=urllib.error.URLError("sem rede")):
            with self.assertRaises(ibge.IbgeErro) as e:
                ibge._buscar("maria", "F")
        self.assertIn("sem rede", str(e.exception))

    def test_uma_tentativa_so_e_tempo_curto(self):
        import urllib.error
        with mock.patch("urllib.request.urlopen", side_effect=urllib.error.URLError("x")) as abrir:
            with self.assertRaises(ibge.IbgeErro):
                ibge._buscar("maria", "F")
        self.assertEqual(abrir.call_count, 1)
        self.assertLessEqual(abrir.call_args.kwargs["timeout"], 5)


class TabelaLocalTests(unittest.TestCase):
    def setUp(self):
        ibge.limpar_cache()
        self.addCleanup(ibge.limpar_cache)

    def test_nome_da_tabela_nao_chama_a_api(self):
        ibge._tabela = {"maria": [997, 3]}
        with mock.patch("apps.usuarias.ibge._buscar", side_effect=AssertionError("não devia chamar")):
            r = ibge.analisar_nome("Maria Silva", minimo=100)
        self.assertEqual((r["classe"], r["pct_feminino"]), ("F", 99.7))

    def test_nome_fora_da_tabela_usa_a_api_e_guarda_na_memoria(self):
        ibge._tabela = {}
        falso = lambda nome, sexo: resposta(500) if sexo == "F" else resposta(1)
        with mock.patch("apps.usuarias.ibge._buscar", side_effect=falso) as b:
            ibge.analisar_nome("Zaira", minimo=100)
            ibge.analisar_nome("Zaira", minimo=100)
        self.assertEqual(b.call_count, 2)    # F e M, uma vez só

    def test_depois_de_falha_nao_insiste_por_um_tempo(self):
        ibge._tabela = {}
        with mock.patch("apps.usuarias.ibge._buscar", side_effect=ibge.IbgeErro("x")) as b:
            with self.assertRaises(ibge.IbgeErro):
                ibge.frequencias("zaira")
            with self.assertRaises(ibge.IbgeErro):
                ibge.frequencias("zelia")
        self.assertEqual(b.call_count, 1)

    def test_arquivo_ausente_ou_estragado_vira_tabela_vazia(self):
        ibge.limpar_cache()
        with mock.patch.object(ibge, "ARQUIVO", ibge.ARQUIVO.parent / "nao_existe.json"):
            self.assertEqual(ibge._carregar_tabela(), {})


class ConstruirTabelaTests(unittest.TestCase):
    def test_monta_pula_existentes_e_junta_falhas(self):
        def falso(nome, sexo):
            if nome == "ruim":
                raise ibge.IbgeErro("x")
            return resposta(90) if sexo == "F" else resposta(10)
        progresso = []
        tabela, falhas = ibge.construir_tabela(
            ["ana", "ruim", "lia"], {"lia": [1, 2]}, buscar=falso, esperar=lambda s: None,
            ao_progresso=lambda i, t, n: progresso.append(i))
        self.assertEqual(tabela, {"ana": [90, 10], "lia": [1, 2]})
        self.assertEqual(falhas, ["ruim"])
        self.assertEqual(progresso, [1, 2, 3])


class NomesComunsTests(unittest.TestCase):
    def test_lista_valida(self):
        from apps.usuarias.nomes_comuns import NOMES_COMUNS
        self.assertGreater(len(NOMES_COMUNS), 500)
        for n in ("maria", "sara", "laura", "julia"):
            self.assertIn(n, NOMES_COMUNS)
        self.assertTrue(all(n == ibge.primeiro_nome(n) for n in NOMES_COMUNS))


if __name__ == "__main__":
    unittest.main()
