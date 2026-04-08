import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Polygon, useMap } from 'react-leaflet'
import L from 'leaflet'

const GOOGLE_HYBRID_URL = 'https://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}'
const GOOGLE_SUBDOMAINS = ['mt0', 'mt1', 'mt2', 'mt3']

const markerIcon = L.divIcon({
  html: '<div style="background:#22c55e;width:24px;height:24px;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3)"></div>',
  className: 'custom-marker',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
})

function FitBounds({ positions }: { positions: [number, number][] }) {
  const map = useMap()
  useEffect(() => {
    if (positions.length >= 2) {
      const bounds = L.latLngBounds(positions)
      map.fitBounds(bounds, { padding: [20, 20], maxZoom: 14 })
    } else if (positions.length === 1) {
      map.setView(positions[0], 14)
    }
  }, [map, positions])
  return null
}

interface ParcelMapProps {
  center: [number, number]
  polygon?: [number, number][]  // Leaflet format [lat, lon][]
  zoom?: number
  className?: string
  height?: string
}

export default function ParcelMap({ center, polygon, zoom = 14, className = '', height = '300px' }: ParcelMapProps) {
  const hasPolygon = polygon && polygon.length >= 3
  const positions = hasPolygon ? polygon : [center]

  return (
    <div className={className} style={{ height }}>
      <MapContainer
        center={center}
        zoom={zoom}
        className="h-full w-full rounded-xl"
        scrollWheelZoom
        style={{ minHeight: height }}
      >
        <TileLayer
          attribution="&copy; Google"
          url={GOOGLE_HYBRID_URL}
          subdomains={GOOGLE_SUBDOMAINS}
          maxZoom={20}
          maxNativeZoom={20}
        />
        {hasPolygon ? (
          <Polygon
            positions={polygon}
            pathOptions={{
              color: '#22c55e',
              weight: 3,
              fillColor: '#22c55e',
              fillOpacity: 0.25,
            }}
          />
        ) : (
          <Marker position={center} icon={markerIcon} />
        )}
        <FitBounds positions={positions} />
      </MapContainer>
    </div>
  )
}
