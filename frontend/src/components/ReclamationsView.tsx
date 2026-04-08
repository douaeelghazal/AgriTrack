import { useState, useEffect, useCallback } from 'react'
import { AlertCircle, X, Check, FileSearch } from 'lucide-react'
import { authFetch } from '../api'
import { useLang } from '../i18n'
import ParcelMap from './ParcelMap'

interface ClaimSummary {
  id: number
  contract_id: number
  policy_number: string
  farmer_name: string
  incident_date: string | null
  description: string
  claim_date: string
  ndvi_at_claim: number | null
  baseline_ndvi: number | null
  deviation_percent: number | null
  ai_analysis_text: string
  ai_recommendation: string
  ai_advice?: string
  status: string
}

const STATUS_LABELS: Record<string, string> = {
  en_cours: 'claimStatusPending',
  approuve: 'claimStatusApproved',
  refuse: 'claimStatusRefused',
  expertise_requise: 'claimStatusExpertise',
  en_attente: 'claimStatusHold',
}

export default function ReclamationsView() {
  const { t } = useLang()
  const [claims, setClaims] = useState<ClaimSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState<ClaimSummary & { audit?: { latitude: number; longitude: number; report_data?: { polygon_coords?: number[][] } }; contract?: unknown } | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [updatingId, setUpdatingId] = useState<number | null>(null)

  const fetchClaims = useCallback(() => {
    setLoading(true)
    authFetch('/api/claims/')
      .then((r) => (r.ok ? r.json() : []))
      .then(setClaims)
      .catch(() => setClaims([]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetchClaims() }, [fetchClaims])

  async function openDetail(id: number) {
    setLoadingDetail(true)
    setDetail(null)
    try {
      const res = await authFetch(`/api/claims/${id}/`)
      if (!res.ok) throw new Error()
      setDetail(await res.json())
    } catch {
      setDetail(null)
    } finally {
      setLoadingDetail(false)
    }
  }

  async function updateStatus(claimId: number, status: string) {
    setUpdatingId(claimId)
    try {
      const res = await authFetch(`/api/claims/${claimId}/status/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (res.ok) {
        fetchClaims()
        if (detail?.id === claimId) setDetail((d) => (d ? { ...d, status } : null))
      }
    } finally {
      setUpdatingId(null)
    }
  }

  function polygonFromAudit(audit: { report_data?: { polygon_coords?: number[][] } }): [number, number][] | undefined {
    const coords = audit?.report_data?.polygon_coords
    if (!coords || coords.length < 3) return undefined
    return coords.map(([lon, lat]) => [lat, lon] as [number, number])
  }

  return (
    <div className="p-6 max-w-6xl">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-100">{t('claimsTitle')}</h2>
        <p className="text-slate-500 mt-1">{t('claimsDesc')}</p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-slate-800/50 rounded-xl border border-slate-700 animate-pulse" />
          ))}
        </div>
      ) : claims.length === 0 ? (
        <div className="rounded-xl border border-slate-700 bg-slate-800/30 p-12 text-center">
          <div className="mx-auto w-24 h-24 rounded-full bg-slate-700/50 flex items-center justify-center mb-6">
            <AlertCircle size={48} className="text-slate-500" />
          </div>
          <p className="text-lg font-medium text-slate-300">{t('emptyClaimsTitle')}</p>
          <p className="text-sm text-slate-500 mt-2 max-w-md mx-auto">{t('emptyClaimsDesc')}</p>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-700 bg-slate-800/30 overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-700 bg-slate-800/50">
                <th className="px-4 py-3 font-medium text-slate-400">{t('claimId')}</th>
                <th className="px-4 py-3 font-medium text-slate-400">{t('claimsTableFarmer')}</th>
                <th className="px-4 py-3 font-medium text-slate-400">{t('dateOfIncident')}</th>
                <th className="px-4 py-3 font-medium text-slate-400">{t('aiRiskScore')}</th>
                <th className="px-4 py-3 font-medium text-slate-400">{t('claimsTableStatus')}</th>
                <th className="px-4 py-3 font-medium text-slate-400 w-40">Actions</th>
              </tr>
            </thead>
            <tbody>
              {claims.map((cl) => (
                <tr
                  key={cl.id}
                  onClick={() => openDetail(cl.id)}
                  className="border-b border-slate-700/50 hover:bg-slate-700/30 cursor-pointer"
                >
                  <td className="px-4 py-3 font-mono text-emerald-400">#{cl.id}</td>
                  <td className="px-4 py-3 text-slate-300">{cl.farmer_name}</td>
                  <td className="px-4 py-3 text-slate-400">
                    {cl.incident_date ? new Date(cl.incident_date).toLocaleDateString() : new Date(cl.claim_date).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs max-w-[180px] truncate">{cl.ai_recommendation || cl.ai_advice || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${
                      cl.status === 'approuve' ? 'bg-emerald-500/20 text-emerald-400' :
                      cl.status === 'refuse' ? 'bg-red-500/20 text-red-400' :
                      cl.status === 'en_attente' ? 'bg-amber-500/20 text-amber-400' :
                      cl.status === 'expertise_requise' ? 'bg-amber-500/20 text-amber-400' :
                      'bg-slate-600/80 text-slate-400'
                    }`}>
                      {t(STATUS_LABELS[cl.status] || 'claimStatusPending')}
                    </span>
                  </td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    {cl.status === 'en_cours' && (
                      <div className="flex gap-2 flex-wrap">
                        <button
                          disabled={updatingId === cl.id}
                          onClick={() => updateStatus(cl.id, 'approuve')}
                          className="px-2 py-1 rounded-lg bg-emerald-600/80 text-white text-xs font-medium hover:bg-emerald-500 disabled:opacity-50"
                        >
                          {t('claimAccept')}
                        </button>
                        <button
                          disabled={updatingId === cl.id}
                          onClick={() => updateStatus(cl.id, 'refuse')}
                          className="px-2 py-1 rounded-lg bg-red-600/80 text-white text-xs hover:bg-red-500 disabled:opacity-50"
                        >
                          {t('claimRefuse')}
                        </button>
                        <button
                          disabled={updatingId === cl.id}
                          onClick={() => updateStatus(cl.id, 'en_attente')}
                          className="px-2 py-1 rounded-lg bg-amber-500/80 text-white text-xs hover:bg-amber-400 disabled:opacity-50"
                        >
                          {t('claimHold')}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {loadingDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="h-10 w-10 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {detail && !loadingDetail && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60" onClick={() => setDetail(null)}>
          <div
            className="relative z-[10000] w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between p-4 border-b border-slate-700 bg-slate-900">
              <h3 className="text-lg font-semibold text-slate-100">Claim #{detail.id} — {detail.policy_number}</h3>
              <button onClick={() => setDetail(null)} className="p-2 rounded-xl text-slate-400 hover:bg-slate-800 hover:text-slate-200">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-300"><strong>{t('claimsTableFarmer')}:</strong> {detail.farmer_name}</p>
              <p className="text-sm text-slate-300"><strong>{t('dateOfIncident')}:</strong> {detail.incident_date ? new Date(detail.incident_date).toLocaleDateString() : new Date(detail.claim_date).toLocaleDateString()}</p>
              {detail.description && <p className="text-sm text-slate-400"><strong>{t('claimDescription')}:</strong> {detail.description}</p>}
              <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-4">
                <p className="text-xs font-medium text-slate-500 uppercase mb-2">AI</p>
                <p className="text-sm text-slate-300 whitespace-pre-wrap">{detail.ai_analysis_text || detail.ai_advice}</p>
                <p className="text-sm text-emerald-400 mt-2">{detail.ai_recommendation}</p>
              </div>
              {detail.audit && (
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase mb-2">{t('mapParcel')}</p>
                  <ParcelMap
                    center={[detail.audit.latitude, detail.audit.longitude]}
                    polygon={polygonFromAudit(detail.audit)}
                    height="260px"
                  />
                </div>
              )}
              {detail.status === 'en_cours' && (
                <div className="flex gap-3 pt-2 flex-wrap">
                  <button onClick={() => updateStatus(detail.id, 'approuve')} disabled={updatingId === detail.id} className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500 disabled:opacity-50">
                    {t('claimAccept')}
                  </button>
                  <button onClick={() => updateStatus(detail.id, 'refuse')} disabled={updatingId === detail.id} className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm hover:bg-red-500 disabled:opacity-50">
                    {t('claimRefuse')}
                  </button>
                  <button onClick={() => updateStatus(detail.id, 'en_attente')} disabled={updatingId === detail.id} className="px-4 py-2 rounded-xl bg-amber-500 text-white text-sm hover:bg-amber-400 disabled:opacity-50">
                    {t('claimHold')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
