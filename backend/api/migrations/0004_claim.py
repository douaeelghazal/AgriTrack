# Generated manually for Claim model (Ta3wid / Réclamations)

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0003_contract"),
    ]

    operations = [
        migrations.CreateModel(
            name="Claim",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("claim_date", models.DateTimeField(auto_now_add=True)),
                ("ndvi_at_claim", models.DecimalField(blank=True, decimal_places=4, max_digits=5, null=True)),
                ("baseline_ndvi", models.DecimalField(blank=True, decimal_places=4, max_digits=5, null=True)),
                ("deviation_percent", models.DecimalField(blank=True, decimal_places=2, max_digits=8, null=True)),
                ("ai_analysis_text", models.TextField(blank=True)),
                ("ai_recommendation", models.CharField(blank=True, max_length=64)),
                ("status", models.CharField(choices=[("en_cours", "En cours"), ("approuve", "Approuvé"), ("refuse", "Refusé"), ("expertise_requise", "Expertise Requise")], default="en_cours", max_length=32)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("contract", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="claims", to="api.contract")),
            ],
            options={
                "ordering": ["-created_at"],
            },
        ),
    ]
