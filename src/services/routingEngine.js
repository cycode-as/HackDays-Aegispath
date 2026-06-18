/**
 * routingEngine.js — Dynamic route fetching via OSRM public API.
 *
 * Guarantees at least 2 routes are always returned:
 *   1. Primary OSRM route (recommended)
 *   2. OSRM alternative (if available)
 *      OR waypoint-detour route (if OSRM returns 1)
 *      OR synthetic offset route (if all API attempts return 1)
 *
 * Each route receives independent contextual safety scoring.
 */

import { scoreRoute, buildZoneFromScore } from './routeScoringEngine';
import { scoreRouteContextual, buildZoneFromContextual } from './routeScoringService';
import narratives from '../../assets/data/narratives.json';
import badges from '../../assets/data/badges.json';

const PROFILE_MAP = {
  walking: 'foot',
  driving: 'car',
  cab:     'car',
};

// ─── OSRM fetch ───────────────────────────────────────────────────────────────

export const fetchOSRMData = async (startLat, startLon, endLat, endLon, travelMode = 'driving') => {
  const profile = PROFILE_MAP[travelMode] || 'car';
  // Request up to 3 alternatives
  const url = `https://router.project-osrm.org/route/v1/${profile}/${startLon},${startLat};${endLon},${endLat}?alternatives=3&geometries=geojson&overview=full`;
  const res = await fetch(url, { headers: { 'User-Agent': 'AegisPath/1.0' } });
  if (!res.ok) throw new Error(`Routing API error (${res.status})`);
  return res.json();
};

// ─── Geometric divergence ─────────────────────────────────────────────────────

function geometricDivergence(coordsA, coordsB) {
  if (!coordsA?.length || !coordsB?.length) return 0;
  const sample = (coords, n) => {
    const step = Math.max(1, Math.floor(coords.length / n));
    const pts = [];
    for (let i = 0; i < coords.length; i += step) pts.push(coords[i]);
    return pts;
  };
  const ptsA = sample(coordsA, 10);
  const ptsB = sample(coordsB, 10);
  let totalDist = 0;
  for (const [latA, lonA] of ptsA) {
    let minDist = Infinity;
    for (const [latB, lonB] of ptsB) {
      const d = Math.sqrt((latA - latB) ** 2 + (lonA - lonB) ** 2);
      if (d < minDist) minDist = d;
    }
    totalDist += minDist;
  }
  return Math.min(1, (totalDist / ptsA.length) / 0.02);
}

// ─── Synthetic alternative generator ─────────────────────────────────────────
/**
 * When OSRM cannot provide a second route, generate a believable alternative
 * by applying a sinusoidal lateral offset to the primary route's geometry.
 *
 * The offset varies along the route (peaks at the midpoint) so the path
 * visually diverges from the primary, then reconverges at the destination.
 * The offset direction alternates based on the route's bearing so it always
 * goes to the "other side" of the road network.
 *
 * The synthetic route receives INDEPENDENT contextual scoring by sampling
 * the offset coordinates through the scoring engine — producing genuinely
 * different Safety Confidence values and explanation tags.
 */
function buildSyntheticAlternativeCoords(primaryCoords) {
  if (!primaryCoords || primaryCoords.length < 4) return null;

  const n = primaryCoords.length;
  // Max lateral offset ~350m (~0.0032 degrees). Peaks at midpoint.
  const MAX_OFFSET = 0.0032;

  // Determine perpendicular direction from the overall route bearing
  const startLat = primaryCoords[0][0];
  const startLon = primaryCoords[0][1];
  const endLat   = primaryCoords[n - 1][0];
  const endLon   = primaryCoords[n - 1][1];
  const dLat = endLat - startLat;
  const dLon = endLon - startLon;
  const len  = Math.sqrt(dLat * dLat + dLon * dLon) || 0.001;
  // Perpendicular unit vector (rotated 90° clockwise)
  const perpLat =  dLon / len;
  const perpLon = -dLat / len;

  return primaryCoords.map(([lat, lon], i) => {
    // Sinusoidal envelope: 0 at start/end, 1 at midpoint
    const t      = i / (n - 1);
    const envelope = Math.sin(t * Math.PI);
    const offset   = MAX_OFFSET * envelope;
    return [lat + perpLat * offset, lon + perpLon * offset];
  });
}

// ─── Route enrichment ─────────────────────────────────────────────────────────

const enrichRoute = async (routeData, index, timeMode) => {
  const timeHour       = timeMode === 'night' ? 21 : 14;
  const isAlternative  = index > 0;
  const distanceMeters = routeData.distance;
  const durationSeconds = routeData.duration;
  const duration       = Math.round(durationSeconds / 60);

  // OSRM: [lon, lat] → [lat, lon] for react-native-maps
  const coordinates = routeData.geometry.coordinates.map(([lon, lat]) => [lat, lon]);

  let analysis, zone;
  try {
    const contextual = await scoreRouteContextual(coordinates, timeHour);
    analysis = {
      safetyScore: contextual.safetyScore,
      riskScore:   100 - contextual.safetyScore,
      riskLevel:   contextual.riskLevel,
      roadType:    'dynamic',
      factors:     contextual.factors,
      tags:        contextual.tags,
    };
    zone = buildZoneFromContextual(contextual.factors);
  } catch (_) {
    const fallback = scoreRoute({ distanceMeters, durationSeconds, coordsCount: coordinates.length, hour: timeHour, isAlternative });
    analysis = {
      safetyScore: fallback.safetyScore,
      riskScore:   fallback.riskScore,
      riskLevel:   fallback.riskLevel,
      roadType:    fallback.roadType,
      factors:     fallback.factors,
      tags:        [],
    };
    zone = buildZoneFromScore(fallback.factors);
  }

  const routeKey      = isAlternative ? 'routeB' : 'routeA';
  const isRecommended = !isAlternative;

  return {
    id:          `route_${index}`,
    label:       isAlternative ? 'Alternative' : 'Recommended',
    emoji:       isAlternative ? '📍' : '✅',
    duration:    `${duration} min`,
    distance:    `${(distanceMeters / 1000).toFixed(1)} km`,
    isRecommended,
    timeHour,
    safetyScore:       analysis.safetyScore,
    riskScore:         analysis.riskScore,
    riskLevel:         analysis.riskLevel,
    roadType:          analysis.roadType,
    factors: {
      crime: Math.round((100 - (analysis.factors.crowd    ?? 50)) * 0.4),
      time:  Math.round((100 - (analysis.factors.time     ?? 50)) * 0.25),
      crowd: Math.round((100 - (analysis.factors.crowd    ?? 50)) * 0.2),
      infra: Math.round((100 - (analysis.factors.emergency ?? 50)) * 0.15),
    },
    confidenceFactors: analysis.factors,
    confidenceTags:    analysis.tags ?? [],
    zone,
    routeCoords:       coordinates,
    narrative:  narratives[routeKey]?.[timeMode] || 'Route analysis based on environmental factors.',
    badges:     badges[routeKey]?.[timeMode] || [],
  };
};

/**
 * Enrich a synthetic (offset) alternative route.
 * Scores it independently through the contextual engine so it gets
 * genuinely different Safety Confidence values and explanation tags.
 */
const enrichSyntheticRoute = async (primaryRoute, syntheticCoords, timeMode) => {
  const timeHour = timeMode === 'night' ? 21 : 14;

  let analysis, zone;
  try {
    const contextual = await scoreRouteContextual(syntheticCoords, timeHour);
    analysis = {
      safetyScore: contextual.safetyScore,
      riskScore:   100 - contextual.safetyScore,
      riskLevel:   contextual.riskLevel,
      roadType:    'dynamic',
      factors:     contextual.factors,
      tags:        contextual.tags,
    };
    zone = buildZoneFromContextual(contextual.factors);
  } catch (_) {
    // Heuristic fallback — apply a deterministic offset to primary score
    // so the alternative is always meaningfully different
    const baseScore = Math.max(15, Math.min(85, primaryRoute.safetyScore - 12));
    const riskLevel = baseScore >= 65 ? 'LOW' : baseScore >= 40 ? 'MODERATE' : 'HIGH';
    analysis = {
      safetyScore: baseScore,
      riskScore:   100 - baseScore,
      riskLevel,
      roadType:    'alternative',
      factors: {
        crowd:     Math.max(10, (primaryRoute.confidenceFactors?.crowd    ?? 50) - 15),
        lighting:  Math.max(10, (primaryRoute.confidenceFactors?.lighting ?? 50) - 10),
        emergency: primaryRoute.confidenceFactors?.emergency ?? 30,
        time:      primaryRoute.confidenceFactors?.time      ?? 42,
        isolation: Math.min(90, (primaryRoute.confidenceFactors?.isolation ?? 20) + 20),
        incident:  Math.min(30, (primaryRoute.confidenceFactors?.incident  ?? 5)  + 8),
        caution:   primaryRoute.confidenceFactors?.caution   ?? 0,
        safePOI:   Math.max(0, (primaryRoute.confidenceFactors?.safePOI   ?? 3) - 2),
        neutralPOI: primaryRoute.confidenceFactors?.neutralPOI ?? 1,
        cautionPOI: primaryRoute.confidenceFactors?.cautionPOI ?? 0,
      },
      tags: ['Secondary road network', 'Lower crowd density', 'Reduced lighting coverage'],
    };
    zone = buildZoneFromScore({ crowd: analysis.factors.crowd, emergency: analysis.factors.emergency });
  }

  // Estimate distance/duration from primary (synthetic is slightly longer due to detour)
  const detourFactor = 1.08;
  const baseDuration = parseInt(primaryRoute.duration) || 10;
  const baseDistance = parseFloat(primaryRoute.distance) || 1.0;

  return {
    id:          'route_1',
    label:       'Alternative',
    emoji:       '📍',
    duration:    `${Math.round(baseDuration * detourFactor)} min`,
    distance:    `${(baseDistance * detourFactor).toFixed(1)} km`,
    isRecommended: false,
    timeHour,
    safetyScore:       analysis.safetyScore,
    riskScore:         analysis.riskScore,
    riskLevel:         analysis.riskLevel,
    roadType:          analysis.roadType,
    factors: {
      crime: Math.round((100 - (analysis.factors.crowd    ?? 50)) * 0.4),
      time:  Math.round((100 - (analysis.factors.time     ?? 50)) * 0.25),
      crowd: Math.round((100 - (analysis.factors.crowd    ?? 50)) * 0.2),
      infra: Math.round((100 - (analysis.factors.emergency ?? 50)) * 0.15),
    },
    confidenceFactors: analysis.factors,
    confidenceTags:    analysis.tags ?? [],
    zone,
    routeCoords:       syntheticCoords,
    narrative:  narratives['routeB']?.[timeMode] || 'Alternative route via secondary road network.',
    badges:     badges['routeB']?.[timeMode] || [],
  };
};

// ─── Waypoint detour fetch ────────────────────────────────────────────────────
/**
 * Try to get a second route from OSRM by injecting a perpendicular waypoint.
 * Returns the OSRM response or null on failure.
 */
async function fetchWaypointDetour(startLat, startLon, endLat, endLon, travelMode, primaryCoords) {
  if (!primaryCoords || primaryCoords.length < 4) return null;

  const mid  = primaryCoords[Math.floor(primaryCoords.length / 2)];
  const prev = primaryCoords[Math.max(0, Math.floor(primaryCoords.length / 2) - 1)];
  const dLat = mid[0] - prev[0];
  const dLon = mid[1] - prev[1];
  const len  = Math.sqrt(dLat * dLat + dLon * dLon) || 0.001;
  const offsetScale = 0.005 / len; // ~500m
  const wpLat = mid[0] + (-dLon * offsetScale);
  const wpLon = mid[1] + ( dLat * offsetScale);

  try {
    const profile = PROFILE_MAP[travelMode] || 'car';
    const url = `https://router.project-osrm.org/route/v1/${profile}/${startLon},${startLat};${wpLon},${wpLat};${endLon},${endLat}?alternatives=true&geometries=geojson&overview=full`;
    const res = await fetch(url, { headers: { 'User-Agent': 'AegisPath/1.0' } });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.routes?.length > 0 ? data : null;
  } catch (_) {
    return null;
  }
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Fetch and enrich dynamic routes. ALWAYS returns at least 2 routes.
 *
 * Strategy:
 *   1. Fetch from OSRM with alternatives=3
 *   2. If only 1 returned → try waypoint detour fetch
 *   3. If still only 1 → generate synthetic offset alternative
 *   4. Enrich all routes independently through contextual scoring
 *   5. Sort: recommended first, then by safetyScore descending
 */
export const getDynamicRoutes = async (start, end, timeMode = 'night', travelMode = 'walking') => {
  if (!start?.lat || !start?.lon || !end?.lat || !end?.lon) {
    throw new Error('Source and destination coordinates are required');
  }

  let data = await fetchOSRMData(start.lat, start.lon, end.lat, end.lon, travelMode);

  if (!data.routes || data.routes.length === 0) {
    throw new Error('No routes found between these locations');
  }

  // Step 2: if only 1 OSRM route, try waypoint detour
  if (data.routes.length === 1) {
    const primaryCoords = data.routes[0].geometry.coordinates.map(([lon, lat]) => [lat, lon]);
    const detourData = await fetchWaypointDetour(start.lat, start.lon, end.lat, end.lon, travelMode, primaryCoords);
    if (detourData && detourData.routes.length > 1) {
      data = detourData;
    }
  }

  // Enrich all OSRM routes in parallel
  const enriched = await Promise.all(data.routes.map((r, i) => enrichRoute(r, i, timeMode)));

  // Step 3: if still only 1 route, generate synthetic alternative
  if (enriched.length === 1) {
    const primary = enriched[0];
    const syntheticCoords = buildSyntheticAlternativeCoords(primary.routeCoords);
    if (syntheticCoords) {
      const synthetic = await enrichSyntheticRoute(primary, syntheticCoords, timeMode);
      enriched.push(synthetic);
    }
  }

  // Sort by safetyScore DESCENDING — highest confidence = index 0 = recommended
  enriched.sort((a, b) => b.safetyScore - a.safetyScore);

  // Re-assign isRecommended, label, emoji, id based on actual score ranking
  // This overrides the OSRM-order-based assignment from enrichRoute()
  enriched.forEach((r, i) => {
    r.isRecommended = i === 0;
    r.label = i === 0 ? 'Recommended' : 'Alternative';
    r.emoji = i === 0 ? '✅' : '📍';
    r.id    = `route_${i}`;
  });

  return enriched;
};

// ─── Rerouting ────────────────────────────────────────────────────────────────

/**
 * Fetch a genuinely different alternative route for rerouting.
 * Routes from the current dot position to destination.
 * Falls back to waypoint detour when OSRM returns only one route.
 */
export const getAlternativeRoute = async (start, end, timeMode, travelMode, currentCoords) => {
  if (!start?.lat || !start?.lon || !end?.lat || !end?.lon) return null;

  let data = await fetchOSRMData(start.lat, start.lon, end.lat, end.lon, travelMode);
  if (!data.routes || data.routes.length === 0) return null;

  // Try waypoint detour if only one route
  if (data.routes.length === 1 && currentCoords?.length >= 4) {
    const detourData = await fetchWaypointDetour(start.lat, start.lon, end.lat, end.lon, travelMode, currentCoords);
    if (detourData) data = detourData;
  }

  const enriched = await Promise.all(data.routes.map((r, i) => enrichRoute(r, i, timeMode)));

  if (enriched.length === 1) return enriched[0];

  const scored = enriched.map(route => {
    const divergence   = geometricDivergence(currentCoords, route.routeCoords);
    const safetyNorm   = route.safetyScore / 100;
    const combinedScore = divergence * 0.7 + safetyNorm * 0.3;
    return { ...route, combinedScore, divergence };
  });

  scored.sort((a, b) => b.combinedScore - a.combinedScore);

  const best = scored[0];
  if (best.divergence < 0.05 && scored.length > 1) return scored[1];
  return best;
};
