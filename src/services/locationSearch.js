/**
 * locationSearch.js — Location search via Nominatim (OpenStreetMap).
 * No API key required. Rate limit: 1 req/sec.
 */

/**
 * Search for locations matching a query string.
 * Returns array of { label, lat, lon, displayName }
 */
export async function searchLocations(query) {
  if (!query || query.trim().length < 2) return [];
  try {
    const encoded = encodeURIComponent(query.trim());
    const url = `https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&limit=6&addressdetails=1`;
    const res = await fetch(url, {
      headers: { 'Accept-Language': 'en', 'User-Agent': 'AegisPath/1.0' },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.map(item => ({
      label: item.display_name.split(',').slice(0, 3).join(', ').trim(),
      displayName: item.display_name,
      lat: parseFloat(item.lat),
      lon: parseFloat(item.lon),
    }));
  } catch (_) {
    return [];
  }
}

/**
 * Reverse geocode coordinates to a human-readable label.
 * @param {number} lat
 * @param {number} lon
 * @returns {Promise<string>} Display label
 */
export async function reverseGeocode(lat, lon) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=16`;
    const res = await fetch(url, {
      headers: { 'Accept-Language': 'en', 'User-Agent': 'AegisPath/1.0' },
    });
    if (!res.ok) return 'Current Location';
    const data = await res.json();
    return data.display_name?.split(',').slice(0, 2).join(', ').trim() || 'Current Location';
  } catch (_) {
    return 'Current Location';
  }
}
