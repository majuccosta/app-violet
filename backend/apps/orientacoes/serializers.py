from rest_framework import serializers

from .models import Orientacao


class OrientacaoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Orientacao
        fields = "__all__"
