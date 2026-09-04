// Reports which payment gateways currently have credentials configured
// -- used by the frontend to decide whether to initiate payment
// automatically (exactly one available) or show the user a picker
// (more than one available). This never touches tenant data and
// requires no auth: it only reveals which secrets exist, not their
// values, so there's nothing tenant-specific or sensitive to protect.

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, content-type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  };
}

Deno.serve((req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders() });

  const available = {
    payunit: !!(Deno.env.get('PAYUNIT_API_USER') && Deno.env.get('PAYUNIT_API_PASSWORD') && Deno.env.get('PAYUNIT_APP_TOKEN')),
    flutterwave: !!Deno.env.get('FLUTTERWAVE_SECRET_KEY'),
    paystack: !!Deno.env.get('PAYSTACK_SECRET_KEY'),
    // Paddle no longer needs a secret API key here -- see
    // supabase/functions/paddle-initiate/index.ts: checkout runs
    // client-side via the public client-side token (src/lib/paddle.ts),
    // and PADDLE_PRICE_MAP is the only thing this server-side lookup
    // still needs.
    paddle: !!Deno.env.get('PADDLE_PRICE_MAP'),
  };

  return new Response(JSON.stringify(available), { headers: { 'Content-Type': 'application/json', ...corsHeaders() } });
});
