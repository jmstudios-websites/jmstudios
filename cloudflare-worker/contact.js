export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN || "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method !== "POST") {
      return jsonResponse(405, { error: "Method not allowed." }, corsHeaders);
    }

    if (!env.RESEND_API_KEY || !env.CONTACT_TO_EMAIL) {
      return jsonResponse(500, { error: "Email service is not configured." }, corsHeaders);
    }

    let body;
    try {
      body = await request.json();
    } catch (error) {
      return jsonResponse(400, { error: "Invalid request body." }, corsHeaders);
    }

    const { name, email, service, message } = body;
    if (!name || !email || !service || !message) {
      return jsonResponse(400, { error: "Missing required fields." }, corsHeaders);
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
      return jsonResponse(400, { error: "Invalid email address." }, corsHeaders);
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
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: env.CONTACT_FROM_EMAIL || "JM Studios <onboarding@resend.dev>",
        to: [env.CONTACT_TO_EMAIL],
        reply_to: email,
        subject: "New website project inquiry",
        text,
      }),
    });

    if (!response.ok) {
      return jsonResponse(502, { error: "Email could not be sent." }, corsHeaders);
    }

    return jsonResponse(200, { ok: true }, corsHeaders);
  },
};

function jsonResponse(status, body, headers) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  });
}
