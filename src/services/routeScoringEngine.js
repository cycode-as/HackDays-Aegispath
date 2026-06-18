/**
 * routeScoringEngine.js — Environmental Safety Confidence Engine
 *
 * Generates intelligent safety confidence scores for routes based on
 * environmental heuristics. This is NOT crime prediction — it estimates
 * environmental safety confidence using route characteristics.
 *
 * Factors:
 *  - Crowd Confidence (POI density heuristic based on route type)
 *  - Lighting Confidence (time-of-day + road classification)
 *  - Isolation Score (segment spacing, road type)
 *  - Emergency Accessibility (proximity to major roads)
 *  - Route Type Confidence (highway vs residential vs footpath)
 *  - Time-of-Day Confidence
 *
 * Each factor is scored 0–100 (higher = safer).
 * Final Safety Confidence = weighted composite.
 */

// ─── Time-of-day lighting & crowd modifiers ──────────────────────────────────

function getTimeConfidence(hour) {
  // Peak safety during business hours, lowest late night
  if (hour >= 8 && hour < 17) return 95;   // Daytime — excellent
  if (hour >= 6 && hour < 8)  return 80;   // Early morning — good
  if (hour >= 17 && hour < 20) return 70;  // Evening — moderate
  if (hour >= 20 && hour < 22) return 45;  // Night — reduced
  return 20;                                // Late night — low
}

function getLightingConfidence(hour, roadType) {
  const baseTime = getTimeConfidence(hour);

  // Road type modifiers — major roads are better lit
  const roadModifiers = {
    highway: 15,
    primary: 12,
    secondary: 8,
    tertiary: 3,
    residential: -5,
    footway: -15,
    unknown: 0,
  };

  const modifier = roadModifiers[roadType] || 0;
  return Math.max(0, Math.min(100, baseTime + modifier));
}

// ─── Route characteristic analysis ──────────────────────────────────────────

function classifyRoadType(distanceMeters, durationSeconds) {
  if (!durationSeconds || durationSeconds === 0) return 'unknown';
  const speedKmh = (distanceMeters / 1000) / (durationSeconds / 3600);

  if (speedKmh > 60) return 'highway';
  if (speedKmh > 40) return 'primary';
  if (speedKmh > 25) return 'secondary';
  if (speedKmh > 15) return 'tertiary';
  if (speedKmh > 5)  return 'residential';
  return 'footway';
}

function getCrowdConfidence(roadType, hour) {
  // Commercial/major roads have more foot traffic
  const baseScores = {
    highway: 30,       // Cars only, no pedestrian safety
    primary: 75,       // Major roads — shops, people
    secondary: 70,     // Moderate commercial
    tertiary: 55,      // Mixed areas
    residential: 40,   // Quiet streets
    footway: 25,       // Isolated paths
    unknown: 50,
  };

  const base = baseScores[roadType] || 50;

  // Time modifier — crowds thin at night
  const timeMultiplier =
    (hour >= 8 && hour < 20) ? 1.0 :
    (hour >= 6 && hour < 8)  ? 0.7 :
    (hour >= 20 && hour < 22) ? 0.5 :
    0.25;

  return Math.max(0, Math.min(100, Math.round(base * timeMultiplier)));
}

function getIsolationScore(coordsCount, distanceMeters) {
  // More coordinates = more detailed route = likely through populated areas
  // Fewer coords over long distance = straight road through isolated area
  if (coordsCount === 0 || distanceMeters === 0) return 50;

  const pointDensity = coordsCount / (distanceMeters / 1000); // points per km
  
  if (pointDensity > 50)  return 90;  // Very detailed — urban
  if (pointDensity > 20)  return 75;  // Moderate — suburban
  if (pointDensity > 10)  return 55;  // Sparse — semi-rural
  if (pointDensity > 5)   return 35;  // Low — rural
  return 20;                           // Very low — isolated
}

function getEmergencyAccessibility(roadType, distanceMeters) {
  // Major roads = easier for emergency vehicles to reach
  const baseScores = {
    highway: 90,
    primary: 85,
    secondary: 70,
    tertiary: 55,
    residential: 45,
    footway: 20,
    unknown: 50,
  };

  const base = baseScores[roadType] || 50;

  // Shorter routes are easier to respond to
  const distanceModifier = distanceMeters < 2000 ? 10 :
                           distanceMeters < 5000 ? 5 :
                           distanceMeters < 10000 ? 0 : -10;

  return Math.max(0, Math.min(100, base + distanceModifier));
}

function getRouteTypeConfidence(roadType) {
  const scores = {
    highway: 40,      // Fast but not pedestrian-friendly
    primary: 80,      // Well-maintained, visible
    secondary: 75,
    tertiary: 60,
    residential: 45,
    footway: 30,
    unknown: 50,
  };
  return scores[roadType] || 50;
}

// ─── Composite scoring ──────────────────────────────────────────────────────

const WEIGHTS = {
  crowd:      0.22,
  lighting:   0.22,
  isolation:  0.18,
  emergency:  0.15,
  routeType:  0.10,
  time:       0.13,
};

/**
 * Score a route for safety confidence.
 *
 * @param {Object} params
 * @param {number} params.distanceMeters   - Total route distance
 * @param {number} params.durationSeconds  - Total route duration
 * @param {number} params.coordsCount      - Number of coordinate points in geometry
 * @param {number} params.hour             - Hour of day (0-23)
 * @param {boolean} params.isAlternative   - Whether this is an alternative route
 * @returns {Object} Safety analysis result
 */
export function scoreRoute({ distanceMeters, durationSeconds, coordsCount, hour, isAlternative }) {
  const roadType = classifyRoadType(distanceMeters, durationSeconds);

  const factors = {
    crowd:     getCrowdConfidence(roadType, hour),
    lighting:  getLightingConfidence(hour, roadType),
    isolation: getIsolationScore(coordsCount, distanceMeters),
    emergency: getEmergencyAccessibility(roadType, distanceMeters),
    routeType: getRouteTypeConfidence(roadType),
    time:      getTimeConfidence(hour),
  };

  // Add slight variation for alternative routes to make comparison meaningful
  if (isAlternative) {
    factors.crowd     = Math.max(0, Math.min(100, factors.crowd - 8));
    factors.isolation  = Math.max(0, Math.min(100, factors.isolation - 5));
    factors.lighting   = Math.max(0, Math.min(100, factors.lighting - 3));
  }

  // Compute weighted composite
  const safetyConfidence = Math.round(
    factors.crowd     * WEIGHTS.crowd +
    factors.lighting  * WEIGHTS.lighting +
    factors.isolation * WEIGHTS.isolation +
    factors.emergency * WEIGHTS.emergency +
    factors.routeType * WEIGHTS.routeType +
    factors.time      * WEIGHTS.time
  );

  const safetyScore = Math.max(0, Math.min(100, safetyConfidence));
  const riskLevel = safetyScore >= 65 ? 'LOW' :
                    safetyScore >= 40 ? 'MODERATE' : 'HIGH';

  return {
    safetyScore,
    riskScore: 100 - safetyScore,
    riskLevel,
    roadType,
    factors,
  };
}

/**
 * Generate a zone object compatible with calcRiskScore for Time Impact screen.
 */
export function buildZoneFromScore(factors) {
  return {
    crimeLevel: Math.max(0, 100 - factors.crowd),
    crowdLevel: factors.crowd >= 60 ? 'busy' : factors.crowd >= 35 ? 'moderate' : 'isolated',
    infraLevel: factors.emergency >= 60 ? 'full' : factors.emergency >= 35 ? 'mixed' : 'poor',
  };
}
