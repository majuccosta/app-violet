from django.contrib import admin
from django.contrib.auth.models import Group

from .models import Usuaria, Preferencias, VerificacaoIdentidade

admin.site.register(Usuaria)
admin.site.register(Preferencias)
admin.site.register(VerificacaoIdentidade)

# "Grupos" do Django são grupos de permissão (não usados no Violet). Os grupos do app ficam em Conversas e em Grupos de trajeto.
admin.site.unregister(Group)
