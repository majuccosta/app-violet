from django.test import TestCase

from apps.comum.testes import cliente_logado, criar_usuaria
from apps.contatos.models import ContatoConfianca
from apps.notificacoes.models import Notificacao


class AlertaTests(TestCase):
    def test_alerta_avisa_so_contatos_de_confianca(self):
        u = criar_usuaria()
        ContatoConfianca.objects.create(usuaria=u, nome="Mãe", telefone="61999990001", relacao="Mãe")
        ContatoConfianca.objects.create(usuaria=u, nome="Colega", telefone="61999990002", de_confianca=False,
                                        recebe_alertas=False, compartilha_localizacao=False)
        r = cliente_logado(u).post("/api/emergencia/alertas/", {}, format="json")
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.data["contatos_notificados"], 1)
        self.assertTrue(Notificacao.objects.filter(usuaria=u).exists())
