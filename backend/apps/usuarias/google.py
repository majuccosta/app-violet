"""Login com Google — confere o 'credential' (ID token) que o botão do Google entrega ao app.

Fica separado do Django de propósito (testa sem banco) e usa só a biblioteca padrão.
O Google confere a assinatura do token no endereço 'tokeninfo'; aqui conferimos para quem o token foi emitido
(o nosso Client ID), se o e-mail foi verificado pelo Google e, se configurado, o domínio do e-mail.
Documentação: https://developers.google.com/identity/gsi/web/guides/verify-google-id-token"""
import json
import time
import urllib.error
import urllib.parse
import urllib.request

URL_TOKENINFO = "https://oauth2.googleapis.com/tokeninfo"
EMISSORES = ("accounts.google.com", "https://accounts.google.com")


class GoogleErro(Exception):
    """A entrada com Google não pôde ser concluída. `codigo`: 'invalido' | 'dominio' | 'indisponivel'."""

    def __init__(self, mensagem, codigo="invalido"):
        super().__init__(mensagem)
        self.codigo = codigo


def verificar_credencial(credencial, client_id, agora=None, abrir=urllib.request.urlopen):
    """Devolve {'email', 'nome', 'foto'} do token, ou levanta GoogleErro."""
    if not client_id:
        raise GoogleErro("Login com Google não está configurado.", "indisponivel")
    if not credencial or not isinstance(credencial, str) or len(credencial) > 4096:
        raise GoogleErro("Credencial do Google ausente ou inválida.")
    url = f"{URL_TOKENINFO}?{urllib.parse.urlencode({'id_token': credencial})}"
    req = urllib.request.Request(url, headers={"Accept": "application/json", "User-Agent": "Violet/1.0"})
    try:
        with abrir(req, timeout=10) as resp:
            dados = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:      # 400 = token inválido, vencido ou adulterado
        raise GoogleErro("O Google não reconheceu essa entrada. Tente de novo.") from e
    except (urllib.error.URLError, TimeoutError, ValueError, OSError) as e:
        raise GoogleErro("Não foi possível falar com o Google agora. Tente novamente.", "indisponivel") from e

    if dados.get("aud") != client_id:
        raise GoogleErro("Essa entrada não foi emitida para o Violet.")
    if dados.get("iss") not in EMISSORES:
        raise GoogleErro("Emissor do token inválido.")
    try:
        if float(dados.get("exp", 0)) < (agora if agora is not None else time.time()):
            raise GoogleErro("A entrada com Google expirou. Tente de novo.")
    except (TypeError, ValueError) as e:
        raise GoogleErro("Token do Google inválido.") from e
    email = str(dados.get("email") or "").strip().lower()
    if not email or str(dados.get("email_verified")).lower() != "true":
        raise GoogleErro("O e-mail dessa conta Google não está verificado.")
    return {"email": email, "nome": str(dados.get("name") or "").strip(), "foto": dados.get("picture") or ""}
