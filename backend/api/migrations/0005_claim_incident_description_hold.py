# Claim: incident_date, description, ai_advice, status en_attente

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0004_claim"),
    ]

    operations = [
        migrations.AddField(
            model_name="claim",
            name="incident_date",
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="claim",
            name="description",
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name="claim",
            name="ai_advice",
            field=models.TextField(blank=True),
        ),
        migrations.AlterField(
            model_name="claim",
            name="status",
            field=models.CharField(
                choices=[
                    ("en_cours", "En cours"),
                    ("approuve", "Approuvé"),
                    ("refuse", "Refusé"),
                    ("expertise_requise", "Expertise Requise"),
                    ("en_attente", "Mise en attente"),
                ],
                default="en_cours",
                max_length=32,
            ),
        ),
    ]
