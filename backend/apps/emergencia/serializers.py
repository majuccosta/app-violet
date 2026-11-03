from rest_framework import serializers

from .models import AlertaEmergencia, MidiaAlerta


class MidiaAlertaSerializer(serializers.ModelSerializer):
    class Meta:
        model = MidiaAlerta
        fields = ["id", "tipo", "arquivo", "criado_em"]


class AlertaEmergenciaSerializer(serializers.ModelSerializer):
    midias = MidiaAlertaSerializer(many=True, read_only=True)
    contatos_notificados = serializers.IntegerField(read_only=True, required=False)

    class Meta:
        model = AlertaEmergencia
        fields = ["id", "latitude", "longitude", "status", "ligue180_acionado", "criado_em", "encerrado_em", "midias", "contatos_notificados"]
        read_only_fields = ["status", "ligue180_acionado", "criado_em", "encerrado_em"]
