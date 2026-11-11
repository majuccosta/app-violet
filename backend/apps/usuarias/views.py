import logging

from django.db.models import ProtectedError
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .serializers import (
    AlterarSenhaSerializer, CadastroSerializer, ExcluirContaSerializer, NovaSenhaSerializer,
    RecuperarSenhaSerializer, UsuariaSerializer, VerificacaoSerializer, VerificarCodigoSerializer,
)
from .models import Usuaria
from .didit import DiditErro
from .services import (
    codigo_valido, didit_ativo, enviar_codigo_recuperacao, iniciar_verificacao, processar_webhook, sincronizar,
    verificar_documento,
)

log = logging.getLogger(__name__)


class CadastroView(generics.CreateAPIView):
    """POST /api/auth/cadastro/"""
    serializer_class = CadastroSerializer
    authentication_classes = []   # não valida token enviado (um token vencido não deve bloquear)
    permission_classes = [permissions.AllowAny]


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
