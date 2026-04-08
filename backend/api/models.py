"""
ParcelAudit & Contract models - Insurance onboarding and satellite audit (MAMDA)
"""
from django.conf import settings
from django.db import models


class ParcelAudit(models.Model):
    """Stores satellite audit results for agricultural parcels (pre-contract analysis)."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="parcel_audits",
        null=True,
        blank=True,
    )

    latitude = models.DecimalField(max_digits=9, decimal_places=6)
    longitude = models.DecimalField(max_digits=9, decimal_places=6)
    area_ha = models.DecimalField(max_digits=10, decimal_places=4, null=True, blank=True)
    current_ndvi = models.DecimalField(
        max_digits=5, decimal_places=4, null=True, blank=True
    )
    historical_avg_5y = models.DecimalField(
        max_digits=5, decimal_places=4, null=True, blank=True
    )
    deviation_score = models.DecimalField(
        max_digits=8, decimal_places=2, null=True, blank=True
    )
    cloud_coverage = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True
    )
    report_data = models.JSONField(default=dict, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Audit ({self.latitude}, {self.longitude}) - NDVI: {self.current_ndvi}"


def _next_policy_number():
    from django.db.models import Max
    from datetime import datetime
    year = datetime.now().year
    prefix = f"MAMDA-{year}-"
    last = Contract.objects.filter(policy_number__startswith=prefix).aggregate(Max("policy_number"))["policy_number__max"]
    if last:
        try:
            num = int(last.replace(prefix, "")) + 1
        except ValueError:
            num = 1
    else:
        num = 1
    return f"{prefix}{num:04d}"


class Contract(models.Model):
    """Insurance contract: links ParcelAudit (satellite baseline) to farmer/farm/terms."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="contracts",
    )
    parcel_audit = models.OneToOneField(
        ParcelAudit,
        on_delete=models.CASCADE,
        related_name="contract",
        null=True,
        blank=True,
    )

    # Farmer (Moul l'ard)
    farmer_name = models.CharField(max_length=255)
    cin = models.CharField(max_length=32, blank=True)
    phone = models.CharField(max_length=32, blank=True)

    # Farm
    farm_name = models.CharField(max_length=255, blank=True)
    surface_ha = models.DecimalField(max_digits=10, decimal_places=4, null=True, blank=True)

    # Insurance terms
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    policy_type = models.CharField(max_length=64, blank=True)

    policy_number = models.CharField(max_length=64, unique=True, db_index=True)
    document_placeholder = models.CharField(max_length=512, blank=True)  # Land title / lease URL or placeholder
    boundary_coordinates = models.JSONField(default=list, blank=True)  # [[lat, lng], ...] source of truth for parcel

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.policy_number} — {self.farmer_name}"

    def save(self, *args, **kwargs):
        if not self.policy_number:
            self.policy_number = _next_policy_number()
        super().save(*args, **kwargs)


class Claim(models.Model):
    """Insurance claim (Réclamation / Ta3wid): links to contract, stores AI analysis and status."""

    STATUS_PENDING = "en_cours"
    STATUS_APPROVED = "approuve"
    STATUS_REFUSED = "refuse"
    STATUS_EXPERTISE = "expertise_requise"
    STATUS_HOLD = "en_attente"
    STATUS_CHOICES = [
        (STATUS_PENDING, "En cours"),
        (STATUS_APPROVED, "Approuvé"),
        (STATUS_REFUSED, "Refusé"),
        (STATUS_EXPERTISE, "Expertise Requise"),
        (STATUS_HOLD, "Mise en attente"),
    ]

    contract = models.ForeignKey(
        Contract,
        on_delete=models.CASCADE,
        related_name="claims",
    )
    incident_date = models.DateField(null=True, blank=True)
    description = models.TextField(blank=True)
    claim_date = models.DateTimeField(auto_now_add=True)
    ndvi_at_claim = models.DecimalField(
        max_digits=5, decimal_places=4, null=True, blank=True
    )
    baseline_ndvi = models.DecimalField(
        max_digits=5, decimal_places=4, null=True, blank=True
    )
    deviation_percent = models.DecimalField(
        max_digits=8, decimal_places=2, null=True, blank=True
    )
    ai_analysis_text = models.TextField(blank=True)
    ai_recommendation = models.CharField(max_length=64, blank=True)
    ai_advice = models.TextField(blank=True)
    status = models.CharField(
        max_length=32, choices=STATUS_CHOICES, default=STATUS_PENDING
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Claim #{self.id} — {self.contract.policy_number}"
