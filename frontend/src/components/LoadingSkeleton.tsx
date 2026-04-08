import { Satellite } from 'lucide-react'

export default function LoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-4 p-6 bg-agri-card rounded-xl border border-agri-border">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-agri-accent/20 rounded-lg">
          <Satellite className="text-agri-accent" size={24} />
        </div>
        <div className="space-y-2">
          <div className="h-4 bg-agri-border rounded w-48" />
          <div className="h-3 bg-agri-border rounded w-64" />
        </div>
      </div>
      <div className="space-y-2">
        <div className="h-3 bg-agri-border rounded w-full" />
        <div className="h-3 bg-agri-border rounded w-5/6" />
        <div className="h-3 bg-agri-border rounded w-4/5" />
      </div>
      <p className="text-sm text-gray-400 italic">
        Analyzing Sentinel-2 Satellite Bands...
      </p>
      <div className="grid grid-cols-3 gap-4 pt-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-agri-border rounded-lg" />
        ))}
      </div>
    </div>
  )
}
