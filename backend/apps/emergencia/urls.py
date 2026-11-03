from rest_framework.routers import DefaultRouter

from .views import AlertaEmergenciaViewSet

router = DefaultRouter()
router.register("alertas", AlertaEmergenciaViewSet, basename="alerta")
urlpatterns = router.urls
