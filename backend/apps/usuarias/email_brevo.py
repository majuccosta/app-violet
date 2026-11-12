"""Envio de e-mail pela API HTTP da Brevo (gratuita, ~300 e-mails/dia).

Por que não SMTP? O Render grátis bloqueia as portas de SMTP (25, 465 e 587), então Gmail/Outlook por SMTP não
funcionam lá. A API da Brevo usa HTTPS comum, que não é bloqueado. Só biblioteca padrão.
Configuração: BREVO_API_KEY e EMAIL_REMETENTE (um e-mail já confirmado na Brevo). Sem BREVO_API_KEY o app volta a
mostrar o e-mail no terminal (modo desenvolvimento)."""
import json
import logging
import urllib.error
import urllib.request
from email.utils import parseaddr

from django.conf import settings
from django.core.mail.backends.base import BaseEmailBackend

log = logging.getLogger(__name__)
URL = "https://api.brevo.com/v3/smtp/email"


class BrevoEmailBackend(BaseEmailBackend):
    def send_messages(self, email_messages):
        enviados = 0
        for msg in email_messages or []:
            try:
                self._enviar(msg)
                enviados += 1
            except Exception as e:      # nunca derruba a requisição por causa do e-mail
                log.warning("Brevo: não consegui enviar e-mail para %s: %s", msg.to, e)
                if not self.fail_silently:
                    raise
        return enviados

    def _enviar(self, msg):
        nome, email = parseaddr(msg.from_email or settings.DEFAULT_FROM_EMAIL)
        corpo = {
            "sender": {"name": nome or "Violet", "email": email},
            "to": [{"email": d} for d in msg.to],
            "subject": msg.subject,
            "textContent": msg.body,
        }
        req = urllib.request.Request(
            URL, data=json.dumps(corpo).encode("utf-8"), method="POST",
            headers={"api-key": settings.BREVO_API_KEY, "Content-Type": "application/json",
                     "Accept": "application/json", "User-Agent": "Violet/1.0"},
        )
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                resp.read()
        except urllib.error.HTTPError as e:
            detalhe = e.read().decode("utf-8", "replace")[:300] if hasattr(e, "read") else ""
            raise RuntimeError(f"Brevo respondeu {e.code}: {detalhe}") from e
