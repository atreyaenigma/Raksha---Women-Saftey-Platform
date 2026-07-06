// Demo dataset with real-world coordinates — in production this list would come from
// a Places API queried live against the user's coordinates instead of being static.
export const STATIONS = [
  { name: 'Connaught Place Police Station', lat: 28.6315, lng: 77.2167, phone: '+91 11 2334 1234' },
  { name: 'Parliament Street Police Station', lat: 28.6229, lng: 77.2100, phone: '+91 11 2336 5678' },
  { name: 'Mandir Marg Police Station', lat: 28.6249, lng: 77.2003, phone: '+91 11 2336 9012' },
  { name: "Women's Help Desk — North District", lat: 28.7041, lng: 77.1025, phone: '1091' },
];

// Haversine distance in km between two lat/lng points.
export function distanceKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Returns STATIONS annotated with distance-from (lat, lng) in km, nearest first when `live`
// is true (i.e. we trust the coordinates as the user's real position, not the demo default).
export function nearestStations(lat, lng, live) {
  const withDistance = STATIONS.map((s) => ({
    ...s,
    km: live ? distanceKm(lat, lng, s.lat, s.lng) : null,
  }));
  if (live) withDistance.sort((a, b) => a.km - b.km);
  return withDistance;
}

// ── Live lookup (real coordinates, anywhere) ────────────────────────────────
// The dataset above is a fixed New Delhi demo set. For a user's actual live
// location — which could be anywhere — we query OpenStreetMap's Overpass API
// for real police=amenity points nearby. No API key needed. Two public
// endpoints are tried in case one is rate-limited or down.
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

function extractPhone(tags = {}) {
  return tags.phone || tags['contact:phone'] || tags['contact:mobile'] || tags.mobile || null;
}

async function queryOverpass(query, timeoutMs = 12000) {
  let lastErr;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: query,
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`Overpass responded ${res.status}`);
      return await res.json();
    } catch (err) {
      clearTimeout(timer);
      lastErr = err;
    }
  }
  throw lastErr || new Error('Overpass unreachable');
}

// Looks up real, nearby police stations from OpenStreetMap around (lat, lng).
// Tries a tight 5km radius first and widens to 15km if nothing turns up (rural
// areas can be sparse). Not every OSM entry has a phone tagged — callers should
// fall back to a national helpline for entries with `phone: null`.
export async function fetchNearbyPoliceStations(lat, lng, { limit = 5 } = {}) {
  for (const radius of [5000, 15000]) {
    const query = `[out:json][timeout:20];(node["amenity"="police"](around:${radius},${lat},${lng});way["amenity"="police"](around:${radius},${lat},${lng});relation["amenity"="police"](around:${radius},${lat},${lng}););out center;`;
    const data = await queryOverpass(query);
    const elements = data?.elements || [];
    if (!elements.length) continue;

    const stations = elements
      .map((el) => {
        const elLat = el.lat ?? el.center?.lat;
        const elLng = el.lon ?? el.center?.lon;
        if (elLat == null || elLng == null) return null;
        return {
          name: el.tags?.name || el.tags?.['name:en'] || 'Police station',
          lat: elLat,
          lng: elLng,
          phone: extractPhone(el.tags),
          km: distanceKm(lat, lng, elLat, elLng),
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.km - b.km)
      .slice(0, limit);

    if (stations.length) return stations;
  }
  return [];
}
