from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('usuarias', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='usuaria',
            name='apelido',
            field=models.CharField(blank=True, max_length=30, verbose_name='apelido'),
        ),
    ]
