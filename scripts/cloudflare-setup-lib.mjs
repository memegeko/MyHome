export function validateSetup(input) {
  const text = (key) => typeof input?.[key] === "string" ? input[key].trim() : "";
  const name = text("name");
  const accountId = text("accountId");
  const email = text("email").toLowerCase();
  const login = text("login");
  const password = typeof input?.password === "string" ? input.password : "";
  if (!/^[a-z][a-z0-9-]{2,39}$/.test(name)) throw new Error("Site address must be 3-40 lowercase letters, numbers, or hyphens, starting with a letter.");
  if (!/^[a-f0-9]{32}$/i.test(accountId)) throw new Error("Enter the 32-character Cloudflare account ID from your dashboard.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new Error("Enter an owner email address.");
  if (!["password", "github", "both"].includes(login)) throw new Error("Choose a login method.");
  if (login !== "github" && (password.length < 12 || password.length > 256)) throw new Error("Use a password of 12-256 characters.");
  if (!text("displayName") || text("displayName").length > 100) throw new Error("Enter a display name of up to 100 characters.");
  if (!/^[a-z0-9_-]{1,40}$/i.test(text("username"))) throw new Error("Enter a username using letters, numbers, underscores, or hyphens.");
  if (!/^#[a-f0-9]{6}$/i.test(text("accent"))) throw new Error("Choose an accent color.");
  if (login !== "password" && (!/^[a-z0-9-]{1,39}$/i.test(text("githubUsername")) || !text("githubClientId") || !text("githubClientSecret"))) throw new Error("Enter your GitHub username and OAuth app credentials.");
  const fonts = { segoe: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif', tahoma: 'Tahoma, Geneva, sans-serif', trebuchet: '"Trebuchet MS", sans-serif' };
  const fontKey = text("fontFamily") || "segoe";
  if (!Object.hasOwn(fonts, fontKey)) throw new Error("Choose one of the available fonts.");
  const choice = (key, allowed, fallback) => {
    const value = text(key) || fallback;
    if (!allowed.includes(value)) throw new Error(`Choose a valid ${key}.`);
    return value;
  };
  const color = (key, fallback) => {
    const value = text(key) || fallback;
    if (!/^#[a-f0-9]{6}$/i.test(value)) throw new Error(`Choose a valid ${key}.`);
    return value;
  };
  const number = (key, max, fallback) => {
    const value = input[key] === undefined ? fallback : Number(input[key]);
    if (!Number.isInteger(value) || value < 0 || value > max) throw new Error(`Choose a valid ${key}.`);
    return value;
  };
  const media = (key) => {
    const value = text(key);
    if (!value) return "";
    if (value.length > 2048 || !["https:", "http:"].includes(new URL(value).protocol)) throw new Error("Use an HTTP or HTTPS image URL.");
    return value;
  };
  const appearance = { backgroundMode: choice("backgroundMode", ["cover", "contain", "tile", "stretch"], "cover"), backgroundPosition: choice("backgroundPosition", ["center", "top", "bottom", "left", "right"], "center"), textColor: color("textColor", "#17445b"), panelColor: color("panelColor", "#effbff"), borderRadius: number("borderRadius", 40, 18), contentSpacing: number("contentSpacing", 48, 20), particleType: choice("particleType", ["bubbles", "sparkles", "snow", "none"], "bubbles"), particleAmount: number("particleAmount", 60, 18) };
  return { appearance, avatarUrl: media("avatarUrl"), backgroundUrl: media("backgroundUrl"), siteTitle: text("siteTitle").slice(0, 200), siteSubtitle: text("siteSubtitle").slice(0, 300), tagline: text("tagline").slice(0, 200), status: text("status").slice(0, 200), name, accountId, email, login, password, displayName: text("displayName"), username: text("username"), bio: text("bio").slice(0, 4000), accent: text("accent"), fontFamily: fonts[fontKey], animations: input.animations !== false, githubUsername: text("githubUsername"), githubClientId: text("githubClientId"), githubClientSecret: text("githubClientSecret"), uploads: input.uploads === true };
}

export function ownerSeed({ email, hash, salt, recoveryHash, document }) {
  const literal = (value) => `'${String(value).replaceAll("'", "''")}'`;
  return `INSERT INTO myhome_owner (id, email, password_hash, password_salt, password_iterations) VALUES (1, ${literal(email)}, ${literal(hash)}, ${literal(salt)}, 100000);
INSERT INTO myhome_recovery (id, code_hash) VALUES (1, ${literal(recoveryHash)});
INSERT INTO myhome_content (id, document) VALUES (1, ${literal(JSON.stringify(document))});`;
}
