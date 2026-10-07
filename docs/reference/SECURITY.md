# Security model

> [View the complete static showcase](https://memegeko.github.io/MyHome/?demo=showcase) · [Download the importable example ZIP](https://memegeko.github.io/MyHome/examples/myhome-showcase.zip)

## Static edition

- Static Studio encrypts the full owner document with AES-256-GCM.
- Password and recovery-key encryption keys use separate random salts and
  PBKDF2-SHA-256 derivation.
- Public exports omit pages, sections and contact links marked private.
- Fine-grained GitHub publishing tokens stay in component memory and are
  cleared after publishing.
- Static deployments cannot enforce server-side rate limits. Because encrypted
  repository files can be downloaded and attacked offline, owners should heed
  the password-strength warning and use a unique password.

## One owner

The server edition stores one owner row with the fixed identifier `1`.
First-run setup is rejected after that row exists.

## Password storage

Passwords are never stored in configuration or plain text. The Worker derives
a hash with PBKDF2-HMAC-SHA-256, a unique random salt, 100,000 iterations (the
Workers Web Crypto limit), and
the deployment's `SESSION_SECRET`.

Use a unique password of at least 12 characters and protect the Cloudflare
account that controls the deployment.

## Sessions

- Session tokens are generated from 32 random bytes.
- Only a SHA-256 hash of the token and deployment secret is stored in D1.
- Cookies are `HttpOnly`, `SameSite=Strict`, scoped to `/`, and `Secure` on
  HTTPS deployments.
- Sessions expire after 14 days.
- Signing out removes the stored session.

## Request protection

- Content writes, setup, login, logout, recovery and uploads require the same origin.
- Admin API routes require a valid owner session.
- Content documents are size-limited and reject `javascript:` URLs.
- React escapes user-authored text.
- Responses include a restrictive Content Security Policy, frame protection,
  referrer policy and MIME sniffing protection.
- Login, recovery and GitHub authorization starts are limited to 10 attempts
  per IP address in 15 minutes using atomic counters in D1.
- Public content responses omit private pages, their blocks, private blocks,
  and private contact links. Drafts are accessible only to the owner.

## GitHub and recovery

GitHub OAuth uses a random, short-lived, single-use state bound to an HttpOnly
cookie. Only the configured numeric GitHub owner ID is accepted. The OAuth
client secret is a Worker secret; no repository scopes are requested.

Recovery codes are hashed with the deployment secret and rotated atomically
after use. Password resets invalidate all sessions. Cloudflare owners can set
a temporary single-use `RECOVERY_OVERRIDE_CODE` secret when the saved code is
lost. See the [wizard guide](../deployment/WIZARD.md) for the recovery procedure.

The browser installer seeds the owner before deploying and sets `SETUP_LOCKED`
to disable public first-run setup. Failed deployment state is kept in ignored
local files with private file permissions where supported by the OS.

## Uploads

- Only JPEG, PNG, WebP, GIF, MP3, WAV, OGG and M4A are accepted.
- Images are limited to 10 MB and audio to 18 MB.
- Chunk identifiers, sizes, order and R2 ETags are verified before assembly.
- Public asset responses use stored MIME types and `nosniff`.

## Reporting a vulnerability

Do not open a public issue containing secrets or an exploit against somebody's
deployed site. Contact the repository owner privately through the contact
method listed on their GitHub profile.
