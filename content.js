;(function () {
  'use strict'

  // ── Constants ────────────────────────────────────────────────────────────────

  const HC_CATS = [
    { id: 'vegan-rest',   label: 'Vegan restaurant',       match: h => h.entrytype === 1 && h.category === 0 && h.vegan === 1 && h.vegonly === 1 },
    { id: 'veg-rest',     label: 'Vegetarian restaurant',  match: h => h.entrytype === 1 && h.category === 0 && h.vegan !== 1 && h.vegonly === 1 },
    { id: 'veg-opt-rest', label: 'Veg-options restaurant', match: h => h.entrytype === 1 && h.category === 0 && h.vegan !== 1 && h.vegonly !== 1 },
    { id: 'health-store', label: 'Health store',           match: h => h.entrytype === 2 && h.category === 1 },
    { id: 'veg-store',    label: 'Veg store',              match: h => h.entrytype === 2 && h.category === 2 },
    { id: 'bakery',       label: 'Bakery',                 match: h => h.entrytype === 2 && h.category === 3 },
    { id: 'bnb',          label: 'B&B',                    match: h => h.entrytype === 2 && h.category === 4 },
    { id: 'delivery',     label: 'Delivery',               match: h => h.entrytype === 2 && h.category === 5 },
    { id: 'catering',     label: 'Catering',               match: h => h.entrytype === 2 && h.category === 6 },
    { id: 'org',          label: 'Organization',           match: h => h.entrytype === 2 && h.category === 7 },
    { id: 'farmers-mkt',  label: "Farmer's market",        match: h => h.entrytype === 2 && h.category === 8 },
    { id: 'food-truck',   label: 'Food truck',             match: h => h.entrytype === 2 && h.category === 10 },
    { id: 'mkt-vendor',   label: 'Market vendor',          match: h => h.entrytype === 2 && h.category === 11 },
    { id: 'ice-cream',    label: 'Ice cream',              match: h => h.entrytype === 2 && h.category === 12 },
    { id: 'juice-bar',    label: 'Juice bar',              match: h => h.entrytype === 2 && h.category === 13 },
    { id: 'professional', label: 'Professional',           match: h => h.entrytype === 2 && h.category === 14 },
    { id: 'coffee-tea',   label: 'Coffee & tea',           match: h => h.entrytype === 2 && h.category === 15 },
    { id: 'spa',          label: 'Spa',                    match: h => h.entrytype === 2 && h.category === 16 },
    { id: 'other',        label: 'Other',                  match: h => h.entrytype === 2 && h.category === 99 },
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

  // ── State ────────────────────────────────────────────────────────────────────

  const state = { hcData: [], osmData: [], compared: [] }

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

  // ── Read HC map bounds ────────────────────────────────────────────────────────

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

    const sidebar = document.querySelector('#search-data')
    const mapW = window.innerWidth - (sidebar ? sidebar.offsetWidth : 0)
    const mapH = window.innerHeight
    const tilesWide = mapW / 256, tilesHigh = mapH / 256

    const yCenter = latToY(lat, zoom)
    const latNorth = yToLat(yCenter - tilesHigh / 2, zoom)
    const latSouth = yToLat(yCenter + tilesHigh / 2, zoom)
    const lngHalf = (tilesWide / 2) * (360 / Math.pow(2, zoom))

    // expand by 20% on each side to catch venues near the edges
    const latPad = (latNorth - latSouth) * 0.2
    const lngPad = lngHalf * 0.2
    return [latSouth - latPad, lng - lngHalf - lngPad, latNorth + latPad, lng + lngHalf + lngPad]
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

  // ── OSM tag UI ───────────────────────────────────────────────────────────────

  function addTag(key, val) {
    const list = document.getElementById('mc-tag-list')
    const row = document.createElement('div')
    row.className = 'mc-tag-row'

    const keyInput = document.createElement('input')
    keyInput.type = 'text'; keyInput.placeholder = 'key'; keyInput.value = key; keyInput.className = 'mc-tag-key'

    const eq = document.createElement('span')
    eq.textContent = '='; eq.className = 'mc-tag-eq'

    const valInput = document.createElement('input')
    valInput.type = 'text'; valInput.placeholder = 'value'; valInput.value = val; valInput.className = 'mc-tag-val'

    const del = document.createElement('button')
    del.className = 'mc-btn-sm mc-tag-del'; del.textContent = '×'; del.title = 'Remove tag'

    row.append(keyInput, eq, valInput, del)
    list.appendChild(row)
  }

  function getOSMTags() {
    return [...document.querySelectorAll('.mc-tag-row')].map(row => ({
      k: row.querySelector('.mc-tag-key').value.trim(),
      v: row.querySelector('.mc-tag-val').value.trim()
    })).filter(t => t.k)
  }

  function buildOverpassQuery(bbox) {
    const tags = getOSMTags()
    if (!tags.length) return null
    const isOr = document.querySelector('[name="mc-osm-logic"]:checked').value === 'or'
    const bboxStr = bbox.join(',')
    const lines = ['[out:json][timeout:180];', '(']
    if (isOr) {
      tags.forEach(t => {
        const k = t.k.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
        const v = t.v.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
        const f = v ? `["${k}"="${v}"]` : `["${k}"]`
        lines.push(`  node${f}(${bboxStr});`, `  way${f}(${bboxStr});`)
      })
    } else {
      const f = tags.map(t => {
        const k = t.k.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
        const v = t.v.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
        return v ? `["${k}"="${v}"]` : `["${k}"]`
      }).join('')
      lines.push(`  node${f}(${bboxStr});`, `  way${f}(${bboxStr});`)
    }
    lines.push(');', 'out center;')
    return lines.join('\n')
  }

  // ── Scrape + compare ─────────────────────────────────────────────────────────

  async function scrapeAndCompare() {
    await scrapeHC()
    await fetchOSM()
  }

  // ── Fetch OSM ────────────────────────────────────────────────────────────────

  async function fetchOSM() {
    const bbox = getMapBounds()
    if (!bbox) { setStatus('Could not read map bounds.'); return }
    const query = buildOverpassQuery(bbox)
    if (!query) { setStatus('Add at least one OSM tag first.'); return }
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

    // One-to-one primary matching (greedy best-score)
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

    // One-to-one secondary match (OSM-only vs unselected HC)
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

  function buildPanelHTML() {
    const catCheckboxes = HC_CATS.map(c =>
      `<label><input type="checkbox" class="mc-hc-cat" data-id="${c.id}"${c.id === 'vegan-rest' ? ' checked' : ''}> ${c.label}</label>`
    ).join('')
    return `
      <div id="mc-panel">
        <div id="mc-head">
          <strong>MappyCow</strong>
          <button id="mc-close" title="Close">×</button>
        </div>
        <div id="mc-body">
          <section class="mc-section">
            <div class="mc-sh">HC categories</div>
            <div id="mc-cats">${catCheckboxes}</div>
          </section>
          <section class="mc-section">
            <div class="mc-sh">OSM tags</div>
            <div style="margin-bottom:6px;font-size:12px">
              <label><input type="radio" name="mc-osm-logic" value="and" checked> <strong>ALL</strong> (AND)</label>
              <label style="margin-left:10px"><input type="radio" name="mc-osm-logic" value="or"> <strong>ANY</strong> (OR)</label>
            </div>
            <div id="mc-tag-list"></div>
            <button class="mc-btn-sm mc-add-tag">+ Add tag</button>
          </section>
          <section class="mc-section">
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
      <button id="mc-toggle" title="MappyCow"><img id="mc-toggle-img" alt="OSM"></button>
    `
  }

  // ── Resizable sidebar ────────────────────────────────────────────────────────

  function initResizableSidebar(sidebar) {
    const mapEl = document.querySelector('.search-map-data')
    sidebar.style.setProperty('width', '600px', 'important')
    if (mapEl) mapEl.style.setProperty('width', 'calc(100% - 600px)', 'important')
  }

  function waitForSidebar() {
    const sidebar = document.querySelector('#search-data')
    if (sidebar) { initResizableSidebar(sidebar); return }
    const obs = new MutationObserver(() => {
      const s = document.querySelector('#search-data')
      if (s) { obs.disconnect(); initResizableSidebar(s) }
    })
    obs.observe(document.body, { childList: true, subtree: true })
  }

  // ── Init ─────────────────────────────────────────────────────────────────────

  function init() {
    const wrapper = document.createElement('div')
    wrapper.innerHTML = buildPanelHTML()
    document.body.appendChild(wrapper)

    document.getElementById('mc-toggle-img').src = 'https://www.openstreetmap.org/assets/favicon-32x32.png'
    addTag('diet:vegan', 'only')

    const panel = document.getElementById('mc-panel')

    document.getElementById('mc-toggle').addEventListener('click', () => {
      panel.style.display = panel.style.display === 'none' ? 'flex' : 'none'
    })
    document.getElementById('mc-close').addEventListener('click', () => {
      panel.style.display = 'none'
    })
    document.getElementById('mc-cats').addEventListener('change', () => {
      if (state.compared.length) compareData()
    })
    document.getElementById('mc-tag-list').addEventListener('click', e => {
      if (e.target.classList.contains('mc-tag-del')) e.target.parentElement.remove()
    })
    document.querySelector('.mc-add-tag').addEventListener('click', () => addTag('', ''))
    document.getElementById('mc-srch').addEventListener('input', renderTable)
    document.getElementById('mc-ftype').addEventListener('change', renderTable)

    document.addEventListener('mc:urlchange', () => {
      state.hcData = []; state.osmData = []; state.compared = []
      document.getElementById('mc-results').style.display = 'none'
      scrapeAndCompare()
    })

    waitForSidebar()
    scrapeAndCompare()
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }
})()
