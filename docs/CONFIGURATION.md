# Configuration reference

MyHome separates content from the application. A fresh checkout contains a
blank `public/myhome.json`, so the first visitor sees the setup wizard.

## Pages

`pages` controls the public navigation:

```json
{
  "id": "projects",
  "label": "Projects",
  "icon": "▦",
  "enabled": true
}
```

The array order is the navigation order. Pages may be hidden, renamed and
reordered in the studio.

## Content blocks

Every block has:

- `id` — stable unique identifier;
- `type` — `about`, `projects`, `records`, `anime`, `gallery`, `people`,
  `places`, or `custom`;
- `pageId` — the page that contains it;
- `title` and `icon`;
- `enabled`; and
- type-specific content.

The block array order is the display order. Blocks can move between pages.

## Media

Every image field uses the same shape:

```json
{
  "src": "./assets/example.webp",
  "alt": "Description for screen readers",
  "credit": "Artist or photographer",
  "sourceUrl": "https://example.com/source"
}
```

`src` may be a local path or an external URL. The studio accepts local uploads
or external URLs for avatars, project covers, record covers, anime covers,
gallery images, people, places, custom blocks and the full-page background.

Missing credit information is shown in the editor so site owners can correct
it before publishing.

## Anime progress

Anime entries support:

- planned, watching, completed, paused and dropped states;
- current season and episode;
- a list of fully watched seasons;
- optional total season and episode counts; and
- notes.

## Developer settings

`src/config/developer.ts` contains the small set of developer-oriented paths:

- `contentPath`;
- `apiBase`;
- `staticStudioEnabled`;
- `setupPath`; and
- `adminPath`.

Most users never need to edit this file.
