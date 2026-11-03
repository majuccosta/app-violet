"""Utilitários para os testes da API."""
from rest_framework.test import APIClient

from apps.usuarias.models import Usuaria

SENHA = "Violet@2026"


def criar_usuaria(email="ana@ceub.edu.br", nome="Ana Souza"):
    return Usuaria.objects.create_user(username=email, email=email, password=SENHA, nome_completo=nome, verificada=True)


def cliente_logado(usuaria):
    c = APIClient()
    c.force_authenticate(usuaria)
    return c
