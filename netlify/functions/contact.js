exports.handler = async function handler(event) {
  if (event.httpMethod !== "POST") {
    return jsonResponse(405, { error: "Method not allowed." }, { Allow: "POST" });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const toEmail = process.env.CONTACT_TO_EMAIL;
  const fromEmail = process.env.CONTACT_FROM_EMAIL || "JM Studios <onboarding@resend.dev>";

  if (!apiKey || !toEmail) {
    return jsonResponse(500, { error: "Email service is not configured." });
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch (error) {
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
    return jsonResponse(502, { error: "Email could not be sent." });
  }

  return jsonResponse(200, { ok: true });
};

function jsonResponse(statusCode, body, headers = {}) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  };
}
