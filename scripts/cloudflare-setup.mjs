import http from "node:http";
import { spawn } from "node:child_process";
import { randomBytes, pbkdf2Sync, createHash } from "node:crypto";
import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ArrowLeft, ArrowRight, Check, CircleHelp, Cloud, Copy, Download, ExternalLink, Eye, Globe, Info, Link, LockKeyhole, Palette, ShieldCheck, Sparkles, UserRound } from "lucide-react";
import { createBlankDocument } from "../src/defaults.ts";
import { validateSetup, ownerSeed } from "./cloudflare-setup-lib.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const token = randomBytes(32).toString("base64url");
const state = { busy: false, stage: "Ready", connected: false, logs: [], url: "", recoveryCode: "", error: "" };
const wrangler = path.join(root, "node_modules/wrangler/bin/wrangler.js");
let origin;
let deployment;
const icons = { back: ArrowLeft, next: ArrowRight, check: Check, help: CircleHelp, cloud: Cloud, copy: Copy, download: Download, external: ExternalLink, eye: Eye, globe: Globe, info: Info, link: Link, lock: LockKeyhole, palette: Palette, shield: ShieldCheck, sparkles: Sparkles, user: UserRound };

function log(message) {
  state.logs.push(message);
  state.logs = state.logs.slice(-80);
}

function run(args, { input, quiet = false, tool = wrangler } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [tool, ...args], {
      cwd: root, env: { ...process.env, CI: "true", NO_COLOR: "1", XDG_CONFIG_HOME: path.join(root, ".cache/xdg"), WRANGLER_SEND_METRICS: "false" },
      stdio: ["pipe", "pipe", "pipe"],
    });
    let output = "";
    child.on("error", reject);
    for (const stream of [child.stdout, child.stderr]) stream.on("data", (chunk) => {
      const text = chunk.toString().replace(/\x1b\[[0-9;]*m/g, "");
      output += text;
      if (!quiet) log(text);
    });
    child.stdin.on("error", () => {});
    child.stdin.end(input);
    child.on("close", (code) => {
      if (code === 0) resolve(output);
      else { const error = new Error(`Cloudflare setup command failed (${code}). Check the progress log.`); error.output = output; reject(error); }
    });
  });
}

async function deploy(raw) {
  const options = validateSetup(raw);
  if (deployment && deployment.name !== options.name) throw new Error("Restart the installer to deploy a different site.");
  const dir = path.join(root, ".cache/deploy", options.name);
  await mkdir(dir, { recursive: true, mode: 0o700 });
  const configPath = path.join(dir, "wrangler.jsonc");
  if (!deployment) {
    // Keep a failed first deployment resumable without replacing an existing owner.
    const saved = await readFile(path.join(dir, "pending.json"), "utf8").catch(() => null);
    deployment = saved ? JSON.parse(saved) : { name: options.name, secret: randomBytes(32).toString("base64url"), recoveryCode: randomBytes(32).toString("base64url"), seeded: false };
  }
  const persist = () => writeFile(path.join(dir, "pending.json"), JSON.stringify(deployment), { mode: 0o600 });
  await persist();
  let config = await readFile(configPath, "utf8").then(JSON.parse).catch(() => null);
  if (!config) {
    config = {
      name: options.name, account_id: options.accountId, main: path.join(root, "server/worker.ts"),
      compatibility_date: "2026-07-01", workers_dev: true,
      assets: { directory: path.join(root, "dist"), binding: "ASSETS", not_found_handling: "single-page-application", run_worker_first: ["/api/*"] },
      vars: { SETUP_LOCKED: "true" },
    };
    await writeFile(configPath, JSON.stringify(config, null, 2), { mode: 0o600 });
  }
  if (config.account_id !== options.accountId) throw new Error("This site is already associated with another account. Choose a new site address.");
  if (!deployment.checkedName) {
    state.stage = "Checking the site address";
    try {
      await run(["deployments", "list", "--json", "--config", configPath], { quiet: true });
      throw new Error("A Worker already uses this site address. Choose a new address to avoid replacing it.");
    } catch (error) {
      // Cloudflare's missing-Worker code is the only failure that means the name is free.
      if (!/\[code:\s*10007\]/.test(error.output || "")) throw error;
    }
    deployment.checkedName = true;
    await persist();
  }
  if (!config.d1_databases?.length) {
    state.stage = "Creating your database";
    await run(["d1", "create", `${options.name}-content`, "--config", configPath, "--binding", "DB", "--update-config"]);
    config = JSON.parse(await readFile(configPath, "utf8"));
    config.d1_databases[0].migrations_dir = path.join(root, "server/migrations");
    await writeFile(configPath, JSON.stringify(config, null, 2));
  }
  state.stage = "Preparing the site";
  await run(["d1", "migrations", "apply", "DB", "--remote", "--config", configPath]);
  if (!deployment.seeded) {
    state.stage = "Creating the owner account";
    const document = createBlankDocument();
    document.configured = true;
    document.siteTitle = options.siteTitle || options.displayName;
    document.siteSubtitle = options.siteSubtitle;
    document.profile = { ...document.profile, displayName: options.displayName, username: options.username, bio: options.bio, tagline: options.tagline, status: options.status };
    document.profile.avatar.src = options.avatarUrl;
    Object.assign(document.appearance, options.appearance);
    document.appearance.background.src = options.backgroundUrl;
    document.appearance.accent = options.accent;
    document.appearance.fontFamily = options.fontFamily;
    document.appearance.headingFontFamily = options.fontFamily;
    document.appearance.animationsEnabled = options.animations;
    const salt = randomBytes(16);
    const password = options.password || randomBytes(48).toString("base64url");
    const hash = pbkdf2Sync(`${password}\0${deployment.secret}`, salt, 100000, 32, "sha256").toString("base64");
    const recoveryHash = createHash("sha256").update(`${deployment.recoveryCode}\0${deployment.secret}`).digest("base64");
    const seed = path.join(dir, "seed.sql");
    await writeFile(seed, ownerSeed({ email: options.email, hash, salt: salt.toString("base64"), recoveryHash, document }), { mode: 0o600 });
    try { await run(["d1", "execute", "DB", "--remote", "--config", configPath, "--file", seed], { quiet: true }); }
    catch { throw new Error("Owner initialization failed. Existing owners cannot be replaced; check the D1 database in Cloudflare or choose a new site address."); }
    finally { await rm(seed, { force: true }); }
    deployment.seeded = true;
    await persist();
  }
  const secrets = { SESSION_SECRET: deployment.secret };
  if (options.login === "github" || options.login === "both") {
    state.stage = "Checking your GitHub account";
    const response = await fetch(`https://api.github.com/users/${encodeURIComponent(options.githubUsername)}`, { headers: { "user-agent": "MyHome-Setup" } });
    if (!response.ok) throw new Error("GitHub account was not found. Check the username and retry.");
    const user = await response.json();
    config.vars.OWNER_GITHUB_ID = String(user.id);
    config.vars.GITHUB_CLIENT_ID = options.githubClientId;
    secrets.GITHUB_CLIENT_SECRET = options.githubClientSecret;
  } else {
    delete config.vars.OWNER_GITHUB_ID;
    delete config.vars.GITHUB_CLIENT_ID;
  }
  if (options.uploads && !config.r2_buckets?.length) {
    state.stage = "Creating upload storage";
    await run(["r2", "bucket", "create", `${options.name}-media`, "--config", configPath]);
    config.r2_buckets = [{ binding: "MEDIA", bucket_name: `${options.name}-media` }];
  }
  await writeFile(configPath, JSON.stringify(config, null, 2));
  state.stage = "Building your site";
  await run(["-b"], { tool: path.join(root, "node_modules/typescript/bin/tsc") });
  await run(["-p", "tsconfig.worker.json"], { tool: path.join(root, "node_modules/typescript/bin/tsc") });
  await run(["build", "--mode", "server"], { tool: path.join(root, "node_modules/vite/bin/vite.js") });
  state.stage = "Deploying to Cloudflare";
  const output = await run(["deploy", "--config", configPath]);
  const siteUrl = output.match(/https:\/\/[a-z0-9-]+\.[a-z0-9-]+\.workers\.dev\b/i)?.[0];
  if (!siteUrl) throw new Error("Deployment finished but no workers.dev address was returned. Check that workers.dev is enabled in Cloudflare.");
  state.stage = "Securing owner login";
  await run(["secret", "bulk", "--config", configPath], { input: JSON.stringify(secrets), quiet: true });
  state.stage = "Checking the published site";
  const response = await fetch(`${siteUrl}/api/site`);
  const result = await response.json();
  if (!response.ok || !result.document?.configured) throw new Error("The site did not pass its first health check. Retry setup.");
  state.url = siteUrl;
  state.recoveryCode = deployment.recoveryCode;
  state.stage = "Your site is ready";
  await rm(path.join(dir, "pending.json"), { force: true });
}

const server = http.createServer(async (request, response) => {
  response.setHeader("cache-control", "no-store");
  response.setHeader("x-content-type-options", "nosniff");
  response.setHeader("content-security-policy", "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
  const reply = (body, status = 200) => { response.writeHead(status, { "content-type": "application/json" }); response.end(JSON.stringify(body)); };
  if (request.headers.host !== new URL(origin).host) return reply({ error: "Host rejected." }, 403);
  const url = new URL(request.url, origin);
  if (url.pathname.startsWith("/api/")) {
    if (request.headers.authorization !== `Bearer ${token}` || (request.method !== "GET" && request.headers.origin !== origin)) return reply({ error: "Installer session rejected." }, 403);
    if (url.pathname === "/api/state" && request.method === "GET") return reply(state);
    if (request.method !== "POST") return reply({ error: "Method not allowed." }, 405);
    if (state.busy || state.url) return reply({ error: "Setup is already running or completed." }, 409);
    let bytes = 0;
    const chunks = [];
    for await (const chunk of request) { bytes += chunk.length; if (bytes > 16384) return reply({ error: "Request too large." }, 413); chunks.push(chunk); }
    let body;
    try { body = JSON.parse(Buffer.concat(chunks).toString() || "{}"); }
    catch { return reply({ error: "Invalid request." }, 400); }
    if (!["/api/connect", "/api/deploy"].includes(url.pathname)) return reply({ error: "Not found." }, 404);
    if (url.pathname === "/api/deploy") {
      if (!state.connected) return reply({ error: "Connect Cloudflare first." }, 400);
      try { validateSetup(body); } catch (error) { return reply({ error: error.message }, 400); }
    }
    state.busy = true; state.error = "";
    reply({ started: true }, 202);
    try {
      if (url.pathname === "/api/connect") {
        state.stage = "Connecting Cloudflare";
        let identity = await run(["whoami"]);
        if (identity.includes("You are not authenticated")) {
          await run(["login"]);
          identity = await run(["whoami"]);
        }
        if (identity.includes("You are not authenticated")) throw new Error("Cloudflare login did not complete. Try connecting again.");
        state.connected = true; state.stage = "Cloudflare connected";
      } else await deploy(body);
    } catch (error) { state.error = error.message; state.stage = "Setup needs attention"; }
    finally { state.busy = false; }
    return;
  }
  const icon = /^\/icons\/([a-z]+)\.svg$/.exec(url.pathname)?.[1];
  if (request.method === "GET" && icon && icons[icon]) {
    response.writeHead(200, { "content-type": "image/svg+xml" });
    response.end(renderToStaticMarkup(createElement(icons[icon], { color: "#426b81", strokeWidth: 1.6, size: 24 })));
    return;
  }
  const files = { "/": ["index.html", "text/html"], "/setup.js": ["setup.js", "text/javascript"], "/setup.css": ["setup.css", "text/css"], "/wallpaper.png": ["wallpaper.png", "image/png"], "/myhome.svg": ["../../public/myhome.svg", "image/svg+xml"] };
  const asset = files[url.pathname];
  if (!asset || request.method !== "GET") return reply({ error: "Not found." }, 404);
  response.writeHead(200, { "content-type": asset[1] });
  response.end(await readFile(new URL(`./setup/${asset[0]}`, import.meta.url)));
});

server.listen(0, "127.0.0.1", () => {
  origin = `http://127.0.0.1:${server.address().port}`;
  const link = `${origin}/#${token}`;
  console.log(`MyHome setup: ${link}\nLeave this terminal open during setup. Press Ctrl+C when finished.`);
  const command = process.platform === "win32" ? "rundll32" : process.platform === "darwin" ? "open" : "xdg-open";
  const args = process.platform === "win32" ? ["url.dll,FileProtocolHandler", link] : [link];
  const browser = spawn(command, args, { stdio: "ignore", detached: true });
  browser.on("error", () => console.log("Open the setup link in your browser."));
  browser.unref();
});
