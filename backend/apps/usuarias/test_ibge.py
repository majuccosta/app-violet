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
        ibge.frequencias.cache_clear()

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


if __name__ == "__main__":
    unittest.main()
