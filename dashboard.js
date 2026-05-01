const params = new URLSearchParams(window.location.hash.slice(1));
const payload = params.get("payload");
const slug = params.get("slug");
const storageKey = "jmStudiosProjects";
const passwordForm = document.querySelector("#passwordForm");
const statusEl = document.querySelector("#dashboardStatus");
const accessPanel = document.querySelector("#accessPanel");
const dashboard = document.querySelector("#clientDashboard");
const toggleAnnotationButton = document.querySelector("#toggleAnnotation");
const annotationComposer = document.querySelector("#annotationComposer");
const annotationTargetLabel = document.querySelector("#annotationTargetLabel");
const annotationNoteInput = document.querySelector("#annotationNoteInput");
const previewNotesInput = document.querySelector("#previewNotesInput");
const feedbackStatus = document.querySelector("#feedbackStatus");
const clientAnnotationList = document.querySelector("#clientAnnotationList");
const clientFileRequestList = document.querySelector("#clientFileRequestList");
let previewObjectUrls = [];
let activeProject = null;
let annotationMode = false;
let pendingAnnotation = null;
const readyStates = ["Connected", "Verified", "Active", "Tested", "Ready", "Done", "Complete"];
const workingStates = ["Connecting", "Checking", "Activating", "Setting up", "Testing", "Reviewing", "In progress"];

if (!slug && !payload) {
  statusEl.textContent = "This dashboard link is missing project data. Ask JM Studios for a fresh link.";
}

installPreviewScrollGuards();

passwordForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  statusEl.textContent = "Unlocking dashboard.";

  try {
    const password = document.querySelector("#dashboardPassword").value;
    const project = await loadProject(password);
    renderProject(project);
    accessPanel.classList.add("hidden");
    dashboard.classList.remove("hidden");
  } catch (error) {
    statusEl.textContent = "That password did not unlock this dashboard.";
  }
});

async function loadProject(password) {
  const liveProject = findStoredProject(slug);
  if (liveProject) {
    if (liveProject.password !== password) throw new Error("Invalid password");
    const publicProject = { ...liveProject };
    delete publicProject.password;
    delete publicProject.clientEmail;
    return publicProject;
  }

  if (payload) return decryptProject(payload, password);
  throw new Error("Missing project");
}

function findStoredProject(projectSlug) {
  if (!projectSlug) return null;
  try {
    const projects = JSON.parse(localStorage.getItem(storageKey)) || [];
    return projects.find((project) => project.slug === projectSlug) || null;
  } catch (error) {
    return null;
  }
}

async function decryptProject(value, password) {
  const [saltValue, ivValue, cipherValue] = value.split(".");
  if (!saltValue || !ivValue || !cipherValue) throw new Error("Invalid payload");

  const salt = fromBase64Url(saltValue);
  const iv = fromBase64Url(ivValue);
  const cipher = fromBase64Url(cipherValue);
  const key = await deriveDashboardKey(password, salt, ["decrypt"]);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, cipher);
  return JSON.parse(new TextDecoder().decode(plain));
}

async function deriveDashboardKey(password, salt, usages) {
  const baseKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 120000, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    usages
  );
}

function fromBase64Url(value) {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(base64);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function renderProject(project) {
  activeProject = project;
  const tasks = project.tasks || [];
  const setupChecks = project.setupChecks || [];
  const completedTasks = tasks.filter((task) => task.state === "Complete").length;
  const progress = tasks.length ? Math.round((completedTasks / tasks.length) * 100) : 0;
  const domain = setupChecks.find((check) => check.key === "domain")?.state || "Not connected";
  const dns = setupChecks.find((check) => check.key === "dns")?.state || "Not verified";
  const ssl = setupChecks.find((check) => check.key === "ssl")?.state || "Not active";
  const hosting = setupChecks.find((check) => check.key === "hosting")?.state || "Not active";

  document.title = `${project.projectName || "Project"} - JM Studios`;
  document.querySelector("#clientName").textContent = project.clientName || "JM Studios client";
  document.querySelector("#projectName").textContent = project.slug ? `${project.slug}.jmstudios` : "clientsite.com";
  document.querySelector("#projectTitle").textContent = project.projectName || "Website project";
  document.querySelector("#projectOverview").textContent = project.overview || "";
  document.querySelector("#projectStatus").textContent = project.status || "In progress";
  document.querySelector("#heroStatus").textContent = project.status || "In progress";
  document.querySelector("#heroDomain").textContent = domain;
  document.querySelector("#heroDns").textContent = dns;
  document.querySelector("#heroSsl").textContent = ssl;
  document.querySelector("#heroHosting").textContent = hosting;
  document.querySelector("#heroProgress").style.width = `${Math.max(progress, 8)}%`;
  document.querySelector("#progressPercent").textContent = `${progress}%`;
  document.querySelector("#progressBar").style.width = `${progress}%`;
  document.querySelector("#previewUpdatedAt").textContent = project.updatedAt
    ? `Last updated: ${formatDateTime(project.updatedAt)}`
    : "Last updated: Not yet";
  renderPaymentBanner(project);
  document.querySelector("#launchDate").textContent = project.dueDate
    ? `Target launch: ${formatDate(project.dueDate)}`
    : "Launch date will be confirmed.";

  renderTasks(tasks);
  renderSetupChecks(setupChecks);
  renderPreview(project);
  renderFeedback(project);
  renderFileRequests(project);
}

function renderTasks(tasks) {
  const taskList = document.querySelector("#clientTaskList");
  taskList.innerHTML = "";
  tasks.forEach((task) => {
    const row = document.createElement("article");
    row.className = `client-task ${stateClass(task.state)}`;
    row.innerHTML = `
      <span class="task-dot" aria-hidden="true"></span>
      <strong>${escapeHtml(task.title)}</strong>
      <span class="task-state">${escapeHtml(task.state)}</span>
    `;
    taskList.append(row);
  });
}

function renderSetupChecks(checks) {
  const setupList = document.querySelector("#clientSetupList");
  setupList.innerHTML = "";
  checks.forEach((check) => {
    const row = document.createElement("article");
    row.className = `setup-check ${stateClass(check.state)}`;
    row.innerHTML = `
      <span class="task-dot" aria-hidden="true"></span>
      <div>
        <strong>${escapeHtml(check.title)}</strong>
        <p>${escapeHtml(check.description)}</p>
      </div>
      <span class="task-state">${escapeHtml(check.state)}</span>
    `;
    setupList.append(row);
  });
}

function renderPaymentBanner(project) {
  const banner = document.querySelector("#paymentBanner");
  const link = document.querySelector("#paymentLink");
  const title = document.querySelector("#paymentBannerTitle");
  const shouldShow = Boolean(project.paymentRequestedAt);
  banner.classList.toggle("hidden", !shouldShow);
  title.textContent = project.paymentPlanName
    ? `Pay for the ${project.paymentPlanName} to keep development moving.`
    : "Pay for us to keep developing it.";

  if (project.paymentUrl) {
    link.href = project.paymentUrl;
    link.classList.remove("hidden");
  } else {
    link.classList.add("hidden");
  }
}

function renderPreview(project) {
  clearPreviewObjectUrls();
  const previewFrame = document.querySelector("#livePreviewFrame");
  const previewEmpty = document.querySelector("#livePreviewEmpty");
  const previewAddress = document.querySelector("#livePreviewAddress");
  const previewLink = document.querySelector("#openPreviewLink");
  const previewUrl = project.previewUrl;
  const bundle = project.previewBundle;

  previewFrame.removeAttribute("src");
  previewFrame.removeAttribute("srcdoc");

  if (bundle?.files?.length) {
    const htmlFiles = bundle.files.filter((file) => isHtmlPath(file.path));
    const routes = htmlFiles.length ? htmlFiles : [bundle.files[0]];
    const route = routes.some((file) => file.path === project.previewRoute) ? project.previewRoute : routes[0].path;
    previewFrame.srcdoc = buildPreviewDocument(bundle, route, project.annotations || [], true);
    previewFrame.classList.remove("hidden");
    previewEmpty.classList.add("hidden");
    previewAddress.textContent = displayPath(route, bundle.name);
    toggleAnnotationButton.classList.remove("hidden");
    setAnnotationMode(false);
    previewLink.classList.add("hidden");
    return;
  }

  if (previewUrl) {
    previewFrame.src = previewUrl;
    previewFrame.classList.remove("hidden");
    previewEmpty.classList.add("hidden");
    previewAddress.textContent = previewUrl;
    previewLink.href = previewUrl;
    previewLink.classList.remove("hidden");
    toggleAnnotationButton.classList.add("hidden");
    setAnnotationMode(false);
    return;
  }

  previewFrame.classList.add("hidden");
  previewEmpty.classList.remove("hidden");
  previewAddress.textContent = "Preview URL not set";
  previewLink.classList.add("hidden");
  toggleAnnotationButton.classList.add("hidden");
  setAnnotationMode(false);
}

function stateClass(state = "") {
  if (readyStates.includes(state)) return "complete";
  if (workingStates.includes(state)) return "in-progress";
  return state.toLowerCase().replaceAll(" ", "-");
}

function clearPreviewObjectUrls() {
  previewObjectUrls.forEach((url) => URL.revokeObjectURL(url));
  previewObjectUrls = [];
}

function buildPreviewDocument(bundle, route, annotations = [], allowAnnotations = false) {
  const fileMap = new Map(bundle.files.map((file) => [file.path, file]));
  const urlMap = new Map();

  bundle.files
    .filter((file) => !isHtmlPath(file.path) && !isCssPath(file.path))
    .forEach((file) => {
      const url = objectUrlFromDataUrl(file.dataUrl, file.type);
      urlMap.set(file.path, url);
    });

  bundle.files
    .filter((file) => isCssPath(file.path))
    .forEach((file) => {
      const css = rewriteCss(dataUrlToText(file.dataUrl), file.path, urlMap);
      const url = URL.createObjectURL(new Blob([css], { type: "text/css" }));
      previewObjectUrls.push(url);
      urlMap.set(file.path, url);
    });

  const routeFile = fileMap.get(route) || fileMap.get(bundle.entryPath) || bundle.files.find((file) => isHtmlPath(file.path));
  if (!routeFile || !isHtmlPath(routeFile.path)) {
    return previewFallbackDocument("Select an HTML file to preview this website.");
  }

  return rewriteHtml(dataUrlToText(routeFile.dataUrl), routeFile.path, urlMap, bundle, annotations, allowAnnotations);
}

function objectUrlFromDataUrl(dataUrl, type) {
  const [meta, value] = dataUrl.split(",");
  const isBase64 = meta.includes(";base64");
  const binary = isBase64 ? atob(value) : decodeURIComponent(value);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type }));
  previewObjectUrls.push(url);
  return url;
}

function dataUrlToText(dataUrl) {
  const [, value] = dataUrl.split(",");
  const bytes = Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function rewriteHtml(html, htmlPath, urlMap, bundle, annotations = [], allowAnnotations = false) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const attrs = [
    ["src", "script,img,iframe,source,video,audio"],
    ["href", "link,a"],
    ["poster", "video"],
  ];

  attrs.forEach(([attr, selector]) => {
    doc.querySelectorAll(selector).forEach((node) => {
      const value = node.getAttribute(attr);
      if (!value || shouldSkipUrl(value)) return;
      const resolved = resolveImportedPath(value, htmlPath, bundle.files);
      if (resolved && urlMap.has(resolved)) {
        node.setAttribute(attr, urlMap.get(resolved));
      } else if (attr === "href" && resolved && isHtmlPath(resolved)) {
        node.setAttribute("href", "#");
        node.setAttribute("data-preview-route", resolved);
      }
    });
  });

  doc.querySelectorAll("[srcset]").forEach((node) => node.removeAttribute("srcset"));
  injectPreviewBridge(doc, htmlPath, annotations, allowAnnotations);
  return `<!doctype html>${doc.documentElement.outerHTML}`;
}

function injectPreviewBridge(doc, route, annotations = [], allowAnnotations = false) {
  const routeAnnotations = annotations.filter((annotation) => annotation.route === route);
  const style = doc.createElement("style");
  style.textContent = `
    .jm-annotation-hover {
      outline: 3px solid #2f80ed !important;
      outline-offset: 2px !important;
      cursor: crosshair !important;
    }
    .jm-annotation-box {
      position: absolute;
      z-index: 2147483000;
      border: 3px solid #2f80ed;
      border-radius: 6px;
      background: rgba(47, 128, 237, 0.1);
      box-shadow: 0 12px 34px rgba(18, 51, 95, 0.18);
      pointer-events: none;
    }
    .jm-annotation-pin {
      position: absolute;
      top: -14px;
      right: -14px;
      display: grid;
      width: 28px;
      height: 28px;
      place-items: center;
      border: 2px solid #fff;
      border-radius: 50%;
      background: #2f80ed;
      color: #fff;
      font: 800 12px/1 system-ui, sans-serif;
    }
  `;
  doc.head.append(style);

  const routeScript = doc.createElement("script");
  routeScript.textContent = `
    (function() {
      var annotations = ${jsonForScript(routeAnnotations)};
      var annotationMode = false;
      var activeElement = null;

      function pageSize() {
        var doc = document.documentElement;
        var body = document.body || doc;
        return {
          width: Math.max(doc.scrollWidth, body.scrollWidth, window.innerWidth, 1),
          height: Math.max(doc.scrollHeight, body.scrollHeight, window.innerHeight, 1)
        };
      }

      function drawAnnotations() {
        document.querySelectorAll(".jm-annotation-box").forEach(function(node) {
          node.remove();
        });
        var size = pageSize();
        annotations.forEach(function(annotation, index) {
          var box = document.createElement("div");
          box.className = "jm-annotation-box";
          box.style.left = (annotation.x * size.width) + "px";
          box.style.top = (annotation.y * size.height) + "px";
          box.style.width = Math.max(28, annotation.width * size.width) + "px";
          box.style.height = Math.max(22, annotation.height * size.height) + "px";
          box.title = annotation.note || annotation.label || "Annotation";
          var pin = document.createElement("span");
          pin.className = "jm-annotation-pin";
          pin.textContent = String(index + 1);
          box.append(pin);
          document.body.append(box);
        });
      }

      function clearHover() {
        if (activeElement) activeElement.classList.remove("jm-annotation-hover");
        activeElement = null;
      }

      document.addEventListener("click", function(event) {
        var link = event.target.closest("[data-preview-route]");
        if (link && !annotationMode) {
          event.preventDefault();
          parent.postMessage({ type: "jm-preview-route", route: link.dataset.previewRoute }, "*");
          return;
        }

        if (!annotationMode) return;
        var target = event.target.closest("body *");
        if (!target || target.classList.contains("jm-annotation-box") || target.classList.contains("jm-annotation-pin")) return;
        event.preventDefault();
        event.stopPropagation();
        var rect = target.getBoundingClientRect();
        var size = pageSize();
        parent.postMessage({
          type: "jm-preview-annotation-target",
          annotation: {
            route: ${jsonForScript(route)},
            label: target.getAttribute("aria-label") || target.innerText?.trim().slice(0, 70) || target.tagName.toLowerCase(),
            x: (rect.left + window.scrollX) / size.width,
            y: (rect.top + window.scrollY) / size.height,
            width: rect.width / size.width,
            height: rect.height / size.height
          }
        }, "*");
      }, true);

      ${allowAnnotations ? `
      document.addEventListener("mouseover", function(event) {
        if (!annotationMode) return;
        var target = event.target.closest("body *");
        if (!target || target.classList.contains("jm-annotation-box") || target.classList.contains("jm-annotation-pin")) return;
        clearHover();
        activeElement = target;
        activeElement.classList.add("jm-annotation-hover");
      }, true);

      document.addEventListener("mouseout", function(event) {
        if (!annotationMode || event.relatedTarget === activeElement) return;
        clearHover();
      }, true);

      window.addEventListener("message", function(event) {
        if (event.data?.type !== "jm-annotation-mode") return;
        annotationMode = Boolean(event.data.active);
        document.body.style.cursor = annotationMode ? "crosshair" : "";
        if (!annotationMode) clearHover();
      });
      ` : ""}

      window.addEventListener("resize", drawAnnotations);
      if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", drawAnnotations);
      else drawAnnotations();
    })();
  `;
  doc.body.append(routeScript);
}

function rewriteCss(css, cssPath, urlMap) {
  return css.replace(/url\((['"]?)(.*?)\1\)/g, (match, quote, value) => {
    if (!value || shouldSkipUrl(value)) return match;
    const resolved = resolveImportedPath(value, cssPath, [...urlMap.keys()].map((path) => ({ path })));
    return resolved && urlMap.has(resolved) ? `url("${urlMap.get(resolved)}")` : match;
  });
}

function previewFallbackDocument(message) {
  return `<!doctype html><html><body style="font-family: system-ui; padding: 32px;">${escapeHtml(message)}</body></html>`;
}

function resolveImportedPath(value, fromPath, files) {
  const cleanValue = value.split("#")[0].split("?")[0];
  const normalized = normalizePath(cleanValue.startsWith("/") ? cleanValue.slice(1) : cleanValue);
  const fromDir = fromPath.split("/").slice(0, -1).join("/");
  const candidates = [
    normalizePath(`${fromDir}/${normalized}`),
    normalized,
    normalizePath(`${commonRoot(files.map((file) => file.path))}/${normalized}`),
  ];
  return candidates.find((candidate) => files.some((file) => file.path === candidate));
}

function shouldSkipUrl(value) {
  return /^(#|mailto:|tel:|data:|blob:|https?:|javascript:)/i.test(value);
}

function normalizePath(path) {
  const parts = path.replaceAll("\\", "/").split("/");
  const stack = [];
  parts.forEach((part) => {
    if (!part || part === ".") return;
    if (part === "..") stack.pop();
    else stack.push(part);
  });
  return stack.join("/");
}

function commonRoot(paths) {
  if (!paths.length) return "";
  const first = paths[0].split("/");
  let end = first.length - 1;
  paths.forEach((path) => {
    const parts = path.split("/");
    end = Math.min(end, parts.length - 1);
    for (let index = 0; index < end; index += 1) {
      if (first[index] !== parts[index]) {
        end = index;
        break;
      }
    }
  });
  return first.slice(0, end).join("/");
}

function displayPath(path, root) {
  return root && path.startsWith(`${root}/`) ? path.slice(root.length + 1) : path;
}

function isHtmlPath(path) {
  return /\.html?$/i.test(path);
}

function isCssPath(path) {
  return /\.css$/i.test(path);
}

function formatDate(value) {
  return new Intl.DateTimeFormat("en", { month: "long", day: "numeric", year: "numeric" }).format(
    new Date(`${value}T12:00:00`)
  );
}

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not yet";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function escapeHtml(value = "") {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function jsonForScript(value) {
  return JSON.stringify(value).replaceAll("<", "\\u003c");
}

function escapeAttr(value = "") {
  return escapeHtml(value).replaceAll('"', "&quot;");
}

function setAnnotationMode(active) {
  annotationMode = active;
  toggleAnnotationButton.classList.toggle("active", active);
  toggleAnnotationButton.textContent = active ? "Click an element" : "Annotate";
  const frameWindow = document.querySelector("#livePreviewFrame").contentWindow;
  if (frameWindow) frameWindow.postMessage({ type: "jm-annotation-mode", active }, "*");
}

function renderFeedback(project) {
  previewNotesInput.value = project.previewNotes || "";
  const annotations = project.annotations || [];
  clientAnnotationList.innerHTML = annotations.length
    ? annotations
        .map(
          (annotation, index) => `
            <article class="annotation-item">
              <span>${index + 1}</span>
              <div>
                <strong>${escapeHtml(annotation.label || "Selected element")}</strong>
                <p>${escapeHtml(annotation.note || "")}</p>
              </div>
            </article>
          `
        )
        .join("")
    : `<p class="empty-feedback">No preview annotations yet.</p>`;
}

function renderFileRequests(project) {
  const requests = project.fileRequests || [];
  clientFileRequestList.innerHTML = requests.length
    ? ""
    : `<p class="empty-feedback">No file requests yet.</p>`;

  requests.forEach((request) => {
    const row = document.createElement("article");
    row.className = "client-file-request";
    row.dataset.requestId = request.id;
    const uploads = request.uploads || [];
    row.innerHTML = `
      <div class="request-copy">
        <strong>${escapeHtml(request.title || "File request")}</strong>
        <p>${escapeHtml(request.description || "Upload any useful files for the project.")}</p>
      </div>
      <label class="file-import-button secondary-import">
        Add files
        <input data-file-upload type="file" multiple />
      </label>
      <label>
        Notes for JM Studios
        <textarea data-file-note rows="3" placeholder="Add context, links, or instructions for these files.">${escapeHtml(request.note || "")}</textarea>
      </label>
      <div class="composer-actions">
        <button class="solid-button" data-save-files type="button">Save files</button>
        <p class="portal-status" data-file-status role="status" aria-live="polite"></p>
      </div>
      <div class="uploaded-file-list">
        ${uploads.map((file) => `
          <a class="uploaded-file" href="${escapeAttr(file.dataUrl)}" download="${escapeAttr(file.name)}">
            <span>${escapeHtml(file.name)}</span>
            <small>${escapeHtml(readableFileSize(file.size))}</small>
          </a>
        `).join("")}
      </div>
    `;
    row.querySelector("[data-save-files]").addEventListener("click", () => saveFileRequest(row));
    clientFileRequestList.append(row);
  });
}

function setFeedbackStatus(message) {
  feedbackStatus.textContent = message;
  window.clearTimeout(setFeedbackStatus.timer);
  setFeedbackStatus.timer = window.setTimeout(() => {
    feedbackStatus.textContent = "";
  }, 2600);
}

function saveProjectFeedback(updater) {
  const annotationsProject = findStoredProject(slug);
  const nextProject = updater({ ...(annotationsProject || activeProject) });
  activeProject = {
    ...activeProject,
    previewNotes: nextProject.previewNotes || "",
    annotations: nextProject.annotations || [],
    fileRequests: nextProject.fileRequests || [],
  };

  if (slug && annotationsProject) {
    const projects = JSON.parse(localStorage.getItem(storageKey)) || [];
    const index = projects.findIndex((project) => project.slug === slug);
    if (index >= 0) {
      projects[index] = { ...projects[index], ...nextProject };
      localStorage.setItem(storageKey, JSON.stringify(projects));
    }
  }

  renderFeedback(activeProject);
  renderFileRequests(activeProject);
  renderPreview(activeProject);
}

async function saveFileRequest(row) {
  const requestId = row.dataset.requestId;
  const status = row.querySelector("[data-file-status]");
  const note = row.querySelector("[data-file-note]").value.trim();
  const input = row.querySelector("[data-file-upload]");
  const selectedFiles = [...input.files].filter((file) => !file.name.startsWith("."));

  status.textContent = "Saving files.";

  try {
    const uploads = await Promise.all(selectedFiles.map(readDashboardFile));
    saveProjectFeedback((project) => ({
      ...project,
      fileRequests: (project.fileRequests || []).map((request) => {
        if (request.id !== requestId) return request;
        return {
          ...request,
          note,
          uploads: [...(request.uploads || []), ...uploads],
        };
      }),
    }));
    input.value = "";
    setFeedbackStatus(selectedFiles.length ? "Files saved." : "Note saved.");
  } catch (error) {
    status.textContent = "Those files could not be saved here. Try fewer or smaller files.";
  }
}

function readDashboardFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve({
        id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${file.name}`,
        name: file.name,
        type: file.type || "application/octet-stream",
        size: file.size,
        dataUrl: reader.result,
        uploadedAt: new Date().toISOString(),
      });
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function readableFileSize(bytes = 0) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function installPreviewScrollGuards() {
  const guardedPreviews = document.querySelectorAll("[data-scroll-guard]");
  if (!guardedPreviews.length) return;

  let wheelTimer;
  let isWheelActive = false;

  window.addEventListener(
    "wheel",
    () => {
      isWheelActive = true;
      window.clearTimeout(wheelTimer);
      wheelTimer = window.setTimeout(() => {
        isWheelActive = false;
      }, 360);
    },
    { passive: true }
  );

  guardedPreviews.forEach((preview) => {
    let hoverTimer;

    const disablePreview = () => {
      window.clearTimeout(hoverTimer);
      preview.classList.remove("is-preview-active");
    };

    preview.addEventListener("mouseenter", () => {
      window.clearTimeout(hoverTimer);
      hoverTimer = window.setTimeout(() => {
        if (!isWheelActive) preview.classList.add("is-preview-active");
      }, 520);
    });

    preview.addEventListener("mousemove", () => {
      if (preview.classList.contains("is-preview-active")) return;
      window.clearTimeout(hoverTimer);
      hoverTimer = window.setTimeout(() => {
        if (!isWheelActive) preview.classList.add("is-preview-active");
      }, 520);
    });

    preview.addEventListener("mouseleave", disablePreview);
    preview.addEventListener("wheel", () => {
      if (!preview.classList.contains("is-preview-active")) disablePreview();
    });
  });
}

toggleAnnotationButton.addEventListener("click", () => {
  setAnnotationMode(!annotationMode);
  if (!annotationMode) annotationComposer.classList.add("hidden");
});

document.querySelector("#cancelAnnotation").addEventListener("click", () => {
  pendingAnnotation = null;
  annotationNoteInput.value = "";
  annotationComposer.classList.add("hidden");
});

document.querySelector("#saveAnnotation").addEventListener("click", () => {
  const note = annotationNoteInput.value.trim();
  if (!pendingAnnotation || !note) {
    setFeedbackStatus("Write a note before saving the annotation.");
    return;
  }

  saveProjectFeedback((project) => ({
    ...project,
    annotations: [
      ...(project.annotations || []),
      {
        id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
        ...pendingAnnotation,
        note,
        createdAt: new Date().toISOString(),
      },
    ],
  }));

  pendingAnnotation = null;
  annotationNoteInput.value = "";
  annotationComposer.classList.add("hidden");
  setFeedbackStatus("Annotation saved.");
});

document.querySelector("#savePreviewNotes").addEventListener("click", () => {
  saveProjectFeedback((project) => ({
    ...project,
    previewNotes: previewNotesInput.value.trim(),
  }));
  setFeedbackStatus("Preview notes saved.");
});

window.addEventListener("message", (event) => {
  if (!activeProject) return;

  if (event.data?.type === "jm-preview-route") {
    activeProject = { ...activeProject, previewRoute: event.data.route };
    renderPreview(activeProject);
    return;
  }

  if (event.data?.type === "jm-preview-annotation-target") {
    pendingAnnotation = event.data.annotation;
    annotationTargetLabel.textContent = pendingAnnotation.label || "Selected element";
    annotationNoteInput.value = "";
    annotationComposer.classList.remove("hidden");
    setAnnotationMode(false);
    annotationNoteInput.focus();
  }
});
