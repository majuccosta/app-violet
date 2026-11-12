from rest_framework.routers import DefaultRouter

from .conexoes import ConexaoViewSet
from .views import ConversaViewSet

router = DefaultRouter()
# "conexoes" vem antes do "" para a rota não ser confundida com o id de uma conversa
router.register("conexoes", ConexaoViewSet, basename="conexao")
router.register("", ConversaViewSet, basename="conversa")
urlpatterns = router.urls
