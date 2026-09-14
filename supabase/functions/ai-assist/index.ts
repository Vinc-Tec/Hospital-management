// AI Assistant -- free, available to every authenticated tenant member
// regardless of plan (see module_flags: this is NOT module-gated on
// purpose, per the requirement that it be usable platform-wide).
//
// STATUS: real and active as soon as GEMINI_API_KEY is set and this is
// deployed.
//
// DEPLOY: supabase functions deploy ai-assist
// SETUP:  supabase secrets set GEMINI_API_KEY=AIza...
//         (optional) supabase secrets set GEMINI_MODEL=gemini-2.0-flash
//         -- override only if Google renames/retires the default below.
//
// Uses Google's stable, long-documented request shape
// (POST /v1beta/models/{model}:generateContent, auth via the
// x-goog-api-key header) rather than any specific SDK, and the model
// name is read from GEMINI_MODEL with a fallback, precisely so a future
// Gemini model rename doesn't require redeploying this function.
//
// SECURITY: requires a valid Supabase session (any authenticated tenant
// member) -- this is a free assistant *for signed-in staff*, not a
// public, unauthenticated endpoint anyone could hit and burn through
// the shared Gemini quota. No patient data is sent unless the person
// using it types it into their own message themselves; this function
// does not read from any table.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...corsHeaders() } });
}

type ChatMessage = { role: 'user' | 'assistant'; content: string };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders() });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) {
    return json({ status: 'not_configured', message: 'GEMINI_API_KEY is not set.' });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'missing_auth' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData.user) return json({ error: 'invalid_session' }, 401);

  let body: { message?: string; history?: ChatMessage[]; language?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid_request', message: 'Expected JSON body.' }, 400);
  }
  const message = (body.message ?? '').trim();
  if (!message) return json({ error: 'invalid_request', message: 'message is required.' }, 400);
  if (message.length > 4000) return json({ error: 'invalid_request', message: 'message is too long (max 4000 characters).' }, 400);

  // Keep a short rolling history only -- this is a stateless request/
  // response API, so the client resends prior turns each time; capping
  // it bounds both the request size and the token cost of every call.
  const history = Array.isArray(body.history) ? body.history.slice(-12) : [];

  const model = Deno.env.get('GEMINI_MODEL') || 'gemini-2.0-flash';
  const systemInstruction = {
    parts: [{
      text: 'You are the built-in AI assistant of Health Cloud, a hospital/clinic management platform. '
        + 'Help staff with general questions: how to use the platform\'s modules, drafting messages, summarizing text they paste in, '
        + 'general medical/administrative knowledge questions, and everyday productivity tasks. '
        + 'You are NOT a substitute for clinical judgment: for any question about a specific patient\'s diagnosis, treatment, or dosage, '
        + 'clearly say so and recommend consulting the patient\'s actual chart and a qualified clinician instead of guessing. '
        + `Answer in ${body.language === 'en' ? 'English' : 'French'} unless the person writes in a different language, in which case answer in their language. `
        + 'Keep answers concise and practical.',
    }],
  };

  const contents = [
    ...history.map((h) => ({ role: h.role === 'assistant' ? 'model' : 'user', parts: [{ text: h.content }] })),
    { role: 'user', parts: [{ text: message }] },
  ];

  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({ system_instruction: systemInstruction, contents }),
    });
    const data = await res.json();

    if (!res.ok) {
      return json({ error: 'gemini_error', message: data?.error?.message ?? `Gemini returned HTTP ${res.status}.` }, 502);
    }

    const reply = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? '';
    if (!reply) {
      // Most commonly a safety-filter block -- surface *that* it happened
      // rather than returning an empty message with no explanation.
      const finishReason = data?.candidates?.[0]?.finishReason;
      return json({ error: 'empty_response', message: finishReason ? `No content returned (${finishReason}).` : 'No content returned.' }, 502);
    }

    return json({ reply });
  } catch (e) {
    return json({ error: 'request_failed', message: e instanceof Error ? e.message : 'Gemini request failed.' }, 502);
  }
});
