// tricoach-wellness-proxy — Cloudflare Worker

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

    const dateParam = url.searchParams.get('date') || new Date().toISOString().split('T')[0];
    const ATHLETE_ID = env.INTERVALS_ATHLETE_ID;
    const API_KEY    = env.INTERVALS_API_KEY;

    if (!ATHLETE_ID || !API_KEY) {
      return new Response(JSON.stringify({ error: 'Credentials not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // KV cache check
    if (env.WELLNESS_KV) {
      try {
        const cached = await env.WELLNESS_KV.get(`wellness:${dateParam}`);
        if (cached) return new Response(cached, { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      } catch (_) {}
    }

    // Build auth — encode byte by byte to avoid btoa Unicode issues
    function makeBasicAuth(user, pass) {
      const str = user + ':' + pass;
      let binary = '';
      for (let i = 0; i < str.length; i++) binary += String.fromCharCode(str.charCodeAt(i) & 0xff);
      return 'Basic ' + btoa(binary);
    }

    const authHeader = makeBasicAuth('API_KEY', API_KEY);

    // Fetch today
    let w;
    try {
      const resp = await fetch(
        `https://intervals.icu/api/v1/athlete/${ATHLETE_ID}/wellness/${dateParam}`,
        { headers: { 'Authorization': authHeader, 'Accept': 'application/json' } }
      );
      if (!resp.ok) {
        const txt = await resp.text();
        return new Response(JSON.stringify({ error: `Intervals API ${resp.status}`, detail: txt, auth: authHeader }), {
          status: resp.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      const data = await resp.json();
      w = Array.isArray(data) ? data[0] : data;
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Fetch failed', detail: e.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const result = {
      date:               dateParam,
      hrv:                w?.hrv           ?? null,
      hrv_rmssd:          w?.hrvSDNN       ?? null,
      resting_hr:         w?.restingHR     ?? null,
      sleep_score:        w?.sleepScore    ?? null,
      sleep_hours:        w?.sleepSecs != null ? Math.round(w.sleepSecs / 360) / 10 : null,
      sleep_quality:      w?.sleepQuality  ?? null,
      training_readiness: w?.readiness     ?? null,
      stress_score:       w?.stress        ?? null,
      steps:              w?.steps         ?? null,
      weight:             w?.weight        ?? null,
      source: 'intervals.icu'
    };

    result.history = await loadHistory(ATHLETE_ID, API_KEY, dateParam, makeBasicAuth);

    const json = JSON.stringify(result);
    if (env.WELLNESS_KV) {
      try { await env.WELLNESS_KV.put(`wellness:${dateParam}`, json, { expirationTtl: 43200 }); } catch (_) {}
    }

    return new Response(json, { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
};

async function loadHistory(athleteId, apiKey, today, makeBasicAuth) {
  const authHeader = makeBasicAuth('API_KEY', apiKey);
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
      date:               w.id,
      hrv:                w.hrv          ?? null,
      resting_hr:         w.restingHR    ?? null,
      sleep_score:        w.sleepScore   ?? null,
      sleep_quality:      w.sleepQuality ?? null,
      training_readiness: w.readiness    ?? null,
      steps:              w.steps        ?? null,
    }));
  } catch (_) { return []; }
}
