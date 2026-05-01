const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") || "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== "GET") {
    return jsonResponse(405, { error: "Method not allowed." });
  }

  const slug = new URL(request.url).searchParams.get("slug")?.trim();
  if (!slug) return jsonResponse(400, { error: "Missing dashboard slug." });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(500, { error: "Payment status service is not configured." });
  }

  const response = await fetch(
    `${supabaseUrl}/rest/v1/project_payments?project_slug=eq.${encodeURIComponent(slug)}&select=*&order=paid_at.desc&limit=1`,
    {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    },
  );

  if (!response.ok) {
    return jsonResponse(502, { error: "Payment status could not be checked." });
  }

  const [payment] = await response.json();
  if (!payment) return jsonResponse(200, { paid: false });

  return jsonResponse(200, {
    paid: true,
    paidAt: payment.paid_at,
    amount: payment.amount_total,
    currency: payment.currency,
    planName: payment.plan_name,
    stripeSessionId: payment.stripe_session_id,
  });
});

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders,
    },
  });
}
