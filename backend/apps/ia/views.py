import tempfile
from pathlib import Path

from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from .services import analisar_evidencia


class AnalisarEvidenciaView(APIView):
    """POST /api/ia/analisar/ (multipart: arquivo) — prévia da análise antes de enviar a denúncia."""
    parser_classes = [MultiPartParser]

    def post(self, request):
        arquivo = request.FILES.get("arquivo")
        if not arquivo:
            return Response({"detail": "Envie um arquivo no campo 'arquivo'."}, status=400)
        with tempfile.NamedTemporaryFile(suffix=Path(arquivo.name).suffix) as tmp:
            for parte in arquivo.chunks():
                tmp.write(parte)
            tmp.flush()
            resultado = analisar_evidencia(tmp.name, arquivo.content_type)
        return Response({"arquivo": arquivo.name, **resultado,
                         "observacao": "Resultado de apoio. Não comprova a ocorrência."})
