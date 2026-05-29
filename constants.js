// osmTags: array of filter groups used for the Overpass diet-tag query and tag verification
//          OR between groups, AND within each group
//          { k, v } exact match; { k, v, rx: true } Overpass-style regex
export const DIET = { k: 'diet:vegan', v: 'yes|only', rx: true }

export const HC_CATS = [
  {
    id: 'vegan-rest',
    label: 'Vegan restaurant',
    osmTags: [[{ k: 'diet:vegan', v: 'only' }]],
    match: h => h.entrytype === 1 && h.category === 0 && h.vegan === 1 && h.vegonly === 1
  },
  {
    id: 'veg-rest',
    label: 'Vegetarian restaurant',
    osmTags: [[{ k: 'diet:vegetarian', v: 'only' }]],
    match: h => h.entrytype === 1 && h.category === 0 && h.vegan !== 1 && h.vegonly === 1
  },
  {
    id: 'veg-opt-rest',
    label: 'Veg-options restaurant',
    osmTags: [[{ k: 'diet:vegan', v: 'yes' }], [{ k: 'diet:vegetarian', v: 'yes' }]],
    match: h => h.entrytype === 1 && h.category === 0 && h.vegan !== 1 && h.vegonly !== 1
  },
  {
    id: 'health-store',
    label: 'Health store',
    osmTags: [[{ k: 'shop', v: 'health_food' }, DIET]],
    match: h => h.entrytype === 2 && h.category === 1
  },
  {
    id: 'veg-store',
    label: 'Veg store',
    osmTags: [[{ k: 'shop', v: 'organic|greengrocer', rx: true }, DIET]],
    match: h => h.entrytype === 2 && h.category === 2
  },
  {
    id: 'bakery',
    label: 'Bakery',
    osmTags: [[{ k: 'shop', v: 'bakery' }, DIET]],
    match: h => h.entrytype === 2 && h.category === 3
  },
  {
    id: 'bnb',
    label: 'B&B',
    osmTags: [[{ k: 'tourism', v: 'guest_house' }, DIET]],
    match: h => h.entrytype === 2 && h.category === 4
  },
  {
    id: 'delivery',
    label: 'Delivery',
    osmTags: [[DIET]],
    match: h => h.entrytype === 2 && h.category === 5
  },
  {
    id: 'catering',
    label: 'Catering',
    osmTags: [[{ k: 'shop', v: 'catering' }, DIET]],
    match: h => h.entrytype === 2 && h.category === 6
  },
  {
    id: 'org',
    label: 'Organization',
    osmTags: [[{ k: 'office', v: 'association' }, DIET]],
    match: h => h.entrytype === 2 && h.category === 7
  },
  {
    id: 'farmers-mkt',
    label: "Farmer's market",
    osmTags: [[{ k: 'amenity', v: 'marketplace' }, DIET]],
    match: h => h.entrytype === 2 && h.category === 8
  },
  {
    id: 'food-truck',
    label: 'Food truck',
    osmTags: [[{ k: 'amenity', v: 'fast_food' }, DIET]],
    match: h => h.entrytype === 2 && h.category === 10
  },
  {
    id: 'mkt-vendor',
    label: 'Market vendor',
    osmTags: [[DIET]],
    match: h => h.entrytype === 2 && h.category === 11
  },
  {
    id: 'ice-cream',
    label: 'Ice cream',
    osmTags: [[{ k: 'amenity', v: 'ice_cream' }, DIET]],
    match: h => h.entrytype === 2 && h.category === 12
  },
  {
    id: 'juice-bar',
    label: 'Juice bar',
    osmTags: [[{ k: 'amenity', v: 'juice_bar' }, DIET]],
    match: h => h.entrytype === 2 && h.category === 13
  },
  {
    id: 'professional',
    label: 'Professional',
    osmTags: [[DIET]],
    match: h => h.entrytype === 2 && h.category === 14
  },
  {
    id: 'coffee-tea',
    label: 'Coffee & tea',
    osmTags: [[{ k: 'amenity', v: 'cafe' }, DIET]],
    match: h => h.entrytype === 2 && h.category === 15
  },
  {
    id: 'spa',
    label: 'Spa',
    osmTags: [[{ k: 'leisure', v: 'spa' }, DIET]],
    match: h => h.entrytype === 2 && h.category === 16
  },
  {
    id: 'other',
    label: 'Other',
    osmTags: [[DIET]],
    match: h => h.entrytype === 2 && h.category === 99
  },
]

export const CAT_MAP = {
  1: 'health-store', 2: 'veg-store', 3: 'bakery', 4: 'bnb', 5: 'delivery',
  6: 'catering', 7: 'org', 8: 'farmers-mkt', 10: 'food-truck', 11: 'mkt-vendor',
  12: 'ice-cream', 13: 'juice-bar', 14: 'professional', 15: 'coffee-tea', 16: 'spa', 99: 'other'
}

export const OVERPASS_ENDPOINTS = [
  'https://overpass.openstreetmap.fr/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter'
]

export const COLORS = {
  missing: '#ff0000',
  match: '#00cc00',
  incorrect: '#f1c40f',
  'osm-only': '#ff8800'
}

export const HC_ICON_BASE = 'https://www.happycow.net/img/category/'
export const HC_ICON_FILE = {
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
