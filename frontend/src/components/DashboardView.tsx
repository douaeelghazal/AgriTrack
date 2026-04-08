import { useState, useEffect, useCallback } from 'react'
import { FileText, AlertTriangle, AlertCircle, ClipboardList, TrendingDown, Calendar } from 'lucide-react'
import { useLang } from '../i18n'
import { authFetch } from '../api'

interface DashboardStats {
  total_contracts: number
  total_insured_ha: number
  average_portfolio_risk: number | null
  expiring_soon: number
  claims_today: number
  pending_claims: number
  high_risk_anomalies: number
  payout_estimates: number
}

export default function DashboardView() {
  const { t } = useLang()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchStats = useCallback(() => {
    authFetch('/api/dashboard-stats/')
      .then((r) => {
        if (!r.ok) throw new Error()
        return r.json()
      })
      .then(setStats)
      .catch(() => setStats(null))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetchStats()
    const interval = setInterval(fetchStats, 30000)
    const onFocus = () => fetchStats()
    window.addEventListener('focus', onFocus)
    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', onFocus)
    }
  }, [fetchStats])

  const cards = [
    {
      key: 'contracts',
      label: t('kpiContratsActifs'),
      value: loading ? '—' : (stats?.total_contracts ?? 0),
      icon: FileText,
      className: 'bg-slate-800/80 border-slate-700 text-emerald-400',
    },
    {
      key: 'ha',
      label: t('kpiTotalHa'),
      value: loading ? '—' : (stats?.total_insured_ha?.toFixed(1) ?? '0'),
      icon: TrendingDown,
      className: 'bg-slate-800/80 border-slate-700 text-sky-400',
    },
    {
      key: 'risk',
      label: t('kpiAvgRisk'),
      value: loading ? '—' : (stats?.average_portfolio_risk != null ? `${stats.average_portfolio_risk}%` : '—'),
      icon: AlertTriangle,
      className: 'bg-slate-800/80 border-slate-700 text-slate-300',
    },
    {
      key: 'expiring',
      label: t('kpiExpiringSoon'),
      value: loading ? '—' : (stats?.expiring_soon ?? 0),
      icon: Calendar,
      className: (stats?.expiring_soon ?? 0) > 0 ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' : 'bg-slate-800/80 border-slate-700 text-slate-300',
    },
    {
      key: 'claims_today',
      label: t('kpiClaimsToday'),
      value: loading ? '—' : (stats?.claims_today ?? 0),
      icon: AlertCircle,
      className: 'bg-slate-800/80 border-slate-700 text-slate-300',
    },
    {
      key: 'pending_claims',
      label: t('kpiPendingClaims'),
      value: loading ? '—' : (stats?.pending_claims ?? 0),
      icon: AlertCircle,
      className: (stats?.pending_claims ?? 0) > 0 ? 'bg-violet-500/10 border-violet-500/30 text-violet-400' : 'bg-slate-800/80 border-slate-700 text-slate-300',
    },
    {
      key: 'high_risk',
      label: t('kpiHighRiskAnomalies'),
      value: loading ? '—' : (stats?.high_risk_anomalies ?? 0),
      icon: AlertTriangle,
      className: (stats?.high_risk_anomalies ?? 0) > 0 ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' : 'bg-slate-800/80 border-slate-700 text-slate-300',
    },
    {
      key: 'payout',
      label: t('kpiPayoutEstimates'),
      value: loading ? '—' : (stats?.payout_estimates ?? 0),
      icon: ClipboardList,
      className: 'bg-slate-800/80 border-slate-700 text-emerald-400',
    },
  ]

  return (
    <div className="p-6 max-w-6xl">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-100">{t('navDashboard')}</h2>
        <p className="text-slate-500 mt-1">{t('platform')} — MAMDA</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4 gap-4">
        {cards.map(({ key, label, value, icon: Icon, className }) => (
          <div
            key={key}
            className={`rounded-xl border p-5 shadow-sm transition-all hover:shadow-md ${className}`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
                <p className="text-2xl font-bold mt-1">{value}</p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-white/5 flex items-center justify-center">
                <Icon size={20} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
