import { useState, useCallback, useRef, useEffect, type FormEvent } from 'react'
import Map from 'react-map-gl/mapbox'
import MapboxDraw from '@mapbox/mapbox-gl-draw'
import area from '@turf/area'
import { polygon as turfPolygon } from '@turf/helpers'
import 'mapbox-gl/dist/mapbox-gl.css'
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css'
import { authFetch } from '../api'
import { useLang } from '../i18n'
import type { ParcelAuditResult } from '../types'

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || ''

const BERRECHID = { lng: -7.58, lat: 33.26 }
const INITIAL_VIEW = { longitude: BERRECHID.lng, latitude: BERRECHID.lat, zoom: 8 }

const NEON_CYAN = '#00f2ff'
const DRAW_STYLES: object[] = [
  {
    id: 'gl-draw-polygon-fill-inactive',
    type: 'fill',
    filter: ['all', ['==', 'active', 'false'], ['==', '$type', 'Polygon']],
    paint: { 'fill-color': NEON_CYAN, 'fill-outline-color': NEON_CYAN, 'fill-opacity': 0.1 },
  },
  {
    id: 'gl-draw-polygon-stroke-inactive',
    type: 'line',
    filter: ['all', ['==', 'active', 'false'], ['==', '$type', 'Polygon']],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': NEON_CYAN, 'line-width': 2 },
  },
  {
    id: 'gl-draw-polygon-fill-active',
    type: 'fill',
    filter: ['all', ['==', 'active', 'true'], ['==', '$type', 'Polygon']],
    paint: { 'fill-color': NEON_CYAN, 'fill-outline-color': NEON_CYAN, 'fill-opacity': 0.15 },
  },
  {
    id: 'gl-draw-polygon-stroke-active',
    type: 'line',
    filter: ['all', ['==', 'active', 'true'], ['==', '$type', 'Polygon']],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': NEON_CYAN, 'line-width': 2 },
  },
]

function polygonFromDrawFeature(feature: GeoJSON.Feature<GeoJSON.Polygon>): [number, number][] | null {
  const coords = feature.geometry?.coordinates?.[0]
  if (!coords || coords.length < 3) return null
  return coords.map(([lng, lat]) => [lat, lng] as [number, number])
}

function areaHaFromPolygon(positions: [number, number][]): number {
  if (positions.length < 3) return 0
  const ring = positions.map(([lat, lng]) => [lng, lat] as [number, number])
  if (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1]) ring.push(ring[0])
  const poly = turfPolygon([ring])
  return area(poly) / 10000
}

function getBounds(positions: [number, number][]): [[number, number], [number, number]] {
  const lats = positions.map((p) => p[0])
  const lngs = positions.map((p) => p[1])
  return [
    [Math.min(...lngs), Math.min(...lats)],
    [Math.max(...lngs), Math.max(...lats)],
  ]
}

function getRiskLevel(deviation: number | null | undefined): 'low' | 'medium' | 'high' {
  if (deviation == null) return 'medium'
  if (deviation >= -5) return 'low'
  if (deviation >= -10) return 'medium'
  return 'high'
}

interface AddContractFlowProps {
  onContractCreated: () => void
  onShowToast: (message: string) => void
}

export default function AddContractFlow({ onContractCreated, onShowToast }: AddContractFlowProps) {
  const { t } = useLang()
  const auditIdRef = useRef<number | null>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const drawRef = useRef<MapboxDraw | null>(null)

  const [polygon, setPolygon] = useState<[number, number][]>([])
  const [surfaceHa, setSurfaceHa] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [auditError, setAuditError] = useState<string | null>(null)
  const [result, setResult] = useState<ParcelAuditResult | null>(null)
  const [pendingLat, setPendingLat] = useState<number | null>(null)
  const [pendingLon, setPendingLon] = useState<number | null>(null)
  const [awaitConfirm, setAwaitConfirm] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [formSubmitting, setFormSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    farmer_name: '',
    cin: '',
    phone: '',
    farm_name: '',
    surface_ha: '',
    start_date: '',
    end_date: '',
    policy_type: '',
    document_placeholder: '',
  })

  const syncFromDraw = useCallback(() => {
    const draw = drawRef.current
    const map = mapRef.current
    if (!draw || !map) return
    const data = draw.getAll()
    const polyFeature = data.features.find((f) => f.geometry?.type === 'Polygon') as GeoJSON.Feature<GeoJSON.Polygon> | undefined
    const positions = polyFeature ? polygonFromDrawFeature(polyFeature) : null
    if (positions && positions.length >= 3) {
      const ha = areaHaFromPolygon(positions)
      setPolygon(positions)
      setSurfaceHa(ha)
      setFormData((prev) => ({ ...prev, surface_ha: ha.toFixed(4) }))
      setPendingLat(positions[0][0])
      setPendingLon(positions[0][1])
      setAwaitConfirm(true)
      setResult(null)
      setAuditError(null)
      const b = getBounds(positions)
      map.fitBounds(b, { padding: 60, duration: 1200, maxZoom: 16 })
    }
  }, [])

  const handleMapLoad = useCallback(
    (e: { target: mapboxgl.Map }) => {
      const map = e.target
      mapRef.current = map
      map.flyTo({ center: [BERRECHID.lng, BERRECHID.lat], zoom: 8, duration: 2000 })

      const draw = new MapboxDraw({
        displayControlsDefault: false,
        controls: { polygon: true, trash: true },
        defaultMode: 'draw_polygon',
        styles: DRAW_STYLES,
      })
      map.addControl(draw)
      drawRef.current = draw

      map.on('draw.create', syncFromDraw as () => void)
      map.on('draw.update', syncFromDraw as () => void)
    },
    [syncFromDraw]
  )

  useEffect(() => {
    const fn = syncFromDraw as () => void
    return () => {
      if (mapRef.current) {
        mapRef.current.off('draw.create', fn)
        mapRef.current.off('draw.update', fn)
      }
    }
  }, [syncFromDraw])

  const fetchAudit = useCallback(
    async (
      lat: number,
      lon: number,
      coords?: [number, number][],
      areaHaParam?: number | null
    ): Promise<ParcelAuditResult> => {
      const body: Record<string, unknown> = { latitude: lat, longitude: lon }
      if (coords && coords.length >= 3) body.polygon_coords = coords.map(([la, lo]) => [lo, la])
      if (areaHaParam != null && !Number.isNaN(areaHaParam)) body.area_ha = areaHaParam
      const res = await authFetch('/api/audit/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as { error?: string }).error || 'Audit failed')
      }
      return (await res.json()) as ParcelAuditResult
    },
    []
  )

  const handleClearMap = useCallback(() => {
    drawRef.current?.deleteAll()
    setPolygon([])
    setSurfaceHa(null)
    setFormData((prev) => ({ ...prev, surface_ha: '' }))
    setPendingLat(null)
    setPendingLon(null)
    setAwaitConfirm(false)
    setResult(null)
    setAuditError(null)
    auditIdRef.current = null
    onShowToast?.(t('mapCleared') || 'Map cleared')
  }, [t, onShowToast])

  const handleConfirmZone = useCallback(async () => {
    if (pendingLat == null || pendingLon == null || polygon.length < 3) return
    setLoading(true)
    setResult(null)
    setAuditError(null)
    auditIdRef.current = null
    setAwaitConfirm(false)
    const delay = new Promise<void>((r) => setTimeout(r, 6000))
    try {
      const data = await fetchAudit(pendingLat, pendingLon, polygon, surfaceHa ?? undefined)
      await delay
      if (data && typeof (data as ParcelAuditResult).id === 'number') {
        auditIdRef.current = (data as ParcelAuditResult).id
        setResult(data as ParcelAuditResult)
      } else {
        setAuditError('Audit response missing id')
        onShowToast?.('Audit response missing id')
      }
    } catch (err) {
      await delay
      const msg = err instanceof Error ? err.message : 'Audit failed'
      setAuditError(msg)
      setResult(null)
      auditIdRef.current = null
      onShowToast?.(msg)
    } finally {
      setLoading(false)
    }
  }, [pendingLat, pendingLon, polygon, surfaceHa, fetchAudit, onShowToast, t])

  const openForm = useCallback(() => setFormOpen(true), [])

  const submitContract = useCallback(async () => {
    const auditId = auditIdRef.current ?? result?.id
    if (auditId == null || typeof auditId !== 'number') {
      onShowToast?.(t('errorAuditMissing'))
      return
    }
    const farmerName = formData.farmer_name.trim()
    if (!farmerName) {
      onShowToast?.(t('errorFarmerRequired'))
      return
    }
    setFormSubmitting(true)
    try {
      const payload = {
        audit_id: auditId,
        farmer_name: farmerName || '—',
        cin: formData.cin.trim(),
        phone: formData.phone.trim(),
        farm_name: formData.farm_name.trim(),
        surface_ha: surfaceHa ?? result?.area_ha ?? null,
        start_date: formData.start_date || null,
        end_date: formData.end_date || null,
        policy_type: formData.policy_type.trim(),
        document_placeholder: formData.document_placeholder.trim(),
        boundary_coordinates: polygon.length >= 3 ? polygon : [],
      }
      const res = await authFetch('/api/contracts/create/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error((json as { error?: string }).error || `Failed to create contract (${res.status})`)
      }
      onShowToast?.(t('contractSuccess'))
      setFormOpen(false)
      setResult(null)
      auditIdRef.current = null
      setPolygon([])
      setSurfaceHa(null)
      setPendingLat(null)
      setPendingLon(null)
      drawRef.current?.deleteAll()
      setFormData({
        farmer_name: '',
        cin: '',
        phone: '',
        farm_name: '',
        surface_ha: '',
        start_date: '',
        end_date: '',
        policy_type: '',
        document_placeholder: '',
      })
      onContractCreated?.()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error'
      onShowToast?.(msg)
    } finally {
      setFormSubmitting(false)
    }
  }, [result, formData, surfaceHa, polygon, t, onShowToast, onContractCreated])

  const handleFormSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault()
      e.stopPropagation()
      submitContract()
    },
    [submitContract]
  )

  const riskLevel = result ? getRiskLevel(result.deviation_score) : null
  const aiRecoText =
    riskLevel === 'high' ? t('aiRecoCaution') : riskLevel === 'low' ? t('aiRecoStable') : t('aiRecoHealthy')
  const surfaceDisplay = surfaceHa != null ? surfaceHa.toFixed(4) : formData.surface_ha

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <div>
        <h2 className="text-2xl font-bold text-slate-100">{t('addContractTitle')}</h2>
        <p className="text-slate-500 mt-1">{t('addContractDesc')}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-2">
          <p className="text-sm text-slate-400 bg-slate-800/50 rounded-lg px-3 py-2 border border-slate-700/50">
            {t('mapTooltipDrawPolygon')}
          </p>
          <div className="rounded-xl overflow-hidden border border-slate-700 h-[400px] md:h-[500px] relative">
            <Map
              mapboxAccessToken={MAPBOX_TOKEN}
              initialViewState={INITIAL_VIEW}
              style={{ width: '100%', height: '100%' }}
              mapStyle="mapbox://styles/mapbox/satellite-v9"
              onLoad={handleMapLoad}
            />
            {surfaceHa != null && polygon.length >= 3 && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 px-4 py-2 rounded-lg bg-slate-900/95 border border-cyan-500/50 text-cyan-400 text-sm font-mono shadow-lg pointer-events-none">
                {surfaceHa.toFixed(4)} Ha
              </div>
            )}
            {polygon.length >= 3 && (
              <button
                type="button"
                onClick={handleClearMap}
                className="absolute top-3 right-3 z-10 px-3 py-2 rounded-lg bg-slate-800/90 border border-slate-600 text-slate-200 text-sm font-medium hover:bg-slate-700 shadow-lg"
              >
                {t('clearMap')}
              </button>
            )}
          </div>
        </div>

        <div className="space-y-4">
          {awaitConfirm && polygon.length >= 3 && !loading && (
            <button
              onClick={handleConfirmZone}
              className="w-full px-4 py-3 rounded-xl bg-emerald-600 text-white font-semibold text-sm hover:bg-emerald-500 transition-all duration-200"
            >
              {t('confirmZone')}
            </button>
          )}

          {loading && (
            <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-4 flex items-center gap-4">
              <div className="h-8 w-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              <div>
                <p className="text-sm font-medium text-slate-100">{t('analyzingHistorical')}</p>
                <p className="text-xs text-slate-500 mt-0.5">{t('surfaceFromMap')}</p>
              </div>
            </div>
          )}

          {auditError && !loading && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
              <p className="text-sm text-red-400">{auditError}</p>
            </div>
          )}

          {result && result.id != null && !loading && (
            <div className="space-y-4">
              {surfaceHa != null && (
                <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-4 space-y-1">
                  <p className="text-xs font-medium text-slate-500 uppercase">{t('totalSurface')}</p>
                  <p className="text-lg font-semibold text-cyan-400">{surfaceHa.toFixed(4)} Ha</p>
                </div>
              )}
              <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-4 space-y-2">
                <p className="text-xs font-medium text-slate-500 uppercase">{t('riskScore')}</p>
                <p
                  className={`text-lg font-semibold ${
                    riskLevel === 'high' ? 'text-amber-400' : riskLevel === 'medium' ? 'text-sky-400' : 'text-emerald-400'
                  }`}
                >
                  {riskLevel === 'high' ? t('riskHigh') : riskLevel === 'medium' ? t('riskMedium') : t('riskLow')}
                </p>
              </div>
              <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-4 space-y-2">
                <p className="text-xs font-medium text-slate-500 uppercase">{t('aiRecommendation')}</p>
                <p className="text-sm text-slate-300">{aiRecoText}</p>
              </div>
              <button
                type="button"
                onClick={openForm}
                className="w-full px-4 py-3 rounded-xl bg-emerald-600 text-white font-semibold text-sm hover:bg-emerald-500 transition-all duration-200"
              >
                {t('registerNewContract')}
              </button>
            </div>
          )}

          {!result && !loading && !awaitConfirm && !auditError && (
            <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-8 text-center text-slate-500">
              <p>{t('mapTooltipDrawPolygon')}</p>
            </div>
          )}
        </div>
      </div>

      {formOpen && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60"
          onClick={() => !formSubmitting && setFormOpen(false)}
        >
          <div
            className="relative z-[10000] w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-slate-700">
              <h3 className="text-lg font-semibold text-slate-100">{t('registerNewContract')}</h3>
            </div>
            <form
              noValidate
              onSubmit={handleFormSubmit}
              className="p-5 space-y-4 max-h-[70vh] overflow-y-auto"
              id="add-contract-form"
            >
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase mb-2">{t('formFarmer')}</p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">{t('farmerName')}</label>
                    <input
                      type="text"
                      value={formData.farmer_name}
                      onChange={(e) => setFormData((d) => ({ ...d, farmer_name: e.target.value }))}
                      className="w-full rounded-lg bg-slate-800 border border-slate-600 px-3 py-2 text-sm text-slate-200 outline-none focus:border-emerald-500"
                      placeholder={t('farmerName')}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">{t('cinNumber')}</label>
                    <input
                      type="text"
                      value={formData.cin}
                      onChange={(e) => setFormData((d) => ({ ...d, cin: e.target.value }))}
                      className="w-full rounded-lg bg-slate-800 border border-slate-600 px-3 py-2 text-sm text-slate-200 outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">{t('phone')}</label>
                    <input
                      type="text"
                      value={formData.phone}
                      onChange={(e) => setFormData((d) => ({ ...d, phone: e.target.value }))}
                      className="w-full rounded-lg bg-slate-800 border border-slate-600 px-3 py-2 text-sm text-slate-200 outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase mb-2">{t('formFarm')}</p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">{t('farmName')}</label>
                    <input
                      type="text"
                      value={formData.farm_name}
                      onChange={(e) => setFormData((d) => ({ ...d, farm_name: e.target.value }))}
                      className="w-full rounded-lg bg-slate-800 border border-slate-600 px-3 py-2 text-sm text-slate-200 outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">{t('totalSurface')}</label>
                    <input
                      type="text"
                      readOnly
                      value={surfaceDisplay}
                      className="w-full rounded-lg bg-slate-800 border border-slate-600 px-3 py-2 text-sm text-slate-300 cursor-not-allowed"
                      title={t('surfaceFromMap')}
                    />
                    <p className="text-xs text-slate-500 mt-1">{t('surfaceFromMap')}</p>
                  </div>
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase mb-2">{t('formInsurance')}</p>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">{t('startDate')}</label>
                      <input
                        type="date"
                        value={formData.start_date}
                        onChange={(e) => setFormData((d) => ({ ...d, start_date: e.target.value }))}
                        className="w-full rounded-lg bg-slate-800 border border-slate-600 px-3 py-2 text-sm text-slate-200 outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">{t('endDate')}</label>
                      <input
                        type="date"
                        value={formData.end_date}
                        onChange={(e) => setFormData((d) => ({ ...d, end_date: e.target.value }))}
                        className="w-full rounded-lg bg-slate-800 border border-slate-600 px-3 py-2 text-sm text-slate-200 outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">{t('policyType')}</label>
                    <input
                      type="text"
                      value={formData.policy_type}
                      onChange={(e) => setFormData((d) => ({ ...d, policy_type: e.target.value }))}
                      className="w-full rounded-lg bg-slate-800 border border-slate-600 px-3 py-2 text-sm text-slate-200 outline-none focus:border-emerald-500"
                      placeholder="e.g. Multirisque"
                    />
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">{t('documentUpload')}</label>
                <input
                  type="text"
                  value={formData.document_placeholder}
                  onChange={(e) => setFormData((d) => ({ ...d, document_placeholder: e.target.value }))}
                  className="w-full rounded-lg bg-slate-800 border border-slate-600 px-3 py-2 text-sm text-slate-200 outline-none focus:border-emerald-500"
                  placeholder={t('documentPlaceholder')}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => !formSubmitting && setFormOpen(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-slate-600 text-slate-300 text-sm font-medium hover:bg-slate-800"
                >
                  {t('cancel')}
                </button>
                <button
                  type="button"
                  disabled={formSubmitting || !result?.id}
                  onClick={() => submitContract()}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-500 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {formSubmitting ? t('saving') : t('saveContract')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
