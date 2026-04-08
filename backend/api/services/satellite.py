"""
AgriTrack Satellite Service
AgroMonitoring API Integration with Cloud-Masking and Historical NDVI Engine
"""
import time
from datetime import datetime, timedelta
from typing import Any

import requests

# Berrechid demo farm coordinates (Morocco)
DEFAULT_BERRECHID_LAT = 33.26
DEFAULT_BERRECHID_LON = -7.58

# Cloud coverage threshold - search for alternative if exceeded
CLOUD_THRESHOLD_PERCENT = 20

# Historical lookback for cloud-masking (days)
CLOUD_MASK_LOOKBACK_DAYS = 30

# Years for baseline
HISTORICAL_YEARS = 5


def _get_api_key() -> str:
    from django.conf import settings
    import os
    return os.getenv("AGROMONITORING_API_KEY", getattr(settings, "AGROMONITORING_API_KEY", ""))


def _create_polygon_from_point(lat: float, lon: float, api_key: str) -> str | None:
    """Create a small polygon around a point for AgroMonitoring API (1-3000 ha limit)."""
    delta = 0.002
    coords = [
        [lon - delta, lat - delta],
        [lon + delta, lat - delta],
        [lon + delta, lat + delta],
        [lon - delta, lat + delta],
        [lon - delta, lat - delta],
    ]
    payload = {
        "name": f"AgriVerify-{lat}-{lon}",
        "geo_json": {
            "type": "Feature",
            "properties": {},
            "geometry": {
                "type": "Polygon",
                "coordinates": [coords],
            },
        },
    }
    url = "https://api.agromonitoring.com/agro/1.0/polygons"
    resp = requests.post(url, json=payload, params={"appid": api_key}, timeout=30)
    if resp.status_code != 201:
        return None
    data = resp.json()
    return data.get("id")


def _create_polygon_from_coords(coords: list[list[float]], api_key: str) -> str | None:
    """Create polygon from GeoJSON-style coordinates [[lon, lat], ...]."""
    if not coords or len(coords) < 3:
        return None
    closed = list(coords) + [coords[0]]
    payload = {
        "name": "AgriVerify-parcel",
        "geo_json": {
            "type": "Feature",
            "properties": {},
            "geometry": {
                "type": "Polygon",
                "coordinates": [closed],
            },
        },
    }
    url = "https://api.agromonitoring.com/agro/1.0/polygons"
    resp = requests.post(url, json=payload, params={"appid": api_key}, timeout=30)
    if resp.status_code != 201:
        return None
    return resp.json().get("id")


def _search_images(
    poly_id: str,
    api_key: str,
    start_ts: int,
    end_ts: int,
    clouds_max: int | None = None,
    source: str = "s2",
) -> list[dict]:
    """Search satellite images for polygon. Filter by clouds_max if provided."""
    url = "https://api.agromonitoring.com/agro/1.0/image/search"
    params = {
        "polyid": poly_id,
        "appid": api_key,
        "start": start_ts,
        "end": end_ts,
    }
    if clouds_max is not None:
        params["clouds_max"] = clouds_max
    resp = requests.get(url, params=params, timeout=30)
    if resp.status_code != 200:
        return []
    data = resp.json()
    return data if isinstance(data, list) else []


def _get_ndvi_stats(stats_url: str, api_key: str) -> dict | None:
    """Fetch NDVI statistics from stats URL."""
    url = stats_url + ("&" if "?" in stats_url else "?") + f"appid={api_key}"
    resp = requests.get(url, timeout=30)
    if resp.status_code != 200:
        return None
    return resp.json()


def _get_ndvi_history(
    poly_id: str,
    api_key: str,
    start_ts: int,
    end_ts: int,
    clouds_max: int = 30,
) -> list[dict]:
    """Fetch historical NDVI data for polygon."""
    url = "https://api.agromonitoring.com/agro/1.0/ndvi/history"
    params = {
        "polyid": poly_id,
        "appid": api_key,
        "start": start_ts,
        "end": end_ts,
        "clouds_max": clouds_max,
    }
    resp = requests.get(url, params=params, timeout=30)
    if resp.status_code != 200:
        return []
    data = resp.json()
    return data if isinstance(data, list) else []


def _compute_deviation(current: float, average: float) -> float:
    """deviation = ((current - average) / average) * 100"""
    if average is None or average == 0:
        return 0.0
    return ((float(current) - float(average)) / float(average)) * 100


def get_mock_audit_data(
    lat: float | None = None,
    lon: float | None = None,
    area_ha: float | None = None,
) -> dict:
    """Demo Shield: Hardcoded realistic data for Berrechid farm. area_ha from polygon when provided."""
    lat = lat or DEFAULT_BERRECHID_LAT
    lon = lon or DEFAULT_BERRECHID_LON

    # Realistic 5-year trend (monthly NDVI for same period); zonal-style average for polygon
    base_year = 2019
    monthly_trend = []
    for year in range(5):
        year_data = []
        for month in range(1, 13):
            val = 0.35 + (month / 18) + (year * 0.02) + ((month % 3) * 0.03)
            val = min(0.85, max(0.25, val))
            year_data.append({"month": month, "ndvi": round(val, 4)})
        monthly_trend.append({"year": base_year + year, "data": year_data})

    historical_avg = 0.52
    current_ndvi = 0.48
    deviation = _compute_deviation(current_ndvi, historical_avg)
    cloud_coverage = 8.5

    return {
        "latitude": lat,
        "longitude": lon,
        "area_ha": float(area_ha) if area_ha is not None else 12.4,
        "current_ndvi": current_ndvi,
        "historical_avg_5y": historical_avg,
        "deviation_score": round(deviation, 2),
        "cloud_coverage": cloud_coverage,
        "report_data": {
            "verdict": "Moderate Risk" if deviation < -5 else "Healthy",
            "natural_color_url": "https://via.placeholder.com/400x300/2d5a27/ffffff?text=Natural+Color",
            "ndvi_heatmap_url": "https://via.placeholder.com/400x300/1a472a/90EE90?text=NDVI+Heatmap",
            "historical_trend": monthly_trend,
            "acquisition_date": datetime.utcnow().isoformat() + "Z",
            "satellite": "Sentinel-2",
        },
    }


def analyze_parcel(
    latitude: float,
    longitude: float,
    polygon_coords: list[list[float]] | None = None,
    area_ha: float | None = None,
) -> dict[str, Any]:
    """
    Main audit logic: fetch NDVI, apply cloud-masking, compute deviation.
    """
    from django.conf import settings

    if getattr(settings, "MOCK_MODE", True):
        return get_mock_audit_data(latitude, longitude, area_ha=area_ha)

    api_key = _get_api_key()
    if not api_key:
        return get_mock_audit_data(latitude, longitude)

    poly_id = None
    if polygon_coords and len(polygon_coords) >= 3:
        poly_id = _create_polygon_from_coords(polygon_coords, api_key)
    if not poly_id:
        poly_id = _create_polygon_from_point(latitude, longitude, api_key)
    if not poly_id:
        return get_mock_audit_data(latitude, longitude)

    now = datetime.utcnow()
    end_ts = int(now.timestamp())
    start_ts = int((now - timedelta(days=CLOUD_MASK_LOOKBACK_DAYS)).timestamp())

    images = _search_images(poly_id, api_key, start_ts, end_ts, clouds_max=None)

    selected = None
    for img in sorted(images, key=lambda x: x.get("dt", 0), reverse=True):
        cloud = img.get("cl", 100)
        if cloud <= CLOUD_THRESHOLD_PERCENT:
            selected = img
            break
    if not selected and images:
        selected = min(images, key=lambda x: x.get("cl", 100))

    if not selected:
        return get_mock_audit_data(latitude, longitude)

    cloud_coverage = float(selected.get("cl", 0))
    stats_url = selected.get("stats", {}).get("ndvi")
    current_ndvi = None
    if stats_url:
        stats = _get_ndvi_stats(stats_url, api_key)
        if stats:
            current_ndvi = stats.get("mean") or stats.get("median")

    if current_ndvi is None:
        current_ndvi = 0.5

    # Historical: fetch monthly NDVI for past 5 years
    hist_start = int((now - timedelta(days=365 * HISTORICAL_YEARS)).timestamp())
    hist_end = end_ts
    hist_data = _get_ndvi_history(poly_id, api_key, hist_start, hist_end, clouds_max=30)

    monthly_by_year: dict[int, list[float]] = {}
    for h in hist_data:
        dt_val = h.get("dt")
        if not dt_val:
            continue
        dt_obj = datetime.utcfromtimestamp(dt_val)
        year = dt_obj.year
        data = h.get("data") or {}
        ndvi = data.get("mean") or data.get("median")
        if ndvi is None:
            continue
        if year not in monthly_by_year:
            monthly_by_year[year] = []
        monthly_by_year[year].append(float(ndvi))

    historical_trend = []
    all_ndvis = []
    for year, vals in sorted(monthly_by_year.items()):
        year_data = [{"month": i + 1, "ndvi": v} for i, v in enumerate(vals[:12])]
        historical_trend.append({"year": year, "data": year_data})
        all_ndvis.extend(vals)

    historical_avg = sum(all_ndvis) / len(all_ndvis) if all_ndvis else current_ndvi
    deviation = _compute_deviation(current_ndvi, historical_avg)

    image_data = selected.get("image", {})
    natural_url = image_data.get("truecolor", "")
    ndvi_url = image_data.get("ndvi", "")

    return {
        "latitude": latitude,
        "longitude": longitude,
        "area_ha": area_ha,
        "current_ndvi": round(float(current_ndvi), 4),
        "historical_avg_5y": round(float(historical_avg), 4),
        "deviation_score": round(deviation, 2),
        "cloud_coverage": round(cloud_coverage, 2),
        "report_data": {
            "verdict": (
                "High Risk/Drought"
                if deviation < -15
                else "Moderate Risk"
                if deviation < -5
                else "Healthy"
            ),
            "natural_color_url": natural_url,
            "ndvi_heatmap_url": ndvi_url,
            "historical_trend": historical_trend,
            "acquisition_date": datetime.utcfromtimestamp(
                selected.get("dt", int(now.timestamp()))
            ).isoformat()
            + "Z",
            "satellite": selected.get("type", "Sentinel-2"),
        },
    }
