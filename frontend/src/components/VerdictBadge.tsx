import { CheckCircle, AlertTriangle, XCircle } from 'lucide-react'

interface VerdictBadgeProps {
  verdict: string
  deviation?: number
}

export default function VerdictBadge({ verdict, deviation }: VerdictBadgeProps) {
  const isHealthy = verdict?.toLowerCase().includes('healthy')
  const isHighRisk = verdict?.toLowerCase().includes('high risk') || verdict?.toLowerCase().includes('drought')
  const isModerate = verdict?.toLowerCase().includes('moderate')

  let bg = 'bg-agri-accent/20'
  let text = 'text-agri-accent'
  let Icon = CheckCircle

  if (isHighRisk) {
    bg = 'bg-agri-danger/20'
    text = 'text-agri-danger'
    Icon = XCircle
  } else if (isModerate) {
    bg = 'bg-agri-warning/20'
    text = 'text-agri-warning'
    Icon = AlertTriangle
  }

  return (
    <span
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-full font-semibold ${bg} ${text}`}
    >
      <Icon size={18} />
      {verdict}
      {deviation != null && (
        <span className="text-gray-400 font-normal text-sm">
          ({deviation > 0 ? '+' : ''}{deviation}%)
        </span>
      )}
    </span>
  )
}
