from rest_framework import serializers

from .models import Notificacao


class NotificacaoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notificacao
        exclude = ["usuaria"]
        read_only_fields = ["tipo", "titulo", "texto", "criado_em"]
