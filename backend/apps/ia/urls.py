from django.urls import path

from .views import AnalisarEvidenciaView

urlpatterns = [
    path("analisar/", AnalisarEvidenciaView.as_view(), name="ia-analisar"),
]
