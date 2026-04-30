const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") || "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed." });
  }

  const apiKey = Deno.env.get("RESEND_API_KEY");
  const toEmail = Deno.env.get("CONTACT_TO_EMAIL");
  const fromEmail = Deno.env.get("CONTACT_FROM_EMAIL") || "JM Studios <onboarding@resend.dev>";

  if (!apiKey || !toEmail) {
    return jsonResponse(500, { error: "Email service is not configured." });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(400, { error: "Invalid request body." });
  }

  const { name, email, service, message } = body;

  if (!name || !email || !service || !message) {
    return jsonResponse(400, { error: "Missing required fields." });
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(email)) {
    return jsonResponse(400, { error: "Invalid email address." });
  }

  const text = [
    "New website project inquiry",
    "",
    `Name: ${name}`,
    `Email: ${email}`,
    `Service: ${service}`,
    "",
    "Project details:",
    message,
  ].join("\n");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [toEmail],
      reply_to: email,
      subject: "New website project inquiry",
      text,
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    console.error("Resend error", response.status, details);
    return jsonResponse(502, {
      error: "Email could not be sent.",
      details,
    });
  }

  return jsonResponse(200, { ok: true });
});

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders,
    },
  });
}
