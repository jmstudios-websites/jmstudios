const ADMIN_SLUG = "hdlxmpfpfmxwdvbvvu";
const ADMIN_PASSWORD_HASH = "3061b5d003ab7dcc019a1134695197a7a4c62215d23cac10f725c7222ca47be5";
const pathAllowsAdmin = window.location.pathname.toLowerCase().includes(`/${ADMIN_SLUG}/`);
const paymentSettingsKey = "jmStudiosPaymentLinks";

if (!pathAllowsAdmin) {
  document.body.innerHTML = `
    <main class="dashboard-shell">
      <section class="access-panel">
        <div>
          <p class="eyebrow">Admin</p>
          <h1>Admin portal is private.</h1>
          <p>Use the private admin URL to open the JM Studios portal.</p>
        </div>
        <a class="solid-button" href="index.html">Back to site</a>
      </section>
    </main>
  `;
  throw new Error("Private admin path required.");
}

const storageKey = "jmStudiosProjects";
const form = document.querySelector("#projectForm");
const projectList = document.querySelector("#projectList");
const taskList = document.querySelector("#taskList");
const setupList = document.querySelector("#setupList");
const fileRequestList = document.querySelector("#fileRequestList");
const statusEl = document.querySelector("#portalStatus");
const dashboardLink = document.querySelector("#dashboardLink");
const openDashboard = document.querySelector("#openDashboard");
const editorTitle = document.querySelector("#editorTitle");
const previewFolderInput = document.querySelector("#previewFolderInput");
const previewFileInput = document.querySelector("#previewFileInput");
const previewRoute = document.querySelector("#previewRoute");
const previewFrame = document.querySelector("#websitePreviewFrame");
const previewEmpty = document.querySelector("#previewEmpty");
const previewAddress = document.querySelector("#previewAddress");
const browserPreviewShell = document.querySelector("#browserPreviewShell");
const adminPreviewNotes = document.querySelector("#adminPreviewNotes");
const adminAnnotationList = document.querySelector("#adminAnnotationList");
const paymentRequestStatus = document.querySelector("#paymentRequestStatus");
const starterPaymentLink = document.querySelector("#starterPaymentLink");
const fullPaymentLink = document.querySelector("#fullPaymentLink");
const carePaymentLink = document.querySelector("#carePaymentLink");

installAdminGate();
installPreviewScrollGuards();

let projects = loadProjects();
let activeId = projects[0]?.id || null;
let previewObjectUrls = [];

const starterTasks = [
  { title: "Quote approved", state: "Complete" },
  { title: "Content collected", state: "In progress" },
  { title: "Homepage direction", state: "Not started" },
  { title: "Responsive build", state: "Not started" },
  { title: "Launch checks", state: "Not started" },
];

const paymentPlans = {
  starter: "Starter website",
  full: "Full website build",
  care: "Care package",
};

const defaultPaymentLinks = {
  starter: "https://buy.stripe.com/test_8x2bJ33K422jgl6emF83C00",
  full: "https://buy.stripe.com/test_5kQ8wR1BW5evc4Q0vP83C01",
  care: "https://buy.stripe.com/test_3cI5kFdkE5ev2ugbat83C02",
};

const starterFileRequests = [
  {
    id: "logo-files",
    title: "Logo files",
    description: "Upload the best logo files you have, preferably SVG, PNG, or PDF.",
    uploads: [],
    note: "",
  },
  {
    id: "brand-fonts",
    title: "Fonts or brand assets",
    description: "Upload font files, color notes, style guides, or brand photos if you have them.",
    uploads: [],
    note: "",
  },
  {
    id: "existing-website",
    title: "Existing website files",
    description: "Upload any existing website export, screenshots, copy, or pages we should reuse.",
    uploads: [],
    note: "",
  },
];

const defaultSetupChecks = [
  {
    key: "domain",
    title: "Domain connected",
    description: "The live domain is pointed at the website.",
    state: "Not connected",
  },
  {
    key: "dns",
    title: "DNS verified",
    description: "Required DNS records are in place and resolving.",
    state: "Not verified",
  },
  {
    key: "ssl",
    title: "SSL activated",
    description: "The site loads securely over HTTPS.",
    state: "Not active",
  },
  {
    key: "hosting",
    title: "Hosting active",
    description: "Deployment and hosting are ready for traffic.",
    state: "Not active",
  },
  {
    key: "contact",
    title: "Contact form tested",
    description: "Form submissions are reaching the right inbox.",
    state: "Not tested",
  },
  {
    key: "launch",
    title: "Final launch review",
    description: "Final responsive, content, and link checks are complete.",
    state: "Not ready",
  },
];

const setupStatusOptions = {
  domain: ["Not connected", "Connecting", "Connected", "Blocked"],
  dns: ["Not verified", "Checking", "Verified", "Blocked"],
  ssl: ["Not active", "Activating", "Active", "Blocked"],
  hosting: ["Not active", "Setting up", "Active", "Blocked"],
  contact: ["Not tested", "Testing", "Tested", "Blocked"],
  launch: ["Not ready", "Reviewing", "Ready", "Blocked"],
  default: ["Not started", "In progress", "Done", "Blocked"],
};

const readyStates = ["Connected", "Verified", "Active", "Tested", "Ready", "Done", "Complete"];

function loadProjects() {
  try {
    return JSON.parse(localStorage.getItem(storageKey)) || [];
  } catch (error) {
    return [];
  }
}

function loadPaymentLinks() {
  try {
    return { ...defaultPaymentLinks, ...(JSON.parse(localStorage.getItem(paymentSettingsKey)) || {}) };
  } catch (error) {
    return { ...defaultPaymentLinks };
  }
}

function savePaymentLinks() {
  const links = {
    starter: starterPaymentLink.value.trim(),
    full: fullPaymentLink.value.trim(),
    care: carePaymentLink.value.trim(),
  };
  localStorage.setItem(paymentSettingsKey, JSON.stringify(links));
  setPaymentStatus("Payment links saved.");
  return links;
}

function renderPaymentLinks() {
  const links = loadPaymentLinks();
  starterPaymentLink.value = links.starter || "";
  fullPaymentLink.value = links.full || "";
  carePaymentLink.value = links.care || "";
}

function saveProjects() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(projects));
    return true;
  } catch (error) {
    setStatus("Browser storage is full. The imported preview may be too large to save here.");
    return false;
  }
}

function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
}

function randomToken(length = 8) {
  const chars = "abcdefghijkmnopqrstuvwxyz23456789";
  return Array.from(crypto.getRandomValues(new Uint8Array(length)))
    .map((value) => chars[value % chars.length])
    .join("");
}

function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 34);
}

function getActiveProject() {
  return projects.find((project) => project.id === activeId);
}

function setStatus(message) {
  statusEl.textContent = message;
  window.clearTimeout(setStatus.timer);
  setStatus.timer = window.setTimeout(() => {
    statusEl.textContent = "";
  }, 3200);
}

function installAdminGate() {
  if (sessionStorage.getItem("jmAdminUnlocked") === ADMIN_PASSWORD_HASH) {
    document.body.classList.remove("is-locked");
    return;
  }

  const gate = document.createElement("section");
  gate.className = "admin-gate";
  gate.innerHTML = `
    <form class="admin-gate-panel">
      <p class="eyebrow">Private admin</p>
      <h1>Enter admin password.</h1>
      <label>
        20-character password
        <input id="adminPasswordInput" type="password" autocomplete="current-password" required />
      </label>
      <button class="solid-button" type="submit">Unlock portal</button>
      <p class="portal-status" id="adminGateStatus" role="status" aria-live="polite"></p>
    </form>
  `;

  document.body.append(gate);
  gate.querySelector("form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const input = gate.querySelector("#adminPasswordInput");
    const status = gate.querySelector("#adminGateStatus");
    const hash = await sha256(input.value);

    if (hash !== ADMIN_PASSWORD_HASH) {
      status.textContent = "Password is not correct.";
      input.select();
      return;
    }

    sessionStorage.setItem("jmAdminUnlocked", ADMIN_PASSWORD_HASH);
    gate.remove();
    document.body.classList.remove("is-locked");
  });
}

async function sha256(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function createProject() {
  const slug = `client-${randomToken(6)}`;
  const project = {
    id: uid(),
    clientName: "New client",
    clientEmail: "",
    projectName: "Website project",
    slug,
    password: randomToken(10),
    dueDate: "",
    status: "Quote sent",
    previewUrl: "",
    paymentUrl: "",
    paymentPlanName: "",
    paymentRequestedAt: "",
    overview: "Your project dashboard will show the current status, review link, and checklist as the website moves forward.",
    tasks: starterTasks,
    setupChecks: defaultSetupChecks,
    previewBundle: null,
    previewRoute: "",
    previewSize: "desktop",
    previewNotes: "",
    annotations: [],
    fileRequests: starterFileRequests,
    updatedAt: new Date().toISOString(),
  };

  projects.unshift(project);
  activeId = project.id;
  saveProjects();
  render();
  setStatus("New dashboard created.");
}

function projectFromForm() {
  const data = Object.fromEntries(new FormData(form).entries());
  return {
    ...getActiveProject(),
    ...data,
    slug: slugify(data.slug) || randomToken(6),
    setupChecks: [...setupList.querySelectorAll(".setup-row")].map((row) => ({
      key: row.dataset.key,
      title: row.querySelector("[data-setup-title]").value.trim(),
      description: row.querySelector("[data-setup-description]").value.trim(),
      state: row.querySelector("[data-setup-state]").value,
    })).filter((check) => check.title),
    tasks: [...taskList.querySelectorAll(".task-row")].map((row) => ({
      title: row.querySelector("[data-task-title]").value.trim(),
      state: row.querySelector("[data-task-state]").value,
    })).filter((task) => task.title),
    fileRequests: [...fileRequestList.querySelectorAll(".file-request-row")].map((row) => {
      const saved = getActiveProject().fileRequests?.find((request) => request.id === row.dataset.requestId);
      return {
        id: row.dataset.requestId,
        title: row.querySelector("[data-request-title]").value.trim(),
        description: row.querySelector("[data-request-description]").value.trim(),
        uploads: saved?.uploads || [],
        note: saved?.note || "",
      };
    }).filter((request) => request.title),
    previewRoute: previewRoute.value,
    previewSize: browserPreviewShell.dataset.size || "desktop",
    updatedAt: new Date().toISOString(),
  };
}

function fillForm(project) {
  form.clientName.value = project.clientName || "";
  form.clientEmail.value = project.clientEmail || "";
  form.projectName.value = project.projectName || "";
  form.slug.value = project.slug || "";
  form.password.value = project.password || "";
  form.dueDate.value = project.dueDate || "";
  form.status.value = project.status || "Quote sent";
  form.previewUrl.value = project.previewUrl || "";
  form.overview.value = project.overview || "";
  editorTitle.textContent = project.projectName || "New client dashboard";
  renderSetupChecks(normalizeSetupChecks(project.setupChecks));
  renderTasks(project.tasks || []);
  renderFileRequests(project.fileRequests || []);
  renderPreview(project);
  renderClientFeedback(project);
}

function normalizeSetupChecks(checks = []) {
  const normalizedDefaults = defaultSetupChecks.map((defaultCheck) => {
    const saved = checks.find((check) => check.key === defaultCheck.key || check.title === defaultCheck.title);
    return saved ? { ...defaultCheck, ...saved } : defaultCheck;
  });
  const customChecks = checks.filter(
    (check) => !defaultSetupChecks.some((defaultCheck) => defaultCheck.key === check.key || defaultCheck.title === check.title)
  );
  return [...normalizedDefaults, ...customChecks];
}

function renderSetupChecks(checks) {
  setupList.innerHTML = "";
  checks.forEach((check) => {
    const statusOptions = statusOptionsForCheck(check);
    const row = document.createElement("div");
    row.className = "setup-row";
    row.dataset.key = check.key;
    row.innerHTML = `
      <input data-setup-title type="text" value="${escapeAttr(check.title)}" aria-label="Launch check title" />
      <input data-setup-description type="text" value="${escapeAttr(check.description)}" aria-label="Launch check description" />
      <select data-setup-state aria-label="${escapeAttr(check.title)} status">
        ${statusOptions.map((state) => `<option ${state === check.state ? "selected" : ""}>${state}</option>`).join("")}
      </select>
      <button class="text-button danger" type="button">Remove</button>
    `;
    row.querySelector("button").addEventListener("click", () => row.remove());
    setupList.append(row);
  });
}

function statusOptionsForCheck(check) {
  const options = setupStatusOptions[check.key] || setupStatusOptions.default;
  return options.includes(check.state) ? options : [...options, check.state];
}

function renderTasks(tasks) {
  taskList.innerHTML = "";
  tasks.forEach((task) => addTaskRow(task));
}

function addTaskRow(task = { title: "", state: "Not started" }) {
  const row = document.createElement("div");
  row.className = "task-row";
  row.innerHTML = `
    <input data-task-title type="text" value="${escapeAttr(task.title)}" aria-label="Task title" />
    <select data-task-state aria-label="Task status">
      ${["Not started", "In progress", "Complete"].map((state) => `<option ${state === task.state ? "selected" : ""}>${state}</option>`).join("")}
    </select>
    <button class="text-button danger" type="button">Remove</button>
  `;
  row.querySelector("button").addEventListener("click", () => row.remove());
  taskList.append(row);
}

function renderFileRequests(requests) {
  fileRequestList.innerHTML = "";
  const normalizedRequests = requests.length ? requests : starterFileRequests;
  normalizedRequests.forEach((request) => addFileRequestRow(request));
}

function addFileRequestRow(request = {}) {
  const row = document.createElement("article");
  row.className = "file-request-row";
  row.dataset.requestId = request.id || uid();
  const uploads = request.uploads || [];
  row.innerHTML = `
    <div class="request-fields">
      <input data-request-title type="text" value="${escapeAttr(request.title || "New file request")}" aria-label="File request title" />
      <input data-request-description type="text" value="${escapeAttr(request.description || "Describe what the client should upload.")}" aria-label="File request description" />
    </div>
    <div class="request-response">
      <strong>${uploads.length ? `${uploads.length} file${uploads.length === 1 ? "" : "s"} uploaded` : "No files uploaded yet"}</strong>
      ${request.note ? `<p>${escapeHtml(request.note)}</p>` : `<p>No client note yet.</p>`}
      <div class="uploaded-file-list">
        ${uploads.map((file) => `
          <a class="uploaded-file" href="${escapeAttr(file.dataUrl)}" download="${escapeAttr(file.name)}">
            <span>${escapeHtml(file.name)}</span>
            <small>${escapeHtml(readableFileSize(file.size))}</small>
          </a>
        `).join("")}
      </div>
    </div>
    <button class="text-button danger" type="button">Remove</button>
  `;
  row.querySelector("button").addEventListener("click", () => row.remove());
  fileRequestList.append(row);
}

function renderClientFeedback(project) {
  const annotations = project.annotations || [];
  adminPreviewNotes.textContent = project.previewNotes || "No preview notes yet.";
  adminAnnotationList.innerHTML = annotations.length
    ? annotations
        .map(
          (annotation, index) => `
            <article class="annotation-item">
              <span>${index + 1}</span>
              <div>
                <strong>${escapeHtml(annotation.label || "Selected element")}</strong>
                <p>${escapeHtml(annotation.note || "")}</p>
                <small>${escapeHtml(displayPath(annotation.route || project.previewRoute || "", project.previewBundle?.name || ""))}</small>
              </div>
            </article>
          `
        )
        .join("")
    : `<p class="empty-feedback">No annotations from this client yet.</p>`;
}

function escapeAttr(value = "") {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");
}

function renderList() {
  projectList.innerHTML = "";

  if (!projects.length) {
    projectList.innerHTML = `<p class="portal-status">No dashboards yet.</p>`;
    return;
  }

  projects.forEach((project) => {
    const setupChecks = normalizeSetupChecks(project.setupChecks);
    const completeChecks = setupChecks.filter((check) => isDoneState(check.state)).length;
    const item = document.createElement("button");
    item.type = "button";
    item.className = `project-item${project.id === activeId ? " active" : ""}`;
    item.innerHTML = `
      <strong>${escapeHtml(project.projectName || "Website project")}</strong>
      <span>${escapeHtml(project.clientName || "Client")} · ${escapeHtml(project.status || "Quote sent")}</span>
      <small>${completeChecks}/${setupChecks.length} launch checks ready</small>
    `;
    item.addEventListener("click", () => {
      activeId = project.id;
      render();
    });
    projectList.append(item);
  });
}

function isDoneState(state) {
  return readyStates.includes(state);
}

function renderDashboardAccess(project) {
  if (!project) return;
  dashboardLink.value = "Save dashboard to generate link.";
  openDashboard.href = "../dashboard.html";

  const url = new URL("../dashboard.html", window.location.href);
  url.hash = new URLSearchParams({ slug: project.slug }).toString();
  dashboardLink.value = url.href;
  openDashboard.href = url.href;
}

function render() {
  const latestProjects = loadProjects();
  if (latestProjects.length) projects = latestProjects;
  if (!projects.some((project) => project.id === activeId)) activeId = projects[0]?.id || null;
  if (!projects.length) createProject();
  const project = getActiveProject();
  renderPaymentLinks();
  renderList();
  fillForm(project);
  renderDashboardAccess(project);
}

function setActiveProject(nextProject) {
  const index = projects.findIndex((project) => project.id === activeId);
  projects[index] = nextProject;
  return saveProjects();
}

function readableFileSize(bytes = 0) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function importPreviewFiles(files) {
  const selectedFiles = [...files].filter((file) => !file.name.startsWith("."));
  if (!selectedFiles.length) return;

  const totalBytes = selectedFiles.reduce((sum, file) => sum + file.size, 0);
  const importedFiles = await Promise.all(selectedFiles.map(readPreviewFile));
  const htmlFiles = importedFiles
    .filter((file) => isHtmlPath(file.path))
    .sort((a, b) => routeWeight(a.path) - routeWeight(b.path));

  const bundle = {
    name: commonRoot(importedFiles.map((file) => file.path)) || "Imported website",
    importedAt: new Date().toISOString(),
    totalBytes,
    entryPath: htmlFiles[0]?.path || importedFiles[0].path,
    files: importedFiles,
  };

  const project = {
    ...projectFromForm(),
    previewBundle: bundle,
    previewRoute: bundle.entryPath,
  };
  if (!setActiveProject(project)) return;
  renderList();
  fillForm(project);
  setStatus(`Imported ${importedFiles.length} files for preview (${readableFileSize(totalBytes)}).`);
}

function readPreviewFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const path = normalizePath(file.webkitRelativePath || file.name);
    reader.onload = () => {
      resolve({
        path,
        name: file.name,
        type: file.type || mimeFromPath(path),
        size: file.size,
        dataUrl: reader.result,
      });
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function renderPreview(project) {
  clearPreviewObjectUrls();
  const bundle = project.previewBundle;
  const size = project.previewSize || "desktop";
  browserPreviewShell.dataset.size = size;
  document.querySelectorAll("[data-preview-size]").forEach((button) => {
    button.classList.toggle("active", button.dataset.previewSize === size);
  });

  previewRoute.innerHTML = "";
  if (!bundle?.files?.length) {
    previewFrame.removeAttribute("srcdoc");
    previewFrame.classList.add("hidden");
    previewEmpty.classList.remove("hidden");
    previewAddress.textContent = "No website imported";
    previewRoute.innerHTML = `<option value="">No imported pages</option>`;
    return;
  }

  const htmlFiles = bundle.files.filter((file) => isHtmlPath(file.path));
  const routes = htmlFiles.length ? htmlFiles : [bundle.files[0]];
  routes.forEach((file) => {
    const option = document.createElement("option");
    option.value = file.path;
    option.textContent = displayPath(file.path, bundle.name);
    previewRoute.append(option);
  });

  const route = routes.some((file) => file.path === project.previewRoute) ? project.previewRoute : routes[0].path;
  previewRoute.value = route;
  previewAddress.textContent = displayPath(route, bundle.name);
  previewEmpty.classList.add("hidden");
  previewFrame.classList.remove("hidden");
  previewFrame.srcdoc = buildPreviewDocument(bundle, route, project.annotations || []);
}

function clearPreviewObjectUrls() {
  previewObjectUrls.forEach((url) => URL.revokeObjectURL(url));
  previewObjectUrls = [];
}

function buildPreviewDocument(bundle, route, annotations = []) {
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

  return rewriteHtml(dataUrlToText(routeFile.dataUrl), routeFile.path, urlMap, bundle, annotations);
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

function rewriteHtml(html, htmlPath, urlMap, bundle, annotations = []) {
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
  injectPreviewBridge(doc, htmlPath, annotations);
  return `<!doctype html>${doc.documentElement.outerHTML}`;
}

function injectPreviewBridge(doc, route, annotations = []) {
  const routeAnnotations = annotations.filter((annotation) => annotation.route === route);
  const style = doc.createElement("style");
  style.textContent = `
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

      document.addEventListener("click", function(event) {
        var link = event.target.closest("[data-preview-route]");
        if (!link) return;
        event.preventDefault();
        parent.postMessage({ type: "jm-preview-route", route: link.dataset.previewRoute }, "*");
      });

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

function routeWeight(path) {
  if (/\/?index\.html?$/i.test(path)) return 0;
  return path.split("/").length;
}

function mimeFromPath(path) {
  if (/\.html?$/i.test(path)) return "text/html";
  if (/\.css$/i.test(path)) return "text/css";
  if (/\.m?js$/i.test(path)) return "text/javascript";
  if (/\.svg$/i.test(path)) return "image/svg+xml";
  if (/\.png$/i.test(path)) return "image/png";
  if (/\.jpe?g$/i.test(path)) return "image/jpeg";
  if (/\.webp$/i.test(path)) return "image/webp";
  return "application/octet-stream";
}

function escapeHtml(value = "") {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function jsonForScript(value) {
  return JSON.stringify(value).replaceAll("<", "\\u003c");
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

async function copyText(value, message) {
  try {
    await navigator.clipboard.writeText(value);
    setStatus(message);
  } catch (error) {
    setStatus("Copy was blocked by the browser. Select the field and copy it manually.");
  }
}

function setPaymentStatus(message) {
  paymentRequestStatus.textContent = message;
  window.clearTimeout(setPaymentStatus.timer);
  setPaymentStatus.timer = window.setTimeout(() => {
    paymentRequestStatus.textContent = "";
  }, 4200);
}

async function askForPayment(selectedPlan) {
  const project = projectFromForm();
  const paymentLinks = savePaymentLinks();
  const paymentUrl = paymentLinks[selectedPlan] || "";
  const planName = paymentPlans[selectedPlan] || "Website payment";

  if (!project.clientEmail) {
    setPaymentStatus("Add the client email before asking for payment.");
    return;
  }

  if (!paymentUrl) {
    setPaymentStatus(`Add the ${planName} Stripe payment link first.`);
    return;
  }

  const endpoint = window.JM_CONTACT_ENDPOINT || "/api/contact";
  const paymentRequestedAt = new Date().toISOString();
  const nextProject = {
    ...project,
    paymentPlan: selectedPlan,
    paymentUrl,
    paymentPlanName: planName,
    paymentRequestedAt,
    updatedAt: paymentRequestedAt,
  };
  const index = projects.findIndex((savedProject) => savedProject.id === activeId);
  projects[index] = nextProject;

  if (!saveProjects()) return;
  renderDashboardAccess(nextProject);
  renderList();
  fillForm(nextProject);

  setPaymentStatus("Sending payment request email.");

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "payment-request",
        clientName: nextProject.clientName,
        clientEmail: nextProject.clientEmail,
        projectName: nextProject.projectName,
        planName: nextProject.paymentPlanName,
        dashboardUrl: dashboardLink.value,
        paymentUrl: nextProject.paymentUrl,
      }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(result.details || result.error || "Payment email could not be sent.");
    }
    setPaymentStatus("Payment request sent and dashboard notice is live.");
  } catch (error) {
    setPaymentStatus(`Dashboard notice is live, but email failed: ${error.message}`);
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const nextProject = projectFromForm();
  const index = projects.findIndex((project) => project.id === activeId);
  projects[index] = nextProject;
  saveProjects();
  renderList();
  renderDashboardAccess(nextProject);
  setStatus("Dashboard saved. Refresh the client dashboard to see the latest changes.");
});

form.projectName.addEventListener("input", () => {
  if (!form.slug.dataset.touched) form.slug.value = slugify(form.projectName.value);
});

form.slug.addEventListener("input", () => {
  form.slug.dataset.touched = "true";
});

document.querySelector("#newProject").addEventListener("click", createProject);
document.querySelector("#addTask").addEventListener("click", () => addTaskRow());
document.querySelectorAll("[data-payment-plan]").forEach((button) => {
  button.addEventListener("click", () => askForPayment(button.dataset.paymentPlan));
});
document.querySelector("#savePaymentLinks").addEventListener("click", savePaymentLinks);
document.querySelector("#addFileRequest").addEventListener("click", () => {
  addFileRequestRow({
    id: uid(),
    title: "New file request",
    description: "Describe what the client should upload.",
    uploads: [],
    note: "",
  });
});
document.querySelector("#addSetupCheck").addEventListener("click", () => {
  const key = `custom-${randomToken(6)}`;
  renderSetupChecks([
    ...[...setupList.querySelectorAll(".setup-row")].map((row) => ({
      key: row.dataset.key,
      title: row.querySelector("[data-setup-title]").value.trim(),
      description: row.querySelector("[data-setup-description]").value.trim(),
      state: row.querySelector("[data-setup-state]").value,
    })),
    {
      key,
      title: "New launch check",
      description: "Describe what needs to be confirmed.",
      state: "Not started",
    },
  ]);
});

document.querySelector("#deleteProject").addEventListener("click", () => {
  if (projects.length <= 1) {
    setStatus("Keep at least one dashboard in the workspace.");
    return;
  }
  projects = projects.filter((project) => project.id !== activeId);
  activeId = projects[0].id;
  saveProjects();
  render();
  setStatus("Dashboard deleted.");
});

document.querySelector("#copyPassword").addEventListener("click", () => {
  copyText(form.password.value, "Password copied.");
});

document.querySelector("#copyDashboardLink").addEventListener("click", () => {
  copyText(dashboardLink.value, "Dashboard link copied.");
});

function handlePreviewImport(event) {
  importPreviewFiles(event.target.files).catch(() => {
    setStatus("Could not import those files. Try a smaller static site folder.");
  });
  event.target.value = "";
}

previewFolderInput.addEventListener("change", handlePreviewImport);
previewFileInput.addEventListener("change", handlePreviewImport);

previewRoute.addEventListener("change", () => {
  const project = { ...projectFromForm(), previewRoute: previewRoute.value };
  setActiveProject(project);
  renderPreview(project);
});

document.querySelectorAll("[data-preview-size]").forEach((button) => {
  button.addEventListener("click", () => {
    const project = { ...projectFromForm(), previewSize: button.dataset.previewSize };
    setActiveProject(project);
    renderPreview(project);
  });
});

document.querySelector("#clearPreview").addEventListener("click", () => {
  const project = { ...projectFromForm(), previewBundle: null, previewRoute: "" };
  setActiveProject(project);
  renderList();
  renderPreview(project);
  setStatus("Website preview cleared.");
});

window.addEventListener("message", (event) => {
  if (event.data?.type !== "jm-preview-route") return;
  const project = getActiveProject();
  const nextProject = { ...project, previewRoute: event.data.route };
  setActiveProject(nextProject);
  renderPreview(nextProject);
});

window.addEventListener("storage", (event) => {
  if (event.key !== storageKey) return;
  projects = loadProjects();
  render();
});

document.querySelector("#exportData").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(projects, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `jm-studios-dashboards-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
});

render();
