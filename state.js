export const state = { hcData: [], osmDietData: [], osmNameData: [], compared: [], nominatimAddr: null }

// Mutable refs held in an object so all modules share the same bindings
export const refs = { leafletMap: null, markerLayer: null, mcActive: false }
