from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("conversas", "0003_conexao"),
    ]

    operations = [
        migrations.DeleteModel(
            name="Conexao",
        ),
    ]
