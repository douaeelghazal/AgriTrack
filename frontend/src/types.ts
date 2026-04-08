export interface ParcelAuditResult {
  id?: number
  latitude: number
  longitude: number
  area_ha?: number
  current_ndvi?: number
  historical_avg_5y?: number
  deviation_score?: number
  cloud_coverage?: number
  report_data: {
    verdict?: string
    natural_color_url?: string
    ndvi_heatmap_url?: string
    historical_trend?: { year: number; data: { month: number; ndvi: number }[] }[]
    acquisition_date?: string
    satellite?: string
    polygon_coords?: number[][]
  }
  created_at?: string
}
