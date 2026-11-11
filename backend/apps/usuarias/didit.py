"""Cliente da API Didit (verificação de identidade) — só a parte que fala com a Didit.

Fica separado do Django de propósito: assim dá para testar sem banco. Usa apenas a biblioteca padrão.
Documentação: https://docs.didit.me
"""
import hashlib
import hmac
import json
import time
import urllib.error
import urllib.request

URL_BASE = "https://verification.didit.me/v3"
TOLERANCIA_SEGUNDOS = 5 * 60   # a Didit recomenda recusar avisos com mais de 5 minutos de diferença


class DiditErro(Exception):
    """A Didit recusou o pedido ou não respondeu."""


def _chamar(metodo, caminho, api_key, corpo=None, abrir=urllib.request.urlopen):
    req = urllib.request.Request(
        f"{URL_BASE}{caminho}",
        data=json.dumps(corpo).encode("utf-8") if corpo is not None else None,
        method=metodo,
        headers={"x-api-key": api_key, "Content-Type": "application/json", "Accept": "application/json",
                 "User-Agent": "Violet/1.0"},   # sem User-Agent algumas APIs bloqueiam o pedido
    )
    try:
        with abrir(req, timeout=15) as resp:
            return json.loads(resp.read().decode("utf-8") or "{}")
    except urllib.error.HTTPError as e:
        detalhe = e.read().decode("utf-8", "replace")[:300] if hasattr(e, "read") else ""
        raise DiditErro(f"Didit respondeu {e.code}: {detalhe}") from e
    except (urllib.error.URLError, TimeoutError, ValueError) as e:
        raise DiditErro(f"Não foi possível falar com a Didit: {e}") from e


def criar_sessao(api_key, workflow_id, vendor_data, callback=None, metadata=None, abrir=urllib.request.urlopen):
    """Cria uma sessão de verificação. Devolve {'session_id', 'url', 'status', ...}.
    A usuária faz a captura do documento e da selfie na página da própria Didit (a 'url')."""
    corpo = {"workflow_id": workflow_id, "vendor_data": str(vendor_data)}
    if callback:
        corpo["callback"] = callback
    if metadata:
        corpo["metadata"] = metadata
    r = _chamar("POST", "/session/", api_key, corpo, abrir)
    if not r.get("session_id") or not r.get("url"):
        raise DiditErro("Resposta da Didit sem session_id/url.")
    return r


def consultar_decisao(api_key, session_id, abrir=urllib.request.urlopen):
    """Pergunta à Didit como está a sessão. O campo 'status' vem no nível de cima."""
    return _chamar("GET", f"/session/{session_id}/decision/", api_key, None, abrir)


def traduzir_status(status_didit):
    """Status da Didit -> status do Violet ('aprovada', 'reprovada' ou 'pendente').
    'In Review' (análise manual), 'In Progress' etc. continuam pendentes."""
    s = (status_didit or "").strip().lower()
    if s == "approved":
        return "aprovada"
    if s in ("declined", "expired", "abandoned", "kyc expired"):
        return "reprovada"
    return "pendente"


# ---------- Assinatura do webhook (X-Signature-V2) ----------
def _normalizar(valor):
    """Forma canônica pedida pela Didit: floats inteiros viram int; chaves ordenadas (feito no dumps)."""
    if isinstance(valor, float) and valor.is_integer():
        return int(valor)
    if isinstance(valor, dict):
        return {k: _normalizar(v) for k, v in valor.items()}
    if isinstance(valor, list):
        return [_normalizar(v) for v in valor]
    return valor


def assinatura_esperada(corpo_json, segredo):
    canonico = json.dumps(_normalizar(corpo_json), sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hmac.new(segredo.encode("utf-8"), canonico.encode("utf-8"), hashlib.sha256).hexdigest()


def assinatura_valida(corpo_bytes, assinatura, timestamp, segredo, agora=None):
    """Confere X-Signature-V2 e X-Timestamp. Sem segredo configurado, nunca aceita."""
    if not (segredo and assinatura and timestamp):
        return False
    try:
        if abs((agora if agora is not None else time.time()) - float(timestamp)) > TOLERANCIA_SEGUNDOS:
            return False
        corpo = json.loads(corpo_bytes)
    except (ValueError, TypeError):
        return False
    return hmac.compare_digest(assinatura_esperada(corpo, segredo), assinatura.strip().lower())
