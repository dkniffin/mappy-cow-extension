import { HC_CATS, CAT_MAP, OVERPASS_ENDPOINTS } from './constants.js'
import { state, refs } from './state.js'
import { setStatus, getMapBounds, calcStep } from './utils.js'
import { maybeCompare } from './compare.js'

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
  maybeCompare()
}

function buildOverpassQuery(bbox) {
  const selectedCats = HC_CATS.filter(c => {
    const cb = document.querySelector(`.mc-hc-cat[data-id="${c.id}"]`)
    return cb && cb.checked
  })
  const seen = new Set()
  const groups = []
  for (const cat of selectedCats) {
    for (const group of cat.osmTags) {
      const key = group.map(t => `${t.k}${t.rx ? '~' : '='}${t.v}`).join('&')
      if (!seen.has(key)) { seen.add(key); groups.push(group) }
    }
  }
  if (!groups.length) return null
  const bboxStr = bbox.join(',')
  const lines = ['[out:json][timeout:180];', '(']
  for (const group of groups) {
    const filter = group.map(t => {
      const k = t.k.replace(/"/g, '\\"'), v = t.v.replace(/"/g, '\\"')
      return t.rx ? `["${k}"~"^(${v})$"]` : `["${k}"="${v}"]`
    }).join('')
    lines.push(`  node${filter}(${bboxStr});`, `  way${filter}(${bboxStr});`)
  }
  lines.push(');', 'out center;')
  return lines.join('\n')
}

async function fetchOSM() {
  const bbox = getMapBounds()
  if (!bbox) { setStatus('Could not read map bounds.'); return }
  const query = buildOverpassQuery(bbox)
  if (!query) { setStatus('No categories with OSM tags selected.'); return }
  let elements = null
  for (const ep of OVERPASS_ENDPOINTS) {
    try {
      setStatus(`Querying ${ep}…`)
      const r = await fetch(ep, { method: 'POST', body: new URLSearchParams({ data: query }) })
      const d = await r.json()
      if (d.elements) { elements = d.elements; break }
    } catch (e) { /* try next */ }
  }
  if (!elements) { setStatus('Error: all Overpass endpoints failed.'); return }
  state.osmData = elements.map(el => {
    const lat = el.lat || (el.center && el.center.lat)
    const lon = el.lon || (el.center && el.center.lon)
    return { id: el.id, name: (el.tags && el.tags.name) || '', lat, lon, tags: el.tags || {}, type: el.type }
  }).filter(el => el.name && el.lat && el.lon)
  setStatus(`OSM: ${state.osmData.length} venues loaded.`)
  maybeCompare()
}

export async function scrapeAndCompare() {
  const btn = document.getElementById('mc-refresh')
  if (btn) btn.disabled = true
  try {
    await scrapeHC()
    await fetchOSM()
  } finally {
    if (btn) btn.disabled = false
  }
}
