# Generated manually for Contract model (MAMDA onboarding)

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("api", "0002_parcelaudit_user"),
    ]

    operations = [
        migrations.CreateModel(
            name="Contract",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("farmer_name", models.CharField(max_length=255)),
                ("cin", models.CharField(blank=True, max_length=32)),
                ("phone", models.CharField(blank=True, max_length=32)),
                ("farm_name", models.CharField(blank=True, max_length=255)),
                ("surface_ha", models.DecimalField(blank=True, decimal_places=4, max_digits=10, null=True)),
                ("start_date", models.DateField(blank=True, null=True)),
                ("end_date", models.DateField(blank=True, null=True)),
                ("policy_type", models.CharField(blank=True, max_length=64)),
                ("policy_number", models.CharField(db_index=True, max_length=64, unique=True)),
                ("document_placeholder", models.CharField(blank=True, max_length=512)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "parcel_audit",
                    models.OneToOneField(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="contract",
                        to="api.parcelaudit",
                    ),
                ),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="contracts",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["-created_at"],
            },
        ),
    ]
