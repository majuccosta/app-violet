"""A rota /api/saude/ responde sem login (usada pelo UptimeRobot para manter a API acordada)."""
from django.test import TestCase


class SaudeTests(TestCase):
    def test_responde_200_sem_login(self):
        r = self.client.get("/api/saude/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json(), {"status": "ok"})
