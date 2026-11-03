from datetime import date

from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from .models import Preferencias, Usuaria, VerificacaoIdentidade

IDADE_MINIMA = 16


class PreferenciasSerializer(serializers.ModelSerializer):
    class Meta:
        model = Preferencias
        exclude = ["id", "usuaria"]


class UsuariaSerializer(serializers.ModelSerializer):
    preferencias = PreferenciasSerializer(required=False)

    class Meta:
        model = Usuaria
        fields = [
            "id", "nome_completo", "email", "telefone", "data_nascimento", "verificada", "modo_anonimo", "preferencias",
            "cep", "logradouro", "numero", "complemento", "bairro", "cidade", "uf",
        ]
        read_only_fields = ["id", "email", "verificada"]

    def validate_cep(self, value):
        digitos = "".join(c for c in value if c.isdigit())
        if value and len(digitos) != 8:
            raise serializers.ValidationError("CEP inválido.")
        return f"{digitos[:5]}-{digitos[5:]}" if digitos else ""

    def validate_uf(self, value):
        return value.upper()

    def validate(self, attrs):
        # Depois da verificação, nome e data de nascimento vêm do documento e não mudam.
        if self.instance and self.instance.verificada:
            for campo in ("nome_completo", "data_nascimento"):
                if campo in attrs and attrs[campo] != getattr(self.instance, campo):
                    raise serializers.ValidationError({campo: "Vem do seu documento verificado e não pode ser alterado."})
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


class ExcluirContaSerializer(serializers.Serializer):
    senha = serializers.CharField(write_only=True)

    def validate_senha(self, value):
        if not self.context["request"].user.check_password(value):
            raise serializers.ValidationError("Senha incorreta.")
        return value


class CadastroSerializer(serializers.ModelSerializer):
    senha = serializers.CharField(write_only=True, validators=[validate_password])

    class Meta:
        model = Usuaria
        fields = ["nome_completo", "email", "senha", "data_nascimento"]
        extra_kwargs = {"data_nascimento": {"required": True, "allow_null": False}}

    def validate_data_nascimento(self, valor):
        hoje = date.today()
        idade = hoje.year - valor.year - ((hoje.month, hoje.day) < (valor.month, valor.day))
        if valor > hoje:
            raise serializers.ValidationError("A data de nascimento não pode estar no futuro.")
        if idade < IDADE_MINIMA:
            raise serializers.ValidationError(f"É preciso ter pelo menos {IDADE_MINIMA} anos para usar o Violet.")
        if idade > 100:
            raise serializers.ValidationError("Informe uma data de nascimento válida.")
        return valor

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
