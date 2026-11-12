from rest_framework import serializers

from .models import Conversa, Mensagem


class MensagemSerializer(serializers.ModelSerializer):
    autora = serializers.SerializerMethodField()
    nome = serializers.SerializerMethodField()
    hora = serializers.DateTimeField(source="criado_em", format="%H:%M", read_only=True)

    class Meta:
        model = Mensagem
        fields = ["id", "autora", "nome", "texto", "hora", "lida"]
        read_only_fields = ["lida"]

    def get_autora(self, obj):
        # O front só precisa saber se a mensagem é minha ou dela
        return "eu" if obj.autora_id == self.context["request"].user.id else "ela"

    def get_nome(self, obj):
        # Em grupos, mostra quem escreveu (só o primeiro nome; anônimas ficam anônimas)
        if obj.autora_id == self.context["request"].user.id:
            return ""
        part = obj.conversa.participantes.filter(usuaria_id=obj.autora_id).first()
        if obj.conversa.tipo == Conversa.Tipo.ANONIMA or (part and part.anonima):
            return "Usuária anônima"
        return obj.autora.nome_exibicao


class ConversaSerializer(serializers.ModelSerializer):
    ultima = serializers.SerializerMethodField()
    nao_lidas = serializers.SerializerMethodField()
    criadora = serializers.SerializerMethodField()
    participantes = serializers.SerializerMethodField()

    class Meta:
        model = Conversa
        fields = ["id", "tipo", "nome", "descricao", "cor", "membros", "criadora", "participantes",
                  "ultima", "nao_lidas", "criado_em"]
        read_only_fields = ["criado_em"]

    def validate(self, attrs):
        # Por aqui só se cria grupo de conversa (os contatos e apoios vêm de outros fluxos)
        if self.instance is None:
            if attrs.get("tipo") != Conversa.Tipo.GRUPO:
                raise serializers.ValidationError({"tipo": "Só é possível criar grupos por aqui."})
            if not (attrs.get("nome") or "").strip():
                raise serializers.ValidationError({"nome": "Dê um nome ao grupo."})
        return attrs

    def validate_cor(self, valor):
        return valor if 1 <= valor <= 4 else 1

    def validate_membros(self, valor):
        if not isinstance(valor, list) or len(valor) > 50:
            raise serializers.ValidationError("Lista de membros inválida.")
        limpa = []
        for m in valor:
            if not isinstance(m, dict) or not str(m.get("nome", "")).strip():
                raise serializers.ValidationError("Cada membro precisa de um nome.")
            limpa.append({"id": m.get("id"), "nome": str(m["nome"]).strip()[:80]})
        return limpa

    def to_representation(self, obj):
        dados = super().to_representation(obj)
        dados["nome"] = self._nome(obj)
        return dados

    def _outra(self, obj):
        eu = self.context["request"].user
        return obj.participantes.exclude(usuaria=eu).select_related("usuaria").first()

    def _nome(self, obj):
        if obj.tipo == Conversa.Tipo.GRUPO:
            return obj.nome or "Grupo"
        outra = self._outra(obj)
        if not outra:
            return "Conversa"
        # Anonimato: nunca expõe o nome de quem escolheu ficar anônima
        if outra.anonima or obj.tipo == Conversa.Tipo.ANONIMA:
            return "Usuária anônima"
        return outra.usuaria.nome_exibicao

    def get_criadora(self, obj):
        return obj.criadora_id is not None and obj.criadora_id == self.context["request"].user.id

    def get_participantes(self, obj):
        """Só para grupos: quem está no grupo além de mim. 'u12' = usuária do app, 'c7' = contato convidado."""
        if obj.tipo != Conversa.Tipo.GRUPO:
            return []
        eu = self.context["request"].user
        lista = []
        for p in obj.participantes.exclude(usuaria=eu).select_related("usuaria"):
            nome = "Usuária anônima" if p.anonima else p.usuaria.nome_exibicao
            lista.append({"id": f"u{p.usuaria_id}", "nome": nome, "tone": (p.usuaria_id % 4) + 1})
        for i, m in enumerate(obj.membros or []):
            lista.append({"id": f"c{m.get('id') if m.get('id') is not None else i}", "nome": m["nome"], "tone": (i % 4) + 1})
        return lista

    def get_ultima(self, obj):
        m = obj.mensagens.order_by("-criado_em").first()
        return m.texto[:80] if m else ""

    def get_nao_lidas(self, obj):
        eu = self.context["request"].user
        return obj.mensagens.filter(lida=False).exclude(autora=eu).count()
