from django.utils import timezone
from django.utils.timesince import timesince
from rest_framework import serializers

from .models import GrupoTrajeto, ParticipacaoGrupo, SolicitacaoAcompanhamento, CompartilhamentoLocalizacao


class GrupoTrajetoSerializer(serializers.ModelSerializer):
    """Devolve o grupo no formato que o front usa (ponto, participantes, membro, minha...)."""
    ponto = serializers.CharField(source="ponto_encontro", max_length=200)
    participantes = serializers.SerializerMethodField()
    membro = serializers.SerializerMethodField()
    minha = serializers.SerializerMethodField()
    compativel = serializers.SerializerMethodField()
    distancia = serializers.SerializerMethodField()

    class Meta:
        model = GrupoTrajeto
        fields = ["id", "nome", "ponto", "destino", "horario", "vagas",
                  "participantes", "membro", "minha", "compativel", "distancia", "criado_em"]
        read_only_fields = ["criado_em"]

    def _ativas(self, obj):
        # participantes() já vem carregado (prefetch); filtramos aqui para não repetir consultas
        return [p for p in obj.participantes.all() if p.saiu_em is None]

    def _eu(self):
        return self.context["request"].user

    def get_participantes(self, obj):
        eu = self._eu()
        lista = []
        for p in sorted(self._ativas(obj), key=lambda x: x.entrou_em):
            u = p.usuaria
            sou_eu = u.id == eu.id
            if sou_eu:
                nome = "Você"
            elif getattr(u, "modo_anonimo", False):
                nome = "Usuária verificada"
            else:
                nome = u.nome_exibicao
            lista.append({"id": u.id, "nome": nome, "tone": 0 if sou_eu else (u.id % 4) + 1, "eu": sou_eu})
        return lista

    def get_membro(self, obj):
        return any(p.usuaria_id == self._eu().id for p in self._ativas(obj))

    def get_minha(self, obj):
        return obj.criadora_id == self._eu().id

    def get_compativel(self, obj):
        return True  # TODO (integrações): comparar rota/horário com a usuária

    def get_distancia(self, obj):
        return "perto"  # TODO (integrações): calcular pela geolocalização

    def validate_vagas(self, valor):
        if not 2 <= valor <= 10:
            raise serializers.ValidationError("Escolha entre 2 e 10 vagas.")
        return valor

    def validate_horario(self, valor):
        if self.instance is None and valor <= timezone.now():
            raise serializers.ValidationError("Escolha um horário que ainda não passou.")
        return valor


class ParticipacaoGrupoSerializer(serializers.ModelSerializer):
    class Meta:
        model = ParticipacaoGrupo
        fields = "__all__"


class SolicitacaoAcompanhamentoSerializer(serializers.ModelSerializer):
    nome = serializers.SerializerMethodField()
    curso = serializers.SerializerMethodField()
    destino = serializers.SerializerMethodField()
    tempo = serializers.SerializerMethodField()
    tone = serializers.SerializerMethodField()

    class Meta:
        model = SolicitacaoAcompanhamento
        fields = ["id", "destinataria", "status", "criado_em", "nome", "curso", "destino", "tempo", "tone"]
        read_only_fields = ["status", "criado_em"]

    def get_nome(self, obj):
        u = obj.solicitante
        return "Usuária verificada" if u.modo_anonimo else u.nome_exibicao

    def get_curso(self, obj):
        return "Usuária verificada"  # TODO (integrações): curso vindo da verificação de identidade

    def get_destino(self, obj):
        return "o campus"

    def get_tempo(self, obj):
        return "há " + timesince(obj.criado_em).split(",")[0]

    def get_tone(self, obj):
        return (obj.solicitante_id % 4) + 1


class CompartilhamentoLocalizacaoSerializer(serializers.ModelSerializer):
    class Meta:
        model = CompartilhamentoLocalizacao
        fields = ["id", "grupo", "inicio", "expira_em", "encerrado"]
