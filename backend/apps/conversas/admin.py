from django.contrib import admin

from .models import Conexao, Conversa, Participante, Mensagem


@admin.register(Conversa)
class ConversaAdmin(admin.ModelAdmin):
    list_display = ("id", "tipo", "nome", "criadora", "criado_em")
    list_filter = ("tipo",)
    search_fields = ("nome",)


admin.site.register(Participante)
admin.site.register(Mensagem)


@admin.register(Conexao)
class ConexaoAdmin(admin.ModelAdmin):
    list_display = ("id", "de", "para", "status", "criado_em")
    list_filter = ("status",)
