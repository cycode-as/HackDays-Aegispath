/**
 * policeStationService.js
 *
 * Finds the nearest police station using the Overpass API (OpenStreetMap data).
 * No API key required. Free tier. Works globally.
 *
 * Query strategy:
 *   - Search for amenity=police within a 5km radius of the user's location
 *   - Sort by distance, return the closest one
 *   - Gracefully fall back if no results or network fails
 */

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const SEARCH_RADIUS_M = 5000; // 5 km

/**
 * Haversine distance between two lat/lon points in km.
 */
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Estimate walking/driving time from distance.
 * Returns a human-readable string like "~4 min" or "~12 min".
 */
function estimateETA(distanceKm) {
  // Assume ~30 km/h average in urban area (car/auto)
  const minutes = Math.round((distanceKm / 30) * 60);
  if (minutes < 2) return '< 2 min';
  return `~${minutes} min`;
}

/**
 * Format distance for display.
 */
function formatDistance(distanceKm) {
  if (distanceKm < 1) return `${Math.round(distanceKm * 1000)} m`;
  return `${distanceKm.toFixed(1)} km`;
}

/**
 * Fetch the nearest police station to the given coordinates.
 *
 * @param {number} lat - User's latitude
 * @param {number} lon - User's longitude
 * @returns {Promise<{
 *   name: string,
 *   distance: string,
 *   eta: string,
 *   phone: string | null,
 *   lat: number,
 *   lon: number,
 * } | null>}
 */
export async function getNearestPoliceStation(lat, lon) {
  try {
    // Overpass QL query: find police amenities within radius
    const query = `
      [out:json][timeout:10];
      (
        node["amenity"="police"](around:${SEARCH_RADIUS_M},${lat},${lon});
        way["amenity"="police"](around:${SEARCH_RADIUS_M},${lat},${lon});
      );
      out center tags;
    `;

    const res = await fetch(OVERPASS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'AegisPath/1.0',
      },
      body: `data=${encodeURIComponent(query)}`,
    });

    if (!res.ok) return null;

    const data = await res.json();
    const elements = data?.elements ?? [];

    if (elements.length === 0) return null;

    // Normalise: ways have a `center` object, nodes have lat/lon directly
    const stations = elements.map(el => ({
      name: el.tags?.name || el.tags?.['name:en'] || 'Police Station',
      phone: el.tags?.phone || el.tags?.['contact:phone'] || null,
      lat: el.lat ?? el.center?.lat,
      lon: el.lon ?? el.center?.lon,
    })).filter(s => s.lat != null && s.lon != null);

    if (stations.length === 0) return null;

    // Sort by distance and pick the closest
    const withDistance = stations.map(s => ({
      ...s,
      distanceKm: haversineKm(lat, lon, s.lat, s.lon),
    }));
    withDistance.sort((a, b) => a.distanceKm - b.distanceKm);

    const nearest = withDistance[0];

    return {
      name:     nearest.name,
      distance: formatDistance(nearest.distanceKm),
      eta:      estimateETA(nearest.distanceKm),
      phone:    nearest.phone,
      lat:      nearest.lat,
      lon:      nearest.lon,
    };
  } catch (_) {
    return null;
  }
}
