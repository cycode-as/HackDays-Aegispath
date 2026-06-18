/**
 * geminiSafetyAlerts.js — Gemini-powered Dynamic Safety Alert Engine
 *
 * Gemini acts as a REASONING LAYER on top of existing route intelligence.
 * It does NOT score routes, rank routes, or modify any routing data.
 * It interprets pre-computed safety factors and returns actionable,
 * human-readable guidance for women travelling alone.
 *
 * Trigger conditions (caller's responsibility — see NavigationScreen):
 *   isolationRisk > 70
 *   OR lightingConfidence < 40
 *   OR crowdConfidence < 35
 *   OR emergencyAccess < 40
 *   OR (timeMode === 'night' AND isolationRisk > 60)
 *
 * Cooldown: enforced here — minimum 60 seconds between API calls.
 * Deduplication: skipped if route context hasn't changed meaningfully.
 * Caching: identical context fingerprints return cached result instantly.
 * Error handling: all failures return null — navigation always continues.
 */

const GEMINI_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

// ─── Cooldown & cache state (module-level, not per-render) ────────────────────
let _lastCallTimestamp = 0;
const COOLDOWN_MS = 60_000; // 60 seconds between API calls

const _alertCache = new Map(); // fingerprint → { severity, title, message }

// ─── Context fingerprint ──────────────────────────────────────────────────────
/**
 * Produces a short string key that captures the "shape" of the route context.
 * Values are bucketed to avoid re-calling Gemini for minor sensor fluctuations.
 *
 * Buckets: values are rounded to nearest 10 to absorb small changes.
 */
function buildFingerprint(ctx) {
  const b = (v) => Math.round((v ?? 50) / 10) * 10; // bucket to nearest 10
  return [
    ctx.timeMode ?? 'day',
    ctx.travelMode ?? 'walking',
    b(ctx.safetyScore),
    b(ctx.crowdConfidence),
    b(ctx.lightingConfidence),
    b(ctx.emergencyAccess),
    b(ctx.isolationRisk),
    b(ctx.safePOIs),
    b(ctx.cautionPOIs),
  ].join('|');
}

// ─── Prompt builder ───────────────────────────────────────────────────────────
function buildPrompt(ctx) {
  const {
    timeMode         = 'day',
    travelMode       = 'walking',
    safetyScore      = 50,
    crowdConfidence  = 50,
    lightingConfidence = 50,
    emergencyAccess  = 50,
    isolationRisk    = 20,
    safePOIs         = 0,
    neutralPOIs      = 0,
    cautionPOIs      = 0,
    nearbyPoliceStations = 0,
    nearbyHospitals  = 0,
  } = ctx;

  const routeContext = JSON.stringify({
    timeMode,
    travelMode,
    safetyScore,
    crowdConfidence,
    lightingConfidence,
    emergencyAccess,
    isolationRisk,
    safePOIs,
    neutralPOIs,
    cautionPOIs,
    nearbyPoliceStations,
    nearbyHospitals,
  }, null, 2);

  return `You are AegisPath Safety AI.
Your job is to interpret route intelligence and create concise safety alerts for women travelling alone.

You are NOT calculating route safety.
The safety score already exists.
You are providing situational awareness.

Input:
${routeContext}

Return ONLY valid JSON with no markdown, no code fences, no explanation.
Format:
{ "severity": "low | medium | high", "title": "", "message": "" }

Rules:
- Maximum 40 words in message
- Practical advice only
- Avoid fear-inducing language
- Consider time of day (timeMode: night = after dark)
- Consider travel mode (walking is more vulnerable than cab)
- Consider lighting (lightingConfidence: low = poor visibility)
- Consider crowd density (crowdConfidence: low = fewer people)
- Consider isolation (isolationRisk: high = more isolated)
- Consider emergency accessibility (emergencyAccess: low = harder to reach help)
- Use safePOIs / cautionPOIs to adjust tone
- Mention a practical precaution when relevant
- severity "high" = isolationRisk > 70 OR lightingConfidence < 30 OR both
- severity "medium" = moderate risk signals
- severity "low" = mild advisory
- Return JSON only, no markdown`;
}

// ─── Trigger condition checker ────────────────────────────────────────────────
/**
 * Returns true if route conditions are noteworthy enough to warrant an alert.
 * Prevents unnecessary API calls for safe, well-lit routes.
 *
 * @param {object} ctx - Route context object
 * @returns {boolean}
 */
export function shouldTriggerAlert(ctx) {
  if (!ctx) return false;
  const {
    timeMode        = 'day',
    isolationRisk   = 0,
    lightingConfidence = 100,
    crowdConfidence = 100,
    emergencyAccess = 100,
  } = ctx;

  return (
    isolationRisk > 70 ||
    lightingConfidence < 40 ||
    crowdConfidence < 35 ||
    emergencyAccess < 40 ||
    (timeMode === 'night' && isolationRisk > 60)
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────
/**
 * Generate a safety alert via Gemini for the given route context.
 *
 * Returns: { severity: 'low'|'medium'|'high', title: string, message: string }
 * Returns: null on any error, rate-limit hit, or cache hit that is identical.
 *
 * @param {object} routeContext
 * @param {string} routeContext.timeMode         - 'day' | 'night'
 * @param {string} routeContext.travelMode       - 'walking' | 'cab' | 'transit'
 * @param {number} routeContext.safetyScore      - 0–100
 * @param {number} routeContext.crowdConfidence  - 0–100
 * @param {number} routeContext.lightingConfidence - 0–100
 * @param {number} routeContext.emergencyAccess  - 0–100
 * @param {number} routeContext.isolationRisk    - 0–100
 * @param {number} routeContext.safePOIs         - count
 * @param {number} routeContext.neutralPOIs      - count
 * @param {number} routeContext.cautionPOIs      - count
 * @param {number} routeContext.nearbyPoliceStations - count
 * @param {number} routeContext.nearbyHospitals  - count
 * @returns {Promise<{ severity: string, title: string, message: string } | null>}
 */
export async function generateSafetyAlert(routeContext) {
  try {
    // ── API key guard ────────────────────────────────────────────────────────
    const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
    if (!apiKey || apiKey === 'your_gemini_api_key_here') {
      // Key not configured — fail silently, navigation continues
      return null;
    }

    // ── Cooldown check ───────────────────────────────────────────────────────
    const now = Date.now();
    if (now - _lastCallTimestamp < COOLDOWN_MS) {
      // Still in cooldown window — return null, not an error
      return null;
    }

    // ── Cache check ──────────────────────────────────────────────────────────
    const fingerprint = buildFingerprint(routeContext);
    if (_alertCache.has(fingerprint)) {
      // Return cached result without counting against cooldown
      return _alertCache.get(fingerprint);
    }

    // ── Mark call time before await to prevent concurrent calls ─────────────
    _lastCallTimestamp = now;

    // ── Call Gemini ──────────────────────────────────────────────────────────
    const response = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: buildPrompt(routeContext) }],
        }],
        generationConfig: {
          temperature:     0.4,  // low — we want practical, consistent output
          maxOutputTokens: 200,  // tight — JSON only, no prose
          topP:            0.85,
        },
        safetySettings: [
          { category: 'HARM_CATEGORY_HARASSMENT',        threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_HATE_SPEECH',       threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
        ],
      }),
    });

    if (!response.ok) {
      // Non-2xx — Gemini down or quota exceeded. Silent fail.
      return null;
    }

    const data = await response.json();

    // ── Extract text from Gemini response ────────────────────────────────────
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    if (!rawText.trim()) return null;

    // ── Strip any accidental markdown fences ────────────────────────────────
    const cleaned = rawText
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim();

    // ── Parse JSON ───────────────────────────────────────────────────────────
    const parsed = JSON.parse(cleaned);

    // ── Validate shape ───────────────────────────────────────────────────────
    const severity = ['low', 'medium', 'high'].includes(parsed.severity)
      ? parsed.severity
      : 'medium';

    const title = typeof parsed.title === 'string' && parsed.title.trim()
      ? parsed.title.trim()
      : 'Safety Advisory';

    const message = typeof parsed.message === 'string' && parsed.message.trim()
      ? parsed.message.trim()
      : 'Stay alert and keep emergency features accessible.';

    const alert = { severity, title, message };

    // ── Cache the result ─────────────────────────────────────────────────────
    _alertCache.set(fingerprint, alert);

    return alert;

  } catch (_) {
    // Any error (network, JSON parse, etc.) — silent fail.
    // Navigation MUST continue normally.
    return null;
  }
}

/**
 * Reset cooldown and cache — useful for testing or when a new trip starts.
 * Not exported for production use — called internally if needed.
 */
export function _resetAlertState() {
  _lastCallTimestamp = 0;
  _alertCache.clear();
}
