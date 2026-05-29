import { COLORS, HC_ICON_BASE, HC_ICON_FILE } from './constants.js'
import { refs, state } from './state.js'
import { esc } from './utils.js'

/* global L */

export function initLeafletMap() {
  const p = new URLSearchParams(window.location.search)
  const lat = parseFloat(p.get('lat')) || 20
  const lng = parseFloat(p.get('lng')) || 0
  const zoom = parseInt(p.get('zoom')) || 4

  const container = document.getElementById('mc-map')
  refs.leafletMap = L.map(container).setView([lat, lng], zoom)
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/">CARTO</a>',
    subdomains: 'abcd', maxZoom: 19
  }).addTo(refs.leafletMap)
  refs.markerLayer = L.layerGroup().addTo(refs.leafletMap)
}

export function makeHCIcon(hcCategory, ringColor) {
  const src = HC_ICON_BASE + (HC_ICON_FILE[hcCategory] || 'category_other.svg')
  return L.divIcon({
    className: '',
    html: `<div style="width:36px;height:36px;border-radius:50%;background:${ringColor};padding:4px;box-shadow:0 2px 6px rgba(0,0,0,.5)"><div style="width:100%;height:100%;border-radius:50%;background:#fff;display:flex;align-items:center;justify-content:center;overflow:hidden"><img src="${src}" style="width:22px;height:22px;object-fit:contain"></div></div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -20]
  })
}

export function makeOSMOnlyIcon() {
  return L.divIcon({
    className: '',
    html: `<div style="width:36px;height:36px;border-radius:50%;background:${COLORS['osm-only']};padding:4px;box-shadow:0 2px 6px rgba(0,0,0,.5)"><div style="width:100%;height:100%;border-radius:50%;background:#fff;display:flex;align-items:center;justify-content:center;font-size:18px;line-height:1;color:${COLORS['osm-only']}">?</div></div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -20]
  })
}

export function updateMarkers() {
  if (!refs.leafletMap) return
  refs.markerLayer.clearLayers()
  const ft = document.getElementById('mc-ftype')?.value || 'all'
  const visible = ft === 'all' ? state.compared : state.compared.filter(c => c.status === ft)
  visible.forEach(c => {
    const lat = c.hc ? parseFloat(c.hc.lat) : c.osm.lat
    const lng = c.hc ? parseFloat(c.hc.lng) : c.osm.lon
    const name = (c.hc && c.hc.name) || (c.osm && c.osm.name) || ''
    const hcUrl = c.hc && c.hc.pretty_url ? `https://www.happycow.net/reviews/${c.hc.pretty_url}` : null
    const osmUrl = c.osm ? `https://www.openstreetmap.org/${c.osm.type}/${c.osm.id}` : null

    const color = COLORS[c.status]
    const editUrl = c.status === 'missing'
      ? `https://www.openstreetmap.org/edit?lat=${lat}&lon=${lng}&zoom=18`
      : (c.status === 'incorrect' && c.osm)
        ? `https://www.openstreetmap.org/edit?${c.osm.type}=${c.osm.id}`
        : null
    let popup = `<strong>${esc(name)}</strong><br>`
    if (c.status === 'missing') popup += `<span style="color:${color}">Missing from OSM</span><br>`
    else if (c.status === 'match') popup += `<span style="color:${color}">Found in OSM</span><br>`
    else if (c.status === 'incorrect') popup += `<span style="color:${color}">Incorrect tags in OSM</span><br>`
    else popup += `<span style="color:${color}">OSM only</span><br>`
    if (hcUrl) popup += `<a href="${hcUrl}" target="_blank">HappyCow</a> `
    if (osmUrl) popup += `<a href="${osmUrl}" target="_blank">OSM</a> `
    if (editUrl) popup += `<a href="${editUrl}" target="_blank">Edit OSM</a>`

    const ringColor = c.status === 'match' ? COLORS.match : c.status === 'incorrect' ? COLORS.incorrect : COLORS.missing
    const icon = c.status === 'osm-only'
      ? makeOSMOnlyIcon()
      : makeHCIcon(c.hc.hc_category, ringColor)

    const cat = c.hc && c.hc.hc_category
    const zIndexOffset = cat === 'vegan-rest' ? 200 : cat === 'veg-rest' ? 100 : 0

    L.marker([lat, lng], { icon, zIndexOffset }).bindPopup(popup).addTo(refs.markerLayer)
  })
}
