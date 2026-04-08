"""
AI Claim Analyzer (Ta3wid): compare current NDVI vs baseline, output professional recommendation.
Regional event (drought) vs isolated anomaly (neglect).
"""
from decimal import Decimal


def get_claim_analysis_text(
    ndvi_at_claim: float | None,
    baseline_ndvi: float | None,
    deviation_percent: float | None,
    is_regional: bool = False,
) -> tuple[str, str]:
    """
    Returns (ai_analysis_text, ai_recommendation).
    is_regional: True if neighbouring parcels also show stress (regional drought).
    """
    baseline = float(baseline_ndvi) if baseline_ndvi is not None else 0.5
    current = float(ndvi_at_claim) if ndvi_at_claim is not None else baseline
    drop_pct = float(deviation_percent) if deviation_percent is not None else 0.0
    if drop_pct > 0:
        drop_pct = -drop_pct  # deviation is often negative for drop
    abs_drop = abs(drop_pct)

    if abs_drop < 10:
        text = (
            f"Stable vegetation: NDVI at claim {current:.2f} vs baseline {baseline:.2f} "
            f"(deviation {drop_pct:+.1f}%). No significant stress detected."
        )
        rec = "No Payout"
        return text, rec

    if is_regional or abs_drop >= 25:
        # Regional drought or major drop → recommend approve
        text = (
            f"Drought detected: NDVI drop of {abs_drop:.0f}% vs baseline. "
            f"Current NDVI {current:.2f} vs baseline {baseline:.2f}. "
            "Regional event confirmed. Recommended: Approve."
        )
        rec = "Approve"
    else:
        # Isolated anomaly → manual inspection
        text = (
            f"Anomaly detected: NDVI drop of {abs_drop:.0f}% vs baseline. "
            f"Current NDVI {current:.2f} vs baseline {baseline:.2f}. "
            "Drop is isolated to this parcel. Potential neglect. Recommended: Manual Inspection."
        )
        rec = "Manual Inspection"
    return text, rec
