from django.contrib import admin

from .models import GrupoTrajeto, ParticipacaoGrupo, SolicitacaoAcompanhamento, CompartilhamentoLocalizacao


@admin.register(GrupoTrajeto)
class GrupoTrajetoAdmin(admin.ModelAdmin):
    list_display = ("nome", "criadora", "ponto_encontro", "destino", "horario", "vagas", "ativo")
    list_filter = ("ativo",)
    search_fields = ("nome", "destino")


@admin.register(ParticipacaoGrupo)
class ParticipacaoGrupoAdmin(admin.ModelAdmin):
    list_display = ("grupo", "usuaria", "entrou_em", "saiu_em")


admin.site.register(SolicitacaoAcompanhamento)
admin.site.register(CompartilhamentoLocalizacao)
