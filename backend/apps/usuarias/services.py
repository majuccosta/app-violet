"""Regras de negócio de usuárias (camada BusinessLogic)."""
import hashlib
import hmac
import json
import logging
import time
from urllib.parse import urlsplit

from django.conf import settings
from django.core.mail import send_mail

from . import didit, google, ibge
from .models import Preferencias, Usuaria, VerificacaoIdentidade

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


_MINUSCULAS = {"de", "da", "do", "das", "dos", "e", "di", "du", "van", "von", "la", "le"}


def nome_legivel(nome):
    """'MARIA JÚLIA DE CARVALHO COSTA' -> 'Maria Júlia de Carvalho Costa' (documentos vêm em maiúsculas)."""
    partes = str(nome or "").split()
    return " ".join(p.lower() if i and p.lower() in _MINUSCULAS else p[:1].upper() + p[1:].lower()
                    for i, p in enumerate(partes))


def _exigir_mulher():
    """O Violet é um app só para mulheres: por padrão, a verificação confere o gênero do documento."""
    return getattr(settings, "DIDIT_EXIGIR_MULHER", True)


def _aceitar_sem_genero():
    """Alguns documentos (ex.: CNH) não trazem o gênero. Por padrão, nesse caso a verificação segue aprovada."""
    return getattr(settings, "DIDIT_ACEITAR_SEM_GENERO", True)


def _usar_nome_ibge():
    """Quando o documento não informa o gênero, estima pelo primeiro nome (base do IBGE)."""
    return getattr(settings, "VERIFICACAO_USAR_NOME_IBGE", True)


def _avaliar(status_didit, decisao):
    """Status final no Violet, somando o resultado da Didit e a regra 'só mulheres'.
    Devolve (status, conferencia). Status: 'aprovada', 'reprovada' ou 'pendente' (pendente = aguarda revisão de
    uma administradora). Conferencia: passo a passo da checagem de gênero/nome (o app mostra isso na tela), ou
    None quando a Didit ainda não aprovou ou a regra está desligada."""
    novo = didit.traduzir_status(status_didit)
    if novo != VerificacaoIdentidade.Status.APROVADA or not _exigir_mulher():
        return novo, None
    genero = didit.genero_do_documento(decisao)
    nome_doc = didit.nome_do_documento(decisao)
    primeiro = nome_doc.split()[0].capitalize() if nome_doc.split() else ""
    conf = {"genero_documento": genero, "nome": primeiro, "metodo": "documento", "classe": None, "pct_feminino": None}

    def fim(status):
        conf["resultado"] = str(getattr(status, "value", status))
        return status, conf

    if genero == "F":
        return fim(novo)
    if genero == "M":
        log.info("Didit: documento masculino; verificação recusada (app só para mulheres).")
        return fim(VerificacaoIdentidade.Status.REPROVADA)
    # O documento não informa o gênero (ex.: CNH).
    if _usar_nome_ibge():
        conf["metodo"] = "ibge"
        try:
            a_ = ibge.analisar_nome(nome_doc, limite=getattr(settings, "IBGE_LIMITE", 0.98),
                                    minimo=getattr(settings, "IBGE_MINIMO", 1000))
        except ibge.IbgeErro as e:
            log.warning("IBGE: não consegui conferir o nome; verificação segue pendente: %s", e)
            conf["metodo"] = "indisponivel"
            return fim(VerificacaoIdentidade.Status.PENDENTE)
        conf["classe"], conf["pct_feminino"] = a_["classe"], a_["pct_feminino"]
        if a_["classe"] == "F":
            return fim(novo)
        if a_["classe"] == "M":
            log.info("Nome claramente masculino em documento sem gênero; verificação recusada.")
            return fim(VerificacaoIdentidade.Status.REPROVADA)
        return fim(VerificacaoIdentidade.Status.PENDENTE)      # ambíguo: revisão manual
    conf["metodo"] = "nenhum"
    return fim(novo if _aceitar_sem_genero() else VerificacaoIdentidade.Status.REPROVADA)


def aplicar_status(verificacao, status_didit, decisao=None):
    """Atualiza a verificação (e a usuária) com o status da Didit. Uma verificação aprovada nunca volta atrás.
    Se a Didit aprovou e ainda não temos a decisão completa, busca para conferir o gênero do documento;
    se não conseguir buscar, a verificação continua pendente (nunca aprova às cegas)."""
    if verificacao.status == VerificacaoIdentidade.Status.APROVADA:
        return verificacao
    if (didit.traduzir_status(status_didit) == VerificacaoIdentidade.Status.APROVADA and _exigir_mulher()
            and decisao is None):
        try:
            decisao = didit.consultar_decisao(settings.DIDIT_API_KEY, verificacao.id_sessao_didit)
        except didit.DiditErro as e:
            log.warning("Didit: não consegui conferir o gênero da sessão %s: %s", verificacao.id_sessao_didit, e)
            return verificacao
    novo, verificacao.conferencia = _avaliar(status_didit, decisao)
    if novo != verificacao.status:
        verificacao.status = novo
        verificacao.save(update_fields=["status"])
    if novo == VerificacaoIdentidade.Status.APROVADA:
        usuaria = verificacao.usuaria
        usuaria.verificada = True
        campos = ["verificada"]
        # Depois de verificada, o nome é o do DOCUMENTO (não o do e-mail/Google).
        # A data de nascimento NÃO é copiada: a leitura do documento falha com frequência; vale a do cadastro.
        nome = nome_legivel(didit.nome_completo_do_documento(decisao))[:150]
        if nome:
            usuaria.nome_completo = nome
            campos.append("nome_completo")
        usuaria.save(update_fields=campos)
    return verificacao


def sincronizar(usuaria):
    """Última verificação da usuária. Se ainda estiver pendente, pergunta à Didit como ela está."""
    v = usuaria.verificacoes.order_by("-criado_em", "-id").first()
    if v and v.status == VerificacaoIdentidade.Status.PENDENTE and v.id_sessao_didit and didit_ativo():
        try:
            decisao = didit.consultar_decisao(settings.DIDIT_API_KEY, v.id_sessao_didit)
            aplicar_status(v, decisao.get("status"), decisao)
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


# ---------- Entrar com Google ----------
def google_ativo():
    return bool(getattr(settings, "GOOGLE_CLIENT_ID", ""))


def entrar_com_google(credencial):
    """Confere o token do Google e devolve a usuária (cria a conta na primeira vez).
    A conta nova entra SEM verificação de identidade: ela ainda passa pela Didit (e pela regra 'só mulheres')."""
    info = google.verificar_credencial(credencial, getattr(settings, "GOOGLE_CLIENT_ID", ""))
    email = info["email"]
    permitidos = [d.strip().lower().lstrip("@") for d in getattr(settings, "GOOGLE_DOMINIOS_PERMITIDOS", []) if d.strip()]
    if permitidos and email.rsplit("@", 1)[-1] not in permitidos:
        raise google.GoogleErro("Use o e-mail da sua instituição para entrar com o Google.", "dominio")
    usuaria = Usuaria.objects.filter(email__iexact=email).first()
    if usuaria:
        if not usuaria.is_active:
            raise google.GoogleErro("Esta conta está desativada.", "dominio")
        return usuaria
    usuaria = Usuaria(username=email, email=email, nome_completo=(info["nome"] or email.split("@")[0])[:150])
    usuaria.set_unusable_password()      # entra sempre pelo Google; pode definir senha depois em "Esqueci minha senha"
    usuaria.save()
    Preferencias.objects.create(usuaria=usuaria)
    return usuaria
