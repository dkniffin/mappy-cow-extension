import { HC_CATS } from './constants.js'
import { state } from './state.js'
import { hav, nsim, setStatus } from './utils.js'
import { updateMarkers } from './map.js'
import { renderTable } from './ui.js'

export function osmMatchesCat(osmEl, cat) {
  const tags = osmEl.tags || {}
  return cat.osmTags.some(group =>
    group.every(t => {
      const val = tags[t.k]
      if (!val) return false
      return t.rx ? new RegExp(`^(${t.v})$`).test(val) : val === t.v
    })
  )
}

export function maybeCompare() {
  if (state.hcData.length && state.osmData.length) compareData()
}

export function compareData() {
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
