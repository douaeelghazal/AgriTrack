import { useState, useEffect } from 'react'
import VerdictBadge from './VerdictBadge'
import TrendChart from './TrendChart'
import type { ParcelAuditResult } from '../types'
import { useLang } from '../i18n'

type ReportLang = 'en' | 'fr' | 'ar'

const TEXTS: Record<
  ReportLang,
  {
    brand: string
    auditResult: string
    reportLang: string
    naturalTitle: string
    naturalSubtitle: string
    ndviTitle: string
    ndviSubtitle: string
    currentNdvi: string
    baseline: string
    deviation: string
    clouds: string
    baselineChartTitle: string
    exportLabel: string
  }
> = {
  en: {
    reportLang: 'Report language',
    brand: 'AgriTrack • MAMDA • Crédit Agricole',
    auditResult: 'Audit Result',
    naturalTitle: 'Natural Color',
    naturalSubtitle: 'Real view for identification.',
    ndviTitle: 'NDVI Heatmap',
    ndviSubtitle: 'Health index (Green = Healthy, Red = Stress).',
    currentNdvi: 'Current NDVI (Today)',
    baseline: '5Y NDVI Baseline',
    deviation: 'Deviation vs 5Y Baseline',
    clouds: 'Cloud Coverage',
    baselineChartTitle: '5-Year NDVI Baseline vs Current',
    exportLabel: 'Export Report',
  },
  fr: {
    reportLang: 'Langue du rapport',
    auditResult: "Résultat d'audit",
    naturalTitle: 'Natural Color',
    naturalSubtitle: 'Vue réelle pour vérifier le bon champ.',
    ndviTitle: 'NDVI Heatmap',
    ndviSubtitle: 'Indice de santé (Vert = sain, Rouge = stress).',
    currentNdvi: 'NDVI courant (Aujourd’hui)',
    baseline: 'Baseline NDVI sur 5 ans',
    deviation: 'Écart vs baseline 5 ans',
    clouds: 'Couverture nuageuse',
    baselineChartTitle: 'Baseline NDVI 5 ans vs courant',
    exportLabel: 'Exporter le rapport',
  },
  ar: {
    reportLang: 'لغة التقرير',
    brand: 'AgriTrack • المغذية • القرض الفلاحي',
    auditResult: 'نتيجة التدقيق',
    naturalTitle: 'لون طبيعي',
    naturalSubtitle: 'منظر حقيقي لتحديد القطعة.',
    ndviTitle: 'خريطة NDVI',
    ndviSubtitle: 'مؤشر الصحة (أخضر = سليم، أحمر = إجهاد).',
    currentNdvi: 'NDVI الحالي (اليوم)',
    baseline: 'خط أساس NDVI 5 سنوات',
    deviation: 'الانحراف مقابل خط الأساس 5 سنوات',
    clouds: 'تغطية السحب',
    baselineChartTitle: 'خط أساس NDVI 5 سنوات مقابل الحالي',
    exportLabel: 'تصدير التقرير',
  },
}

interface AuditResultPanelProps {
  result: ParcelAuditResult
  onExport?: () => void
}

export default function AuditResultPanel({ result, onExport }: AuditResultPanelProps) {
  const { lang: uiLang } = useLang()
  const rd = result.report_data || {}
  const naturalUrl = rd.natural_color_url
  const ndviUrl = rd.ndvi_heatmap_url
  const trend = rd.historical_trend || []
  const [lang, setLang] = useState<ReportLang>(uiLang === 'ar' ? 'ar' : uiLang === 'en' ? 'en' : 'fr')
  useEffect(() => {
    setLang(uiLang === 'ar' ? 'ar' : uiLang === 'en' ? 'en' : 'fr')
  }, [uiLang])
  const t = TEXTS[lang]

  return (
    <div className="bg-agri-card rounded-xl border border-agri-border overflow-hidden print-layout hover-lift">
      <div className="p-6 border-b border-agri-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-agri-accent uppercase">{t.brand}</p>
          <h3 className="text-lg font-semibold text-gray-100 mt-1">{t.auditResult}</h3>
          <p className="text-sm text-gray-500 mt-0.5">
            {result.latitude.toFixed(6)}, {result.longitude.toFixed(6)} • {result.area_ha ? `${result.area_ha} ha` : 'Parcel'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-gray-500 uppercase">{t.reportLang}</label>
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value as ReportLang)}
              className="no-print w-full sm:w-auto min-w-[120px] bg-agri-dark border border-agri-border rounded-lg px-3 py-2 text-xs font-medium text-gray-200 focus:border-agri-accent outline-none transition-colors cursor-pointer"
            >
              <option value="fr">Français</option>
              <option value="en">English</option>
              <option value="ar">العربية</option>
            </select>
          </div>
          <VerdictBadge verdict={rd.verdict || 'Pending'} deviation={result.deviation_score} />
          {onExport && (
            <button
              onClick={onExport}
              className="no-print inline-flex items-center justify-center px-4 py-2.5 rounded-lg bg-agri-accent text-agri-dark text-sm font-semibold hover:bg-green-500 transition-all duration-200 shadow-sm"
            >
              {t.exportLabel}
            </button>
          )}
        </div>
      </div>

      {/* Dual view: Natural Color vs NDVI Heatmap */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-6">
        <div>
          <h4 className="text-sm font-medium text-gray-200">{t.naturalTitle}</h4>
          <p className="text-xs text-gray-500 mb-2">{t.naturalSubtitle}</p>
          <div className="aspect-video rounded-lg overflow-hidden bg-agri-dark border border-agri-border">
            {naturalUrl ? (
              <img src={naturalUrl} alt="Natural color" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-500">No image</div>
            )}
          </div>
        </div>
        <div>
          <h4 className="text-sm font-medium text-gray-200">{t.ndviTitle}</h4>
          <p className="text-xs text-gray-500 mb-2">{t.ndviSubtitle}</p>
          <div className="aspect-video rounded-lg overflow-hidden bg-agri-dark border border-agri-border">
            {ndviUrl ? (
              <img src={ndviUrl} alt="NDVI heatmap" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-500">No image</div>
            )}
          </div>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 px-6 pb-4">
        <div className="bg-agri-dark/50 rounded-lg p-4 border border-agri-border">
          <p className="text-xs text-gray-500 uppercase">{t.currentNdvi}</p>
          <p className="text-xl font-semibold text-agri-accent">{result.current_ndvi?.toFixed(4) ?? '-'}</p>
        </div>
        <div className="bg-agri-dark/50 rounded-lg p-4 border border-agri-border">
          <p className="text-xs text-gray-500 uppercase">{t.baseline}</p>
          <p className="text-xl font-semibold text-gray-300">{result.historical_avg_5y?.toFixed(4) ?? '-'}</p>
        </div>
        <div className="bg-agri-dark/50 rounded-lg p-4 border border-agri-border">
          <p className="text-xs text-gray-500 uppercase">{t.deviation}</p>
          <p className={`text-xl font-semibold ${(result.deviation_score ?? 0) < 0 ? 'text-agri-danger' : 'text-agri-accent'}`}>
            {(result.deviation_score ?? 0) > 0 ? '+' : ''}{result.deviation_score?.toFixed(2) ?? '-'}%
          </p>
        </div>
        <div className="bg-agri-dark/50 rounded-lg p-4 border border-agri-border">
          <p className="text-xs text-gray-500 uppercase">{t.clouds}</p>
          <p className="text-xl font-semibold text-gray-300">{result.cloud_coverage?.toFixed(1) ?? '-'}%</p>
        </div>
      </div>

      {/* Trend Chart */}
      {trend.length > 0 && (
        <div className="p-6 border-t border-agri-border">
          <h4 className="text-sm font-medium text-gray-400 mb-4">{t.baselineChartTitle}</h4>
          <TrendChart
            historicalTrend={trend}
            currentNdvi={result.current_ndvi}
            historicalAvg={result.historical_avg_5y}
          />
        </div>
      )}
    </div>
  )
}
