/**
 * routeScoringService.js — Contextual Safety Confidence Engine
 *
 * Evaluates route safety confidence using real OpenStreetMap environmental
 * context fetched via the Overpass API.
 *
 * Formula:
 *   SafetyConfidence = w_crowd·CrowdScore + w_lighting·Lighting
 *                    + w_emergency·EmergencyAccess + w_time·TimeConfidence
 *                    - w_isolation·IsolationDanger
 *                    - w_incident·IncidentPenalty
 *                    - w_caution·CautionZonePenalty
 *
 * POI classification:
 *   SAFE    — cafes, restaurants, hospitals, pharmacies, schools, supermarkets,
 *             malls, transit stations, police stations, commercial areas
 *   NEUTRAL — banks, fast food, places of worship, community centres, libraries,
 *             general retail shops
 *   CAUTION — bars, pubs, nightclubs, liquor/alcohol shops, casinos
 *
 * Crowd scoring:
 *   SAFE POIs  → increase Safety Confidence
 *   CAUTION POIs → reduce Safety Confidence (amplified at night)
 *
 * All factors normalized to [0, 100]. Final score clamped to [15, 95].
 *
 * IMPORTANT: This estimates contextual travel safety confidence.
 * It does NOT predict crime.
 */

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

// ─── In-memory cache keyed by rounded lat/lon grid cell ──────────────────────
const _cache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, value));

function cacheKey(lat, lon, radius) {
  // Round to 3 decimal places (~111m grid) to reuse nearby queries
  return `${lat.toFixed(3)},${lon.toFixed(3)},${radius}`;
}

async function overpassQuery(query) {
  const res = await fetch(OVERPASS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'AegisPath/1.0',
    },
    body: `data=${encodeURIComponent(query)}`,
  });
  if (!res.ok) throw new Error(`Overpass error ${res.status}`);
  return res.json();
}

/**
 * Parse a count block result from Overpass `out count` response.
 * Each `out count` block emits one element whose tags contain
 * { total, nodes, ways, relations, areas }.
 */
function parseCountBlock(element) {
  if (!element || !element.tags) return 0;
  return parseInt(element.tags.total ?? 0, 10);
}

/**
 * Fetch POI context around a single point with caching.
 *
 * Runs a single Overpass request with 6 separate union+count blocks:
 *   [0] SAFE POIs
 *   [1] NEUTRAL POIs
 *   [2] CAUTION POIs
 *   [3] Emergency services
 *   [4] Major roads
 *   [5] Isolated paths
 *
 * Returns counts of relevant OSM features within the radius.
 */
async function fetchPointContext(lat, lon, radiusM = 300) {
  const key = cacheKey(lat, lon, radiusM);
  const cached = _cache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.data;

  // Each block is a separate union followed by `out count;`
  // Overpass returns one element per `out count` statement, in order.
  const query = `
[out:json][timeout:10];

// Block 0 — SAFE POIs
(
  node["amenity"~"^(cafe|restaurant|hospital|pharmacy|school|university|police|bus_station|transit_station)$"](around:${radiusM},${lat},${lon});
  way["amenity"~"^(cafe|restaurant|hospital|pharmacy|school|university|police|bus_station|transit_station)$"](around:${radiusM},${lat},${lon});
  node["shop"~"^(supermarket|mall|department_store)$"](around:${radiusM},${lat},${lon});
  way["shop"~"^(supermarket|mall|department_store)$"](around:${radiusM},${lat},${lon});
  node["public_transport"~"^(station|stop_position|platform)$"](around:${radiusM},${lat},${lon});
  way["public_transport"~"^(station|platform)$"](around:${radiusM},${lat},${lon});
  node["railway"~"^(station|subway_entrance|tram_stop)$"](around:${radiusM},${lat},${lon});
  way["railway"~"^(station|subway_entrance|tram_stop)$"](around:${radiusM},${lat},${lon});
  way["landuse"="commercial"](around:${radiusM},${lat},${lon});
  way["building"~"^(commercial|retail|supermarket)$"](around:${radiusM},${lat},${lon});
);
out count;

// Block 1 — NEUTRAL POIs
(
  node["amenity"~"^(bank|fast_food|marketplace|place_of_worship|community_centre|library|post_office|fuel)$"](around:${radiusM},${lat},${lon});
  way["amenity"~"^(bank|fast_food|marketplace|place_of_worship|community_centre|library|post_office|fuel)$"](around:${radiusM},${lat},${lon});
  node["shop"]["shop"!~"^(supermarket|mall|department_store|alcohol|wine|beverages|liquor)$"](around:${radiusM},${lat},${lon});
  way["shop"]["shop"!~"^(supermarket|mall|department_store|alcohol|wine|beverages|liquor)$"](around:${radiusM},${lat},${lon});
);
out count;

// Block 2 — CAUTION POIs (nightlife / alcohol / gambling)
(
  node["amenity"~"^(bar|pub|nightclub|casino|stripclub|brothel)$"](around:${radiusM},${lat},${lon});
  way["amenity"~"^(bar|pub|nightclub|casino|stripclub|brothel)$"](around:${radiusM},${lat},${lon});
  node["shop"~"^(alcohol|wine|beverages|liquor)$"](around:${radiusM},${lat},${lon});
  way["shop"~"^(alcohol|wine|beverages|liquor)$"](around:${radiusM},${lat},${lon});
);
out count;

// Block 3 — Emergency services
(
  node["amenity"~"^(police|hospital|fire_station)$"](around:${radiusM},${lat},${lon});
  way["amenity"~"^(police|hospital|fire_station)$"](around:${radiusM},${lat},${lon});
);
out count;

// Block 4 — Major roads (well-lit corridors)
(
  way["highway"~"^(primary|secondary|trunk|motorway)$"](around:${radiusM},${lat},${lon});
);
out count;

// Block 5 — Isolated paths (danger signal)
(
  way["highway"~"^(footway|path|track|unclassified)$"](around:${radiusM},${lat},${lon});
);
out count;
`;

  try {
    const data = await overpassQuery(query);
    const elements = data?.elements ?? [];

    // Each `out count` block emits exactly one element in order
    const safePOI      = parseCountBlock(elements[0]);
    const neutralPOI   = parseCountBlock(elements[1]);
    const cautionPOI   = parseCountBlock(elements[2]);
    const emergencySvc = parseCountBlock(elements[3]);
    const majorRoads   = parseCountBlock(elements[4]);
    const isolatedPaths = parseCountBlock(elements[5]);

    const result = {
      safePOI,
      neutralPOI,
      cautionPOI,
      commercialPOI:     safePOI + neutralPOI,
      totalPOI:          safePOI + neutralPOI + cautionPOI,
      emergencyServices: emergencySvc,
      majorRoads,
      isolatedPaths,
    };

    _cache.set(key, { ts: Date.now(), data: result });
    return result;
  } catch (_) {
    // Return neutral defaults on API failure — do not cache failures
    return {
      safePOI: 3, neutralPOI: 2, cautionPOI: 0,
      commercialPOI: 5, totalPOI: 5,
      emergencyServices: 0, majorRoads: 1, isolatedPaths: 1,
    };
  }
}

// ─── Factor calculators ───────────────────────────────────────────────────────

/**
 * Crowd confidence score.
 *
 * SAFE POIs (cafes, hospitals, transit, police, supermarkets, commercial areas)
 * represent Sarafa-style public activity — they INCREASE confidence.
 *
 * NEUTRAL POIs add modest stability.
 *
 * CAUTION POIs (bars, pubs, nightclubs, liquor shops, casinos) represent
 * nightlife-heavy crowds — they REDUCE confidence, especially at night.
 *
 * Returns 0–100 where higher = safer crowd environment.
 */
function calcCrowdScore(safePOI, neutralPOI, cautionPOI, hour) {
  const isNight     = hour >= 22 || hour < 5;
  const isLateEvening = hour >= 20;

  // Safe public activity — saturates at ~20 POIs
  const safeActivity = clamp((safePOI / 20) * 100);

  // Neutral POIs add a smaller boost (general retail, banks, etc.)
  const neutralBoost = clamp((neutralPOI / 30) * 40);

  // Base crowd confidence from safe environment
  const baseConfidence = safeActivity * 0.75 + neutralBoost * 0.25;

  // Time-of-day multiplier — safe crowds thin at night
  const timeMult =
    (hour >= 8  && hour < 20) ? 1.00 :
    (hour >= 6  && hour < 8)  ? 0.70 :
    (hour >= 20 && hour < 22) ? 0.60 :
    0.35; // late night — even safe POIs have fewer people

  const safeCrowdScore = clamp(baseConfidence * timeMult);

  // Caution zone drag — nightlife crowds REDUCE safety confidence
  // Amplified significantly at night (bars/clubs are active, not closed)
  const cautionMult =
    isNight       ? 2.2  :
    isLateEvening ? 1.6  :
    0.8; // daytime bars/pubs are low-risk

  // Each caution POI drags the score down; safe POIs provide a partial buffer
  const safeBuffer = Math.min(15, safePOI * 1.5);
  const cautionDrag = Math.max(0, cautionPOI * 14 * cautionMult - safeBuffer);

  return Math.round(clamp(safeCrowdScore - cautionDrag, 0, 95));
}

/**
 * Caution-zone penalty — a separate penalty term subtracted from the final score.
 *
 * Distinct from crowd drag: this captures the environmental danger signal
 * of being in a nightlife/alcohol-heavy zone regardless of crowd size.
 * A deserted liquor zone at 2am is still dangerous.
 *
 * Returns 0–70 (higher = more dangerous).
 */
function calcCautionZonePenalty(cautionPOI, safePOI, hour) {
  if (cautionPOI === 0) return 0;

  const isDeepNight   = hour >= 22 || hour < 5;
  const isLateEvening = hour >= 20;

  // Night multiplier — caution zones are most dangerous when active
  const nightMult =
    isDeepNight   ? 2.4 :
    isLateEvening ? 1.8 :
    (hour >= 18)  ? 1.2 :
    0.6; // daytime — bars/pubs are low-risk

  // Safe POIs in the same area partially offset caution (e.g. a bar next to a hospital)
  const safeBuffer = Math.min(20, safePOI * 2.0);

  const raw = cautionPOI * 18 * nightMult - safeBuffer;
  return Math.round(clamp(raw, 0, 70));
}

/** Lighting confidence from major roads + safe POI density + time. */
function calcLightingConfidence(majorRoads, safePOI, neutralPOI, cautionPOI, hour) {
  const roadScore = clamp((majorRoads / 5) * 100);
  const poiScore  = clamp(((safePOI + neutralPOI * 0.3) / 15) * 100);
  const base = roadScore * 0.5 + poiScore * 0.5;

  const nightPenalty =
    (hour >= 22 || hour < 5) ? 38 :
    (hour >= 20)              ? 22 :
    (hour >= 18)              ? 10 : 0;

  // Caution zones at night often have poor-quality lighting (neon signs ≠ safe lighting)
  const cautionPenalty =
    cautionPOI > 0 && (hour >= 20 || hour < 6)
      ? Math.min(20, cautionPOI * 5)
      : 0;

  return Math.max(0, Math.round(base - nightPenalty - cautionPenalty));
}

/** Isolation danger — higher = more isolated = LOWER safety. Returns 0–100. */
function calcIsolationDanger(isolatedPaths, totalPOI) {
  const pathDanger = clamp((isolatedPaths / 5) * 60);
  const poiSafety  = Math.min(40, (totalPOI / 20) * 40);
  return Math.max(0, Math.round(pathDanger - poiSafety));
}

/** Emergency accessibility from nearby police/hospital/fire. */
function calcEmergencyAccessibility(emergencyServices, majorRoads) {
  const serviceScore = Math.min(70, emergencyServices * 25);
  const roadScore    = Math.min(30, majorRoads * 8);
  return Math.min(100, serviceScore + roadScore);
}

/** Time-of-day confidence. Pure time-based. */
function calcTimeConfidence(hour) {
  if (hour >= 8  && hour < 17) return 92;
  if (hour >= 6  && hour < 8)  return 75;
  if (hour >= 17 && hour < 20) return 65;
  if (hour >= 20 && hour < 22) return 42;
  return 18;
}

/** Deterministic incident penalty — simulates clustering without a backend. */
function calcIncidentPenalty(lat, lon, hour) {
  const gridLat   = Math.floor(lat * 100);
  const gridLon   = Math.floor(lon * 100);
  const hourBucket = Math.floor(hour / 4);
  const seed = ((gridLat * 31 + gridLon) * 17 + hourBucket) % 100;
  const nightBoost = (hour >= 20 || hour < 6) ? 15 : 0;
  return Math.min(30, Math.max(0, (seed % 20) + nightBoost));
}

// ─── Weights ──────────────────────────────────────────────────────────────────
const W = {
  crowd:     0.28, // increased — crowd quality is the primary differentiator
  lighting:  0.20,
  emergency: 0.16,
  time:      0.18,
  isolation: 0.08, // subtracted
  incident:  0.04, // subtracted
  caution:   0.18, // subtracted — increased to make nightlife zones meaningfully lower
};

// ─── Main scoring function ────────────────────────────────────────────────────

/**
 * Score a route for Safety Confidence using OSM environmental context.
 *
 * Samples up to MAX_SAMPLES evenly-spaced points along the route,
 * fetches Overpass context for each, averages the results.
 *
 * @param {Array<[number,number]>} routeCoords - [[lat,lon], ...]
 * @param {number} hour - Hour of day 0–23
 * @returns {Promise<{
 *   safetyScore: number,
 *   riskLevel: string,
 *   factors: object,
 *   tags: string[],
 * }>}
 */
export async function scoreRouteContextual(routeCoords, hour) {
  const MAX_SAMPLES = 4; // max Overpass calls per route — keeps latency low

  if (!routeCoords || routeCoords.length === 0) {
    return buildResult(50, hour, {
      crowd: 50, lighting: 50, emergency: 30,
      time: calcTimeConfidence(hour),
      isolationDanger: 20, incidentPenalty: 10, cautionZone: 0,
      safePOI: 0, neutralPOI: 0, cautionPOI: 0,
    });
  }

  // Sample evenly-spaced points
  const step = Math.max(1, Math.floor(routeCoords.length / MAX_SAMPLES));
  const samplePoints = [];
  for (let i = 0; i < routeCoords.length; i += step) {
    samplePoints.push(routeCoords[i]);
    if (samplePoints.length >= MAX_SAMPLES) break;
  }

  // Fetch context for all sample points in parallel
  const contexts = await Promise.all(
    samplePoints.map(([lat, lon]) => fetchPointContext(lat, lon, 300))
  );

  // Average all context values across sampled points
  const avg = contexts.reduce(
    (acc, ctx) => {
      acc.safePOI           += ctx.safePOI           ?? 0;
      acc.neutralPOI        += ctx.neutralPOI        ?? 0;
      acc.cautionPOI        += ctx.cautionPOI        ?? 0;
      acc.commercialPOI     += ctx.commercialPOI     ?? 0;
      acc.emergencyServices += ctx.emergencyServices ?? 0;
      acc.majorRoads        += ctx.majorRoads        ?? 0;
      acc.isolatedPaths     += ctx.isolatedPaths     ?? 0;
      acc.totalPOI          += ctx.totalPOI          ?? 0;
      return acc;
    },
    {
      safePOI: 0, neutralPOI: 0, cautionPOI: 0,
      commercialPOI: 0, emergencyServices: 0,
      majorRoads: 0, isolatedPaths: 0, totalPOI: 0,
    }
  );
  const n = contexts.length || 1;
  Object.keys(avg).forEach(k => { avg[k] = avg[k] / n; });

  // Midpoint for incident penalty
  const mid = routeCoords[Math.floor(routeCoords.length / 2)];
  const incidentPenalty = calcIncidentPenalty(mid[0], mid[1], hour);

  const factors = {
    crowd:           calcCrowdScore(avg.safePOI, avg.neutralPOI, avg.cautionPOI, hour),
    lighting:        calcLightingConfidence(avg.majorRoads, avg.safePOI, avg.neutralPOI, avg.cautionPOI, hour),
    emergency:       calcEmergencyAccessibility(avg.emergencyServices, avg.majorRoads),
    time:            calcTimeConfidence(hour),
    isolationDanger: calcIsolationDanger(avg.isolatedPaths, avg.totalPOI),
    cautionZone:     calcCautionZonePenalty(avg.cautionPOI, avg.safePOI, hour),
    safePOI:         Math.round(avg.safePOI),
    neutralPOI:      Math.round(avg.neutralPOI),
    cautionPOI:      Math.round(avg.cautionPOI),
    incidentPenalty,
  };

  return buildResult(null, hour, factors);
}

// ─── Result builder ───────────────────────────────────────────────────────────

function buildResult(overrideScore, hour, factors) {
  const raw = overrideScore ?? (
    factors.crowd     * W.crowd    +
    factors.lighting  * W.lighting +
    factors.emergency * W.emergency +
    factors.time      * W.time     -
    factors.isolationDanger * W.isolation -
    factors.incidentPenalty * W.incident  -
    (factors.cautionZone ?? 0) * W.caution
  );

  // Clamp to [15, 95] — avoid unrealistic extremes
  const safetyScore = Math.max(15, Math.min(95, Math.round(raw)));

  const riskLevel =
    safetyScore >= 65 ? 'LOW' :
    safetyScore >= 40 ? 'MODERATE' : 'HIGH';

  // ── Contextual explanation tags ──────────────────────────────────────────
  const tags = [];
  const isNight     = hour >= 22 || hour < 5;
  const isLateEvening = hour >= 20;
  const cautionZone = factors.cautionZone ?? 0;
  const safePOI     = factors.safePOI     ?? 0;
  const cautionPOI  = factors.cautionPOI  ?? 0;
  const neutralPOI  = factors.neutralPOI  ?? 0;

  // Caution zone tags — nightlife/alcohol-heavy areas
  if (cautionPOI >= 3 && isNight) {
    tags.push('Nightlife-heavy area');
  } else if (cautionPOI >= 2 && isLateEvening) {
    tags.push('Nightlife-heavy area');
  } else if (cautionZone >= 25) {
    tags.push('Nightlife-heavy area');
  }

  // Safe crowd / commercial activity tags
  if (safePOI >= 8) {
    tags.push('Active commercial zone');
  } else if (safePOI >= 4 && neutralPOI >= 3) {
    tags.push('Active commercial zone');
  }

  if (factors.crowd >= 65) {
    tags.push('Well-lit public activity');
  } else if (factors.crowd >= 45 && !isNight) {
    tags.push('Moderate public activity');
  } else if (factors.crowd < 25) {
    tags.push('Low crowd density');
  }

  // Lighting tags
  if (factors.lighting >= 65) {
    tags.push('Well-lit corridor');
  } else if (factors.lighting < 35) {
    tags.push(isLateEvening ? 'Low visibility after dark' : 'Poor lighting');
  }

  // Emergency access
  if (factors.emergency >= 50) {
    tags.push('Emergency services nearby');
  }

  // Isolation
  if (factors.isolationDanger >= 40) {
    tags.push('Isolated stretches');
  }

  // Time-of-day
  if (factors.time < 40) {
    tags.push('Late-night travel');
  } else if (factors.time >= 80) {
    tags.push('Daytime travel');
  }

  // Incident
  if (factors.incidentPenalty >= 20) {
    tags.push('Elevated incident area');
  }

  // Caution zone active (even if not nightlife-heavy by count)
  if (cautionZone >= 40 && !tags.includes('Nightlife-heavy area')) {
    tags.push('Caution zone active');
  }

  return {
    safetyScore,
    riskLevel,
    factors: {
      crowd:      factors.crowd,
      lighting:   factors.lighting,
      emergency:  factors.emergency,
      time:       factors.time,
      isolation:  factors.isolationDanger,
      incident:   factors.incidentPenalty,
      caution:    factors.cautionZone ?? 0,
      safePOI:    factors.safePOI    ?? 0,
      neutralPOI: factors.neutralPOI ?? 0,
      cautionPOI: factors.cautionPOI ?? 0,
    },
    tags,
  };
}

/**
 * Build a zone object compatible with calcRiskScore / TimeImpactScreen.
 *
 * Uses the caution pressure to adjust the perceived crime level so that
 * nightlife-heavy zones score higher crime even with high crowd counts.
 */
export function buildZoneFromContextual(factors) {
  const cautionPressure = factors.caution ?? 0;
  // Crowd confidence is reduced by caution pressure before zone classification
  const crowdConfidence = Math.max(0, (factors.crowd ?? 50) - cautionPressure * 0.3);

  return {
    crimeLevel: Math.max(0, Math.min(100, 100 - crowdConfidence + cautionPressure * 0.25)),
    crowdLevel: crowdConfidence >= 60 ? 'busy' : crowdConfidence >= 35 ? 'moderate' : 'isolated',
    infraLevel: factors.emergency >= 60 ? 'full' : factors.emergency >= 35 ? 'mixed' : 'poor',
  };
}
