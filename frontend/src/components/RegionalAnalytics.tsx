import { BarChart3, TrendingUp } from 'lucide-react'
import { useLang } from '../i18n'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  LineChart,
  Line,
} from 'recharts'

const droughtData = [
  { region: 'Gharb', risk: 0.2 },
  { region: 'Haouz', risk: 0.65 },
  { region: 'Souss', risk: 0.8 },
  { region: 'Chaouia', risk: 0.35 },
  { region: 'Oriental', risk: 0.55 },
]

const reservoirData = [
  { month: 'Jan', alMassira: 0.42, binElOuidane: 0.58, mansourEddahbi: 0.33 },
  { month: 'Mar', alMassira: 0.39, binElOuidane: 0.55, mansourEddahbi: 0.30 },
  { month: 'May', alMassira: 0.35, binElOuidane: 0.5, mansourEddahbi: 0.28 },
  { month: 'Jul', alMassira: 0.31, binElOuidane: 0.47, mansourEddahbi: 0.25 },
  { month: 'Sep', alMassira: 0.29, binElOuidane: 0.44, mansourEddahbi: 0.22 },
]

export default function RegionalAnalytics() {
  const { t } = useLang()
  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <div className="mb-2">
        <h2 className="text-2xl font-bold text-gray-100">{t('analyticsTitle')}</h2>
        <p className="text-gray-500 mt-1">{t('analyticsDesc')}</p>
      </div>

      {/* NDVI / scorecards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-agri-card rounded-xl border border-agri-border p-6 hover-lift">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-agri-accent/20 rounded-lg">
              <BarChart3 className="text-agri-accent" size={24} />
            </div>
            <h3 className="font-semibold text-gray-200">Chaouia-Ouardigha</h3>
          </div>
          <p className="text-3xl font-bold text-agri-accent">0.52</p>
          <p className="text-sm text-gray-500 mt-1">Avg NDVI (5Y)</p>
          <p className="text-xs text-gray-400 mt-2">Berrechid • Settat</p>
        </div>

        <div className="bg-agri-card rounded-xl border border-agri-border p-6 hover-lift">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-agri-warning/20 rounded-lg">
              <TrendingUp className="text-agri-warning" size={24} />
            </div>
            <h3 className="font-semibold text-gray-200">Doukkala-Abda</h3>
          </div>
          <p className="text-3xl font-bold text-agri-warning">-4.2%</p>
          <p className="text-sm text-gray-500 mt-1">YTD NDVI deviation</p>
          <p className="text-xs text-gray-400 mt-2">Safi • El Jadida</p>
        </div>

        <div className="bg-agri-card rounded-xl border border-agri-border p-6 hover-lift">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-agri-accent/20 rounded-lg">
              <BarChart3 className="text-agri-accent" size={24} />
            </div>
            <h3 className="font-semibold text-gray-200">Gharb-Chrarda</h3>
          </div>
          <p className="text-3xl font-bold text-agri-accent">0.61</p>
          <p className="text-sm text-gray-500 mt-1">Avg NDVI (5Y)</p>
          <p className="text-xs text-gray-400 mt-2">Kenitra • Sidi Kacem</p>
        </div>
      </div>

      {/* Drought Risk Map (mock heatmap) */}
      <div className="bg-agri-card rounded-xl border border-agri-border p-6 hover-lift">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-100">Drought Risk Map — Morocco</h3>
            <p className="text-xs text-gray-500">
              Mock NDVI‑derived index by region (0 = no risk, 1 = extreme risk).
            </p>
          </div>
          <div className="hidden md:flex items-center gap-2 text-[11px] text-gray-400">
            <span className="inline-block h-3 w-3 rounded-full bg-agri-accent" /> Low
            <span className="inline-block h-3 w-3 rounded-full bg-agri-warning" /> Medium
            <span className="inline-block h-3 w-3 rounded-full bg-agri-danger" /> High
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {droughtData.map((d) => {
            const color =
              d.risk > 0.7 ? 'bg-agri-danger/30 border-agri-danger/60' : d.risk > 0.4 ? 'bg-agri-warning/20 border-agri-warning/60' : 'bg-agri-accent/10 border-agri-accent/60'
            return (
              <div
                key={d.region}
                className={`rounded-lg border px-3 py-3 flex flex-col gap-1 ${color}`}
              >
                <p className="text-xs font-medium text-gray-200">{d.region}</p>
                <p className="text-lg font-semibold text-gray-100">{Math.round(d.risk * 100)}%</p>
                <p className="text-[10px] text-gray-400">Composite drought risk</p>
              </div>
            )
          })}
        </div>
      </div>

      {/* Reservoir levels chart */}
      <div className="bg-agri-card rounded-xl border border-agri-border p-6 hover-lift">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-100">Regional Reservoir Levels</h3>
            <p className="text-xs text-gray-500">
              Mock storage levels for key dams (% of capacity) — operational view for risk & underwriting.
            </p>
          </div>
        </div>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={reservoirData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2a38" />
              <XAxis dataKey="month" stroke="#6b7280" fontSize={11} tickLine={false} axisLine={{ stroke: '#1e2a38' }} />
              <YAxis
                stroke="#6b7280"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: '#1e2a38' }}
                domain={[0.2, 0.7]}
                tickFormatter={(v) => `${Math.round(v * 100)}%`}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#151d26', border: '1px solid #1e2a38', borderRadius: 8 }}
                labelStyle={{ color: '#9ca3af' }}
                formatter={(value: number, name: string) => [`${Math.round((value || 0) * 100)}%`, name]}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} formatter={(value) => <span className="text-gray-400">{value}</span>} />
              <Line type="monotone" dataKey="alMassira" name="Al Massira" stroke="#22c55e" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="binElOuidane" name="Bin El Ouidane" stroke="#3b82f6" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="mansourEddahbi" name="Mansour Eddahbi" stroke="#eab308" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

