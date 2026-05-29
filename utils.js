export function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export function hav(a, b, c, d) {
  const R = 6371000, dl = (c - a) * Math.PI / 180, dn = (d - b) * Math.PI / 180
  const x = Math.sin(dl / 2) ** 2 + Math.cos(a * Math.PI / 180) * Math.cos(c * Math.PI / 180) * Math.sin(dn / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
}

// nsim: strips non-alphanumeric and lowercases both strings, returns 1 for exact match, 0.8 if one contains the other, 0 otherwise
export function nsim(a, b) {
  a = a.toLowerCase().replace(/[^a-z0-9]/g, '')
  b = b.toLowerCase().replace(/[^a-z0-9]/g, '')
  if (a === b) return 1
  if (a.includes(b) || b.includes(a)) return 0.8
  return 0
}

export function calcStep(bbox) {
  const area = (bbox[2] - bbox[0]) * (bbox[3] - bbox[1])
  if (area < 5) return 0.5
  if (area < 50) return 1.0
  if (area < 300) return 2.0
  return 3.0
}

export function setStatus(msg) {
  document.getElementById('mc-status').textContent = msg
}

export function getMapBounds() {
  const p = new URLSearchParams(window.location.search)
  const lat = parseFloat(p.get('lat')), lng = parseFloat(p.get('lng')), zoom = parseFloat(p.get('zoom'))
  if (isNaN(lat) || isNaN(lng) || isNaN(zoom)) return null

  function latToY(la, z) {
    const r = la * Math.PI / 180
    return (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * Math.pow(2, z)
  }
  function yToLat(y, z) {
    return 180 / Math.PI * Math.atan(Math.sinh(Math.PI - 2 * Math.PI * y / Math.pow(2, z)))
  }

  const mapW = window.innerWidth - 380
  const mapH = window.innerHeight
  const tilesWide = mapW / 256, tilesHigh = mapH / 256

  const yCenter = latToY(lat, zoom)
  const latNorth = yToLat(yCenter - tilesHigh / 2, zoom)
  const latSouth = yToLat(yCenter + tilesHigh / 2, zoom)
  const lngHalf = (tilesWide / 2) * (360 / Math.pow(2, zoom))

  const latPad = (latNorth - latSouth) * 0.2
  const lngPad = lngHalf * 0.2
  return [latSouth - latPad, lng - lngHalf - lngPad, latNorth + latPad, lng + lngHalf + lngPad]
}
