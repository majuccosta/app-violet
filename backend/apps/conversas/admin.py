from django.contrib import admin

from .models import Conversa, Participante, Mensagem


@admin.register(Conversa)
class ConversaAdmin(admin.ModelAdmin):
    list_display = ("id", "tipo", "nome", "criadora", "criado_em")
    list_filter = ("tipo",)
    search_fields = ("nome",)


admin.site.register(Participante)
admin.site.register(Mensagem)
