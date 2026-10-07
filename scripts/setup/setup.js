const token = location.hash.slice(1) || sessionStorage.getItem("myhome-installer-session") || "";
if (token) sessionStorage.setItem("myhome-installer-session", token);
history.replaceState(null, "", "/");
const get = (id) => document.getElementById(id);
const form = get("setup");
const panels = [...document.querySelectorAll("[data-panel]")];
const stepButtons = [...document.querySelectorAll("[data-step]")];
const fonts = { segoe: '"Segoe UI", Tahoma, sans-serif', tahoma: 'Tahoma, sans-serif', trebuchet: '"Trebuchet MS", sans-serif' };
const logins = { password: "Email and password", github: "GitHub", both: "GitHub and password" };
let connected = false;
let busy = false;
let finished = false;
let step = 0;
let furthest = 0;
let installing = false;
let localError = "";
let lastServerError = "";
let lastStage = "";
let lastPreview = "";
let connectionPending = false;
get("installer").addEventListener("animationend", (event) => {
  if (event.target === get("installer")) get("installer").classList.add("window-ready");
});

function error(message) {
  get("error").textContent = message;
  get("error").hidden = !message;
}

async function api(route, body) {
  const response = await fetch(`/api/${route}`, { method: body ? "POST" : "GET", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Setup request failed.");
  return result;
}

function controls() {
  get("back").disabled = step === 0 || busy || finished;
  get("next").hidden = step === 4 || finished;
  get("next").disabled = busy;
  get("deploy").disabled = busy || !connected || finished || !get("confirm").checked;
  get("connect").disabled = busy || connected || finished;
  for (const button of stepButtons) {
    const index = Number(button.dataset.step);
    button.disabled = busy || finished || index > furthest;
    button.classList.toggle("complete", index < furthest || finished);
    button.toggleAttribute("aria-current", index === step);
    if (index === step) button.setAttribute("aria-current", "step");
    button.setAttribute("aria-label", `${button.title}, step ${index + 1}`);
    button.querySelector("b").textContent = index < furthest || finished ? "\u2713" : String(index + 1);
  }
  get("step-count").textContent = finished ? "INSTALLATION COMPLETE" : `STEP ${step + 1} OF 5`;
  get("footer-status").lastChild.textContent = finished ? "Welcome to your new home" : busy ? "Keep your terminal open during setup" : "Made for your own Cloudflare account";
}

function showStep(next) {
  step = next;
  furthest = Math.max(furthest, step);
  for (const panel of panels) {
    panel.hidden = Number(panel.dataset.panel) !== step;
    panel.classList.remove("entering");
  }
  const panel = panels[step];
  void panel.offsetWidth;
  panel.classList.add("entering");
  controls();
  const heading = panel.querySelector("h1");
  heading?.focus({ preventScroll: true });
}

function validStep(index) {
  if (index === 0 && !connected) { localError = "Connect your Cloudflare account to continue."; error(localError); return false; }
  const inputs = panels[index].querySelectorAll("input, select, textarea");
  for (const input of inputs) {
    if (input.closest("[hidden]") || !input.willValidate) continue;
    if (!input.checkValidity()) { input.reportValidity(); return false; }
  }
  localError = "";
  error("");
  return true;
}

get("next").onclick = () => { if (validStep(step)) showStep(Math.min(4, step + 1)); };
get("back").onclick = () => showStep(Math.max(0, step - 1));
for (const button of stepButtons) button.onclick = () => {
  const target = Number(button.dataset.step);
  if (target > step && !validStep(step)) return;
  showStep(target);
};
get("help").onclick = () => get("help-dialog").showModal();
get("close-help").onclick = () => get("help-dialog").close();
const previewPane = document.querySelector(".preview-pane");
for (const button of document.querySelectorAll("[data-open-preview]")) button.onclick = () => {
  get("preview-dialog").append(previewPane);
  get("preview-dialog").showModal();
};
get("close-preview").onclick = () => get("preview-dialog").close();
get("preview-dialog").addEventListener("close", () => document.querySelector(".window-body").append(previewPane));

function updateLogin() {
  const mode = form.elements.login.value;
  get("github-fields").hidden = mode === "password";
  get("password-field").hidden = mode === "github";
  form.elements.password.required = mode !== "github";
  for (const key of ["githubUsername", "githubClientId", "githubClientSecret"]) form.elements[key].required = mode !== "password";
}

function preview() {
  const values = form.elements;
  const name = values.displayName.value.trim();
  const address = values.name.value.trim();
  const subdomain = get("subdomain").value.trim();
  const siteAddress = address ? `${address}${subdomain ? `.${subdomain}` : ""}.workers.dev` : "my-home.workers.dev";
  get("preview-name").textContent = name || "Your name here";
  get("preview-title").textContent = name || "MyHome";
  get("preview-username").textContent = `@${values.username.value.trim() || "your-name"}`;
  get("preview-status").textContent = values.status.value || "A new corner of the internet";
  get("preview-tagline").textContent = values.tagline.value;
  const card = document.querySelector(".preview-window");
  card.style.borderRadius = `${values.borderRadius.value}px`;
  card.style.color = values.textColor.value;
  document.querySelector(".preview-about").style.backgroundColor = values.panelColor.value;
  get("preview-bio").textContent = values.bio.value || "Every home starts with a little hello.";
  get("preview-address").textContent = siteAddress;
  get("callback").textContent = address && subdomain ? `https://${siteAddress}/api/github/callback` : "Enter your site address and Workers subdomain";
  document.documentElement.style.setProperty("--accent", values.accent.value);
  document.documentElement.style.setProperty("--site-font", fonts[values.fontFamily.value]);
  document.body.classList.toggle("motion-off", !values.animations.checked);
  get("review-name").textContent = name || "MyHome";
  get("review-address").textContent = siteAddress;
  get("review-login").textContent = logins[values.login.value];
  get("review-storage").textContent = values.uploads.checked ? "D1 database + R2 uploads" : "D1 database";
  const signature = JSON.stringify([name, values.username.value, values.bio.value, values.accent.value, values.fontFamily.value]);
  if (signature !== lastPreview) {
    const window = document.querySelector(".preview-window");
    window.classList.remove("updated"); void window.offsetWidth; window.classList.add("updated");
    lastPreview = signature;
  }
  const password = values.password.value;
  const score = password.length < 12 ? (password.length ? 1 : 0) : 2 + Number(/[A-Z]/.test(password) && /[a-z]/.test(password)) + Number(/\d/.test(password) && /[^a-z0-9]/i.test(password));
  get("password-strength").style.width = `${score * 25}%`;
  get("password-strength").style.background = ["#c8d5da", "#d2856d", "#c5ae64", "#72a686", "#47a582"][score];
  get("password-hint").textContent = ["Use a unique password.", "Use at least 12 characters.", "Long enough. Add mixed characters for more strength.", "Good password strength.", "Strong password."][score];
  controls();
}

get("login").addEventListener("change", updateLogin);
form.addEventListener("input", (event) => {
  if (event.target.name === "palette") form.elements.accent.value = event.target.value;
  if (event.target.name === "accent") for (const radio of form.querySelectorAll('[name="palette"]')) radio.checked = radio.value === event.target.value;
  localError = ""; error(lastServerError); preview();
});
form.addEventListener("change", preview);

get("connect").onclick = async () => {
  busy = true; connectionPending = true; controls();
  get("connection").textContent = "Opening Cloudflare login...";
  try { await api("connect", {}); }
  catch (cause) { localError = cause.message; error(localError); busy = false; connectionPending = false; controls(); }
};

form.onsubmit = async (event) => {
  event.preventDefault();
  if (busy || finished) return;
  if (step < 4) { if (validStep(step)) showStep(step + 1); return; }
  for (let index = 0; index < panels.length; index++) {
    showStep(index);
    if (!validStep(index)) return;
  }
  const values = Object.fromEntries(new FormData(form));
  values.uploads = form.elements.uploads.checked;
  values.animations = form.elements.animations.checked;
  busy = true; installing = true; controls();
  get("review").hidden = true; get("progress").hidden = false;
  get("stage").textContent = "Installing MyHome";
  form.setAttribute("aria-busy", "true");
  try {
    await api("deploy", values);
    form.elements.password.value = "";
    form.elements.githubClientSecret.value = "";
  } catch (cause) {
    localError = cause.message; error(localError); busy = false; installing = false;
    get("review").hidden = false; get("progress").hidden = true; controls();
  }
};

get("copy").onclick = async () => {
  try { await navigator.clipboard.writeText(get("recovery").value); get("copy").title = "Copied"; get("copy").setAttribute("aria-label", "Recovery code copied"); }
  catch { get("recovery").select(); }
};

function installProgress(stage) {
  const phases = { "Checking the site address": [8, 0], "Creating your database": [16, 0], "Preparing the site": [24, 0], "Creating the owner account": [35, 1], "Checking your GitHub account": [42, 1], "Creating upload storage": [48, 0], "Building your site": [60, 2], "Deploying to Cloudflare": [75, 2], "Securing owner login": [88, 2], "Checking the published site": [95, 3], "Your site is ready": [100, 4] };
  const [amount, active] = phases[stage] || [5, 0];
  get("install-meter").style.width = `${amount}%`;
  for (const [index, task] of [...get("install-tasks").children].entries()) { task.classList.toggle("done", index < active); task.classList.toggle("active", index === active); }
}

async function poll() {
  try {
    const state = await api("state");
    connected = state.connected; busy = state.busy; finished = Boolean(state.url);
    if (!busy) connectionPending = false;
    get("connection").textContent = connected ? "Connected to your Cloudflare account" : connectionPending ? "Waiting for Cloudflare login..." : "Not connected";
    get("account-status").textContent = connected ? "Cloudflare connected. Your site, your control." : "Your Cloudflare account. Your site, your control.";
    if (state.stage !== lastStage && installing) { get("stage").textContent = state.stage; installProgress(state.stage); lastStage = state.stage; }
    get("logs").textContent = state.logs.join("");
    lastServerError = state.error;
    error(localError || state.error);
    if (installing && !busy && state.error) { get("review").hidden = false; get("progress").hidden = false; form.removeAttribute("aria-busy"); }
    if (finished) {
      form.hidden = true; get("success").hidden = false;
      get("site-link").href = state.url; get("admin-link").href = `${state.url}/#/admin`;
      get("recovery").value = state.recoveryCode;
      get("preview-address").textContent = new URL(state.url).hostname;
      get("success").querySelector("h1").focus({ preventScroll: true });
    }
    controls();
  } catch (cause) { error(cause.message); }
  if (!finished) setTimeout(poll, 1000);
}

updateLogin(); preview();
if (token) void poll();
else { localError = "Open the setup link printed in your terminal."; error(localError); get("connect").disabled = true; get("next").disabled = true; }
