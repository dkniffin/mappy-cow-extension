export const state = { hcData: [], osmData: [], compared: [] }

// Mutable refs held in an object so all modules share the same bindings
export const refs = { leafletMap: null, markerLayer: null, mcActive: false }
