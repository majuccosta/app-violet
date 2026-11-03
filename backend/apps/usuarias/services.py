"""Regras de negócio de usuárias (camada BusinessLogic)."""
import hashlib
import hmac
import time

from django.conf import settings
from django.core.mail import send_mail

from .models import VerificacaoIdentidade


def verificar_documento(usuaria, frente, verso, tipo="rg"):
    """Envia as imagens para a API Didit e registra o resultado.

    TODO (integrações): implementar a chamada real à Didit usando settings.DIDIT_API_KEY.
    Enquanto isso, a verificação fica 'pendente', e só é aprovada automaticamente com VERIFICACAO_DEMO=True (demonstração).
    """
    status = VerificacaoIdentidade.Status.APROVADA if settings.VERIFICACAO_DEMO else VerificacaoIdentidade.Status.PENDENTE
    verificacao = VerificacaoIdentidade.objects.create(usuaria=usuaria, tipo_documento=tipo, status=status)
    if status == VerificacaoIdentidade.Status.APROVADA:
        usuaria.verificada = True
        usuaria.save(update_fields=["verificada"])
    # As imagens NÃO são guardadas no Violet: só seguem para o provedor de verificação.
    return verificacao


# ---------- Recuperação de senha (sem tabela extra) ----------
# O código de 6 dígitos é um HMAC do e-mail + hash da senha atual + janela de 15 min.
# Quando a senha muda, o hash muda e o código antigo deixa de valer (uso único).
JANELA_CODIGO = 15 * 60


def _codigo(usuaria, janela):
    msg = f"{usuaria.pk}:{usuaria.email}:{usuaria.password}:{janela}".encode()
    digest = hmac.new(settings.SECRET_KEY.encode(), msg, hashlib.sha256).hexdigest()
    return f"{int(digest[:10], 16) % 1_000_000:06d}"


def _janela_atual():
    return int(time.time() // JANELA_CODIGO)


def codigo_valido(usuaria, codigo):
    atual = _janela_atual()
    return any(hmac.compare_digest(_codigo(usuaria, j), str(codigo)) for j in (atual, atual - 1))


def enviar_codigo_recuperacao(usuaria):
    """TODO (integrações): trocar o backend de e-mail por SMTP/serviço real.
    Em desenvolvimento o e-mail aparece no terminal do runserver."""
    send_mail(
        "Violet — código para redefinir sua senha",
        f"Seu código é {_codigo(usuaria, _janela_atual())}. Ele vale por 15 minutos.",
        None, [usuaria.email], fail_silently=True,
    )
