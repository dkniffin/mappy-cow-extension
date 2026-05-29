; (function () {
  'use strict'

  // ── Constants ────────────────────────────────────────────────────────────────

  // osmTags: array of filter groups (OR between groups, AND within each group)
  // { k, v } — exact match; { k, v, rx: true } — Overpass regex match
  const DIET = { k: 'diet:vegan', v: 'yes|only', rx: true }

  const HC_CATS = [
    { id: 'vegan-rest',   label: 'Vegan restaurant',       osmTags: [[{ k: 'diet:vegan', v: 'only' }]],                                                             match: h => h.entrytype === 1 && h.category === 0 && h.vegan === 1 && h.vegonly === 1 },
    { id: 'veg-rest',     label: 'Vegetarian restaurant',  osmTags: [[{ k: 'diet:vegetarian', v: 'only' }, { k: 'diet:vegan', v: 'yes' }]],                         match: h => h.entrytype === 1 && h.category === 0 && h.vegan !== 1 && h.vegonly === 1 },
    { id: 'veg-opt-rest', label: 'Veg-options restaurant', osmTags: [[{ k: 'diet:vegan', v: 'yes' }], [{ k: 'diet:vegetarian', v: 'yes' }]],                        match: h => h.entrytype === 1 && h.category === 0 && h.vegan !== 1 && h.vegonly !== 1 },
    { id: 'health-store', label: 'Health store',           osmTags: [[{ k: 'shop', v: 'health_food' }, DIET]],                                                       match: h => h.entrytype === 2 && h.category === 1 },
    { id: 'veg-store',    label: 'Veg store',              osmTags: [[{ k: 'shop', v: 'organic|greengrocer', rx: true }, DIET]],                                     match: h => h.entrytype === 2 && h.category === 2 },
    { id: 'bakery',       label: 'Bakery',                 osmTags: [[{ k: 'shop', v: 'bakery' }, DIET]],                                                            match: h => h.entrytype === 2 && h.category === 3 },
    { id: 'bnb',          label: 'B&B',                    osmTags: [[{ k: 'tourism', v: 'guest_house' }, DIET]],                                                    match: h => h.entrytype === 2 && h.category === 4 },
    { id: 'delivery',     label: 'Delivery',               osmTags: [[DIET]],                                                                                         match: h => h.entrytype === 2 && h.category === 5 },
    { id: 'catering',     label: 'Catering',               osmTags: [[{ k: 'shop', v: 'catering' }, DIET]],                                                          match: h => h.entrytype === 2 && h.category === 6 },
    { id: 'org',          label: 'Organization',           osmTags: [[{ k: 'office', v: 'association' }, DIET]],                                                     match: h => h.entrytype === 2 && h.category === 7 },
    { id: 'farmers-mkt',  label: "Farmer's market",        osmTags: [[{ k: 'amenity', v: 'marketplace' }, DIET]],                                                    match: h => h.entrytype === 2 && h.category === 8 },
    { id: 'food-truck',   label: 'Food truck',             osmTags: [[{ k: 'amenity', v: 'fast_food' }, DIET]],                                                      match: h => h.entrytype === 2 && h.category === 10 },
    { id: 'mkt-vendor',   label: 'Market vendor',          osmTags: [[DIET]],                                                                                         match: h => h.entrytype === 2 && h.category === 11 },
    { id: 'ice-cream',    label: 'Ice cream',              osmTags: [[{ k: 'amenity', v: 'ice_cream' }, DIET]],                                                      match: h => h.entrytype === 2 && h.category === 12 },
    { id: 'juice-bar',    label: 'Juice bar',              osmTags: [[{ k: 'amenity', v: 'juice_bar' }, DIET]],                                                      match: h => h.entrytype === 2 && h.category === 13 },
    { id: 'professional', label: 'Professional',           osmTags: [[DIET]],                                                                                         match: h => h.entrytype === 2 && h.category === 14 },
    { id: 'coffee-tea',   label: 'Coffee & tea',           osmTags: [[{ k: 'amenity', v: 'cafe' }, DIET]],                                                           match: h => h.entrytype === 2 && h.category === 15 },
    { id: 'spa',          label: 'Spa',                    osmTags: [[{ k: 'leisure', v: 'spa' }, DIET]],                                                            match: h => h.entrytype === 2 && h.category === 16 },
    { id: 'other',        label: 'Other',                  osmTags: [[DIET]],                                                                                         match: h => h.entrytype === 2 && h.category === 99 },
  ]

  const CAT_MAP = {
    1: 'health-store', 2: 'veg-store', 3: 'bakery', 4: 'bnb', 5: 'delivery',
    6: 'catering', 7: 'org', 8: 'farmers-mkt', 10: 'food-truck', 11: 'mkt-vendor',
    12: 'ice-cream', 13: 'juice-bar', 14: 'professional', 15: 'coffee-tea', 16: 'spa', 99: 'other'
  }

  const OVERPASS_ENDPOINTS = [
    'https://overpass.openstreetmap.fr/api/interpreter',
    'https://overpass-api.de/api/interpreter',
    'https://lz4.overpass-api.de/api/interpreter'
  ]

  const COLORS = { missing: '#ff0000', match: '#00cc00', 'osm-only': '#ff8800' }

  const HC_ICON_BASE = 'https://www.happycow.net/img/category/'
  const HC_ICON_FILE = {
    'vegan-rest': 'category_vegan.svg',
    'veg-rest': 'category_vegetarian.svg',
    'veg-opt-rest': 'category_veg-friendly.svg',
    'health-store': 'category_health-store.svg',
    'veg-store': 'category_veg-shop.svg',
    'bakery': 'category_bakery.svg',
    'bnb': 'category_b-b.svg',
    'delivery': 'category_delivery.svg',
    'catering': 'category_catering.svg',
    'org': 'category_organization.svg',
    'farmers-mkt': 'category_farmer-s-market.svg',
    'food-truck': 'category_food-truck.svg',
    'mkt-vendor': 'category_market-vendor.svg',
    'ice-cream': 'category_ice-cream.svg',
    'juice-bar': 'category_juice-bar.svg',
    'professional': 'category_vegan-professional.svg',
    'coffee-tea': 'category_coffee-tea.svg',
    'spa': 'category_spa.svg',
    'other': 'category_other.svg',
  }

  // ── State ────────────────────────────────────────────────────────────────────

  const state = { hcData: [], osmData: [], compared: [] }
  let leafletMap = null
  let markerLayer = null
  let mcActive = false

  // ── Utilities ────────────────────────────────────────────────────────────────

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  }

  function hav(a, b, c, d) {
    const R = 6371000, dl = (c - a) * Math.PI / 180, dn = (d - b) * Math.PI / 180
    const x = Math.sin(dl / 2) ** 2 + Math.cos(a * Math.PI / 180) * Math.cos(c * Math.PI / 180) * Math.sin(dn / 2) ** 2
    return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
  }

  function nsim(a, b) {
    a = a.toLowerCase().replace(/[^a-z0-9]/g, '')
    b = b.toLowerCase().replace(/[^a-z0-9]/g, '')
    if (a === b) return 1
    if (a.includes(b) || b.includes(a)) return 0.8
    return 0
  }

  function calcStep(bbox) {
    const area = (bbox[2] - bbox[0]) * (bbox[3] - bbox[1])
    if (area < 5) return 0.5
    if (area < 50) return 1.0
    if (area < 300) return 2.0
    return 3.0
  }

  function setStatus(msg) {
    document.getElementById('mc-status').textContent = msg
  }

  // ── Map bounds ───────────────────────────────────────────────────────────────

  function getMapBounds() {
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

  // ── Leaflet map ──────────────────────────────────────────────────────────────

  function initLeafletMap() {
    const p = new URLSearchParams(window.location.search)
    const lat = parseFloat(p.get('lat')) || 20
    const lng = parseFloat(p.get('lng')) || 0
    const zoom = parseInt(p.get('zoom')) || 4

    const container = document.getElementById('mc-map')
    leafletMap = L.map(container).setView([lat, lng], zoom)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/">CARTO</a>',
      subdomains: 'abcd', maxZoom: 19
    }).addTo(leafletMap)
    markerLayer = L.layerGroup().addTo(leafletMap)
  }

  function makeHCIcon(hcCategory, ringColor) {
    const src = HC_ICON_BASE + (HC_ICON_FILE[hcCategory] || 'category_other.svg')
    return L.divIcon({
      className: '',
      html: `<div style="width:36px;height:36px;border-radius:50%;background:${ringColor};padding:4px;box-shadow:0 2px 6px rgba(0,0,0,.5)"><div style="width:100%;height:100%;border-radius:50%;background:#fff;display:flex;align-items:center;justify-content:center;overflow:hidden"><img src="${src}" style="width:22px;height:22px;object-fit:contain"></div></div>`,
      iconSize: [36, 36],
      iconAnchor: [18, 18],
      popupAnchor: [0, -20]
    })
  }

  function makeOSMOnlyIcon() {
    return L.divIcon({
      className: '',
      html: `<div style="width:36px;height:36px;border-radius:50%;background:${COLORS['osm-only']};padding:4px;box-shadow:0 2px 6px rgba(0,0,0,.5)"><div style="width:100%;height:100%;border-radius:50%;background:#fff;display:flex;align-items:center;justify-content:center;font-size:18px;line-height:1;color:${COLORS['osm-only']}">?</div></div>`,
      iconSize: [36, 36],
      iconAnchor: [18, 18],
      popupAnchor: [0, -20]
    })
  }

  function updateMarkers() {
    if (!leafletMap) return
    markerLayer.clearLayers()
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
        ? `https://www.openstreetmap.org/edit?lat=${lat}&lon=${lng}&zoom=18` : null
      let popup = `<strong>${esc(name)}</strong><br>`
      if (c.status === 'missing') popup += `<span style="color:${color}">Missing from OSM</span><br>`
      else if (c.status === 'match') popup += `<span style="color:${color}">Found in OSM (${c.dist}m)</span><br>`
      else popup += `<span style="color:${color}">OSM only</span><br>`
      if (hcUrl) popup += `<a href="${hcUrl}" target="_blank">HappyCow</a> `
      if (osmUrl) popup += `<a href="${osmUrl}" target="_blank">OSM</a> `
      if (editUrl) popup += `<a href="${editUrl}" target="_blank">Edit OSM</a>`

      const icon = c.status === 'osm-only'
        ? makeOSMOnlyIcon()
        : makeHCIcon(c.hc.hc_category, c.status === 'match' ? COLORS.match : COLORS.missing)

      const cat = c.hc && c.hc.hc_category
      const zIndexOffset = cat === 'vegan-rest' ? 200 : cat === 'veg-rest' ? 100 : 0

      L.marker([lat, lng], { icon, zIndexOffset }).bindPopup(popup).addTo(markerLayer)
    })
  }

  // ── HC scrape ────────────────────────────────────────────────────────────────

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

  // ── OSM query ────────────────────────────────────────────────────────────────

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

  // ── Fetch OSM ────────────────────────────────────────────────────────────────

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

  async function scrapeAndCompare() {
    const btn = document.getElementById('mc-refresh')
    if (btn) btn.disabled = true
    try {
      await scrapeHC()
      await fetchOSM()
    } finally {
      if (btn) btn.disabled = false
    }
  }

  // ── Compare ──────────────────────────────────────────────────────────────────

  function maybeCompare() {
    if (state.hcData.length && state.osmData.length) compareData()
  }

  function compareData() {
    state.compared = []
    const selectedCats = HC_CATS.filter(c => {
      const cb = document.querySelector(`.mc-hc-cat[data-id="${c.id}"]`)
      return cb && cb.checked
    })
    const allHC = state.hcData.filter(hc => hc.lat && hc.lng)
    const primary = allHC.filter(hc => selectedCats.some(c => c.match(hc)))
    const secondary = allHC.filter(hc => !selectedCats.some(c => c.match(hc)))

    const cands = []
    primary.forEach((hc, hi) => {
      const lat = parseFloat(hc.lat), lng = parseFloat(hc.lng)
      state.osmData.forEach((o, oi) => {
        const d = hav(lat, lng, o.lat, o.lon); if (d > 300) return
        const ns = nsim(hc.name || '', o.name), sc = (1 - d / 300) * 0.5 + ns * 0.5
        if (d < 80 || ns > 0.7) cands.push({ sc, hi, oi, dist: Math.round(d) })
      })
    })
    cands.sort((a, b) => b.sc - a.sc)
    const usedHC = {}, usedOSM = {}, matchedOSM = {}
    cands.forEach(p => {
      if (usedHC[p.hi] || usedOSM[p.oi]) return
      usedHC[p.hi] = true; usedOSM[p.oi] = true
      matchedOSM[state.osmData[p.oi].id] = true
      state.compared.push({ status: 'match', hc: primary[p.hi], osm: state.osmData[p.oi], dist: p.dist })
    })
    primary.forEach((hc, hi) => {
      if (!usedHC[hi]) state.compared.push({ status: 'missing', hc, osm: null, dist: null })
    })

    const nvCands = []
    state.osmData.forEach((o, oi) => {
      if (matchedOSM[o.id]) return
      secondary.forEach((hc, hi) => {
        const d = hav(o.lat, o.lon, parseFloat(hc.lat), parseFloat(hc.lng)); if (d > 300) return
        const ns = nsim(o.name, hc.name || ''), sc = (1 - d / 300) * 0.5 + ns * 0.5
        if (d < 80 || ns > 0.7) nvCands.push({ sc, oi, hi })
      })
    })
    nvCands.sort((a, b) => b.sc - a.sc)
    const usedNvHC = {}, partialForOI = {}
    nvCands.forEach(p => {
      if (usedNvHC[p.hi] || partialForOI[p.oi] !== undefined) return
      usedNvHC[p.hi] = true; partialForOI[p.oi] = secondary[p.hi]
    })
    state.osmData.forEach((o, oi) => {
      if (matchedOSM[o.id]) return
      state.compared.push({ status: 'osm-only', hc: null, osm: o, dist: null, hcPartial: partialForOI[oi] || null })
    })

    const nMatch = state.compared.filter(c => c.status === 'match').length
    const nMiss  = state.compared.filter(c => c.status === 'missing').length
    const nOnly  = state.compared.filter(c => c.status === 'osm-only').length
    document.getElementById('mc-stats').innerHTML =
      `<div class="mc-stats">` +
      `<span>HC: <strong>${primary.length}</strong></span>` +
      `<span>OSM: <strong>${state.osmData.length}</strong></span>` +
      `<span class="mc-green">Found: <strong>${nMatch}</strong></span>` +
      `<span class="mc-red">Missing: <strong>${nMiss}</strong></span>` +
      `<span class="mc-orange">OSM only: <strong>${nOnly}</strong></span>` +
      `</div>`
    document.getElementById('mc-results').style.display = 'block'
    setStatus('Done.')
    updateMarkers()
    renderTable()
  }

  // ── Table ────────────────────────────────────────────────────────────────────

  function renderTable() {
    const ft = document.getElementById('mc-ftype').value
    const sr = document.getElementById('mc-srch').value.toLowerCase()
    const rows = state.compared.filter(c => {
      if (ft !== 'all' && c.status !== ft) return false
      if (sr) {
        const n = ((c.hc && c.hc.name) || (c.osm && c.osm.name) || '').toLowerCase()
        if (!n.includes(sr)) return false
      }
      return true
    })
    document.getElementById('mc-thead').innerHTML = `<tr><th>Status</th><th>Name</th><th>Links</th></tr>`
    document.getElementById('mc-tbody').innerHTML = rows.slice(0, 200).map(c => {
      const name = esc((c.hc && c.hc.name) || (c.osm && c.osm.name) || '')
      const lat = c.hc ? parseFloat(c.hc.lat).toFixed(5) : (c.osm && c.osm.lat ? c.osm.lat.toFixed(5) : '')
      const lng = c.hc ? parseFloat(c.hc.lng).toFixed(5) : (c.osm && c.osm.lon ? c.osm.lon.toFixed(5) : '')
      const hcUrl = (c.hc && c.hc.pretty_url) ? 'https://www.happycow.net/reviews/' + esc(c.hc.pretty_url) : null
      let badge, links
      if (c.status === 'missing') {
        badge = '<span class="mc-badge mc-miss">Missing</span>'
        const eu = `https://www.openstreetmap.org/edit?lat=${lat}&lon=${lng}&zoom=18`
        links = (hcUrl ? `<a href="${hcUrl}" target="_blank">HappyCow</a> · ` : '') + `<a href="${eu}" target="_blank">Edit OSM</a>`
      } else if (c.status === 'match') {
        badge = `<span class="mc-badge mc-found">Found ${c.dist}m</span>`
        links = (hcUrl ? `<a href="${hcUrl}" target="_blank">HappyCow</a> · ` : '') + `<a href="https://www.openstreetmap.org/${c.osm.type}/${c.osm.id}" target="_blank">OSM</a>`
      } else {
        badge = '<span class="mc-badge mc-only">OSM only</span>'
        links = `<a href="https://www.openstreetmap.org/${c.osm.type}/${c.osm.id}" target="_blank">OSM</a>`
        if (c.hcPartial && c.hcPartial.pretty_url) {
          links += ` · <a href="https://www.happycow.net/reviews/${esc(c.hcPartial.pretty_url)}" target="_blank">HappyCow</a>`
        }
      }
      return `<tr><td>${badge}</td><td title="${lat}, ${lng}">${name}</td><td style="white-space:nowrap">${links}</td></tr>`
    }).join('')
    document.getElementById('mc-rcount').textContent = rows.length + ' rows' + (rows.length > 200 ? ' (first 200 shown)' : '')
  }

  // ── Panel HTML ───────────────────────────────────────────────────────────────

  function fmtOsmTags(osmTags) {
    return osmTags.map(group => group.map(t => `${t.k}=${t.v}`).join(' + ')).join(' or ')
  }

  function buildPanelHTML() {
    const catCheckboxes = HC_CATS.map(c => {
      const checked = c.id === 'vegan-rest' ? ' checked' : ''
      const tagStr = fmtOsmTags(c.osmTags)
      return `<label class="mc-cat-row"><input type="checkbox" class="mc-hc-cat" data-id="${c.id}"${checked}><span class="mc-cat-name">${c.label}</span>${tagStr ? `<code class="mc-cat-tags">${tagStr}</code>` : ''}</label>`
    }).join('')
    return `
      <div id="mc-map"></div>
      <div id="mc-panel">
        <div id="mc-head">
          <strong>MappyCow</strong>
        </div>
        <div id="mc-body">
          <section class="mc-section">
            <div class="mc-sh">Categories</div>
            <div id="mc-cats">${catCheckboxes}</div>
          </section>
          <section class="mc-section">
            <button class="mc-btn" id="mc-refresh">Refresh</button>
            <p id="mc-status"></p>
          </section>
          <section class="mc-section" id="mc-results" style="display:none">
            <div id="mc-stats"></div>
            <div class="mc-filter-row">
              <input type="text" id="mc-srch" placeholder="Search name…">
              <select id="mc-ftype">
                <option value="missing">Missing from OSM</option>
                <option value="match">Found in OSM</option>
                <option value="osm-only">OSM only</option>
                <option value="all">All</option>
              </select>
            </div>
            <div id="mc-table-wrap">
              <table id="mc-table">
                <thead id="mc-thead"></thead>
                <tbody id="mc-tbody"></tbody>
              </table>
            </div>
            <p id="mc-rcount"></p>
          </section>
        </div>
      </div>
      <button id="mc-toggle" title="Toggle panel"><img id="mc-toggle-img" alt="OSM"></button>
    `
  }

  // ── Hide HC UI ───────────────────────────────────────────────────────────────

  function hideHC() {
    const els = [...document.querySelectorAll('#search-data, .search-map-data, header, nav')]
    els.forEach(el => el.style.setProperty('display', 'none', 'important'))
    document.body.style.setProperty('overflow', 'hidden', 'important')
  }

  function showHC() {
    const els = [...document.querySelectorAll('#search-data, .search-map-data, header, nav')]
    els.forEach(el => el.style.removeProperty('display'))
    document.body.style.removeProperty('overflow')
  }

  // ── Init ─────────────────────────────────────────────────────────────────────

  function init() {
    const wrapper = document.createElement('div')
    wrapper.innerHTML = buildPanelHTML()
    document.body.appendChild(wrapper)

    document.getElementById('mc-toggle-img').src = 'https://www.openstreetmap.org/assets/favicon-32x32.png'

    const panel = document.getElementById('mc-panel')
    const mapEl = document.getElementById('mc-map')
    panel.style.display = 'none'
    mapEl.style.display = 'none'

    document.getElementById('mc-toggle').addEventListener('click', () => {
      if (mcActive) {
        showHC()
        panel.style.display = 'none'
        mapEl.style.display = 'none'
        mcActive = false
      } else {
        hideHC()
        panel.style.display = 'flex'
        mapEl.style.display = 'block'
        if (!leafletMap) initLeafletMap()
        leafletMap.invalidateSize()
        if (!state.hcData.length) scrapeAndCompare()
        mcActive = true
      }
    })
    document.getElementById('mc-refresh').addEventListener('click', () => {
      state.hcData = []; state.osmData = []; state.compared = []
      document.getElementById('mc-results').style.display = 'none'
      markerLayer.clearLayers()
      scrapeAndCompare()
    })
    document.getElementById('mc-cats').addEventListener('change', () => {
      if (state.compared.length) compareData()
    })
    document.getElementById('mc-srch').addEventListener('input', renderTable)
    document.getElementById('mc-ftype').addEventListener('change', () => { renderTable(); updateMarkers() })

    document.addEventListener('mc:urlchange', () => {
      state.hcData = []; state.osmData = []; state.compared = []
      if (markerLayer) markerLayer.clearLayers()
      document.getElementById('mc-results').style.display = 'none'
      const p = new URLSearchParams(window.location.search)
      const lat = parseFloat(p.get('lat')), lng = parseFloat(p.get('lng')), zoom = parseInt(p.get('zoom'))
      if (leafletMap && !isNaN(lat) && !isNaN(lng)) leafletMap.setView([lat, lng], zoom || leafletMap.getZoom())
      if (mcActive) scrapeAndCompare()
    })
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }
})()
