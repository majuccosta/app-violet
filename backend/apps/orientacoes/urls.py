from rest_framework.routers import DefaultRouter

from .views import OrientacaoViewSet

router = DefaultRouter()
router.register("", OrientacaoViewSet, basename="orientacao")
urlpatterns = router.urls
