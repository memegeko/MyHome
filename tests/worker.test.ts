import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Miniflare } from "miniflare";
import worker from "../server/worker";
import { createBlankDocument } from "../src/defaults";

type Env = Parameters<typeof worker.fetch>[1];
const origin = "https://test.example";
const password = "Strong-Test-Password-42!";
const recovery = "test-recovery-code-with-at-least-32-characters";
let mf: Miniflare;
let env: Env;

async function request(route: string, method = "GET", body?: unknown, cookie?: string, requestOrigin: string | null = origin) {
  const headers = new Headers();
  if (requestOrigin) headers.set("origin", requestOrigin);
  if (body) headers.set("content-type", "application/json");
  if (cookie) headers.set("cookie", cookie);
  return worker.fetch(new Request(`${origin}/api/${route}`, { method, headers, ...(body ? { body: JSON.stringify(body) } : {}) }), env);
}

async function setup() {
  const document = createBlankDocument();
  document.configured = true;
  document.siteTitle = "Published title";
  const response = await request("setup", "POST", { owner: { email: "owner@example.com", password, recoveryKey: recovery }, document });
  expect(response.status).toBe(201);
  return { document, cookie: response.headers.get("set-cookie")!.split(";")[0] };
}

beforeEach(async () => {
  mf = new Miniflare({ modules: true, script: "export default { fetch() { return new Response('OK'); } }", d1Databases: ["DB"] });
  env = { DB: await mf.getD1Database("DB") as unknown as Env["DB"], SESSION_SECRET: "test-session-secret-at-least-32-characters", ASSETS: { fetch: async () => new Response("assets") } as Env["ASSETS"] };
});
afterEach(async () => { vi.unstubAllGlobals(); await mf.dispose(); });

describe("Worker owner and publishing", () => {
  it("keeps drafts private and changes the public site only on publish", async () => {
    const { document, cookie } = await setup();
    const draft = { ...document, siteTitle: "Private draft" };
    expect((await request("draft", "PUT", { document: draft })).status).toBe(401);
    expect((await request("draft", "PUT", { document: draft }, cookie, "https://evil.example")).status).toBe(403);
    expect((await request("draft", "PUT", { document: draft }, cookie, null)).status).toBe(403);
    expect((await request("draft", "PUT", { document: draft }, cookie)).status).toBe(200);
    expect((await (await request("site")).json()).document.siteTitle).toBe("Published title");
    expect((await request("draft")).status).toBe(401);
    expect((await (await request("draft", "GET", undefined, cookie)).json()).document.siteTitle).toBe("Private draft");
    expect((await request("site", "PUT", { document: draft }, cookie)).status).toBe(200);
    expect((await (await request("site")).json()).document.siteTitle).toBe("Private draft");
  });

  it("rotates recovery codes, invalidates sessions, and rejects reuse", async () => {
    const { cookie } = await setup();
    const response = await request("recover", "POST", { code: recovery, password: "New-Strong-Password-43!" });
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.recoveryCode.length).toBeGreaterThanOrEqual(32);
    expect((await request("session", "GET", undefined, cookie)).status).toBe(401);
    expect((await request("recover", "POST", { code: recovery, password })).status).toBe(401);
    expect((await request("login", "POST", { email: "owner@example.com", password })).status).toBe(401);
    expect((await request("login", "POST", { email: "owner@example.com", password: "New-Strong-Password-43!" })).status).toBe(200);
  });

  it("omits private content from public responses while preserving the owner draft", async () => {
    const { document, cookie } = await setup();
    document.pages[0].private = true;
    document.blocks.push({ id: "private-note", type: "custom", pageId: document.pages[0].id, enabled: true, private: false, title: "Secret", icon: "", body: "Hidden page content", image: { src: "", alt: "", credit: "", sourceUrl: "" }, linkLabel: "", linkUrl: "" });
    document.socials.push({ id: "private-contact", label: "Secret contact", url: "https://secret.example", icon: "", private: true });
    expect((await request("site", "PUT", { document }, cookie)).status).toBe(200);
    const text = await (await request("site")).text();
    expect(text).not.toContain("Hidden page content");
    expect(text).not.toContain("secret.example");
    const draft = await (await request("draft", "GET", undefined, cookie)).text();
    expect(draft).toContain("Hidden page content");
  });

  it("allows a one-use Cloudflare recovery override and locks first-time setup", async () => {
    await setup();
    env.RECOVERY_OVERRIDE_CODE = "cloudflare-operator-code-at-least-32-characters";
    expect((await request("recover", "POST", { code: env.RECOVERY_OVERRIDE_CODE, password })).status).toBe(200);
    expect((await request("recover", "POST", { code: env.RECOVERY_OVERRIDE_CODE, password })).status).toBe(401);
    env.SETUP_LOCKED = "true";
    expect((await request("setup", "POST", {})).status).toBe(403);
  });

  it("limits repeated password attempts", async () => {
    await setup();
    for (let i = 0; i < 10; i++) expect((await request("login", "POST", { email: "owner@example.com", password: "wrong" })).status).toBe(401);
    expect((await request("login", "POST", { email: "owner@example.com", password })).status).toBe(429);
  });

  it("checks OAuth state, rejects another GitHub owner, and prevents callback replay", async () => {
    await setup();
    env.GITHUB_CLIENT_ID = "client"; env.GITHUB_CLIENT_SECRET = "secret"; env.OWNER_GITHUB_ID = "123";
    const start = await request("github");
    const state = new URL(start.headers.get("location")!).searchParams.get("state")!;
    const cookie = start.headers.get("set-cookie")!.split(";")[0];
    expect((await request(`github/callback?state=wrong&code=code`, "GET", undefined, cookie)).status).toBe(403);
    vi.stubGlobal("fetch", vi.fn(async (url: string) => url.includes("access_token") ? Response.json({ access_token: "token" }) : Response.json({ id: 999 })));
    expect((await request(`github/callback?state=${state}&code=code`, "GET", undefined, cookie)).status).toBe(403);
    expect((await request(`github/callback?state=${state}&code=code`, "GET", undefined, cookie)).status).toBe(403);
    const next = await request("github");
    const nextState = new URL(next.headers.get("location")!).searchParams.get("state")!;
    vi.stubGlobal("fetch", vi.fn(async (url: string) => url.includes("access_token") ? Response.json({ access_token: "token" }) : Response.json({ id: 123 })));
    const response = await request(`github/callback?state=${nextState}&code=code`, "GET", undefined, next.headers.get("set-cookie")!.split(";")[0]);
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/#/admin");
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
  });
});
