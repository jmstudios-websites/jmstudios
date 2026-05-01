const form = document.querySelector(".contact-form");
const status = document.querySelector(".form-status");
const revealItems = document.querySelectorAll(
  ".split-section, .case-study, .services-section, .process, .portfolio-section, .contact-section, .service-list article, .process-rail article, .portfolio-card"
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

installPreviewScrollGuards();
installPortfolioTabs();

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
    const endpoint = window.JM_CONTACT_ENDPOINT || "/api/contact";
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      let errorMessage = "Request failed";
      try {
        const errorBody = await response.json();
        errorMessage = errorBody.details || errorBody.error || errorMessage;
      } catch (error) {
        errorMessage = await response.text();
      }
      throw new Error(errorMessage);
    }

    form.reset();
    status.textContent = "Message sent. We will respond in 1-2 days.";
  } catch (error) {
    status.textContent = `Message could not be sent: ${error.message || "Please email us directly."}`;
  } finally {
    submitButton.disabled = false;
  }
});

function installPreviewScrollGuards() {
  const guardedPreviews = document.querySelectorAll("[data-scroll-guard]");
  if (!guardedPreviews.length) return;

  let wheelTimer;
  let isWheelActive = false;
  const hoveredPreviews = new Set();
  const wheelIdleDelay = 110;
  const hoverUnlockDelay = 40;

  const schedulePreviewUnlock = (preview, delay = hoverUnlockDelay) => {
    window.clearTimeout(preview.scrollGuardTimer);
    preview.scrollGuardTimer = window.setTimeout(() => {
      if (!isWheelActive && hoveredPreviews.has(preview)) {
        preview.classList.add("is-preview-active");
      }
    }, delay);
  };

  window.addEventListener(
    "wheel",
    () => {
      isWheelActive = true;
      window.clearTimeout(wheelTimer);
      wheelTimer = window.setTimeout(() => {
        isWheelActive = false;
        hoveredPreviews.forEach((preview) => schedulePreviewUnlock(preview, 0));
      }, wheelIdleDelay);
    },
    { passive: true }
  );

  guardedPreviews.forEach((preview) => {
    const disablePreview = () => {
      hoveredPreviews.delete(preview);
      window.clearTimeout(preview.scrollGuardTimer);
      preview.classList.remove("is-preview-active");
    };

    preview.addEventListener("mouseenter", () => {
      hoveredPreviews.add(preview);
      schedulePreviewUnlock(preview);
    });

    preview.addEventListener("mousemove", () => {
      if (preview.classList.contains("is-preview-active")) return;
      hoveredPreviews.add(preview);
      schedulePreviewUnlock(preview);
    });

    preview.addEventListener("mouseleave", disablePreview);
    preview.addEventListener("wheel", () => {
      if (!preview.classList.contains("is-preview-active")) disablePreview();
    });
  });
}

function installPortfolioTabs() {
  const tabs = document.querySelectorAll("[data-portfolio-tab]");
  if (!tabs.length) return;

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const targetId = tab.dataset.portfolioTab;
      const targetPanel = document.querySelector(`#${targetId}`);
      if (!targetPanel) return;

      tabs.forEach((button) => {
        const isActive = button === tab;
        button.classList.toggle("active", isActive);
        button.setAttribute("aria-selected", String(isActive));
      });

      document.querySelectorAll(".portfolio-card").forEach((panel) => {
        const isActive = panel === targetPanel;
        panel.hidden = !isActive;
        panel.classList.toggle("active", isActive);
        panel.classList.remove("is-preview-active");
      });
    });
  });
}
