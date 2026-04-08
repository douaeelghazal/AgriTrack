import { useState, useEffect, useCallback } from 'react'
import { FileText, X, Download, Filter, AlertCircle } from 'lucide-react'
import { authFetch } from '../api'
import { useLang } from '../i18n'
import ParcelMap from './ParcelMap'
import TrendChart from './TrendChart'
import VerdictBadge from './VerdictBadge'

const ANALYZE_DELAY_MS = 6000

export interface HistoryViewProps {
  onShowToast?: (message: string) => void
  onNavigateToReclamations?: () => void
}

interface ContractSummary {
  id: number
  policy_number: string
  farmer_name: string
  farm_name: string
  surface_ha: number | null
  start_date: string | null
  end_date: string | null
  deviation_score: number | null
  verdict: string | null
  created_at: string
}

interface ContractDetail extends ContractSummary {
  boundary_coordinates?: [number, number][]
  audit?: {
    id: number
    latitude: number
    longitude: number
    area_ha: number | null
    current_ndvi: number | null
    historical_avg_5y: number | null
    deviation_score: number | null
    cloud_coverage: number | null
    report_data: { polygon_coords?: number[][]; historical_trend?: { year: number; data: { month: number; ndvi: number }[] }[] }
  } | null
}

export default function HistoryView({ onShowToast, onNavigateToReclamations }: HistoryViewProps = {}) {
  const { t, lang } = useLang()
  const [contracts, setContracts] = useState<ContractSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState<ContractDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [interpretation, setInterpretation] = useState<string | null>(null)
  const [claimSubmitting, setClaimSubmitting] = useState(false)
  const [reclamationModalOpen, setReclamationModalOpen] = useState(false)
  const [reclamationIncidentDate, setReclamationIncidentDate] = useState('')
  const [reclamationDescription, setReclamationDescription] = useState('')
  const [reclamationAnalyzing, setReclamationAnalyzing] = useState(false)
  const [reclamationResult, setReclamationResult] = useState<{ id: number; ai_analysis_text: string; ai_recommendation: string; status: string } | null>(null)
  const [reclamationUpdating, setReclamationUpdating] = useState(false)
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')

  const fetchContracts = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (filterDateFrom) params.set('date_from', filterDateFrom)
    if (filterDateTo) params.set('date_to', filterDateTo)
    const qs = params.toString()
    authFetch(qs ? `/api/contracts/?${qs}` : '/api/contracts/')
      .then((r) => {
        if (!r.ok) throw new Error()
        return r.json()
      })
      .then(setContracts)
      .catch(() => setContracts([]))
      .finally(() => setLoading(false))
  }, [filterDateFrom, filterDateTo])

  useEffect(() => {
    fetchContracts()
  }, [fetchContracts])

  async function openDetail(id: number) {
    setLoadingDetail(true)
    setDetail(null)
    setInterpretation(null)
    try {
      const res = await authFetch(`/api/contracts/${id}/`)
      if (!res.ok) throw new Error()
      const full = (await res.json()) as ContractDetail
      setDetail(full)
      if (full.audit?.id) {
        const resInterp = await authFetch(`/api/audits/${full.audit.id}/interpretation/?lang=${lang}`)
        if (resInterp.ok) {
          const data = await resInterp.json()
          setInterpretation(data.interpretation || null)
        }
      }
    } catch {
      setDetail(null)
      setInterpretation(null)
    } finally {
      setLoadingDetail(false)
    }
  }

  function closeDetail() {
    setDetail(null)
    setInterpretation(null)
  }

  const polygonFromAudit = (audit: ContractDetail['audit']): [number, number][] | undefined => {
    if (!audit?.report_data?.polygon_coords || audit.report_data.polygon_coords.length < 3) return undefined
    return audit.report_data.polygon_coords.map(([lon, lat]) => [lat, lon] as [number, number])
  }

  function openReclamationModal() {
    setReclamationModalOpen(true)
    setReclamationIncidentDate('')
    setReclamationDescription('')
    setReclamationResult(null)
  }

  function closeReclamationModal() {
    setReclamationModalOpen(false)
    setReclamationResult(null)
    setReclamationAnalyzing(false)
    setReclamationUpdating(false)
  }

  async function analyzeAndCreateClaim() {
    if (!detail?.id) return
    const incidentDate = reclamationIncidentDate.trim()
    if (!incidentDate) {
      onShowToast?.(t('claimIncidentDate') + ' required')
      return
    }
    setReclamationAnalyzing(true)
    setReclamationResult(null)
    const delay = new Promise((r) => setTimeout(r, ANALYZE_DELAY_MS))
    try {
      await delay
      const res = await authFetch('/api/claims/create/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contract_id: detail.id,
          incident_date: incidentDate,
          description: reclamationDescription.trim(),
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error((json as { error?: string }).error || 'Failed to create claim')
      setReclamationResult({
        id: json.id,
        ai_analysis_text: json.ai_analysis_text || json.ai_advice || '',
        ai_recommendation: json.ai_recommendation || '',
        status: json.status || 'en_cours',
      })
    } catch (e) {
      onShowToast?.(e instanceof Error ? e.message : 'Error')
    } finally {
      setReclamationAnalyzing(false)
    }
  }

  async function setClaimStatus(claimId: number, status: string) {
    setReclamationUpdating(true)
    try {
      const res = await authFetch(`/api/claims/${claimId}/status/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (res.ok) {
        onShowToast?.(t('claimFiledSuccess'))
        closeReclamationModal()
        closeDetail()
        onNavigateToReclamations?.()
      } else {
        const err = await res.json().catch(() => ({}))
        onShowToast?.((err as { error?: string }).error || 'Error')
      }
    } catch (e) {
      onShowToast?.(e instanceof Error ? e.message : 'Error')
    } finally {
      setReclamationUpdating(false)
    }
  }

  return (
    <div className="p-6 max-w-6xl">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-100">{t('navContrats')}</h2>
        <p className="text-slate-500 mt-1">{t('historyDesc')}</p>
      </div>

      <div className="mb-4 p-4 rounded-xl border border-slate-700/80 bg-slate-800/30 flex flex-wrap items-end gap-4">
        <div className="flex items-center gap-2 text-slate-400">
          <Filter size={18} />
          <span className="text-sm font-medium">{t('filters')}</span>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">{t('filterDateFrom')}</label>
          <input
            type="date"
            value={filterDateFrom}
            onChange={(e) => setFilterDateFrom(e.target.value)}
            className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-200 focus:border-emerald-500 outline-none"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">{t('filterDateTo')}</label>
          <input
            type="date"
            value={filterDateTo}
            onChange={(e) => setFilterDateTo(e.target.value)}
            className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-200 focus:border-emerald-500 outline-none"
          />
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-14 bg-slate-800/50 rounded-xl border border-slate-700/80 animate-pulse" />
          ))}
        </div>
      ) : contracts.length === 0 ? (
        <div className="rounded-xl border border-slate-700/80 bg-slate-800/30 p-12 text-center">
          <div className="mx-auto w-24 h-24 rounded-full bg-slate-700/50 flex items-center justify-center mb-6">
            <FileText size={48} className="text-slate-500" />
          </div>
          <p className="text-lg font-medium text-slate-300">{t('emptyContractsTitle')}</p>
          <p className="text-sm text-slate-500 mt-2 max-w-md mx-auto">{t('emptyContractsDesc')}</p>
          <p className="text-sm text-slate-500 mt-1">{t('runFromMap')}</p>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-700/80 bg-slate-800/30 overflow-hidden shadow-sm">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-700/80 bg-slate-800/50">
                <th className="px-4 py-3 font-medium text-slate-400">{t('tablePolicyNumber')}</th>
                <th className="px-4 py-3 font-medium text-slate-400">{t('farmerName')}</th>
                <th className="px-4 py-3 font-medium text-slate-400">{t('farmName')}</th>
                <th className="px-4 py-3 font-medium text-slate-400">{t('totalSurface')}</th>
                <th className="px-4 py-3 font-medium text-slate-400">{t('tableDate')}</th>
                <th className="px-4 py-3 font-medium text-slate-400">{t('tableRiskStatus')}</th>
                <th className="px-4 py-3 font-medium text-slate-400 w-28">{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {contracts.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => openDetail(c.id)}
                  className="border-b border-slate-700/50 hover:bg-slate-700/30 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 font-mono text-emerald-400 font-medium">{c.policy_number}</td>
                  <td className="px-4 py-3 text-slate-300">{c.farmer_name}</td>
                  <td className="px-4 py-3 text-slate-400">{c.farm_name || '—'}</td>
                  <td className="px-4 py-3 text-slate-400">{c.surface_ha != null ? `${c.surface_ha} ha` : '—'}</td>
                  <td className="px-4 py-3 text-slate-400">
                    {c.start_date ? new Date(c.start_date).toLocaleDateString() : '—'} – {c.end_date ? new Date(c.end_date).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-slate-700 text-slate-300">
                      {c.verdict || '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={(e) => { e.stopPropagation(); openDetail(c.id); }}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-700 text-slate-200 hover:bg-emerald-500/20 hover:text-emerald-400 text-xs font-medium transition-colors"
                    >
                      <FileText size={14} />
                      {t('viewDownload')}
                    </button>
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
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 animate-in" onClick={closeDetail}>
          <div
            className="relative z-[10000] w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between p-4 border-b border-slate-700 bg-slate-900">
              <h3 className="text-lg font-semibold text-slate-100">
                {t('contractDetail')} — {detail.policy_number}
              </h3>
              <div className="flex items-center gap-3">
                <button
                  onClick={openReclamationModal}
                  disabled={claimSubmitting}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-600 text-white text-sm font-semibold hover:bg-amber-500 disabled:opacity-50 transition-colors"
                >
                  <AlertCircle size={16} />
                  {t('launchReclamation')}
                </button>
                <button
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-500 transition-colors"
                >
                  <Download size={16} />
                  {t('downloadReport')}
                </button>
                <button onClick={closeDetail} className="p-2 rounded-xl text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors">
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-4">
                  <p className="text-xs text-slate-500 uppercase">{t('tablePolicyNumber')}</p>
                  <p className="text-lg font-semibold text-emerald-400">{detail.policy_number}</p>
                </div>
                <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-4">
                  <p className="text-xs text-slate-500 uppercase">{t('farmerName')}</p>
                  <p className="text-lg font-semibold text-slate-300">{detail.farmer_name}</p>
                </div>
                <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-4">
                  <p className="text-xs text-slate-500 uppercase">{t('farmName')}</p>
                  <p className="text-lg font-semibold text-slate-300">{detail.farm_name || '—'}</p>
                </div>
                <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-4">
                  <p className="text-xs text-slate-500 uppercase">{t('totalSurface')}</p>
                  <p className="text-lg font-semibold text-slate-300">{detail.surface_ha != null ? `${detail.surface_ha} ha` : '—'}</p>
                </div>
              </div>

              {(detail.audit || (detail.boundary_coordinates && detail.boundary_coordinates.length >= 3)) && (
                <>
                  <div>
                    <h4 className="text-sm font-medium text-slate-400 mb-2">{t('mapParcel')}</h4>
                    <ParcelMap
                      key={`contract-${detail.id}-audit-${detail.audit?.id ?? 0}`}
                      center={detail.audit ? [detail.audit.latitude, detail.audit.longitude] : [detail.boundary_coordinates![0][0], detail.boundary_coordinates![0][1]]}
                      polygon={detail.boundary_coordinates?.length >= 3 ? detail.boundary_coordinates : (detail.audit ? polygonFromAudit(detail.audit) : undefined)}
                      height="280px"
                    />
                  </div>
                  {detail.audit && (
                    <>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-4">
                          <p className="text-xs text-slate-500 uppercase">{t('metricNdviCurrent')}</p>
                          <p className="text-xl font-semibold text-emerald-400">{detail.audit.current_ndvi?.toFixed(4) ?? '—'}</p>
                        </div>
                        <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-4">
                          <p className="text-xs text-slate-500 uppercase">{t('metricBaseline')}</p>
                          <p className="text-xl font-semibold text-slate-300">{detail.audit.historical_avg_5y?.toFixed(4) ?? '—'}</p>
                        </div>
                        <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-4">
                          <p className="text-xs text-slate-500 uppercase">{t('metricDeviation')}</p>
                          <p className={`text-xl font-semibold ${(detail.audit.deviation_score ?? 0) < 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                            {(detail.audit.deviation_score ?? 0) > 0 ? '+' : ''}{detail.audit.deviation_score?.toFixed(2) ?? '—'}%
                          </p>
                        </div>
                        <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-4">
                          <p className="text-xs text-slate-500 uppercase">{t('metricClouds')}</p>
                          <p className="text-xl font-semibold text-slate-300">{detail.audit.cloud_coverage?.toFixed(1) ?? '—'}%</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <VerdictBadge verdict={(detail.audit.report_data as { verdict?: string })?.verdict || 'Pending'} deviation={detail.audit.deviation_score} />
                      </div>
                      {detail.audit.report_data?.historical_trend?.length > 0 && (
                        <div className="rounded-xl border border-slate-700 bg-slate-800/30 p-4">
                          <h4 className="text-sm font-medium text-slate-400 mb-4">{t('ndviEvolution')}</h4>
                          <TrendChart
                            historicalTrend={detail.audit.report_data.historical_trend}
                            currentNdvi={detail.audit.current_ndvi ?? undefined}
                            historicalAvg={detail.audit.historical_avg_5y ?? undefined}
                          />
                        </div>
                      )}
                    </>
                  )}
                </>
              )}

              <div className="rounded-xl border border-slate-700 bg-slate-800/30 p-4">
                <h4 className="text-sm font-medium text-slate-400 mb-2">{t('interpretationPanel')}</h4>
                <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{interpretation ?? t('interpretationLoading')}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {reclamationModalOpen && detail && (
        <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4 bg-black/60" onClick={closeReclamationModal}>
          <div
            className="relative z-[10002] w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-slate-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-100">{t('launchReclamation')}</h3>
              <button type="button" onClick={closeReclamationModal} className="p-2 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-slate-200">
                <X size={20} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {!reclamationResult ? (
                <>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 uppercase mb-1">{t('dateConstatation')}</label>
                    <input
                      type="date"
                      value={reclamationIncidentDate}
                      onChange={(e) => setReclamationIncidentDate(e.target.value)}
                      className="w-full rounded-lg bg-slate-800 border border-slate-600 px-3 py-2 text-sm text-slate-200 focus:border-emerald-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 uppercase mb-1">{t('descriptionDetaillee')}</label>
                    <textarea
                      value={reclamationDescription}
                      onChange={(e) => setReclamationDescription(e.target.value)}
                      rows={4}
                      className="w-full rounded-lg bg-slate-800 border border-slate-600 px-3 py-2 text-sm text-slate-200 focus:border-emerald-500 outline-none resize-none"
                      placeholder={t('descriptionDetaillee')}
                    />
                  </div>
                  {reclamationAnalyzing ? (
                    <div className="flex flex-col items-center justify-center gap-4 py-8 rounded-xl border border-cyan-500/30 bg-slate-800/50">
                      <div className="h-12 w-12 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                      <p className="text-sm text-cyan-300 text-center max-w-sm">{t('analyzingSpectralData')}</p>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={analyzeAndCreateClaim}
                      disabled={!reclamationIncidentDate.trim()}
                      className="w-full px-4 py-3 rounded-xl bg-amber-600 text-white font-semibold text-sm hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {t('analyseSinistre')}
                    </button>
                  )}
                </>
              ) : (
                <>
                  <div className="rounded-xl border border-cyan-500/30 bg-slate-800/50 p-4 shadow-inner">
                    <p className="text-xs font-semibold text-cyan-400 uppercase tracking-wide mb-2">{t('expertAdvice')}</p>
                    <p className="text-sm text-slate-300 whitespace-pre-wrap">{reclamationResult.ai_analysis_text}</p>
                    <p className="text-sm text-emerald-400 mt-2 font-medium">{reclamationResult.ai_recommendation}</p>
                  </div>
                  <div className="flex gap-3 pt-2 flex-wrap">
                    <button
                      type="button"
                      disabled={reclamationUpdating}
                      onClick={() => setClaimStatus(reclamationResult.id, 'approuve')}
                      className="flex-1 min-w-[140px] px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-500 disabled:opacity-50"
                    >
                      {t('acceptSinistre')}
                    </button>
                    <button
                      type="button"
                      disabled={reclamationUpdating}
                      onClick={() => setClaimStatus(reclamationResult.id, 'refuse')}
                      className="flex-1 min-w-[100px] px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-500 disabled:opacity-50"
                    >
                      {t('claimRefuse')}
                    </button>
                    <button
                      type="button"
                      disabled={reclamationUpdating}
                      onClick={() => setClaimStatus(reclamationResult.id, 'en_attente')}
                      className="flex-1 min-w-[140px] px-4 py-2.5 rounded-xl bg-amber-500 text-white text-sm font-semibold hover:bg-amber-400 disabled:opacity-50"
                    >
                      {t('miseEnAttenteExpertise')}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
