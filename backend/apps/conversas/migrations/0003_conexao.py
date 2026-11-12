import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("conversas", "0002_conversa_criadora_conversa_membros"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="Conexao",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("status", models.CharField(choices=[("pendente", "Pendente"), ("aceita", "Aceita"), ("recusada", "Recusada")], default="pendente", max_length=10)),
                ("criado_em", models.DateTimeField(auto_now_add=True)),
                ("respondido_em", models.DateTimeField(blank=True, null=True)),
                ("conversa", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="+", to="conversas.conversa")),
                ("de", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="pedidos_enviados", to=settings.AUTH_USER_MODEL)),
                ("para", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="pedidos_recebidos", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "verbose_name": "conexão",
                "verbose_name_plural": "conexões",
                "ordering": ["-criado_em"],
                "unique_together": {("de", "para")},
            },
        ),
    ]
