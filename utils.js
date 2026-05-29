import { HC_CATS } from './constants.js'
import { refs, state } from './state.js'

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

function parseLocation(loc) {
  if (!loc) return {}
  const tags = {}
  // Strip unit suffix: ", Unit E1" / ", Suite 200" / ", Apt 3B" / ", #5"
  const unitMatch = loc.match(/,\s*(?:unit|suite|apt|ste|#)\s*(\S.*?)$/i)
  if (unitMatch) {
    tags['addr:unit'] = unitMatch[1].trim()
    loc = loc.slice(0, loc.length - unitMatch[0].length).trim()
  }
  // Leading house number (digits, optional trailing letter or hyphen-range like 123A or 12-14)
  const numMatch = loc.match(/^(\d[\d\w-]*)\s+(.+)$/)
  if (numMatch) {
    tags['addr:housenumber'] = numMatch[1]
    tags['addr:street'] = numMatch[2].trim()
  } else {
    tags['addr:street'] = loc.trim()
  }
  return tags
}

function normalizePhone(raw) {
  const d = String(raw).replace(/\D/g, '')
  if (d.length === 10) return `+1 ${d.slice(0,3)}-${d.slice(3,6)}-${d.slice(6)}`
  if (d.length === 11 && d[0] === '1') return `+1 ${d.slice(1,4)}-${d.slice(4,7)}-${d.slice(7)}`
  return raw
}

// Maps HC category ids that lack a main tag in osmTags to the appropriate amenity/shop tag
const MAIN_TAG = {
  'vegan-rest':   ['amenity', 'restaurant'],
  'veg-rest':     ['amenity', 'restaurant'],
  'veg-opt-rest': ['amenity', 'restaurant'],
  'delivery':     ['amenity', 'restaurant'],
  'food-truck':   ['amenity', 'fast_food'],
  'coffee-tea':   ['amenity', 'cafe'],
  'ice-cream':    ['amenity', 'ice_cream'],
  'juice-bar':    ['amenity', 'juice_bar'],
  'farmers-mkt':  ['amenity', 'marketplace'],
}

function buildAddTags(c) {
  const tags = {}
  const hc = c.hc
  const catDef = hc && HC_CATS.find(cat => cat.id === hc.hc_category)

  if (catDef) {
    const group = catDef.osmTags[0]
    // For new nodes, prepend amenity/shop if the category's osmTags don't already include one
    if (c.status === 'missing') {
      const hasMain = group.some(t => ['amenity', 'shop', 'tourism', 'leisure', 'office'].includes(t.k))
      if (!hasMain) {
        const main = MAIN_TAG[catDef.id]
        if (main) tags[main[0]] = main[1]
      }
    }
    for (const t of group) {
      tags[t.k] = t.rx ? t.v.split('|')[0] : t.v
    }
  }

  if (hc) {
    if (hc.name)  tags.name  = hc.name
    if (hc.phone) tags.phone = normalizePhone(hc.phone)
    Object.assign(tags, parseLocation(hc.location))
    const nom = state.nominatimAddr
    if (nom) {
      const city = nom.city || nom.town || nom.village
      if (city)          tags['addr:city']     = city
      if (nom.state)     tags['addr:state']    = nom.state
      if (nom.postcode)  tags['addr:postcode'] = nom.postcode
    }
  }

  // Don't overwrite tags already present on the OSM object,
  // except diet:* (HC is source of truth) and addr:* (fill gaps freely)
  if (c.osm && c.osm.tags) {
    for (const k of Object.keys(tags)) {
      if (k.startsWith('diet:')) continue
      if (c.osm.tags[k]) delete tags[k]
    }
  }

  if (!Object.keys(tags).length) return null
  return Object.entries(tags).map(([k, v]) => `${k}=${v}`).join('|')
}

export function josmUrl(c) {
  const addtags = buildAddTags(c)
  const atParam = addtags ? `&addtags=${encodeURIComponent(addtags)}` : ''

  if (c.osm && c.osm.type && c.osm.id) {
    return `http://localhost:8111/load_object?objects=${c.osm.type[0]}${c.osm.id}&zoom_mode=download${atParam}`
  }
  if (c.hc) {
    const lat = parseFloat(c.hc.lat), lng = parseFloat(c.hc.lng)
    return `http://localhost:8111/add_node?lat=${lat}&lon=${lng}${atParam}`
  }
  return null
}

export async function fetchNominatimCenter() {
  if (!refs.leafletMap) return
  const { lat, lng } = refs.leafletMap.getCenter()
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
      { headers: { 'Accept-Language': 'en' } }
    )
    const d = await r.json()
    state.nominatimAddr = d.address || null
  } catch (e) {
    state.nominatimAddr = null
  }
}

export function setStatus(msg) {
  document.getElementById('mc-status').textContent = msg
}

export function getMapBounds() {
  if (!refs.leafletMap) return null
  const b = refs.leafletMap.getBounds()
  const latSpan = b.getNorth() - b.getSouth()
  const lngSpan = b.getEast() - b.getWest()
  const pad = 0.1
  return [
    b.getSouth() - latSpan * pad,
    b.getWest()  - lngSpan * pad,
    b.getNorth() + latSpan * pad,
    b.getEast()  + lngSpan * pad,
  ]
}
