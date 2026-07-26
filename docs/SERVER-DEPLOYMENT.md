# Server edition: Cloudflare Workers

The first server adapter uses:

- a Cloudflare Worker for the application and API;
- D1 for the single owner account, sessions and site content;
- R2 for uploaded images and audio; and
- Workers Static Assets for the built frontend.

The owner login is application-owned. It does not use ChatGPT, GitHub, or a
third-party identity service.

## Requirements

- Node.js 22 or newer
- A Cloudflare account
- Wrangler authentication (`npx wrangler login`)

## Create storage

Create the D1 database:

```sh
npx wrangler d1 create myhome
```

Copy the returned database ID into `wrangler.jsonc`.

Create the R2 bucket:

```sh
npx wrangler r2 bucket create myhome-media
```

If you choose another bucket name, update `wrangler.jsonc`.

Apply the database migration:

```sh
npx wrangler d1 migrations apply myhome --remote
```

## Configure the session secret

Generate a long random value with your password manager or operating system,
then store it as a Worker secret:

```sh
npx wrangler secret put SESSION_SECRET
```

Do not commit the secret. It is used as additional password-hash input and when
hashing session tokens.

## Deploy

```sh
npm install
npm run deploy:server
```

Open the deployed address. A fresh database begins with the setup wizard. The
wizard creates exactly one owner account; later attempts to create another
owner are rejected.

## Local server development

Copy `.dev.vars.example` to `.dev.vars` and replace its placeholder secret.
Then run:

```sh
npx wrangler d1 migrations apply myhome --local
npm run dev:server
```

Local D1 and R2 data are stored by Wrangler and are excluded from Git.

## Upload behavior

Images up to 10 MB and audio up to 18 MB are divided into 1 MB requests. Each
part is retried up to three times. The Worker joins verified parts in R2 and
returns a stable `/api/assets/<id>` URL.

This avoids gateway failures that can occur when a whole MP3 is sent in one
request.

## Backups

The admin studio exports one ZIP containing the document and every local R2
asset referenced by it. Importing that ZIP uploads its files into the target
server's R2 bucket before saving the restored document.
