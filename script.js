const form = document.querySelector(".contact-form");
const status = document.querySelector(".form-status");
const revealItems = document.querySelectorAll(
  ".split-section, .case-study, .services-section, .process, .contact-section, .service-list article, .process-rail article"
);

if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.16 }
  );

  revealItems.forEach((item) => {
    item.classList.add("reveal");
    observer.observe(item);
  });
} else {
  revealItems.forEach((item) => item.classList.add("is-visible"));
}

const messages = {
  name: "Please add your name.",
  email: "Please add a valid email address.",
  service: "Please choose the closest service.",
  message: "Please add a few project details.",
};

function setInvalid(field) {
  const row = field.closest(".form-row");
  row.classList.add("invalid");
  row.querySelector("small").textContent = messages[field.name];
}

function clearInvalid(field) {
  const row = field.closest(".form-row");
  row.classList.remove("invalid");
  const helperText = {
    name: "Who should I reply to?",
    email: "Used only for this project conversation.",
    service: "Pick the closest option.",
    message: "Mention your business, pages needed, and ideal launch date.",
  };
  row.querySelector("small").textContent = helperText[field.name];
}

form.addEventListener("input", (event) => {
  if (event.target.matches("input, select, textarea")) {
    clearInvalid(event.target);
    status.textContent = "";
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const fields = [...form.querySelectorAll("input, select, textarea")];
  let firstInvalid = null;

  fields.forEach((field) => {
    if (!field.checkValidity()) {
      setInvalid(field);
      firstInvalid = firstInvalid || field;
    } else {
      clearInvalid(field);
    }
  });

  if (firstInvalid) {
    firstInvalid.focus();
    status.textContent = "A couple of details are missing.";
    return;
  }

  const submitButton = form.querySelector("button[type='submit']");
  const data = Object.fromEntries(new FormData(form).entries());

  submitButton.disabled = true;
  status.textContent = "Sending your message.";

  try {
    const response = await fetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error("Request failed");
    }

    form.reset();
    status.textContent = "Message sent. We will respond in 1-2 days.";
  } catch (error) {
    status.textContent = "Message could not be sent. Please email us directly.";
  } finally {
    submitButton.disabled = false;
  }
});
