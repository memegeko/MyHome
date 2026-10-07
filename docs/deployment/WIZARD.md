# Browser deployment wizard

The installer runs on your own Windows, Linux, or macOS computer. It opens a
local browser page and uses Cloudflare's Wrangler login. Each owner deploys
into their own Cloudflare account and retains dashboard access to the Worker,
D1 database, and optional R2 bucket.

Install Node.js **22.18 or newer** (Node 24 LTS is recommended) and Git, then run
the same commands in PowerShell or a Linux terminal:

```sh
git clone https://github.com/memegeko/MyHome.git
cd MyHome
npm ci
npm run setup:cloudflare
```

Keep the terminal open until deployment finishes. If the browser does not open,
use the URL printed in the terminal. That link contains a private local setup
session; do not share it. The installer listens only on your computer's loopback
interface, requires its session token for API requests, and checks the request
host and origin.

## Setup

1. Connect Cloudflare. Existing Wrangler authentication is reused; otherwise
   Cloudflare's login page opens.
2. Copy your account ID from **Workers & Pages** in your Cloudflare dashboard.
   Set up your account's Workers subdomain there if this is your first Worker.
3. Choose the site's address prefix, display name, username, bio, and accent.
   The Personalize step offers Aero glass colors, fonts, and an animation toggle
   with a live profile preview. These choices are saved to your deployed site.
   The free address is `site.account-subdomain.workers.dev`. A custom domain can
   be attached later through the Worker's **Settings > Domains & Routes**.
4. Choose password, GitHub, or both for owner login. Supply an owner email even
   for GitHub login so recovery can enable password access if necessary.
5. Leave R2 off for a deployment without upload storage. External media URLs work
   without R2. Cloudflare may require billing activation for R2, even within its
   free allowance; platform usage limits still apply.
6. Confirm deployment. The installer creates a dedicated D1 database, seeds the
   owner before publishing, builds the site, deploys the Worker, sets secrets,
   and checks that the site's API returns configured content.
7. Open the resulting site/admin links and save your recovery code privately.
   Close the terminal with Ctrl+C when finished.

Use a new site address for a new installation. Existing Workers and owners are
never replaced by a fresh installation. If setup fails, the progress log explains the failed
step; retry in the same wizard. Deployment state lives in ignored
`.cache/deploy/<site>/`. An interrupted setup retains a private `pending.json`
there with the session secret and recovery code to allow resuming. It is removed
after a successful deployment. Do not commit or share this directory. Resource
creation is not automatically rolled back after a failed deployment; resources
remain visible in your Cloudflare dashboard.

## GitHub login

Create an OAuth app at <https://github.com/settings/applications/new> in the
owner's GitHub account. Set its homepage to your future site address and its
callback to:

```text
https://site.account-subdomain.workers.dev/api/github/callback
```

The wizard shows this URL when you enter the site prefix and Workers subdomain.
Enter the OAuth app's client ID and client secret and your GitHub username.
The installer resolves the username to a stable numeric GitHub account ID.
Only that account can sign in. No repository permissions are requested.
The client secret is stored as a Cloudflare Worker secret.

If you later use a custom domain for admin login, update the OAuth callback to
the same domain followed by `/api/github/callback`.

## Preview and publish

Open `/#/admin` (or `/admin`) and sign in. **Save draft** stores edits privately
in D1 without changing the public document. **Preview** renders the draft.
**Publish** updates the public document and saved draft together. Public visitors
see it on their next visit; already-open pages check for updates every 30 seconds
while visible and when the window regains focus.

## Recovery

Choose **Use recovery key** in the owner login, enter your recovery code, and
choose a new password of at least 12 characters. Save the replacement recovery
code shown afterward, then sign in with the owner email and new password.
Recovery codes are single-use, stored hashed, and rotated after a successful
reset. Resetting the password invalidates existing owner sessions.

Advanced owners who have lost the code can use their Cloudflare dashboard:

1. Open the Worker's **Settings > Variables and Secrets**.
2. Add a **secret** named `RECOVERY_OVERRIDE_CODE` with a new cryptographically
   random code of at least 32 characters. For example, generate one locally with
   `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"`.
3. Deploy the secret change and use that code in the same recovery form.
4. Save the replacement code and delete `RECOVERY_OVERRIDE_CODE` from Cloudflare.

An override code is also single-use. Rotating `SESSION_SECRET` is not a password
reset: passwords are bound to that secret. Keep it unchanged during recovery.

## Updating the deployed application

The wizard saves a deployment config at
`.cache/deploy/<site>/wrangler.jsonc`. Keep it for future application updates:

```sh
npm run build:server
npx wrangler d1 migrations apply DB --remote --config .cache/deploy/<site>/wrangler.jsonc
npx wrangler deploy --config .cache/deploy/<site>/wrangler.jsonc
```

Profile/theme edits through admin need no rebuild or redeploy. Installing code
updates is a separate deployment. Existing manual deployments should apply the
new migrations before using drafts/recovery. Existing owners without a recovery
code can use the Cloudflare override procedure to create one.

### Additional personalization

Profile setup includes a tagline, status and avatar URL. Open **More
personalization** to set the site title and subtitle, background URL and fit,
text and panel colors, corner radius, spacing, and particle type and amount.
These preferences initialize the site's document and remain editable in the
admin panel. The preview illustrates profile, font, colors and corners;
backgrounds and particles are rendered by the deployed site.

Refreshing the installer in the same tab preserves its session. Keep the
installer process running; a restarted process prints a new setup link.
