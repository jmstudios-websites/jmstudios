const params = new URLSearchParams(window.location.hash.slice(1));
const payload = params.get("payload");
const slug = params.get("slug");
const storageKey = "jmStudiosProjects";
const passwordForm = document.querySelector("#passwordForm");
const statusEl = document.querySelector("#dashboardStatus");
const accessPanel = document.querySelector("#accessPanel");
const dashboard = document.querySelector("#clientDashboard");
let previewObjectUrls = [];
let activeProject = null;
const readyStates = ["Connected", "Verified", "Active", "Tested", "Ready", "Done", "Complete"];
const workingStates = ["Connecting", "Checking", "Activating", "Setting up", "Testing", "Reviewing", "In progress"];

if (!slug && !payload) {
  statusEl.textContent = "This dashboard link is missing project data. Ask JM Studios for a fresh link.";
}

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
  document.querySelector("#launchDate").textContent = project.dueDate
    ? `Target launch: ${formatDate(project.dueDate)}`
    : "Launch date will be confirmed.";

  renderTasks(tasks);
  renderSetupChecks(setupChecks);
  renderPreview(project);
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
    previewFrame.srcdoc = buildPreviewDocument(bundle, route);
    previewFrame.classList.remove("hidden");
    previewEmpty.classList.add("hidden");
    previewAddress.textContent = displayPath(route, bundle.name);
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
    return;
  }

  previewFrame.classList.add("hidden");
  previewEmpty.classList.remove("hidden");
  previewAddress.textContent = "Preview URL not set";
  previewLink.classList.add("hidden");
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

function buildPreviewDocument(bundle, route) {
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

  return rewriteHtml(dataUrlToText(routeFile.dataUrl), routeFile.path, urlMap, bundle);
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

function rewriteHtml(html, htmlPath, urlMap, bundle) {
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
  const routeScript = doc.createElement("script");
  routeScript.textContent = `
    document.addEventListener("click", function(event) {
      var link = event.target.closest("[data-preview-route]");
      if (!link) return;
      event.preventDefault();
      parent.postMessage({ type: "jm-preview-route", route: link.dataset.previewRoute }, "*");
    });
  `;
  doc.body.append(routeScript);
  return `<!doctype html>${doc.documentElement.outerHTML}`;
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

function escapeHtml(value = "") {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

window.addEventListener("message", (event) => {
  if (event.data?.type !== "jm-preview-route" || !activeProject) return;
  activeProject = { ...activeProject, previewRoute: event.data.route };
  renderPreview(activeProject);
});
