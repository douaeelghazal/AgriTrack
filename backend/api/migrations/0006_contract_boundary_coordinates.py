from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0005_claim_incident_description_hold"),
    ]

    operations = [
        migrations.AddField(
            model_name="contract",
            name="boundary_coordinates",
            field=models.JSONField(blank=True, default=list),
        ),
    ]
