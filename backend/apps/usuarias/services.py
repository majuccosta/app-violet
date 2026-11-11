"""Regras de negócio de usuárias (camada BusinessLogic)."""
import hashlib
import hmac
import json
import logging
import time
from urllib.parse import urlsplit

from django.conf import settings
from django.core.mail import send_mail

from . import didit
from .models import VerificacaoIdentidade

log = logging.getLogger(__name__)


def verificar_documento(usuaria, frente, verso, tipo="rg"):
    """MODO DEMONSTRAÇÃO (sem Didit configurada): registra a verificação sem analisar as imagens.
    Fica 'pendente', e só é aprovada automaticamente com VERIFICACAO_DEMO=True.
    Com a Didit configurada (didit_ativo), a verificação real é feita por iniciar_verificacao()."""
    status = VerificacaoIdentidade.Status.APROVADA if settings.VERIFICACAO_DEMO else VerificacaoIdentidade.Status.PENDENTE
    verificacao = VerificacaoIdentidade.objects.create(usuaria=usuaria, tipo_documento=tipo, status=status)
    if status == VerificacaoIdentidade.Status.APROVADA:
        usuaria.verificada = True
        usuaria.save(update_fields=["verificada"])
    # As imagens NÃO são guardadas no Violet: só seguem para o provedor de verificação.
    return verificacao


# ---------- Verificação de identidade real (Didit) ----------
# Fluxo: o app pede /verificacao/iniciar/ -> criamos uma sessão na Didit -> a usuária fotografa o documento e faz a
# selfie na página da Didit -> a Didit nos avisa (webhook) e/ou o app pergunta (/verificacao/status/).
# As imagens ficam só na Didit; o Violet guarda apenas o status e o id da sessão.
def didit_ativo():
    return bool(settings.DIDIT_API_KEY and settings.DIDIT_WORKFLOW_ID)


def _retorno_permitido(url):
    """Para onde a Didit devolve a usuária: DIDIT_CALLBACK_URL, ou o endereço do próprio app (se for um dos permitidos)."""
    if settings.DIDIT_CALLBACK_URL:
        return settings.DIDIT_CALLBACK_URL
    if not url:
        return None
    partes = urlsplit(str(url))
    return url if f"{partes.scheme}://{partes.netloc}" in settings.CORS_ALLOWED_ORIGINS else None


def iniciar_verificacao(usuaria, retorno=None):
    """Devolve {'modo': 'demo'} (sem Didit) ou {'modo': 'didit', 'url': ...} para onde enviar a usuária."""
    if not didit_ativo():
        return {"modo": "demo"}
    sessao = didit.criar_sessao(
        settings.DIDIT_API_KEY, settings.DIDIT_WORKFLOW_ID, usuaria.pk,
        callback=_retorno_permitido(retorno), metadata={"origem": "violet"},
    )
    VerificacaoIdentidade.objects.create(
        usuaria=usuaria, status=VerificacaoIdentidade.Status.PENDENTE, id_sessao_didit=sessao["session_id"],
    )
    return {"modo": "didit", "url": sessao["url"]}


def aplicar_status(verificacao, status_didit):
    """Atualiza a verificação (e a usuária) com o status da Didit. Uma verificação aprovada nunca volta atrás."""
    if verificacao.status == VerificacaoIdentidade.Status.APROVADA:
        return verificacao
    novo = didit.traduzir_status(status_didit)
    if novo != verificacao.status:
        verificacao.status = novo
        verificacao.save(update_fields=["status"])
    if novo == VerificacaoIdentidade.Status.APROVADA:
        verificacao.usuaria.verificada = True
        verificacao.usuaria.save(update_fields=["verificada"])
    return verificacao


def sincronizar(usuaria):
    """Última verificação da usuária. Se ainda estiver pendente, pergunta à Didit como ela está."""
    v = usuaria.verificacoes.order_by("-criado_em", "-id").first()
    if v and v.status == VerificacaoIdentidade.Status.PENDENTE and v.id_sessao_didit and didit_ativo():
        try:
            aplicar_status(v, didit.consultar_decisao(settings.DIDIT_API_KEY, v.id_sessao_didit).get("status"))
        except didit.DiditErro as e:
            log.warning("Didit: não consegui consultar a sessão %s: %s", v.id_sessao_didit, e)
    return v


def processar_webhook(corpo_bytes, assinatura, timestamp):
    """Recebe o aviso da Didit. Devolve False se a assinatura não confere (aviso falso ou antigo)."""
    if not didit.assinatura_valida(corpo_bytes, assinatura, timestamp, settings.DIDIT_WEBHOOK_SECRET):
        return False
    dados = json.loads(corpo_bytes)
    v = VerificacaoIdentidade.objects.filter(id_sessao_didit=dados.get("session_id") or "").first()
    if v and dados.get("status"):
        aplicar_status(v, dados["status"])
    return True


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
