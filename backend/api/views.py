from django.contrib.auth import authenticate, get_user_model
from django.db import IntegrityError
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken

from .models import ParcelAudit, Contract, Claim
from .services.satellite import analyze_parcel
from .services.claim_analysis import get_claim_analysis_text
from datetime import datetime, timedelta
from decimal import Decimal


def _parse_date(v):
    if not v:
        return None
    try:
        s = v.replace("Z", "").strip()[:10]
        return datetime.fromisoformat(s).date()
    except (ValueError, TypeError):
        return None


User = get_user_model()


def _user_payload(user: User) -> dict:
  return {
      "id": user.id,
      "username": getattr(user, "username", ""),
      "email": getattr(user, "email", ""),
  }


@api_view(["POST"])
@permission_classes([AllowAny])
def register(request: Request) -> Response:
    data = request.data or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    username = (data.get("username") or email.split("@")[0]).strip()

    if not email or not password:
        return Response(
            {"error": "email and password are required"}, status=status.HTTP_400_BAD_REQUEST
        )

    try:
        user = User.objects.create_user(username=username, email=email, password=password)
    except IntegrityError:
        return Response({"error": "User with this email already exists"}, status=400)

    refresh = RefreshToken.for_user(user)
    return Response(
        {
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "user": _user_payload(user),
        },
        status=status.HTTP_201_CREATED,
    )


@api_view(["POST"])
@permission_classes([AllowAny])
def login(request: Request) -> Response:
    data = request.data or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not email or not password:
        return Response(
            {"error": "email and password are required"}, status=status.HTTP_400_BAD_REQUEST
        )

    username = email
    # Try to find by email field if present
    try:
        user_obj = User.objects.get(email=email)
        username = getattr(user_obj, "username", email)
    except User.DoesNotExist:
        pass

    user = authenticate(request, username=username, password=password)
    if user is None:
        return Response({"error": "Invalid credentials"}, status=status.HTTP_401_UNAUTHORIZED)

    refresh = RefreshToken.for_user(user)
    return Response(
        {
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "user": _user_payload(user),
        }
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def audit_parcel(request: Request) -> Response:
    """
    Accept point (lat/lon) or polygon coordinates.
    Returns ParcelAudit-style response with NDVI, deviation, images, trend.
    """
    data = request.data or {}
    lat = data.get("latitude")
    lon = data.get("longitude")
    polygon_coords = data.get("polygon_coords")
    area_ha = data.get("area_ha")

    if polygon_coords and len(polygon_coords) >= 3:
        first = polygon_coords[0]
        lat = lat or (first[1] if isinstance(first[0], (int, float)) else first.get("lat"))
        lon = lon or (first[0] if isinstance(first[0], (int, float)) else first.get("lon"))
        if isinstance(polygon_coords[0], dict):
            polygon_coords = [[p.get("lng", p.get("lon", 0)), p.get("lat", 0)] for p in polygon_coords]

    if lat is None or lon is None:
        return Response(
            {"error": "latitude and longitude (or polygon_coords) required"},
            status=400,
        )

    try:
        lat = float(lat)
        lon = float(lon)
    except (TypeError, ValueError):
        return Response({"error": "Invalid latitude/longitude"}, status=400)

    result = analyze_parcel(
        latitude=lat,
        longitude=lon,
        polygon_coords=polygon_coords,
        area_ha=float(area_ha) if area_ha is not None else None,
    )
    report_data = dict(result.get("report_data", {}))
    if polygon_coords and len(polygon_coords) >= 3:
        report_data["polygon_coords"] = [[float(c[0]), float(c[1])] for c in polygon_coords]

    audit = ParcelAudit.objects.create(
        user=request.user,
        latitude=lat,
        longitude=lon,
        area_ha=result.get("area_ha"),
        current_ndvi=result.get("current_ndvi"),
        historical_avg_5y=result.get("historical_avg_5y"),
        deviation_score=result.get("deviation_score"),
        cloud_coverage=result.get("cloud_coverage"),
        report_data=report_data,
    )

    return Response(
        {
            "id": audit.id,
            "latitude": float(audit.latitude),
            "longitude": float(audit.longitude),
            "area_ha": float(audit.area_ha) if audit.area_ha else None,
            "current_ndvi": float(audit.current_ndvi) if audit.current_ndvi else None,
            "historical_avg_5y": float(audit.historical_avg_5y) if audit.historical_avg_5y else None,
            "deviation_score": float(audit.deviation_score) if audit.deviation_score else None,
            "cloud_coverage": float(audit.cloud_coverage) if audit.cloud_coverage else None,
            "report_data": audit.report_data,
            "created_at": audit.created_at.isoformat(),
        },
        status=201,
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def audit_list(request: Request) -> Response:
    """List recent parcel audits (contrats) for the authenticated user. Filters: region, date_from, date_to, risk_status."""
    qs = ParcelAudit.objects.filter(user=request.user)

    date_from = request.query_params.get("date_from")
    date_to = request.query_params.get("date_to")
    risk_status = (request.query_params.get("risk_status") or "").strip().lower()
    region = (request.query_params.get("region") or "").strip()

    if date_from:
        try:
            from datetime import datetime
            qs = qs.filter(created_at__date__gte=datetime.fromisoformat(date_from.replace("Z", "")).date())
        except (ValueError, TypeError):
            pass
    if date_to:
        try:
            from datetime import datetime
            qs = qs.filter(created_at__date__lte=datetime.fromisoformat(date_to.replace("Z", "")).date())
        except (ValueError, TypeError):
            pass
    audits = list(qs.order_by("-created_at")[:100])

    if risk_status:
        verdict_map = {"high": ["high", "risk", "drought"], "low": ["healthy"], "moderate": ["moderate"]}
        terms = verdict_map.get(risk_status, [risk_status])
        audits = [a for a in audits if any(
            (a.report_data or {}).get("verdict", "").lower().find(t) >= 0 for t in terms
        )]
    if region:
        audits = [a for a in audits if (a.report_data or {}).get("region", "").lower() == region.lower()]
    return Response([
        {
            "id": a.id,
            "latitude": float(a.latitude),
            "longitude": float(a.longitude),
            "current_ndvi": float(a.current_ndvi) if a.current_ndvi else None,
            "deviation_score": float(a.deviation_score) if a.deviation_score else None,
            "verdict": (a.report_data or {}).get("verdict"),
            "created_at": a.created_at.isoformat(),
        }
        for a in audits
    ])


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def audit_detail(request: Request, pk: int) -> Response:
    """Get a single audit (contract) for the authenticated user."""
    try:
        audit = ParcelAudit.objects.get(id=pk, user=request.user)
    except ParcelAudit.DoesNotExist:
        return Response({"error": "Not found"}, status=status.HTTP_404_NOT_FOUND)

    rd = audit.report_data or {}
    return Response(
        {
            "id": audit.id,
            "latitude": float(audit.latitude),
            "longitude": float(audit.longitude),
            "area_ha": float(audit.area_ha) if audit.area_ha else None,
            "current_ndvi": float(audit.current_ndvi) if audit.current_ndvi else None,
            "historical_avg_5y": float(audit.historical_avg_5y) if audit.historical_avg_5y else None,
            "deviation_score": float(audit.deviation_score) if audit.deviation_score else None,
            "cloud_coverage": float(audit.cloud_coverage) if audit.cloud_coverage else None,
            "report_data": {**rd, "polygon_coords": rd.get("polygon_coords")},
            "created_at": audit.created_at.isoformat(),
        }
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def audit_interpretation(request: Request, pk: int) -> Response:
    """Generate expert insurance interpretation (GPT-style) for an audit. Language: lang query param (fr, en, ar)."""
    try:
        audit = ParcelAudit.objects.get(id=pk, user=request.user)
    except ParcelAudit.DoesNotExist:
        return Response({"error": "Not found"}, status=status.HTTP_404_NOT_FOUND)

    lang = (request.query_params.get("lang") or "fr").strip().lower()[:2]
    if lang not in ("fr", "en", "ar"):
        lang = "fr"

    from .services.interpretation import get_interpretation_text
    text = get_interpretation_text(audit, lang)
    return Response({"interpretation": text, "lang": lang})


# ----- Contracts (onboarding) -----

def _contract_payload(c: Contract) -> dict:
    a = c.parcel_audit
    deviation = float(a.deviation_score) if a and a.deviation_score is not None else None
    verdict = (a.report_data or {}).get("verdict") if a else None
    boundary = getattr(c, "boundary_coordinates", None) or []
    if not boundary and a and (a.report_data or {}).get("polygon_coords"):
        for lon, lat in (a.report_data or {}).get("polygon_coords", []):
            boundary.append([float(lat), float(lon)])
    return {
        "id": c.id,
        "policy_number": c.policy_number,
        "farmer_name": c.farmer_name,
        "cin": c.cin,
        "phone": c.phone,
        "farm_name": c.farm_name,
        "surface_ha": float(c.surface_ha) if c.surface_ha else None,
        "start_date": c.start_date.isoformat() if c.start_date else None,
        "end_date": c.end_date.isoformat() if c.end_date else None,
        "policy_type": c.policy_type,
        "document_placeholder": c.document_placeholder or None,
        "boundary_coordinates": boundary,
        "created_at": c.created_at.isoformat(),
        "audit_id": a.id if a else None,
        "latitude": float(a.latitude) if a else None,
        "longitude": float(a.longitude) if a else None,
        "current_ndvi": float(a.current_ndvi) if a and a.current_ndvi else None,
        "deviation_score": deviation,
        "verdict": verdict,
    }


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def contract_list(request: Request) -> Response:
    """GET: list contracts. POST: create contract (same as /api/contracts/create/)."""
    if request.method == "POST":
        return contract_create(request)
    qs = Contract.objects.filter(user=request.user).select_related("parcel_audit").order_by("-created_at")
    date_from = request.query_params.get("date_from")
    date_to = request.query_params.get("date_to")
    if date_from:
        try:
            qs = qs.filter(start_date__gte=datetime.fromisoformat(date_from.replace("Z", "")).date())
        except (ValueError, TypeError):
            pass
    if date_to:
        try:
            qs = qs.filter(end_date__lte=datetime.fromisoformat(date_to.replace("Z", "")).date())
        except (ValueError, TypeError):
            pass
    return Response([_contract_payload(c) for c in qs])


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def contract_create(request: Request) -> Response:
    """Create a contract from an audit_id + farmer/farm/insurance form. Returns new contract + policy_number."""
    data = request.data or {}
    audit_id = data.get("audit_id")
    if audit_id is None:
        return Response({"error": "audit_id is required"}, status=status.HTTP_400_BAD_REQUEST)
    try:
        audit = ParcelAudit.objects.get(id=audit_id, user=request.user)
    except ParcelAudit.DoesNotExist:
        return Response({"error": "Audit not found"}, status=status.HTTP_404_NOT_FOUND)
    if getattr(audit, "contract", None):
        return Response({"error": "This audit is already linked to a contract"}, status=status.HTTP_400_BAD_REQUEST)

    farmer_name = (data.get("farmer_name") or "").strip() or "—"
    surface_val = data.get("surface_ha")
    if surface_val is not None and surface_val != "":
        try:
            surface_ha = Decimal(str(surface_val))
        except Exception:
            surface_ha = audit.area_ha
    else:
        surface_ha = audit.area_ha
    boundary_raw = data.get("boundary_coordinates")
    boundary_coordinates = []
    if isinstance(boundary_raw, list) and boundary_raw:
        for pt in boundary_raw:
            if isinstance(pt, (list, tuple)) and len(pt) >= 2:
                try:
                    boundary_coordinates.append([float(pt[0]), float(pt[1])])
                except (TypeError, ValueError):
                    pass

    contract = Contract.objects.create(
        user=request.user,
        parcel_audit=audit,
        farmer_name=farmer_name,
        cin=(data.get("cin") or "").strip(),
        phone=(data.get("phone") or "").strip(),
        farm_name=(data.get("farm_name") or "").strip(),
        surface_ha=surface_ha,
        start_date=_parse_date(data.get("start_date")),
        end_date=_parse_date(data.get("end_date")),
        policy_type=(data.get("policy_type") or "").strip(),
        document_placeholder=(data.get("document_placeholder") or "").strip(),
        boundary_coordinates=boundary_coordinates,
    )
    return Response(_contract_payload(contract), status=status.HTTP_201_CREATED)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def contract_detail(request: Request, pk: int) -> Response:
    """Get a single contract with full audit data."""
    try:
        c = Contract.objects.select_related("parcel_audit").get(id=pk, user=request.user)
    except Contract.DoesNotExist:
        return Response({"error": "Not found"}, status=status.HTTP_404_NOT_FOUND)
    out = _contract_payload(c)
    a = c.parcel_audit
    if a:
        rd = a.report_data or {}
        out["audit"] = {
            "id": a.id,
            "latitude": float(a.latitude),
            "longitude": float(a.longitude),
            "area_ha": float(a.area_ha) if a.area_ha else None,
            "current_ndvi": float(a.current_ndvi) if a.current_ndvi else None,
            "historical_avg_5y": float(a.historical_avg_5y) if a.historical_avg_5y else None,
            "deviation_score": float(a.deviation_score) if a.deviation_score else None,
            "cloud_coverage": float(a.cloud_coverage) if a.cloud_coverage else None,
            "report_data": {**rd, "polygon_coords": rd.get("polygon_coords")},
        }
    else:
        out["audit"] = None
    return Response(out)


# ----- Claims (Réclamations / Ta3wid) -----

def _claim_payload(cl: Claim) -> dict:
    c = cl.contract
    return {
        "id": cl.id,
        "contract_id": c.id,
        "policy_number": c.policy_number,
        "farmer_name": c.farmer_name,
        "incident_date": cl.incident_date.isoformat() if cl.incident_date else None,
        "description": cl.description or "",
        "claim_date": cl.claim_date.isoformat(),
        "ndvi_at_claim": float(cl.ndvi_at_claim) if cl.ndvi_at_claim else None,
        "baseline_ndvi": float(cl.baseline_ndvi) if cl.baseline_ndvi else None,
        "deviation_percent": float(cl.deviation_percent) if cl.deviation_percent else None,
        "ai_analysis_text": cl.ai_analysis_text,
        "ai_recommendation": cl.ai_recommendation,
        "ai_advice": getattr(cl, "ai_advice", "") or cl.ai_analysis_text,
        "status": cl.status,
    }


def _parse_date_claim(v):
    if not v:
        return None
    try:
        s = str(v).replace("Z", "").strip()[:10]
        return datetime.fromisoformat(s).date()
    except (ValueError, TypeError):
        return None


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def claim_create(request: Request) -> Response:
    """File a claim: incident_date, description. Runs AI analysis (NDVI at incident vs baseline)."""
    data = request.data or {}
    contract_id = data.get("contract_id")
    if contract_id is None:
        return Response({"error": "contract_id is required"}, status=status.HTTP_400_BAD_REQUEST)
    try:
        contract = Contract.objects.select_related("parcel_audit").get(id=contract_id, user=request.user)
    except Contract.DoesNotExist:
        return Response({"error": "Contract not found"}, status=status.HTTP_404_NOT_FOUND)
    audit = contract.parcel_audit
    if not audit:
        return Response({"error": "Contract has no audit data"}, status=status.HTTP_400_BAD_REQUEST)

    incident_date = _parse_date_claim(data.get("incident_date"))
    description = (data.get("description") or "").strip()

    baseline = float(audit.historical_avg_5y) if audit.historical_avg_5y is not None else None
    current = float(audit.current_ndvi) if audit.current_ndvi is not None else None
    deviation = float(audit.deviation_score) if audit.deviation_score is not None else None
    is_regional = (deviation is not None and deviation <= -25)
    ai_text, ai_rec = get_claim_analysis_text(current, baseline, deviation, is_regional=is_regional)

    claim = Claim.objects.create(
        contract=contract,
        incident_date=incident_date,
        description=description,
        ndvi_at_claim=audit.current_ndvi,
        baseline_ndvi=audit.historical_avg_5y,
        deviation_percent=audit.deviation_score,
        ai_analysis_text=ai_text,
        ai_recommendation=ai_rec,
        ai_advice=ai_text,
        status=Claim.STATUS_PENDING,
    )
    return Response(_claim_payload(claim), status=status.HTTP_201_CREATED)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def claim_list(request: Request) -> Response:
    """List all claims for the authenticated user."""
    qs = Claim.objects.filter(contract__user=request.user).select_related("contract").order_by("-created_at")
    return Response([_claim_payload(cl) for cl in qs])


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def claim_detail(request: Request, pk: int) -> Response:
    """Get claim with contract and audit (for map polygon)."""
    try:
        cl = Claim.objects.select_related("contract__parcel_audit").get(pk=pk, contract__user=request.user)
    except Claim.DoesNotExist:
        return Response({"error": "Not found"}, status=status.HTTP_404_NOT_FOUND)
    out = _claim_payload(cl)
    c = cl.contract
    a = c.parcel_audit
    if a:
        rd = a.report_data or {}
        out["audit"] = {
            "id": a.id,
            "latitude": float(a.latitude),
            "longitude": float(a.longitude),
            "area_ha": float(a.area_ha) if a.area_ha else None,
            "report_data": {**rd, "polygon_coords": rd.get("polygon_coords")},
        }
    else:
        out["audit"] = None
    out["contract"] = _contract_payload(c)
    return Response(out)


@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def claim_update_status(request: Request, pk: int) -> Response:
    """Update claim status: accept AI (Approuvé) or set Refusé / Expertise Requise."""
    data = request.data or {}
    status_val = (data.get("status") or "").strip().lower()
    status_map = {"approuve": Claim.STATUS_APPROVED, "refuse": Claim.STATUS_REFUSED, "expertise_requise": Claim.STATUS_EXPERTISE, "en_cours": Claim.STATUS_PENDING, "en_attente": Claim.STATUS_HOLD}
    status_val = status_map.get(status_val, status_val)
    allowed = {Claim.STATUS_APPROVED, Claim.STATUS_REFUSED, Claim.STATUS_EXPERTISE, Claim.STATUS_PENDING, Claim.STATUS_HOLD}
    if status_val not in allowed:
        return Response({"error": "Invalid status"}, status=status.HTTP_400_BAD_REQUEST)
    try:
        cl = Claim.objects.select_related("contract").get(pk=pk, contract__user=request.user)
    except Claim.DoesNotExist:
        return Response({"error": "Not found"}, status=status.HTTP_404_NOT_FOUND)
    cl.status = status_val
    cl.save(update_fields=["status"])
    return Response(_claim_payload(cl))


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def dashboard_stats(request: Request) -> Response:
    """KPIs: contracts, ha, risk, expiring, claims_today, high_risk_anomalies, payout_estimates."""
    qs = Contract.objects.filter(user=request.user).select_related("parcel_audit")
    total_contracts = qs.count()
    total_ha = sum(
        (c.surface_ha or (c.parcel_audit.area_ha if c.parcel_audit else None) or Decimal("0"))
        for c in qs
    )
    deviations = [
        float(c.parcel_audit.deviation_score)
        for c in qs
        if c.parcel_audit and c.parcel_audit.deviation_score is not None
    ]
    avg_risk = sum(deviations) / len(deviations) if deviations else None
    today = datetime.now().date()
    end_30 = today + timedelta(days=30)
    expiring_soon = qs.filter(end_date__gte=today, end_date__lte=end_30).count()

    from django.utils import timezone
    claim_qs = Claim.objects.filter(contract__user=request.user)
    today_start = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)
    claims_today = claim_qs.filter(claim_date__gte=today_start).count()
    pending_claims = claim_qs.filter(status=Claim.STATUS_PENDING).count()
    high_risk_anomalies = claim_qs.filter(ai_recommendation="Manual Inspection").count()
    approved = claim_qs.filter(status=Claim.STATUS_APPROVED)
    payout_estimates = approved.count()

    return Response({
        "total_contracts": total_contracts,
        "total_insured_ha": float(total_ha),
        "average_portfolio_risk": round(avg_risk, 2) if avg_risk is not None else None,
        "expiring_soon": expiring_soon,
        "claims_today": claims_today,
        "pending_claims": pending_claims,
        "high_risk_anomalies": high_risk_anomalies,
        "payout_estimates": payout_estimates,
    })
