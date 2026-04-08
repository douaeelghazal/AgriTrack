"""
Expert insurance (MAMDA) interpretation text from NDVI/audit data.
Professional tone for underwriters and risk teams.
"""


def get_interpretation_text(audit, lang: str) -> str:
    rd = audit.report_data or {}
    verdict = (rd.get("verdict") or "Pending").strip()
    current = float(audit.current_ndvi or 0)
    baseline = float(audit.historical_avg_5y or 0)
    deviation = float(audit.deviation_score or 0)
    clouds = float(audit.cloud_coverage or 0)
    area = float(audit.area_ha or 0)

    if lang == "ar":
        return _ar(current, baseline, deviation, clouds, area, verdict)
    if lang == "en":
        return _en(current, baseline, deviation, clouds, area, verdict)
    return _fr(current, baseline, deviation, clouds, area, verdict)


def _fr(current: float, baseline: float, deviation: float, clouds: float, area: float, verdict: str) -> str:
    risk = "élevé" if deviation < -10 else "modéré" if deviation < -5 else "faible"
    return (
        f"Synthèse assurance agricole (MAMDA) — Parcelle {area:.1f} ha. "
        f"NDVI actuel : {current:.3f}, baseline 5 ans : {baseline:.3f} ; écart : {deviation:+.1f} %. "
        f"Couv. nuageuse : {clouds:.1f} %. Verdict technique : {verdict}. "
        f"Le niveau de risque végétatif est considéré comme {risk}. "
        "Recommandation : prise en compte des indicateurs satellitaires Sentinel-2 pour l'éligibilité et le suivi du contrat."
    )


def _en(current: float, baseline: float, deviation: float, clouds: float, area: float, verdict: str) -> str:
    risk = "high" if deviation < -10 else "moderate" if deviation < -5 else "low"
    return (
        f"Agricultural insurance summary (MAMDA) — Parcel {area:.1f} ha. "
        f"Current NDVI: {current:.3f}, 5-year baseline: {baseline:.3f}; deviation: {deviation:+.1f}%. "
        f"Cloud coverage: {clouds:.1f}%. Technical verdict: {verdict}. "
        f"Vegetation risk level is assessed as {risk}. "
        "Recommendation: use Sentinel-2 satellite indicators for eligibility and contract monitoring."
    )


def _ar(current: float, baseline: float, deviation: float, clouds: float, area: float, verdict: str) -> str:
    risk = "مرتفع" if deviation < -10 else "متوسط" if deviation < -5 else "منخفض"
    return (
        f"ملخص التأمين الزراعي (المغذية) — قطعة {area:.1f} هكتار. "
        f"NDVI الحالي: {current:.3f}، خط الأساس 5 سنوات: {baseline:.3f}؛ الانحراف: {deviation:+.1f}٪. "
        f"تغطية السحب: {clouds:.1f}٪. الحكم الفني: {verdict}. "
        f"مستوى مخاطر الغطاء النباتي يُقدّر بأنه {risk}. "
        "التوصية: استخدام مؤشرات القمر الصناعي Sentinel-2 للأهلية ومتابعة العقد."
    )
