# Static edition

The static edition runs on GitHub Pages, Netlify, Cloudflare Pages, an ordinary
web server, or directly from a local development server. It does not require a
database or owner login.

## First run

1. Install dependencies with `npm install`.
2. Start the studio with `npm run dev`.
3. Open the shown local address.
4. Complete the first-run wizard.
5. Open **Customize → Import & export → Export full ZIP**.

The setup studio stores unsaved media and content in IndexedDB in the current
browser. A different device will not see those local edits.

## Publish the content

The full ZIP contains:

- `myhome.json` — theme, layout, pages, blocks and content;
- `assets/` — every locally uploaded image and audio file;
- `myhome-backup.json` — the importable backup manifest; and
- a short `README.txt`.

Extract `myhome.json` and `assets/` into `public/`, then run:

```sh
npm run build:static
```

Publish the generated `dist/` directory.

External image and audio URLs remain external references. They are not copied
into the ZIP.

## GitHub Pages

The included Pages workflow builds and deploys the static edition. Enable
**Settings → Pages → GitHub Actions** in your fork. Commit your configured
`public/myhome.json` and `public/assets/` files, then push.

## Manual configuration

Developers can edit:

- `public/myhome.json` for content and layout;
- `src/config/developer.ts` for runtime paths and studio behavior; and
- `presets/*.json` for portable visual presets.

Keep `formatVersion` at `1` unless a future MyHome release documents a
migration.
