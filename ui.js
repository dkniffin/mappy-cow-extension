import { HC_CATS } from './constants.js'
import { state, refs } from './state.js'
import { esc } from './utils.js'
import { initLeafletMap, updateMarkers } from './map.js'
import { scrapeAndCompare } from './data.js'
import { compareData } from './compare.js'

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
              <option value="incorrect">Incorrect in OSM</option>
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

export function renderTable() {
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
    } else if (c.status === 'incorrect') {
      badge = `<span class="mc-badge mc-incor">Incorrect ${c.dist}m</span>`
      const eu = `https://www.openstreetmap.org/edit?${c.osm.type}=${c.osm.id}`
      links = (hcUrl ? `<a href="${hcUrl}" target="_blank">HappyCow</a> · ` : '') + `<a href="https://www.openstreetmap.org/${c.osm.type}/${c.osm.id}" target="_blank">OSM</a> · <a href="${eu}" target="_blank">Edit OSM</a>`
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
    if (refs.mcActive) {
      showHC()
      panel.style.display = 'none'
      mapEl.style.display = 'none'
      refs.mcActive = false
    } else {
      hideHC()
      panel.style.display = 'flex'
      mapEl.style.display = 'block'
      if (!refs.leafletMap) initLeafletMap()
      refs.leafletMap.invalidateSize()
      if (!state.hcData.length) scrapeAndCompare()
      refs.mcActive = true
    }
  })
  document.getElementById('mc-refresh').addEventListener('click', () => {
    state.hcData = []; state.osmDietData = []; state.osmNameData = []; state.compared = []
    document.getElementById('mc-results').style.display = 'none'
    refs.markerLayer.clearLayers()
    scrapeAndCompare()
  })
  document.getElementById('mc-cats').addEventListener('change', () => {
    if (state.compared.length) compareData()
  })
  document.getElementById('mc-srch').addEventListener('input', renderTable)
  document.getElementById('mc-ftype').addEventListener('change', () => { renderTable(); updateMarkers() })

  document.addEventListener('mc:urlchange', () => {
    state.hcData = []; state.osmDietData = []; state.osmNameData = []; state.compared = []
    if (refs.markerLayer) refs.markerLayer.clearLayers()
    document.getElementById('mc-results').style.display = 'none'
    const p = new URLSearchParams(window.location.search)
    const lat = parseFloat(p.get('lat')), lng = parseFloat(p.get('lng')), zoom = parseInt(p.get('zoom'))
    if (refs.leafletMap && !isNaN(lat) && !isNaN(lng)) refs.leafletMap.setView([lat, lng], zoom || refs.leafletMap.getZoom())
    if (refs.mcActive) scrapeAndCompare()
  })
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init)
} else {
  init()
}
