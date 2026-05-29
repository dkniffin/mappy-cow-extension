import { HC_CATS, CAT_MAP, OVERPASS_ENDPOINTS } from './constants.js'
import { state } from './state.js'
import { setStatus, getMapBounds, calcStep, hav, nsim } from './utils.js'
import { compareData } from './compare.js'

async function scrapeHC() {
  const bbox = getMapBounds()
  if (!bbox) { setStatus('Could not read map bounds.'); return }
  const [latMin, lngMin, latMax, lngMax] = bbox
  const step = calcStep(bbox)
  const tot = Math.ceil((latMax - latMin) / step) * Math.ceil((lngMax - lngMin) / step)
  const results = {}
  let done = 0

  setStatus(`Fetching HC… 0 / ${tot} tiles`)

  for (let lat = latMin; lat < latMax; lat = Math.round((lat + step) * 1000) / 1000) {
    for (let lng = lngMin; lng < lngMax; lng = Math.round((lng + step) * 1000) / 1000) {
      const clat = (lat + step / 2).toFixed(4)
      const clng = (lng + step / 2).toFixed(4)
      const lax = Math.round((lat + step) * 1000) / 1000
      const lnx = Math.round((lng + step) * 1000) / 1000
      const url = `/ajax/venues/map?location=area&zoom=10&clat=${clat}&clng=${clng}&latMin=${lat}&latMax=${lax}&lngMin=${lng}&lngMax=${lnx}`
      try {
        const r = await fetch(url, { headers: { 'x-requested-with': 'XMLHttpRequest' } })
        const d = await r.json()
        const items = (d && d.results && d.results.items) || []
        for (const it of items) {
          const ilat = parseFloat(it.lat), ilng = parseFloat(it.lng)
          if (ilat >= latMin && ilat <= latMax && ilng >= lngMin && ilng <= lngMax && !results[it.id]) {
            if (it.entrytype === 1 && it.category === 0) {
              it.hc_category = (it.vegan === 1 && it.vegonly === 1) ? 'vegan-rest' : (it.vegonly === 1 ? 'veg-rest' : 'veg-opt-rest')
            } else {
              it.hc_category = CAT_MAP[it.category] || ('e' + it.entrytype + 'c' + it.category)
            }
            results[it.id] = it
          }
        }
      } catch (e) { /* skip failed tile */ }
      done++
      setStatus(`Fetching HC… ${done} / ${tot} tiles — ${Object.keys(results).length} venues`)
      await new Promise(r => setTimeout(r, 700))
    }
  }

  state.hcData = Object.values(results)
  setStatus(`HC: ${state.hcData.length} venues loaded.`)
}

function buildDietQuery(bbox) {
  const bboxStr = bbox.join(',')
  const seen = new Set()
  const lines = ['[out:json][timeout:180];', '(']
  for (const cat of HC_CATS) {
    for (const group of cat.osmTags) {
      const filters = group.map(t => t.rx ? `["${t.k}"~"^(${t.v})$"]` : `["${t.k}"="${t.v}"]`).join('')
      if (!seen.has(filters)) {
        seen.add(filters)
        lines.push(`  node${filters}(${bboxStr});`, `  way${filters}(${bboxStr});`)
      }
    }
  }
  lines.push(');', 'out center;')
  return lines.join('\n')
}

async function fetchOSMDiet(bbox) {
  const query = buildDietQuery(bbox)
  let elements = null
  for (const ep of OVERPASS_ENDPOINTS) {
    try {
      setStatus(`Querying OSM diet tags from ${ep}…`)
      const r = await fetch(ep, { method: 'POST', body: new URLSearchParams({ data: query }) })
      const d = await r.json()
      if (d.elements) { elements = d.elements; break }
    } catch (e) { /* try next */ }
  }
  if (!elements) { setStatus('Error: all Overpass endpoints failed (diet query).'); return false }
  state.osmDietData = elements.map(el => {
    const lat = el.lat || (el.center && el.center.lat)
    const lon = el.lon || (el.center && el.center.lon)
    return { id: el.id, name: (el.tags && el.tags.name) || '', lat, lon, tags: el.tags || {}, type: el.type }
  }).filter(el => el.lat && el.lon)
  setStatus(`OSM: ${state.osmDietData.length} diet-tagged venues loaded.`)
  return true
}

function findUnmatchedHC() {
  // HC venues with no nearby (150m) diet-tagged OSM venue sharing a name — these need a name-based OSM lookup
  const preMatched = new Set()
  state.hcData.forEach((hc, hi) => {
    const lat = parseFloat(hc.lat), lng = parseFloat(hc.lng)
    for (const o of state.osmDietData) {
      if (hav(lat, lng, o.lat, o.lon) <= 150 && nsim(hc.name || '', o.name) > 0) {
        preMatched.add(hi); break
      }
    }
  })
  return state.hcData.filter((_, hi) => !preMatched.has(hi))
}

function buildNameQuery(bbox, hcVenues) {
  if (!hcVenues.length) return null
  const namePattern = hcVenues
    .map(h => (h.name || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .filter(n => n.length > 0)
    .join('|')
  if (!namePattern) return null
  const bboxStr = bbox.join(',')
  return [
    '[out:json][timeout:180];',
    '(',
    `  node["name"~"${namePattern}",i](${bboxStr});`,
    `  way["name"~"${namePattern}",i](${bboxStr});`,
    ');',
    'out center;'
  ].join('\n')
}

async function fetchOSMByName(bbox, hcVenues) {
  const query = buildNameQuery(bbox, hcVenues)
  if (!query) { state.osmNameData = []; return true }
  const dietIds = new Set(state.osmDietData.map(o => o.id))
  let elements = null
  for (const ep of OVERPASS_ENDPOINTS) {
    try {
      setStatus(`Querying OSM by name from ${ep}…`)
      const r = await fetch(ep, { method: 'POST', body: new URLSearchParams({ data: query }) })
      const d = await r.json()
      if (d.elements) { elements = d.elements; break }
    } catch (e) { /* try next */ }
  }
  if (!elements) { setStatus('Error: all Overpass endpoints failed (name query).'); return false }
  state.osmNameData = elements
    .filter(el => !dietIds.has(el.id))
    .map(el => {
      const lat = el.lat || (el.center && el.center.lat)
      const lon = el.lon || (el.center && el.center.lon)
      return { id: el.id, name: (el.tags && el.tags.name) || '', lat, lon, tags: el.tags || {}, type: el.type }
    }).filter(el => el.lat && el.lon)
  setStatus(`OSM: ${state.osmNameData.length} name-matched venues loaded.`)
  return true
}

export async function scrapeAndCompare() {
  const btn = document.getElementById('mc-refresh')
  if (btn) btn.disabled = true
  try {
    await scrapeHC()
    if (!state.hcData.length) return
    const bbox = getMapBounds()
    if (!bbox) return
    const ok1 = await fetchOSMDiet(bbox)
    if (!ok1) return
    const unmatched = findUnmatchedHC()
    await fetchOSMByName(bbox, unmatched)
    compareData()
  } finally {
    if (btn) btn.disabled = false
  }
}
