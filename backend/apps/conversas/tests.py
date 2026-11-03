from django.test import TestCase

from apps.comum.testes import cliente_logado, criar_usuaria
from .models import Conversa, Participante


class GrupoDeConversaTests(TestCase):
    def setUp(self):
        self.ana = criar_usuaria("ana@ceub.edu.br", "Ana Souza")
        self.bia = criar_usuaria("bia@ceub.edu.br", "Bia Lima")
        self.c_ana = cliente_logado(self.ana)
        self.c_bia = cliente_logado(self.bia)

    def _criar(self):
        r = self.c_ana.post("/api/conversas/", {
            "tipo": "grupo", "nome": "Turma do bloco 9", "cor": 2,
            "membros": [{"id": 4, "nome": "Valen"}, {"id": 5, "nome": "Pam"}]}, format="json")
        self.assertEqual(r.status_code, 201, r.data)
        return r.data

    def test_criar_grupo_salva_no_banco_com_criadora(self):
        d = self._criar()
        g = Conversa.objects.get(pk=d["id"])
        self.assertEqual(g.nome, "Turma do bloco 9")
        self.assertEqual(g.criadora, self.ana)
        self.assertTrue(Participante.objects.filter(conversa=g, usuaria=self.ana).exists())
        self.assertTrue(d["criadora"])
        self.assertEqual([p["nome"] for p in d["participantes"]], ["Valen", "Pam"])

    def test_grupo_sem_nome_ou_tipo_errado_e_recusado(self):
        r = self.c_ana.post("/api/conversas/", {"tipo": "grupo", "nome": " "}, format="json")
        self.assertEqual(r.status_code, 400)
        r = self.c_ana.post("/api/conversas/", {"tipo": "contato", "nome": "x"}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_so_a_criadora_renomeia_exclui_e_remove(self):
        d = self._criar()
        Participante.objects.create(conversa_id=d["id"], usuaria=self.bia)
        url = f"/api/conversas/{d['id']}/"
        self.assertEqual(self.c_bia.patch(url, {"nome": "Hack"}, format="json").status_code, 403)
        self.assertEqual(self.c_bia.delete(url).status_code, 403)
        self.assertEqual(self.c_bia.post(url + "remover-membro/", {"membro": "c4"}, format="json").status_code, 403)
        self.assertEqual(self.c_ana.patch(url, {"nome": "Novo nome"}, format="json").status_code, 200)
        self.assertEqual(Conversa.objects.get(pk=d["id"]).nome, "Novo nome")
        r = self.c_ana.post(url + "remover-membro/", {"membro": "c4"}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertEqual([m["nome"] for m in Conversa.objects.get(pk=d["id"]).membros], ["Pam"])
        r = self.c_ana.post(url + "remover-membro/", {"membro": f"u{self.bia.id}"}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertFalse(Participante.objects.filter(conversa_id=d["id"], usuaria=self.bia).exists())
        self.assertEqual(self.c_ana.post(url + "remover-membro/", {"membro": f"u{self.ana.id}"}, format="json").status_code, 400)
        self.assertEqual(self.c_ana.delete(url).status_code, 204)
        self.assertFalse(Conversa.objects.filter(pk=d["id"]).exists())

    def test_mensagens_do_grupo(self):
        d = self._criar()
        url = f"/api/conversas/{d['id']}/mensagens/"
        self.assertEqual(self.c_ana.post(url, {"texto": "Oi, turma!"}, format="json").status_code, 201)
        r = self.c_ana.get(url)
        self.assertEqual(r.data[0]["autora"], "eu")
        self.assertEqual(self.c_bia.get(url).status_code, 404)   # quem não está no grupo não vê
