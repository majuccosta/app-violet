from rest_framework.routers import DefaultRouter

from .views import ContatoConfiancaViewSet

router = DefaultRouter()
router.register("", ContatoConfiancaViewSet, basename="contato")
urlpatterns = router.urls
