from rest_framework.routers import DefaultRouter

from .views import NotificacaoViewSet

router = DefaultRouter()
router.register("", NotificacaoViewSet, basename="notificacao")
urlpatterns = router.urls
