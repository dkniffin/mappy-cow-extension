import { HC_CATS } from './constants.js'
import { state } from './state.js'
import { hav, nsim, setStatus } from './utils.js'
import { updateMarkers } from './map.js'
import { renderTable } from './ui.js'

function osmMatchesCat(osmEl, cat) {
  const tags = osmEl.tags || {}
  return cat.osmTags.some(group =>
    group.every(t => {
      const val = tags[t.k]
      if (!val) return false
      return t.rx ? new RegExp(`^(${t.v})$`).test(val) : val === t.v
    })
  )
}

export function compareData() {
  state.compared = []
  const selectedCats = HC_CATS.filter(c => {
    const cb = document.querySelector(`.mc-hc-cat[data-id="${c.id}"]`)
    return cb && cb.checked
  })
  const primary = state.hcData.filter(hc => hc.lat && hc.lng && selectedCats.some(c => c.match(hc)))

  // Phase 1: match HC venues to diet-tagged OSM venues by name + proximity
  const cands1 = []
  primary.forEach((hc, hi) => {
    const lat = parseFloat(hc.lat), lng = parseFloat(hc.lng)
    state.osmDietData.forEach((o, oi) => {
      const d = hav(lat, lng, o.lat, o.lon); if (d > 300) return
      const ns = nsim(hc.name || '', o.name); if (ns === 0) return
      cands1.push({ d, ns, hi, oi, dist: Math.round(d) })
    })
  })
  cands1.sort((a, b) => (b.ns - a.ns) || (a.d - b.d))
  const usedHC1 = {}, usedOSM1 = {}, matchedDietIds = new Set()
  cands1.forEach(p => {
    if (usedHC1[p.hi] || usedOSM1[p.oi]) return
    usedHC1[p.hi] = true; usedOSM1[p.oi] = true
    const osmEl = state.osmDietData[p.oi]
    matchedDietIds.add(osmEl.id)
    const hcVenue = primary[p.hi]
    const catDef = HC_CATS.find(c => c.id === hcVenue.hc_category)
    const correct = catDef ? osmMatchesCat(osmEl, catDef) : true
    state.compared.push({ status: correct ? 'match' : 'incorrect', hc: hcVenue, osm: osmEl, dist: p.dist })
  })

  // Phase 2: match remaining HC venues to name-queried OSM venues (these lack diet tags → incorrect)
  const unmatchedHC = primary.filter((_, hi) => !usedHC1[hi])
  const cands2 = []
  unmatchedHC.forEach((hc, hi) => {
    const lat = parseFloat(hc.lat), lng = parseFloat(hc.lng)
    state.osmNameData.forEach((o, oi) => {
      const d = hav(lat, lng, o.lat, o.lon); if (d > 300) return
      const ns = nsim(hc.name || '', o.name); if (ns === 0) return
      cands2.push({ d, ns, hi, oi, dist: Math.round(d) })
    })
  })
  cands2.sort((a, b) => (b.ns - a.ns) || (a.d - b.d))
  const usedHC2 = {}, usedOSM2 = {}
  cands2.forEach(p => {
    if (usedHC2[p.hi] || usedOSM2[p.oi]) return
    usedHC2[p.hi] = true; usedOSM2[p.oi] = true
    state.compared.push({ status: 'incorrect', hc: unmatchedHC[p.hi], osm: state.osmNameData[p.oi], dist: p.dist })
  })

  // Remaining HC venues: not found in OSM at all
  unmatchedHC.forEach((hc, hi) => {
    if (!usedHC2[hi]) state.compared.push({ status: 'missing', hc, osm: null, dist: null })
  })

  // OSM-only: diet-tagged venues with no matching HC entry
  state.osmDietData.forEach(o => {
    if (!matchedDietIds.has(o.id)) {
      state.compared.push({ status: 'osm-only', hc: null, osm: o, dist: null, hcPartial: null })
    }
  })

  const nMatch = state.compared.filter(c => c.status === 'match').length
  const nMiss = state.compared.filter(c => c.status === 'missing').length
  const nIncorrect = state.compared.filter(c => c.status === 'incorrect').length
  const nOnly = state.compared.filter(c => c.status === 'osm-only').length
  document.getElementById('mc-stats').innerHTML =
    `<div class="mc-stats">` +
    `<span>HC: <strong>${primary.length}</strong></span>` +
    `<span>OSM: <strong>${state.osmDietData.length}</strong></span>` +
    `<span class="mc-green">Found: <strong>${nMatch}</strong></span>` +
    `<span class="mc-red">Missing: <strong>${nMiss}</strong></span>` +
    `<span class="mc-yellow">Incorrect: <strong>${nIncorrect}</strong></span>` +
    `<span class="mc-orange">OSM only: <strong>${nOnly}</strong></span>` +
    `</div>`
  document.getElementById('mc-results').style.display = 'block'
  setStatus('Done.')
  updateMarkers()
  renderTable()
}
