import { useState, useCallback, type FormEvent } from 'react'
import { MapContainer, TileLayer, useMapEvents, Marker, Polygon } from 'react-leaflet'
import L from 'leaflet'
import { authFetch } from '../api'
import { useLang } from '../i18n'
import AuditResultPanel from './AuditResultPanel'
import type { ParcelAuditResult } from '../types'

// Custom marker icon (Leaflet default breaks in Vite)
const markerIcon = L.divIcon({
  html: '<div style="background:#22c55e;width:24px;height:24px;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3)"></div>',
  className: 'custom-marker',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
})

const MOROCCO_CENTER: [number, number] = [31.7917, -7.0926]
const BERRECHID: [number, number] = [33.26, -7.58]
const MOROCCO_BOUNDS: [[number, number], [number, number]] = [
  [20.0, -17.0],
  [36.0, -1.0],
]
// Google Hybrid Satellite (s,h = satellite + labels) — high-res for parcel visibility
const GOOGLE_HYBRID_URL = 'https://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}'
const GOOGLE_SUBDOMAINS = ['mt0', 'mt1', 'mt2', 'mt3']

function MapClickHandler({ onPointSelect }: { onPointSelect: (lat: number, lon: number) => void }) {
  useMapEvents({
    click(e: { latlng: { lat: number; lng: number } }) {
      onPointSelect(e.latlng.lat, e.latlng.lng)
    },
  })
  return null
}

export default function MapAudit() {
  const { t } = useLang()
  const [map, setMap] = useState<L.Map | null>(null)
  const [marker, setMarker] = useState<[number, number] | null>(null)
  const [polygon, setPolygon] = useState<[number, number][]>([])
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ParcelAuditResult | null>(null)
  const [pendingLat, setPendingLat] = useState<number | null>(null)
  const [pendingLon, setPendingLon] = useState<number | null>(null)
  const [manualLat, setManualLat] = useState('')
  const [manualLon, setManualLon] = useState('')
  const [coordError, setCoordError] = useState<string | null>(null)
  const [awaitConfirm, setAwaitConfirm] = useState(false)
  const [loadingStatus, setLoadingStatus] = useState('')

  const fetchAudit = useCallback(
    async (lat: number, lon: number, coords?: [number, number][]): Promise<ParcelAuditResult> => {
      const body: Record<string, unknown> = { latitude: lat, longitude: lon }
      if (coords && coords.length >= 3) {
        body.polygon_coords = coords.map(([la, lo]) => [lo, la])
      }
      try {
        const res = await authFetch('/api/audit/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.error || 'Audit failed')
        }
        const data = (await res.json()) as ParcelAuditResult
        return data
      } catch {
        return {
          latitude: lat,
          longitude: lon,
          report_data: { verdict: 'Error', historical_trend: [] },
        }
      }
    },
    []
  )

  const handleMapClick = useCallback(
    (lat: number, lon: number) => {
      setMarker([lat, lon])
      setPolygon([])
      setPendingLat(lat)
      setPendingLon(lon)
      setManualLat(lat.toFixed(6))
      setManualLon(lon.toFixed(6))
      setCoordError(null)
      setAwaitConfirm(true)
    },
    []
  )

  const handleExport = useCallback(() => {
    window.print()
  }, [])

  const handleManualSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault()
      const lat = parseFloat(manualLat)
      const lon = parseFloat(manualLon)
      if (Number.isNaN(lat) || Number.isNaN(lon)) {
        setCoordError(t('coordErrorInvalid'))
        return
      }
      if (lat < MOROCCO_BOUNDS[0][0] || lat > MOROCCO_BOUNDS[1][0] || lon < MOROCCO_BOUNDS[0][1] || lon > MOROCCO_BOUNDS[1][1]) {
        setCoordError(t('coordErrorMorocco'))
        return
      }
      setCoordError(null)
      setMarker([lat, lon])
      setPendingLat(lat)
      setPendingLon(lon)
      setPolygon([])
      setAwaitConfirm(true)
      if (map) {
        map.setView([lat, lon], Math.max(map.getZoom(), 10))
      }
    },
    [manualLat, manualLon, map, t]
  )

  const handleConfirm = useCallback(async () => {
    if (pendingLat == null || pendingLon == null) return
    setLoading(true)
    setLoadingStatus('Fetching Sentinel-2 Tiles...')
    setResult(null)
    setAwaitConfirm(false)

    const delay = new Promise<void>((resolve) => {
      setTimeout(() => setLoadingStatus('Calculating 5-Year NDVI Baseline...'), 2000)
      setTimeout(() => resolve(), 6000)
    })

    const dataPromise = fetchAudit(pendingLat, pendingLon, polygon.length >= 3 ? polygon : undefined)
    const [data] = await Promise.all([dataPromise, delay])

    setResult(data)
    setLoading(false)
    setLoadingStatus('')
  }, [pendingLat, pendingLon, polygon, fetchAudit])

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <div>
        <h2 className="text-2xl font-bold text-slate-100">{t('mapTitle')}</h2>
        <p className="text-slate-500 mt-1">
          {t('mapDesc')}
        </p>
      </div>

      {/* Map + Results layout: responsive grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="rounded-xl overflow-hidden border border-slate-700 h-[400px] md:h-[500px] no-print">
            <MapContainer
              center={BERRECHID}
              zoom={8}
              minZoom={5}
              maxZoom={18}
              maxBounds={MOROCCO_BOUNDS}
              maxBoundsViscosity={1.0}
              className="h-full w-full"
              scrollWheelZoom
              whenCreated={setMap}
            >
              <TileLayer
                attribution='&copy; Google'
                url={GOOGLE_HYBRID_URL}
                subdomains={GOOGLE_SUBDOMAINS}
                maxZoom={20}
                maxNativeZoom={20}
              />
              <MapClickHandler onPointSelect={handleMapClick} />
              {marker && <Marker position={marker} icon={markerIcon} />}
              {polygon.length >= 3 && (
                <Polygon
                  positions={polygon}
                  pathOptions={{
                    color: '#22c55e',
                    weight: 3,
                    fillColor: '#22c55e',
                    fillOpacity: 0.25,
                  }}
                />
              )}
            </MapContainer>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-4 space-y-3">
            <p className="text-sm font-medium text-slate-200">{t('adashir')}</p>
            <form onSubmit={handleManualSubmit} className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <label className="block text-xs text-slate-500 mb-1">{t('latitude')}</label>
                <input
                  type="text"
                  value={manualLat}
                  onChange={(e) => setManualLat(e.target.value)}
                  className="w-full rounded-lg bg-slate-900 border border-slate-600 px-3 py-2 text-sm text-slate-200 outline-none focus:border-emerald-500"
                  placeholder="33.260000"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs text-slate-500 mb-1">{t('longitude')}</label>
                <input
                  type="text"
                  value={manualLon}
                  onChange={(e) => setManualLon(e.target.value)}
                  className="w-full rounded-lg bg-slate-900 border border-slate-600 px-3 py-2 text-sm text-slate-200 outline-none focus:border-emerald-500"
                  placeholder="-7.580000"
                />
              </div>
              <button
                type="submit"
                className="self-start px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-500 transition-all duration-200"
              >
                {t('placeMarker')}
              </button>
            </form>
            {coordError && <p className="text-xs text-red-400">{coordError}</p>}
            <p className="text-xs text-slate-500">
              Natural Color = Real view for identification. NDVI Heatmap = Health index (Green = Healthy, Red = Stress).
            </p>
          </div>

          {awaitConfirm && marker && !loading && (
            <button
              onClick={handleConfirm}
              className="w-full px-4 py-3 rounded-xl bg-emerald-600 text-white font-semibold text-sm hover:bg-emerald-500 transition-all duration-200"
            >
              {t('confirmLocation')}
            </button>
          )}

          {loading && (
            <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-4 flex items-center gap-4 transition-opacity">
              <div className="h-8 w-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              <div>
                <p className="text-sm font-medium text-slate-100">Analyse en cours…</p>
                <p className="text-xs text-slate-400 mt-1">
                  {loadingStatus || 'Traitement Sentinel-2…'}
                </p>
              </div>
            </div>
          )}

          {result && !loading && (
            <AuditResultPanel result={result} onExport={handleExport} />
          )}
          {!result && !loading && (
            <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-8 text-center text-slate-500">
              <p>{t('clickToStart')}</p>
              <p className="text-sm mt-2">{t('demoHint')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
