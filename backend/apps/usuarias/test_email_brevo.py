"""Testes do envio de e-mail pela Brevo (sem internet). Rode: python manage.py test apps.usuarias.test_email_brevo"""
import json
import urllib.error
from unittest import mock

from django.core import mail
from django.core.mail import EmailMessage
from django.test import SimpleTestCase, override_settings

from apps.usuarias.email_brevo import BrevoEmailBackend


class FalsaResposta:
    def __enter__(self): return self
    def __exit__(self, *a): return False
    def read(self): return b"{}"


@override_settings(BREVO_API_KEY="chave-brevo", DEFAULT_FROM_EMAIL="Violet <violet@exemplo.com>")
class BrevoTests(SimpleTestCase):
    def msg(self):
        return EmailMessage("Código", "Seu código é 123456", None, ["ana@ceub.edu.br"])

    def test_envia_pela_api_com_os_campos_certos(self):
        with mock.patch("urllib.request.urlopen", return_value=FalsaResposta()) as abrir:
            n = BrevoEmailBackend().send_messages([self.msg()])
        self.assertEqual(n, 1)
        req = abrir.call_args.args[0]
        self.assertEqual(req.full_url, "https://api.brevo.com/v3/smtp/email")
        self.assertEqual(req.get_header("Api-key"), "chave-brevo")
        corpo = json.loads(req.data)
        self.assertEqual(corpo["sender"], {"name": "Violet", "email": "violet@exemplo.com"})
        self.assertEqual(corpo["to"], [{"email": "ana@ceub.edu.br"}])
        self.assertEqual((corpo["subject"], corpo["textContent"]), ("Código", "Seu código é 123456"))

    def test_falha_silenciosa_nao_levanta_erro(self):
        erro = urllib.error.HTTPError("u", 401, "x", {}, None)
        with mock.patch("urllib.request.urlopen", side_effect=erro):
            self.assertEqual(BrevoEmailBackend(fail_silently=True).send_messages([self.msg()]), 0)

    def test_sem_fail_silently_levanta_erro(self):
        with mock.patch("urllib.request.urlopen", side_effect=urllib.error.URLError("sem rede")):
            with self.assertRaises(Exception):
                BrevoEmailBackend().send_messages([self.msg()])

    @override_settings(EMAIL_BACKEND="apps.usuarias.email_brevo.BrevoEmailBackend")
    def test_send_mail_usa_o_backend(self):
        with mock.patch("urllib.request.urlopen", return_value=FalsaResposta()) as abrir:
            mail.send_mail("Oi", "texto", None, ["a@b.com"], fail_silently=True)
        self.assertEqual(abrir.call_count, 1)
