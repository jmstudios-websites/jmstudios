module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const toEmail = process.env.CONTACT_TO_EMAIL;
  const fromEmail = process.env.CONTACT_FROM_EMAIL || "JM Studios <onboarding@resend.dev>";

  if (!apiKey || !toEmail) {
    return res.status(500).json({ error: "Email service is not configured." });
  }

  const { name, email, service, message } = req.body || {};

  if (!name || !email || !service || !message) {
    return res.status(400).json({ error: "Missing required fields." });
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(email)) {
    return res.status(400).json({ error: "Invalid email address." });
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
    return res.status(502).json({ error: "Email could not be sent." });
  }

  return res.status(200).json({ ok: true });
};
