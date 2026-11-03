from rest_framework import serializers

from .models import AnaliseIA, Denuncia, Evidencia

TAMANHO_MAX = 25 * 1024 * 1024  # 25 MB
TIPOS_ACEITOS = ("image/", "audio/", "video/", "application/pdf")


class AnaliseIASerializer(serializers.ModelSerializer):
    class Meta:
        model = AnaliseIA
        fields = ["indicios", "confianca", "rotulos", "versao_modelo", "criado_em"]


class EvidenciaSerializer(serializers.ModelSerializer):
    analise = AnaliseIASerializer(read_only=True)

    class Meta:
        model = Evidencia
        fields = ["id", "tipo_mime", "tamanho_bytes", "criado_em", "analise"]


class DenunciaSerializer(serializers.ModelSerializer):
    """A usuária nunca é serializada: o relato não expõe a identidade."""
    evidencias = EvidenciaSerializer(many=True, read_only=True)
    arquivos = serializers.ListField(child=serializers.FileField(), write_only=True, required=False)
    categoria_nome = serializers.CharField(source="get_categoria_display", read_only=True)

    class Meta:
        model = Denuncia
        fields = [
            "id", "protocolo", "categoria", "categoria_nome", "envolvido", "local",
            "data_ocorrencia", "hora_ocorrencia", "descricao", "anonima", "status",
            "criado_em", "evidencias", "arquivos",
        ]
        read_only_fields = ["protocolo", "status", "criado_em"]

    def validate_arquivos(self, arquivos):
        for f in arquivos:
            if f.size > TAMANHO_MAX:
                raise serializers.ValidationError(f"{f.name} passa de 25 MB.")
            if not (f.content_type or "").startswith(TIPOS_ACEITOS):
                raise serializers.ValidationError(f"Formato de {f.name} não é aceito.")
        return arquivos
