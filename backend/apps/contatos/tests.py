from django.test import TestCase

from apps.comum.testes import cliente_logado, criar_usuaria


def contato(i):
    return {"nome": f"Contato {i}", "telefone": f"6199999000{i}", "relacao": "Amiga", "de_confianca": True}


class ContatoTests(TestCase):
    def test_maximo_de_cinco_contatos_de_confianca(self):
        c = cliente_logado(criar_usuaria())
        for i in range(5):
            self.assertEqual(c.post("/api/contatos/", contato(i), format="json").status_code, 201)
        self.assertEqual(c.post("/api/contatos/", contato(6), format="json").status_code, 400)

    def test_contato_de_confianca_exige_relacao(self):
        c = cliente_logado(criar_usuaria())
        r = c.post("/api/contatos/", {"nome": "Sem relação", "telefone": "61999990000", "de_confianca": True}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_nao_ve_contato_de_outra_usuaria(self):
        a, b = criar_usuaria("a@ceub.edu.br", "Ana"), criar_usuaria("b@ceub.edu.br", "Bia")
        cliente_logado(a).post("/api/contatos/", contato(1), format="json")
        self.assertEqual(len(cliente_logado(b).get("/api/contatos/").data["results"]), 0)
