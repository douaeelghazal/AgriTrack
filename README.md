# AgriTrack

**FinTech/AgriTech Satellite Audit Platform for Moroccan Institutions**  
MAMDA • Crédit Agricole

---

## Overview

AgriTrack is a professional satellite-based vegetation audit dashboard. It uses **Sentinel-2** imagery via the AgroMonitoring API to compute **NDVI** (Normalized Difference Vegetation Index) and compare it against a **5-year baseline** for banking and agricultural compliance.

---

## NDVI Formula

NDVI is computed from Sentinel-2 bands using:

$$\text{NDVI} = \frac{\text{NIR} - \text{RED}}{\text{NIR} + \text{RED}}$$

- **NIR** = Near-Infrared (Band 8 for Sentinel-2)
- **RED** = Red (Band 4 for Sentinel-2)

The AgroMonitoring API provides pre-computed NDVI values and imagery. Sentinel-2 bands B4 (Red) and B8 (NIR) are used in this standard formula. Values range from -1 to 1; healthy vegetation typically lies between 0.2 and 0.8.

---

## Why a 5-Year Baseline?

A **5-year baseline** is more accurate than simple year-over-year comparison because:

1. **Climate variability** — Single-year anomalies (drought, floods) can skew results. A 5-year average smooths out seasonal and annual noise.
2. **Agricultural cycles** — Crop rotation and fallow periods vary by year. A 5Y baseline captures the typical productivity of a parcel.
3. **Banking compliance** — For loan collateral and risk assessment, regulators prefer statistically robust baselines. A 5-year average reduces false positives/negatives.
4. **Trend detection** — Deviation from a 5Y baseline highlights sustained degradation (e.g. drought, soil exhaustion) vs. temporary dips.

---

## Data Integrity & Banking Compliance

The system ensures **data integrity** for institutional use:

1. **Cloud masking** — If the latest satellite image has >20% cloud coverage, the system automatically searches the last 30 days for the clearest available image, ensuring audits use reliable data.
2. **Immutable audit trail** — Each audit is stored in the database with full metadata (coordinates, NDVI, deviation, cloud cover, acquisition date), providing an auditable record.
3. **Traceable sources** — Report data includes satellite type (Sentinel-2), acquisition date, and cloud coverage for transparency.
4. **Reproducibility** — Historical trend data is stored; audits can be revalidated against the same baseline.
5. **Professional export** — PDF reports include institution branding, GPS coordinates, imagery, and technical verdict for official records.

---

## Architecture

```
AgriTrack
├── backend/          # Django REST API
│   ├── core/         # Project settings
│   ├── api/          # Audit API, ParcelAudit model
│   └── api/services/satellite.py  # AgroMonitoring + cloud-masking + historical engine
├── frontend/         # React (Vite) + Tailwind + Leaflet + Recharts
│   └── src/
│       ├── components/  # MapAudit, AuditResultPanel, TrendChart, etc.
│       └── App.tsx
└── README.md
```

### Backend Logic

- **ParcelAudit** model: `latitude`, `longitude`, `area_ha`, `current_ndvi`, `historical_avg_5y`, `deviation_score`, `cloud_coverage`, `report_data` (JSON)
- **Deviation formula**: `((current - average) / average) * 100`
- **Mock mode**: When `MOCK_MODE=True`, returns hardcoded Berrechid (33.26, -7.58) data with realistic 5-year trend — demo-ready without an API key.

### Frontend Features

- **Responsive sidebar** — Map Audit, History, Regional Analytics
- **Interactive map** — Leaflet, centered on Morocco; click to audit
- **Loading skeleton** — "Analyzing Sentinel-2 Satellite Bands..."
- **Dual image view** — Natural Color vs NDVI Heatmap
- **Recharts trend** — 5-year baseline vs current year
- **Verdict badge** — Red (High Risk/Drought), Yellow (Moderate), Green (Healthy)
- **PDF export** — A4 layout with logos, coordinates, images, verdict

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | Django REST Framework, python-dotenv, requests |
| Frontend | React (Vite), Tailwind CSS, Lucide Icons, Leaflet, Recharts |
| Satellite | AgroMonitoring API (Sentinel-2, Landsat-8) |

---

## License

Proprietary — MAMDA / Crédit Agricole partnership.
