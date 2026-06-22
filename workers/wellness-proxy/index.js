// tricoach-wellness-proxy — Cloudflare Worker
// Fetches wellness data from intervals.icu and caches in KV

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';

    const corsHeaders = {
      'Access-Control-Allow-Origin': origin.includes('ulthybrid89.github.io') || origin.includes('localhost') ? origin : 'https://ulthybrid89.github.io',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    if (url.pathname !== '/wellness') {
      return new Response('Not found', { status: 404, headers: corsHeaders });
    }

    // Date param — default today UTC
    const dateParam = url.searchParams.get('date') || new Date().toISOString().split('T')[0];

    const ATHLETE_ID = env.INTERVALS_ATHLETE_ID;   // i122320
    const API_KEY    = env.INTERVALS_API_KEY;       // 2cvyvoa2bzthet5lo3ezjgq7i

    if (!ATHLETE_ID || !API_KEY) {
      return new Response(JSON.stringify({ error: 'Intervals.icu credentials not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check KV cache first (key = date string, 12h TTL)
    let cached = null;
    if (env.WELLNESS_KV) {
      try { cached = await env.WELLNESS_KV.get(`wellness:${dateParam}`); } catch (_) {}
    }
    if (cached) {
      return new Response(cached, {
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Cache': 'HIT' }
      });
    }

    // Fetch wellness endpoint — returns array, one entry per day
    const authHeader = 'Basic ' + btoa(`API_KEY:${API_KEY}`);
    const iUrl = `https://intervals.icu/api/v1/athlete/${ATHLETE_ID}/wellness/${dateParam}`;

    let data;
    try {
      const resp = await fetch(iUrl, {
        headers: { 'Authorization': authHeader, 'Accept': 'application/json' }
      });
      if (!resp.ok) {
        const txt = await resp.text();
        return new Response(JSON.stringify({ error: `Intervals API ${resp.status}`, detail: txt }), {
          status: resp.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      data = await resp.json();
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Fetch failed', detail: e.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Normalise — intervals returns a single object for the specific date endpoint
    const w = Array.isArray(data) ? data[0] : data;

    const result = {
      date: dateParam,
      hrv:                 w?.hrv             ?? null,
      hrv_rmssd:           w?.hrvSDNN         ?? null,
      resting_hr:          w?.restingHR       ?? null,
      sleep_score:         w?.sleepScore      ?? null,
      sleep_hours:         w?.sleepSecs       != null ? Math.round(w.sleepSecs / 360) / 10 : null,
      body_battery:        w?.bodyBattery     ?? null,
      training_readiness:  w?.trainingReadiness ?? null,
      stress_score:        w?.avgStress       ?? null,
      source: 'intervals.icu'
    };

    // Store 7 days of history for debrief
    const history = await loadHistory(env, ATHLETE_ID, API_KEY, dateParam);
    result.history = history;

    const json = JSON.stringify(result);

    // Cache for 12 hours
    if (env.WELLNESS_KV) {
      try { await env.WELLNESS_KV.put(`wellness:${dateParam}`, json, { expirationTtl: 43200 }); } catch (_) {}
    }

    return new Response(json, {
      headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Cache': 'MISS' }
    });
  }
};

async function loadHistory(env, athleteId, apiKey, today) {
  // Fetch last 7 days for debrief context
  const authHeader = 'Basic ' + btoa(`API_KEY:${apiKey}`);
  const oldest = new Date(today);
  oldest.setDate(oldest.getDate() - 6);
  const oldestStr = oldest.toISOString().split('T')[0];

  try {
    const resp = await fetch(
      `https://intervals.icu/api/v1/athlete/${athleteId}/wellness?oldest=${oldestStr}&newest=${today}`,
      { headers: { 'Authorization': authHeader, 'Accept': 'application/json' } }
    );
    if (!resp.ok) return [];
    const arr = await resp.json();
    return arr.map(w => ({
      date: w.id,
      hrv: w.hrv ?? null,
      resting_hr: w.restingHR ?? null,
      sleep_score: w.sleepScore ?? null,
      training_readiness: w.trainingReadiness ?? null,
      body_battery: w.bodyBattery ?? null,
    }));
  } catch (_) {
    return [];
  }
}
