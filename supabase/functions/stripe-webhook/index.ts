const encoder = new TextEncoder();

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed." });
  }

  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const ownerEmail = Deno.env.get("CONTACT_TO_EMAIL");
  const fromEmail = Deno.env.get("CONTACT_FROM_EMAIL") || "JM Studios <onboarding@resend.dev>";
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!webhookSecret || !resendApiKey || !ownerEmail || !supabaseUrl || !serviceRoleKey) {
    return jsonResponse(500, { error: "Webhook service is not configured." });
  }

  const signature = request.headers.get("stripe-signature") || "";
  const bodyText = await request.text();
  const verified = await verifyStripeSignature(bodyText, signature, webhookSecret);
  if (!verified) return jsonResponse(400, { error: "Invalid Stripe signature." });

  const event = JSON.parse(bodyText);
  if (event.type !== "checkout.session.completed") {
    return jsonResponse(200, { ok: true, ignored: true });
  }

  const session = event.data?.object || {};
  if (session.payment_status !== "paid") {
    return jsonResponse(200, { ok: true, ignored: true });
  }

  const reference = String(session.client_reference_id || "").trim();
  const [projectSlug, selectedPlan] = reference.split("__");
  if (!projectSlug) {
    return jsonResponse(200, { ok: true, ignored: true, reason: "Missing client_reference_id" });
  }

  const planName = readablePlanName(selectedPlan || session.metadata?.plan || session.payment_link || "");
  const payment = {
    project_slug: projectSlug,
    stripe_session_id: session.id,
    payment_link: session.payment_link || null,
    plan_name: planName,
    client_email: session.customer_details?.email || session.customer_email || null,
    amount_total: session.amount_total || null,
    currency: session.currency || null,
    paid_at: new Date().toISOString(),
    raw_event: event,
  };

  const upsertResponse = await fetch(`${supabaseUrl}/rest/v1/project_payments?on_conflict=stripe_session_id`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify(payment),
  });

  if (!upsertResponse.ok) {
    const details = await upsertResponse.text();
    console.error("Payment insert failed", details);
    return jsonResponse(502, { error: "Payment could not be recorded." });
  }

  await sendOwnerPaymentEmail({
    apiKey: resendApiKey,
    fromEmail,
    ownerEmail,
    projectSlug,
    planName,
    amountTotal: session.amount_total,
    currency: session.currency,
    clientEmail: payment.client_email,
  });

  return jsonResponse(200, { ok: true });
});

async function verifyStripeSignature(bodyText, header, secret) {
  const timestamp = header.match(/t=([^,]+)/)?.[1];
  const signature = header.match(/v1=([^,]+)/)?.[1];
  if (!timestamp || !signature) return false;

  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > 300) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signedPayload = `${timestamp}.${bodyText}`;
  const digest = await crypto.subtle.sign("HMAC", key, encoder.encode(signedPayload));
  return toHex(new Uint8Array(digest)) === signature;
}

function toHex(bytes) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function readablePlanName(value) {
  if (String(value).includes("care")) return "Care package";
  if (String(value).includes("full")) return "Full website build";
  if (String(value).includes("starter")) return "Starter website";
  return "Website payment";
}

async function sendOwnerPaymentEmail(details) {
  const amount = typeof details.amountTotal === "number"
    ? `${(details.amountTotal / 100).toFixed(2)} ${String(details.currency || "").toUpperCase()}`
    : "Unknown amount";

  const text = [
    "A JM Studios dashboard payment was completed.",
    "",
    `Dashboard slug: ${details.projectSlug}`,
    `Plan: ${details.planName}`,
    `Amount: ${amount}`,
    details.clientEmail ? `Client email: ${details.clientEmail}` : "",
  ].filter(Boolean).join("\n");

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${details.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: details.fromEmail,
      to: [details.ownerEmail],
      subject: `Payment received for ${details.projectSlug}`,
      text,
    }),
  });
}

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}
