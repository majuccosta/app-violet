from rest_framework import serializers

from .models import ContatoConfianca


class ContatoConfiancaSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContatoConfianca
        exclude = ["usuaria"]

    def validate(self, attrs):
        usuaria = self.context["request"].user
        confiavel = attrs.get("de_confianca", self.instance.de_confianca if self.instance else True)
        if confiavel:
            if not (attrs.get("relacao") or (self.instance and self.instance.relacao)):
                raise serializers.ValidationError("Informe a relação com o contato de confiança.")
            outros = usuaria.contatos.filter(de_confianca=True)
            if self.instance:
                outros = outros.exclude(pk=self.instance.pk)
            if outros.count() >= 5:
                raise serializers.ValidationError("Você pode ter no máximo 5 contatos de confiança.")
        else:
            # Contato comum não recebe alertas nem vê localização
            attrs["recebe_alertas"] = False
            attrs["compartilha_localizacao"] = False
        return attrs
