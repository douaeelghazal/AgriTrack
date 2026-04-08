import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from 'recharts'

interface TrendChartProps {
  historicalTrend: { year: number; data: { month: number; ndvi: number }[] }[]
  currentNdvi?: number
  historicalAvg?: number
}

export default function TrendChart({
  historicalTrend,
  currentNdvi,
  historicalAvg,
}: TrendChartProps) {
  const currentYear = new Date().getFullYear()
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

  const chartData = months.map((name, i) => {
    const point: Record<string, string | number> = { name, month: i + 1 }
    historicalTrend?.forEach((t) => {
      const d = t.data?.find((x) => x.month === i + 1)
      point[`y${t.year}`] = d ? Math.round(d.ndvi * 1000) / 1000 : null
    })
    return point
  })

  const colors = ['#22c55e', '#3b82f6', '#a855f7', '#f59e0b', '#ef4444']
  const years = historicalTrend?.map((t) => t.year).sort() || []

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e2a38" />
          <XAxis
            dataKey="name"
            stroke="#6b7280"
            fontSize={11}
            tickLine={false}
            axisLine={{ stroke: '#1e2a38' }}
          />
          <YAxis
            stroke="#6b7280"
            fontSize={11}
            domain={[0.2, 0.9]}
            tickLine={false}
            axisLine={{ stroke: '#1e2a38' }}
            tickFormatter={(v) => v.toFixed(2)}
          />
          <Tooltip
            contentStyle={{ backgroundColor: '#151d26', border: '1px solid #1e2a38', borderRadius: 8 }}
            labelStyle={{ color: '#9ca3af' }}
            formatter={(value: number) => [value?.toFixed(4) ?? '-', 'NDVI']}
            labelFormatter={(label) => `Month: ${label}`}
          />
          <Legend
            wrapperStyle={{ fontSize: 12 }}
            formatter={(value) => <span className="text-gray-400">{value}</span>}
          />
          {historicalAvg != null && (
            <ReferenceLine
              y={historicalAvg}
              stroke="#6b7280"
              strokeDasharray="4 4"
              label={{ value: '5Y Avg', position: 'right', fill: '#6b7280', fontSize: 10 }}
            />
          )}
          {years.map((year, i) => (
            <Line
              key={year}
              type="monotone"
              dataKey={`y${year}`}
              name={String(year)}
              stroke={colors[i % colors.length]}
              strokeWidth={2}
              dot={false}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
