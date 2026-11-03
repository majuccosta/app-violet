from django.db.models import ProtectedError
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .serializers import (
    AlterarSenhaSerializer, CadastroSerializer, ExcluirContaSerializer, NovaSenhaSerializer,
    RecuperarSenhaSerializer, UsuariaSerializer, VerificacaoSerializer, VerificarCodigoSerializer,
)
from .models import Usuaria
from .services import codigo_valido, enviar_codigo_recuperacao, verificar_documento


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
        ser = VerificacaoSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        v = verificar_documento(
            request.user,
            ser.validated_data["documento_frente"],
            ser.validated_data["documento_verso"],
            ser.validated_data.get("tipo_documento", "rg"),
        )
        return Response({"id": v.id, "status": v.status}, status=status.HTTP_201_CREATED)


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
