"""Buscar usuárias e pedidos de conexão: privacidade, aceitar/recusar e conversa só depois do aceite."""
from django.core.cache import cache
from django.test import TestCase as _TestCase

from apps.comum.testes import cliente_logado, criar_usuaria
from apps.notificacoes.models import Notificacao
from apps.usuarias.models import Preferencias

from .models import Conexao, Conversa, Participante


def visivel(u, perfil="verificadas"):
    Preferencias.objects.update_or_create(usuaria=u, defaults={"priv_perfil": perfil})
    return u


class TestCase(_TestCase):
    def setUp(self):
        super().setUp()
        cache.clear()
        self.ana = visivel(criar_usuaria("ana@ceub.edu.br", "Ana Souza"))
        self.bia = visivel(criar_usuaria("bia@ceub.edu.br", "Bia Lima"))
        self.c_ana = cliente_logado(self.ana)
        self.c_bia = cliente_logado(self.bia)

    def tearDown(self):
        cache.clear()
        super().tearDown()

    def buscar(self, cliente, q):
        r = cliente.get("/api/conversas/conexoes/buscar/", {"q": q})
        self.assertEqual(r.status_code, 200, r.data)
        return r.data

    def conversas(self, cliente):
        d = cliente.get("/api/conversas/").data
        return d["results"] if isinstance(d, dict) else d

    def pedir(self, cliente, usuaria):
        return cliente.post("/api/conversas/conexoes/", {"usuaria": usuaria.id}, format="json")


class BuscaTests(TestCase):
    def test_precisa_de_pelo_menos_3_letras(self):
        self.assertEqual(self.buscar(self.c_ana, "Bi"), [])
        self.assertEqual([p["id"] for p in self.buscar(self.c_ana, "Bia")], [self.bia.id])

    def test_acha_por_nome_ou_apelido_e_mostra_so_o_nome_de_exibicao(self):
        self.bia.apelido = "Bibi"
        self.bia.save()
        for q in ("bibi", "lima"):
            achadas = self.buscar(self.c_ana, q)
            self.assertEqual([p["id"] for p in achadas], [self.bia.id], q)
        p = self.buscar(self.c_ana, "bibi")[0]
        self.assertEqual(p["nome"], "Bibi")
        self.assertEqual(set(p), {"id", "nome", "tone", "relacao"})      # sem e-mail, telefone nem nome completo
        self.assertEqual(p["relacao"], "nenhuma")

    def test_sem_apelido_mostra_so_o_primeiro_nome(self):
        self.assertEqual(self.buscar(self.c_ana, "lima")[0]["nome"], "Bia")

    def test_nao_acha_a_si_mesma(self):
        self.assertEqual(self.buscar(self.c_ana, "Ana"), [])

    def test_respeita_a_privacidade_do_perfil(self):
        for perfil in ("contatos", "ninguem"):
            visivel(self.bia, perfil)
            self.assertEqual(self.buscar(self.c_ana, "Bia"), [], perfil)
        visivel(self.bia, "verificadas")
        self.assertEqual(len(self.buscar(self.c_ana, "Bia")), 1)

    def test_nao_acha_anonima_nem_nao_verificada_nem_inativa(self):
        self.bia.modo_anonimo = True
        self.bia.save()
        self.assertEqual(self.buscar(self.c_ana, "Bia"), [])
        self.bia.modo_anonimo, self.bia.verificada = False, False
        self.bia.save()
        self.assertEqual(self.buscar(self.c_ana, "Bia"), [])
        self.bia.verificada, self.bia.is_active = True, False
        self.bia.save()
        self.assertEqual(self.buscar(self.c_ana, "Bia"), [])

    def test_limita_a_20_resultados(self):
        for i in range(25):
            visivel(criar_usuaria(f"maria{i}@ceub.edu.br", f"Maria Teste{i}"))
        self.assertEqual(len(self.buscar(self.c_ana, "Maria")), 20)

    def test_precisa_estar_logada(self):
        from rest_framework.test import APIClient
        self.assertIn(APIClient().get("/api/conversas/conexoes/buscar/", {"q": "Bia"}).status_code, (401, 403))


class PedidoTests(TestCase):
    def test_pedir_cria_pedido_e_avisa_a_outra(self):
        r = self.pedir(self.c_ana, self.bia)
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(r.data["status"], "pendente")
        self.assertEqual(r.data["direcao"], "enviada")
        self.assertTrue(Notificacao.objects.filter(usuaria=self.bia, titulo="Novo pedido de conexão").exists())
        self.assertEqual(self.buscar(self.c_ana, "Bia")[0]["relacao"], "enviada")
        self.assertEqual(self.buscar(self.c_bia, "Ana")[0]["relacao"], "recebida")

    def test_pedir_de_novo_nao_duplica_nem_avisa_de_novo(self):
        self.pedir(self.c_ana, self.bia)
        r = self.pedir(self.c_ana, self.bia)
        self.assertEqual(r.status_code, 200)
        self.assertEqual(Conexao.objects.count(), 1)
        self.assertEqual(Notificacao.objects.filter(usuaria=self.bia).count(), 1)

    def test_nao_pode_adicionar_a_si_mesma(self):
        self.assertEqual(self.pedir(self.c_ana, self.ana).status_code, 400)

    def test_nao_pede_para_quem_nao_e_encontravel(self):
        visivel(self.bia, "ninguem")
        self.assertEqual(self.pedir(self.c_ana, self.bia).status_code, 404)
        self.assertEqual(Conexao.objects.count(), 0)

    def test_usuaria_inexistente(self):
        r = self.c_ana.post("/api/conversas/conexoes/", {"usuaria": 99999}, format="json")
        self.assertEqual(r.status_code, 404)
        r = self.c_ana.post("/api/conversas/conexoes/", {"usuaria": "abc"}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_no_modo_anonimo_nao_envia_pedido(self):
        self.ana.modo_anonimo = True
        self.ana.save()
        self.assertEqual(self.pedir(self.c_ana, self.bia).status_code, 400)

    def test_lista_de_recebidas_e_enviadas(self):
        self.pedir(self.c_ana, self.bia)
        rec = self.c_bia.get("/api/conversas/conexoes/").data
        self.assertEqual([(c["pessoa"]["nome"], c["direcao"]) for c in rec], [("Ana", "recebida")])
        self.assertEqual(self.c_ana.get("/api/conversas/conexoes/").data, [])
        env = self.c_ana.get("/api/conversas/conexoes/", {"tipo": "enviadas"}).data
        self.assertEqual([c["pessoa"]["nome"] for c in env], ["Bia"])

    def test_cancelar_pedido_pendente(self):
        cid = self.pedir(self.c_ana, self.bia).data["id"]
        self.assertEqual(self.c_bia.delete(f"/api/conversas/conexoes/{cid}/").status_code, 403)
        self.assertEqual(self.c_ana.delete(f"/api/conversas/conexoes/{cid}/").status_code, 204)
        self.assertEqual(Conexao.objects.count(), 0)

    def test_pedidos_cruzados_conectam_direto(self):
        self.pedir(self.c_ana, self.bia)
        r = self.pedir(self.c_bia, self.ana)
        self.assertEqual(r.data["status"], "aceita")
        self.assertIsNotNone(r.data["conversa_id"])
        self.assertEqual(Conexao.objects.filter(status="aceita").count(), 1)


class RespostaTests(TestCase):
    def setUp(self):
        super().setUp()
        self.cid = self.pedir(self.c_ana, self.bia).data["id"]
        self.url = f"/api/conversas/conexoes/{self.cid}"

    def test_aceitar_cria_a_conversa_com_as_duas(self):
        r = self.c_bia.post(f"{self.url}/aceitar/")
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(r.data["status"], "aceita")
        conversa = Conversa.objects.get(pk=r.data["conversa_id"])
        self.assertEqual(set(conversa.participantes.values_list("usuaria", flat=True)), {self.ana.id, self.bia.id})
        self.assertFalse(Participante.objects.filter(conversa=conversa, anonima=True).exists())
        self.assertTrue(Notificacao.objects.filter(usuaria=self.ana, titulo="Pedido aceito").exists())
        self.assertEqual(self.buscar(self.c_ana, "Bia")[0]["relacao"], "conectadas")
        # as duas veem a conversa e podem trocar mensagens
        for c in (self.c_ana, self.c_bia):
            self.assertIn(conversa.id, [x["id"] for x in self.conversas(c)])
        r = self.c_ana.post(f"/api/conversas/{conversa.id}/mensagens/", {"texto": "Oi!"}, format="json")
        self.assertEqual(r.status_code, 201, r.data)

    def test_aceitar_duas_vezes_nao_cria_outra_conversa(self):
        self.c_bia.post(f"{self.url}/aceitar/")
        self.c_bia.post(f"{self.url}/aceitar/")
        self.assertEqual(Conversa.objects.count(), 1)

    def test_so_quem_recebeu_responde(self):
        self.assertEqual(self.c_ana.post(f"{self.url}/aceitar/").status_code, 403)
        self.assertEqual(self.c_ana.post(f"{self.url}/recusar/").status_code, 403)
        outra = cliente_logado(visivel(criar_usuaria("cla@ceub.edu.br", "Clara Dias")))
        self.assertEqual(outra.post(f"{self.url}/aceitar/").status_code, 404)

    def test_recusar_nao_avisa_e_nao_deixa_insistir(self):
        self.assertEqual(self.c_bia.post(f"{self.url}/recusar/").status_code, 200)
        self.assertEqual(self.c_bia.get("/api/conversas/conexoes/").data, [])
        # quem pediu continua vendo "enviada" e sem notificação de recusa
        self.assertEqual(self.buscar(self.c_ana, "Bia")[0]["relacao"], "enviada")
        self.assertEqual(self.c_ana.get("/api/conversas/conexoes/", {"tipo": "enviadas"}).data[0]["status"], "pendente")
        self.assertEqual(Notificacao.objects.filter(usuaria=self.ana).count(), 0)
        # tentar de novo não cria outro pedido nem outro aviso
        self.pedir(self.c_ana, self.bia)
        self.assertEqual(Conexao.objects.count(), 1)
        self.assertEqual(Notificacao.objects.filter(usuaria=self.bia).count(), 1)
        self.assertEqual(self.c_bia.post(f"{self.url}/aceitar/").status_code, 400)

    def test_conversa_so_existe_depois_do_aceite(self):
        self.assertEqual(Conversa.objects.count(), 0)
        self.assertEqual(self.conversas(self.c_ana), [])
