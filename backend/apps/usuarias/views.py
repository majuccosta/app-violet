import logging

from django.core.mail import send_mail
from django.db.models import ProtectedError
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from .serializers import (
    AlterarEmailSerializer, AlterarSenhaSerializer, CadastroSerializer, ExcluirContaSerializer, NovaSenhaSerializer,
    RecuperarSenhaSerializer, UsuariaSerializer, VerificacaoSerializer, VerificarCodigoSerializer,
)
from .models import Usuaria
from .didit import DiditErro
from .google import GoogleErro
from .services import (
    codigo_valido, didit_ativo, entrar_com_google, enviar_codigo_recuperacao, google_ativo, iniciar_verificacao,
    processar_webhook, sincronizar, verificar_documento,
)

log = logging.getLogger(__name__)


class CadastroView(generics.CreateAPIView):
    """POST /api/auth/cadastro/"""
    serializer_class = CadastroSerializer
    authentication_classes = []   # não valida token enviado (um token vencido não deve bloquear)
    permission_classes = [permissions.AllowAny]


class GoogleLoginView(APIView):
    """POST /api/auth/google/  {credential} -> {access, refresh}  (cria a conta na primeira entrada)"""
    authentication_classes = []
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        if not google_ativo():
            return Response({"detail": "Login com Google não está disponível no momento."},
                            status=status.HTTP_503_SERVICE_UNAVAILABLE)
        try:
            usuaria = entrar_com_google(request.data.get("credential"))
        except GoogleErro as e:
            codigo = {"dominio": status.HTTP_403_FORBIDDEN, "indisponivel": status.HTTP_502_BAD_GATEWAY}.get(
                e.codigo, status.HTTP_400_BAD_REQUEST)
            log.warning("Google: entrada recusada (%s): %s", e.codigo, e)
            return Response({"detail": str(e)}, status=codigo)
        refresh = RefreshToken.for_user(usuaria)
        return Response({"access": str(refresh.access_token), "refresh": str(refresh)})


class MeView(generics.RetrieveUpdateAPIView):
    """GET/PATCH /api/usuarias/me/"""
    serializer_class = UsuariaSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user


class AlterarSenhaView(APIView):
    """POST /api/usuarias/me/senha/  {senha_atual, senha_nova}"""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        ser = AlterarSenhaSerializer(data=request.data, context={"request": request})
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response({"ok": True})


class AlterarEmailView(APIView):
    """POST /api/usuarias/me/email/  {email, senha} — só para contas com senha. Contas criadas com o Google usam
    sempre o e-mail do Google (é por ele que o Google as reconhece)."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        u = request.user
        if not u.has_usable_password():
            return Response({"detail": "Você entrou com o Google, então o e-mail da conta é sempre o do Google."},
                            status=status.HTTP_403_FORBIDDEN)
        ser = AlterarEmailSerializer(data=request.data, context={"request": request})
        ser.is_valid(raise_exception=True)
        antigo, novo = u.email, ser.validated_data["email"]
        if novo != antigo.lower():
            u.email = u.username = novo
            u.save(update_fields=["email", "username"])
            # aviso para o e-mail antigo: se não foi ela, percebe na hora
            send_mail("Violet — seu e-mail foi alterado",
                      f"O e-mail da sua conta no Violet foi trocado para {novo}. "
                      "Se não foi você, redefina sua senha em Esqueceu sua senha? e fale com o suporte.",
                      None, [antigo], fail_silently=True)
        return Response({"email": u.email})


class ExcluirContaView(APIView):
    """POST /api/usuarias/me/excluir/  {senha} — apaga a conta e tudo que está ligado a ela (CASCADE)."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        ser = ExcluirContaSerializer(data=request.data, context={"request": request})
        ser.is_valid(raise_exception=True)
        u = request.user
        try:
            u.delete()
        except ProtectedError:
            # Denúncias registradas não podem sumir (apuração institucional): a conta é
            # desativada e os dados pessoais são apagados, mas o vínculo interno fica.
            u.is_active = False
            u.email = f"removida-{u.pk}@violet.invalid"
            u.username = u.email
            u.nome_completo = "Conta removida"
            u.telefone = u.cep = u.logradouro = u.numero = u.complemento = u.bairro = u.cidade = u.uf = ""
            u.data_nascimento = None
            u.set_unusable_password()
            u.save()
        return Response(status=status.HTTP_204_NO_CONTENT)


class VerificacaoView(APIView):
    """POST /api/usuarias/verificacao/ (multipart: documento_frente, documento_verso)"""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        if didit_ativo():   # com a Didit ligada, ninguém pode pular a verificação real por este caminho
            return Response({"detail": "Use a verificação de identidade pela Didit."}, status=status.HTTP_409_CONFLICT)
        ser = VerificacaoSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        v = verificar_documento(
            request.user,
            ser.validated_data["documento_frente"],
            ser.validated_data["documento_verso"],
            ser.validated_data.get("tipo_documento", "rg"),
        )
        return Response({"id": v.id, "status": v.status}, status=status.HTTP_201_CREATED)


class VerificacaoIniciarView(APIView):
    """POST /api/usuarias/verificacao/iniciar/  {retorno?}
    -> {modo: 'demo'} | {modo: 'didit', url} | {modo: 'ja_verificada'}"""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        if request.user.verificada:
            return Response({"modo": "ja_verificada"})
        try:
            return Response(iniciar_verificacao(request.user, request.data.get("retorno")))
        except DiditErro as e:
            log.warning("Didit: falha ao criar sessão: %s", e)
            return Response({"detail": "Não foi possível iniciar a verificação agora. Tente novamente em instantes."},
                            status=status.HTTP_502_BAD_GATEWAY)


class VerificacaoStatusView(APIView):
    """GET /api/usuarias/verificacao/status/ -> {verificada, status, modo}. O app consulta isto ao voltar da Didit."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        v = sincronizar(request.user)
        request.user.refresh_from_db(fields=["verificada"])
        situacao = v.status if v else ("aprovada" if request.user.verificada else "pendente")
        return Response({"verificada": request.user.verificada, "status": situacao,
                         "modo": "didit" if didit_ativo() else "demo",
                         # passo a passo da conferência do gênero/nome (só vem no momento em que a Didit aprova)
                         "conferencia": getattr(v, "conferencia", None)})


class DiditWebhookView(APIView):
    """POST /api/usuarias/verificacao/webhook/ — aviso da Didit (confere a assinatura X-Signature-V2)."""
    authentication_classes = []
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        ok = processar_webhook(request.body, request.headers.get("X-Signature-V2", ""), request.headers.get("X-Timestamp", ""))
        return Response({"ok": True}) if ok else Response(status=status.HTTP_401_UNAUTHORIZED)


class RecuperarSenhaView(APIView):
    """POST /api/auth/recuperar-senha/ — sempre responde igual, para não revelar quais e-mails existem."""
    authentication_classes = []   # não valida token enviado (um token vencido não deve bloquear)
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        ser = RecuperarSenhaSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        usuaria = Usuaria.objects.filter(email__iexact=ser.validated_data["destino"], is_active=True).first()
        if usuaria:
            enviar_codigo_recuperacao(usuaria)
        return Response({"enviado": True})


class VerificarCodigoView(APIView):
    """POST /api/auth/verificar-codigo/ — {destino, codigo} -> {valido}"""
    authentication_classes = []   # não valida token enviado (um token vencido não deve bloquear)
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        ser = VerificarCodigoSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        usuaria = Usuaria.objects.filter(email__iexact=ser.validated_data["destino"]).first()
        return Response({"valido": bool(usuaria and codigo_valido(usuaria, ser.validated_data["codigo"]))})


class NovaSenhaView(APIView):
    """POST /api/auth/nova-senha/ — {destino, codigo, senha}"""
    authentication_classes = []   # não valida token enviado (um token vencido não deve bloquear)
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        ser = NovaSenhaSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        d = ser.validated_data
        usuaria = Usuaria.objects.filter(email__iexact=d["destino"]).first()
        if not (usuaria and codigo_valido(usuaria, d["codigo"])):
            return Response({"detail": "Código inválido ou expirado."}, status=status.HTTP_400_BAD_REQUEST)
        usuaria.set_password(d["senha"])
        usuaria.save(update_fields=["password"])
        return Response({"ok": True})
