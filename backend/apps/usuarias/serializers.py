from datetime import date

from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from .models import Preferencias, Usuaria, VerificacaoIdentidade

IDADE_MINIMA = 16


def validar_nascimento(valor):
    """Mesmas regras no cadastro e na tela Minha conta."""
    hoje = date.today()
    idade = hoje.year - valor.year - ((hoje.month, hoje.day) < (valor.month, valor.day))
    if valor > hoje:
        raise serializers.ValidationError("A data de nascimento não pode estar no futuro.")
    if idade < IDADE_MINIMA:
        raise serializers.ValidationError(f"É preciso ter pelo menos {IDADE_MINIMA} anos para usar o Violet.")
    if idade > 100:
        raise serializers.ValidationError("Informe uma data de nascimento válida.")
    return valor


class PreferenciasSerializer(serializers.ModelSerializer):
    class Meta:
        model = Preferencias
        exclude = ["id", "usuaria"]


class UsuariaSerializer(serializers.ModelSerializer):
    preferencias = PreferenciasSerializer(required=False)
    # False = conta criada com o Google (não tem senha): o e-mail dela é sempre o do Google
    tem_senha = serializers.SerializerMethodField()

    class Meta:
        model = Usuaria
        fields = [
            "id", "nome_completo", "apelido", "email", "telefone", "data_nascimento", "verificada", "modo_anonimo", "preferencias",
            "cep", "logradouro", "numero", "complemento", "bairro", "cidade", "uf", "tem_senha",
        ]
        read_only_fields = ["id", "email", "verificada", "tem_senha"]

    def validate_apelido(self, valor):
        valor = " ".join(str(valor or "").split())
        if len(valor) > 30:
            raise serializers.ValidationError("Use no máximo 30 caracteres.")
        return valor

    def get_tem_senha(self, obj):
        return obj.has_usable_password()

    def validate_data_nascimento(self, valor):
        return validar_nascimento(valor) if valor else valor

    def validate_cep(self, value):
        digitos = "".join(c for c in value if c.isdigit())
        if value and len(digitos) != 8:
            raise serializers.ValidationError("CEP inválido.")
        return f"{digitos[:5]}-{digitos[5:]}" if digitos else ""

    def validate_uf(self, value):
        return value.upper()

    def validate(self, attrs):
        # Depois da verificação, o nome vem do documento e não muda.
        if self.instance and self.instance.verificada:
            if "nome_completo" in attrs and attrs["nome_completo"] != self.instance.nome_completo:
                raise serializers.ValidationError({"nome_completo": "Vem do seu documento verificado e não pode ser alterado."})
        # A data de nascimento só pode ser informada uma vez (no cadastro, ou na tela "Complete seu cadastro" de quem entra
        # pelo Google). Depois de preenchida, só o suporte/admin corrige.
        if self.instance and self.instance.data_nascimento and "data_nascimento" in attrs \
                and attrs["data_nascimento"] != self.instance.data_nascimento:
            raise serializers.ValidationError(
                {"data_nascimento": "A data de nascimento não pode ser alterada. Se estiver errada, fale com o suporte."})
        return attrs

    def update(self, instance, validated_data):
        prefs = validated_data.pop("preferencias", None)
        if prefs:
            Preferencias.objects.update_or_create(usuaria=instance, defaults=prefs)
        return super().update(instance, validated_data)


class AlterarSenhaSerializer(serializers.Serializer):
    senha_atual = serializers.CharField(write_only=True)
    senha_nova = serializers.CharField(write_only=True)

    def validate_senha_atual(self, value):
        if not self.context["request"].user.check_password(value):
            raise serializers.ValidationError("Senha atual incorreta.")
        return value

    def validate_senha_nova(self, value):
        validate_password(value, user=self.context["request"].user)
        return value

    def validate(self, attrs):
        if attrs["senha_atual"] == attrs["senha_nova"]:
            raise serializers.ValidationError({"senha_nova": "A nova senha precisa ser diferente da atual."})
        return attrs

    def save(self, **kwargs):
        usuaria = self.context["request"].user
        usuaria.set_password(self.validated_data["senha_nova"])  # hash seguro (PBKDF2)
        usuaria.save(update_fields=["password"])
        return usuaria


class AlterarEmailSerializer(serializers.Serializer):
    email = serializers.EmailField()
    senha = serializers.CharField(write_only=True)

    def validate_senha(self, value):
        if not self.context["request"].user.check_password(value):
            raise serializers.ValidationError("Senha incorreta.")
        return value

    def validate_email(self, value):
        value = value.strip().lower()
        if Usuaria.objects.filter(email__iexact=value).exclude(pk=self.context["request"].user.pk).exists():
            raise serializers.ValidationError("Este e-mail já está em uso.")
        return value


class ExcluirContaSerializer(serializers.Serializer):
    senha = serializers.CharField(write_only=True, required=False, allow_blank=True)

    def validate_senha(self, value):
        usuaria = self.context["request"].user
        if not usuaria.has_usable_password():   # conta criada com Google não tem senha: o login já a identifica
            return value
        if not usuaria.check_password(value):
            raise serializers.ValidationError("Senha incorreta.")
        return value

    def validate(self, attrs):
        if self.context["request"].user.has_usable_password() and not attrs.get("senha"):
            raise serializers.ValidationError({"senha": "Informe sua senha."})
        return attrs


class CadastroSerializer(serializers.ModelSerializer):
    senha = serializers.CharField(write_only=True, validators=[validate_password])

    class Meta:
        model = Usuaria
        fields = ["nome_completo", "email", "senha", "data_nascimento"]
        extra_kwargs = {"data_nascimento": {"required": True, "allow_null": False}}

    def validate_data_nascimento(self, valor):
        return validar_nascimento(valor)

    def create(self, data):
        usuaria = Usuaria(
            username=data["email"], email=data["email"],
            nome_completo=data["nome_completo"], data_nascimento=data.get("data_nascimento"),
        )
        usuaria.set_password(data["senha"])  # hash seguro (PBKDF2)
        usuaria.save()
        Preferencias.objects.create(usuaria=usuaria)
        return usuaria


class VerificacaoSerializer(serializers.ModelSerializer):
    documento_frente = serializers.ImageField(write_only=True)
    documento_verso = serializers.ImageField(write_only=True)

    class Meta:
        model = VerificacaoIdentidade
        fields = ["id", "tipo_documento", "status", "criado_em", "documento_frente", "documento_verso"]
        read_only_fields = ["id", "status", "criado_em"]


class RecuperarSenhaSerializer(serializers.Serializer):
    destino = serializers.EmailField()


class VerificarCodigoSerializer(serializers.Serializer):
    destino = serializers.EmailField()
    codigo = serializers.CharField(min_length=6, max_length=6)


class NovaSenhaSerializer(VerificarCodigoSerializer):
    senha = serializers.CharField(write_only=True)

    def validate_senha(self, value):
        validate_password(value)
        return value
