import { useState } from "react";
import {
  downloadBlob,
  exportSiteBundle,
  exportThemePreset,
  importSiteBundle,
  importThemePreset,
} from "../backup";
import { aeroThemePreset, emptyMedia } from "../defaults";
import { storeMediaFile } from "../media";
import { runtimeMode } from "../runtime";
import { loadOwnerEnvelope } from "../runtime";
import { publishToGitHub } from "../githubPublish";
import type {
  AnimeBlock,
  AnimeItem,
  ContentBlock,
  CustomBlock,
  DirectoryBlock,
  DirectoryItem,
  GalleryBlock,
  GalleryItem,
  MediaRef,
  PageDefinition,
  ProjectItem,
  ProjectsBlock,
  RecordItem,
  RecordsBlock,
  SiteDocument,
  SocialLink,
} from "../types";

type StudioTab =
  | "profile"
  | "pages"
  | "content"
  | "appearance"
  | "publish"
  | "backup";

const studioTabs: Array<{ id: StudioTab; label: string; icon: string }> = [
  { id: "profile", label: "Profile & links", icon: "☺" },
  { id: "pages", label: "Pages", icon: "▤" },
  { id: "content", label: "Content blocks", icon: "▦" },
  { id: "appearance", label: "Advanced options", icon: "✦" },
  { id: "publish", label: "Publish to GitHub", icon: "↥" },
  { id: "backup", label: "Import & export", icon: "⇄" },
];

function uid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function moveItem<T>(items: T[], index: number, direction: -1 | 1) {
  const target = index + direction;
  if (target < 0 || target >= items.length) return items;
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  multiline = false,
  placeholder,
  min,
}: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  type?: string;
  multiline?: boolean;
  placeholder?: string;
  min?: number;
}) {
  return (
    <label className={`editor-field${multiline ? " is-wide" : ""}`}>
      <span>{label}</span>
      {multiline ? (
        <textarea
          rows={4}
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <input
          type={type}
          value={value}
          min={min}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </label>
  );
}

function MediaEditor({
  label,
  media,
  onChange,
}: {
  label: string;
  media: MediaRef;
  onChange: (media: MediaRef) => void;
}) {
  const [message, setMessage] = useState("");
  return (
    <fieldset className="media-editor">
      <legend>{label}</legend>
      <div className="media-preview">
        {media.src ? <img src={media.src} alt="" /> : <span>▧</span>}
      </div>
      <div className="media-editor-fields">
        <label className="upload-button">
          Upload local image
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              try {
                const src = await storeMediaFile(
                  file,
                  "image",
                  media.credit,
                );
                onChange({
                  ...media,
                  src,
                  alt: media.alt || file.name.replace(/\.[^.]+$/, ""),
                });
                setMessage("Local image ready.");
              } catch (error) {
                setMessage(
                  error instanceof Error ? error.message : "Upload failed.",
                );
              }
              event.target.value = "";
            }}
          />
        </label>
        <Field
          label="External image URL"
          type="url"
          value={media.src.startsWith("data:") ? "" : media.src}
          placeholder="https://…"
          onChange={(src) => onChange({ ...media, src })}
        />
        <Field
          label="Alt text"
          value={media.alt}
          onChange={(alt) => onChange({ ...media, alt })}
        />
        <Field
          label="Credit"
          value={media.credit}
          onChange={(credit) => onChange({ ...media, credit })}
        />
        <Field
          label="Credit/source URL"
          type="url"
          value={media.sourceUrl}
          onChange={(sourceUrl) => onChange({ ...media, sourceUrl })}
        />
        {media.src && (
          <button
            type="button"
            className="small-button danger-button"
            onClick={() => onChange(emptyMedia())}
          >
            Remove image
          </button>
        )}
        {message && <small className="inline-message">{message}</small>}
      </div>
    </fieldset>
  );
}

function ItemToolbar({
  title,
  onDelete,
}: {
  title: string;
  onDelete: () => void;
}) {
  return (
    <div className="item-toolbar">
      <strong>{title}</strong>
      <button type="button" className="danger-button" onClick={onDelete}>
        Delete
      </button>
    </div>
  );
}

function ProjectsEditor({
  block,
  onChange,
}: {
  block: ProjectsBlock;
  onChange: (block: ProjectsBlock) => void;
}) {
  const add = () =>
    onChange({
      ...block,
      items: [
        ...block.items,
        {
          id: uid("project"),
          title: "New project",
          description: "",
          status: "In progress",
          url: "",
          sourceUrl: "",
          tags: [],
          cover: emptyMedia(),
        },
      ],
    });
  return (
    <div className="item-stack">
      {block.items.map((item, index) => {
        const update = (next: ProjectItem) => {
          const items = [...block.items];
          items[index] = next;
          onChange({ ...block, items });
        };
        return (
          <article className="editor-item" key={item.id}>
            <ItemToolbar
              title={item.title}
              onDelete={() =>
                onChange({
                  ...block,
                  items: block.items.filter((_, itemIndex) => itemIndex !== index),
                })
              }
            />
            <div className="editor-grid">
              <Field label="Title" value={item.title} onChange={(title) => update({ ...item, title })} />
              <Field label="Status" value={item.status} onChange={(status) => update({ ...item, status })} />
              <Field label="Project URL" type="url" value={item.url} onChange={(url) => update({ ...item, url })} />
              <Field label="Source URL" type="url" value={item.sourceUrl} onChange={(sourceUrl) => update({ ...item, sourceUrl })} />
              <Field
                label="Tags (comma separated)"
                value={item.tags.join(", ")}
                onChange={(value) =>
                  update({
                    ...item,
                    tags: value.split(",").map((tag) => tag.trim()).filter(Boolean),
                  })
                }
              />
              <Field label="Description" multiline value={item.description} onChange={(description) => update({ ...item, description })} />
            </div>
            <MediaEditor label="Project cover" media={item.cover} onChange={(cover) => update({ ...item, cover })} />
          </article>
        );
      })}
      <button type="button" className="add-button" onClick={add}>＋ Add project</button>
    </div>
  );
}

function RecordsEditor({
  block,
  onChange,
}: {
  block: RecordsBlock;
  onChange: (block: RecordsBlock) => void;
}) {
  const add = () =>
    onChange({
      ...block,
      items: [
        ...block.items,
        {
          id: uid("record"),
          title: "New record",
          artist: "",
          spotifyUrl: "",
          sampleUrl: "",
          cover: emptyMedia(),
        },
      ],
    });
  return (
    <div className="item-stack">
      {block.items.map((item, index) => {
        const update = (next: RecordItem) => {
          const items = [...block.items];
          items[index] = next;
          onChange({ ...block, items });
        };
        return (
          <article className="editor-item" key={item.id}>
            <ItemToolbar
              title={item.title}
              onDelete={() =>
                onChange({
                  ...block,
                  items: block.items.filter((_, itemIndex) => itemIndex !== index),
                })
              }
            />
            <div className="editor-grid">
              <Field label="Title" value={item.title} onChange={(title) => update({ ...item, title })} />
              <Field label="Artist" value={item.artist} onChange={(artist) => update({ ...item, artist })} />
              <Field label="Spotify URL" type="url" value={item.spotifyUrl} onChange={(spotifyUrl) => update({ ...item, spotifyUrl })} />
              <Field
                label="External sample URL"
                type="url"
                value={item.sampleUrl.startsWith("data:") ? "" : item.sampleUrl}
                onChange={(sampleUrl) => update({ ...item, sampleUrl })}
              />
            </div>
            <label className="upload-button">
              Upload local MP3/audio sample
              <input
                type="file"
                accept="audio/mpeg,audio/mp3,audio/wav,audio/ogg,audio/mp4"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  try {
                    update({
                      ...item,
                      sampleUrl: await storeMediaFile(
                        file,
                        "audio",
                        item.cover.credit,
                      ),
                    });
                  } catch {
                    // The studio-level save message remains reserved for persistence.
                  }
                  event.target.value = "";
                }}
              />
            </label>
            {item.sampleUrl && (
              <audio className="editor-audio" controls preload="none" src={item.sampleUrl} />
            )}
            <MediaEditor label="Album cover" media={item.cover} onChange={(cover) => update({ ...item, cover })} />
          </article>
        );
      })}
      <button type="button" className="add-button" onClick={add}>＋ Add record</button>
    </div>
  );
}

function AnimeEditor({
  block,
  onChange,
}: {
  block: AnimeBlock;
  onChange: (block: AnimeBlock) => void;
}) {
  const add = () =>
    onChange({
      ...block,
      items: [
        ...block.items,
        {
          id: uid("anime"),
          title: "New anime",
          status: "planned",
          currentSeason: null,
          currentEpisode: null,
          watchedSeasons: [],
          totalSeasons: null,
          totalEpisodes: null,
          notes: "",
          cover: emptyMedia(),
        },
      ],
    });
  return (
    <div className="item-stack">
      {block.items.map((item, index) => {
        const update = (next: AnimeItem) => {
          const items = [...block.items];
          items[index] = next;
          onChange({ ...block, items });
        };
        return (
          <article className="editor-item" key={item.id}>
            <ItemToolbar
              title={item.title}
              onDelete={() =>
                onChange({
                  ...block,
                  items: block.items.filter((_, itemIndex) => itemIndex !== index),
                })
              }
            />
            <div className="editor-grid">
              <Field label="Anime title" value={item.title} onChange={(title) => update({ ...item, title })} />
              <label className="editor-field">
                <span>Watch status</span>
                <select
                  value={item.status}
                  onChange={(event) =>
                    update({
                      ...item,
                      status: event.target.value as AnimeItem["status"],
                    })
                  }
                >
                  <option value="planned">Planned</option>
                  <option value="watching">Watching</option>
                  <option value="completed">Completed</option>
                  <option value="paused">Paused</option>
                  <option value="dropped">Dropped</option>
                </select>
              </label>
              <Field
                label="Current season"
                type="number"
                min={1}
                value={item.currentSeason ?? ""}
                onChange={(value) => update({ ...item, currentSeason: value ? Number(value) : null })}
              />
              <Field
                label="Current episode"
                type="number"
                min={1}
                value={item.currentEpisode ?? ""}
                onChange={(value) => update({ ...item, currentEpisode: value ? Number(value) : null })}
              />
              <Field
                label="Watched seasons (comma separated)"
                value={item.watchedSeasons.join(", ")}
                onChange={(value) =>
                  update({
                    ...item,
                    watchedSeasons: value
                      .split(",")
                      .map((season) => Number(season.trim()))
                      .filter((season) => Number.isInteger(season) && season > 0),
                  })
                }
              />
              <Field
                label="Total seasons"
                type="number"
                min={1}
                value={item.totalSeasons ?? ""}
                onChange={(value) => update({ ...item, totalSeasons: value ? Number(value) : null })}
              />
              <Field
                label="Total episodes"
                type="number"
                min={1}
                value={item.totalEpisodes ?? ""}
                onChange={(value) => update({ ...item, totalEpisodes: value ? Number(value) : null })}
              />
              <Field label="Notes" multiline value={item.notes} onChange={(notes) => update({ ...item, notes })} />
            </div>
            <MediaEditor label="Real anime cover art" media={item.cover} onChange={(cover) => update({ ...item, cover })} />
          </article>
        );
      })}
      <button type="button" className="add-button" onClick={add}>＋ Add anime</button>
    </div>
  );
}

function GalleryEditor({
  block,
  onChange,
}: {
  block: GalleryBlock;
  onChange: (block: GalleryBlock) => void;
}) {
  const add = () =>
    onChange({
      ...block,
      items: [
        ...block.items,
        {
          id: uid("gallery"),
          title: "New image",
          caption: "",
          image: emptyMedia(),
        },
      ],
    });
  return (
    <div className="item-stack">
      {block.items.map((item, index) => {
        const update = (next: GalleryItem) => {
          const items = [...block.items];
          items[index] = next;
          onChange({ ...block, items });
        };
        return (
          <article className="editor-item" key={item.id}>
            <ItemToolbar
              title={item.title}
              onDelete={() =>
                onChange({
                  ...block,
                  items: block.items.filter((_, itemIndex) => itemIndex !== index),
                })
              }
            />
            <div className="editor-grid">
              <Field label="Title" value={item.title} onChange={(title) => update({ ...item, title })} />
              <Field label="Caption" value={item.caption} onChange={(caption) => update({ ...item, caption })} />
            </div>
            <MediaEditor label="Gallery image" media={item.image} onChange={(image) => update({ ...item, image })} />
          </article>
        );
      })}
      <button type="button" className="add-button" onClick={add}>＋ Add gallery image</button>
    </div>
  );
}

function DirectoryEditor({
  block,
  onChange,
}: {
  block: DirectoryBlock;
  onChange: (block: DirectoryBlock) => void;
}) {
  const label = block.type === "people" ? "person" : "place";
  const add = () =>
    onChange({
      ...block,
      items: [
        ...block.items,
        {
          id: uid(label),
          name: `New ${label}`,
          description: "",
          url: "",
          image: emptyMedia(),
        },
      ],
    });
  return (
    <div className="item-stack">
      {block.items.map((item, index) => {
        const update = (next: DirectoryItem) => {
          const items = [...block.items];
          items[index] = next;
          onChange({ ...block, items });
        };
        return (
          <article className="editor-item" key={item.id}>
            <ItemToolbar
              title={item.name}
              onDelete={() =>
                onChange({
                  ...block,
                  items: block.items.filter((_, itemIndex) => itemIndex !== index),
                })
              }
            />
            <div className="editor-grid">
              <Field label="Name" value={item.name} onChange={(name) => update({ ...item, name })} />
              <Field label="URL" type="url" value={item.url} onChange={(url) => update({ ...item, url })} />
              <Field label="Description" multiline value={item.description} onChange={(description) => update({ ...item, description })} />
            </div>
            <MediaEditor label={`${label[0].toUpperCase()}${label.slice(1)} image`} media={item.image} onChange={(image) => update({ ...item, image })} />
          </article>
        );
      })}
      <button type="button" className="add-button" onClick={add}>＋ Add {label}</button>
    </div>
  );
}

function BlockContentEditor({
  block,
  onChange,
}: {
  block: ContentBlock;
  onChange: (block: ContentBlock) => void;
}) {
  switch (block.type) {
    case "about":
      return (
        <Field
          label="About text"
          multiline
          value={block.body}
          onChange={(body) => onChange({ ...block, body })}
        />
      );
    case "projects":
      return <ProjectsEditor block={block} onChange={onChange} />;
    case "records":
      return <RecordsEditor block={block} onChange={onChange} />;
    case "anime":
      return <AnimeEditor block={block} onChange={onChange} />;
    case "gallery":
      return <GalleryEditor block={block} onChange={onChange} />;
    case "people":
    case "places":
      return <DirectoryEditor block={block} onChange={onChange} />;
    case "custom":
      return (
        <div className="item-stack">
          <Field label="Text" multiline value={block.body} onChange={(body) => onChange({ ...block, body })} />
          <div className="editor-grid">
            <Field label="Button label" value={block.linkLabel} onChange={(linkLabel) => onChange({ ...block, linkLabel })} />
            <Field label="Button URL" type="url" value={block.linkUrl} onChange={(linkUrl) => onChange({ ...block, linkUrl })} />
          </div>
          <MediaEditor label="Optional custom-section image" media={block.image} onChange={(image) => onChange({ ...block, image })} />
        </div>
      );
  }
}

export default function Studio({
  initialDocument,
  serverMode,
  onSave,
  onClose,
  onLogout,
}: {
  initialDocument: SiteDocument;
  serverMode: boolean;
  onSave: (document: SiteDocument) => Promise<void>;
  onClose: () => void;
  onLogout?: () => Promise<void>;
}) {
  const [document, setDocument] = useState(initialDocument);
  const [tab, setTab] = useState<StudioTab>("profile");
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [advancedMode, setAdvancedMode] = useState<"simple" | "expert">("simple");
  const [github, setGithub] = useState({
    token: "",
    owner: "",
    repository: "MyHome",
    branch: "main",
  });

  const updateDocument = (next: SiteDocument) => {
    setDocument(next);
    setDirty(true);
  };

  const save = async () => {
    setBusy(true);
    setMessage("");
    try {
      await onSave({ ...document, configured: true });
      setDirty(false);
      setMessage("Saved. Your public site now uses these changes.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  };

  const updateBlock = (index: number, block: ContentBlock) => {
    const blocks = [...document.blocks];
    blocks[index] = block;
    updateDocument({ ...document, blocks });
  };

  const addCustomBlock = () => {
    const pageId =
      document.pages.find((page) => page.enabled)?.id ||
      document.pages[0]?.id ||
      "home";
    const block: CustomBlock = {
      id: uid("custom"),
      type: "custom",
      pageId,
      title: "Custom section",
      icon: "✦",
      enabled: true,
      body: "Write something here.",
      image: emptyMedia(),
      linkLabel: "",
      linkUrl: "",
    };
    updateDocument({ ...document, blocks: [...document.blocks, block] });
  };

  return (
    <main
      className="studio-world"
      style={{ "--accent": document.appearance.accent } as React.CSSProperties}
    >
      <header className="studio-topbar glass-panel">
        <div className="studio-brand">
          <span className="brand-orb">⌂</span>
          <div>
            <strong>MyHome Studio</strong>
            <small>{serverMode ? "Server owner editor" : "Static setup studio"}</small>
          </div>
        </div>
        <div className="studio-actions">
          <span className={dirty ? "dirty-state" : "saved-state"}>
            {dirty ? "● Unsaved changes" : "✓ Saved"}
          </span>
          <button type="button" className="secondary-button" onClick={onClose}>View site</button>
          {onLogout && (
            <button
              type="button"
              className="secondary-button"
              onClick={() => void onLogout()}
            >
              Sign out
            </button>
          )}
          <button type="button" className="primary-button" disabled={!dirty || busy} onClick={() => void save()}>
            {busy ? "Saving…" : "Save changes"}
          </button>
        </div>
      </header>

      <div className="studio-layout">
        <aside className="studio-sidebar glass-panel">
          <p>CONTROL PANEL</p>
          <nav aria-label="Studio sections">
            {studioTabs.map((item) => (
              <button
                type="button"
                key={item.id}
                className={tab === item.id ? "is-active" : ""}
                onClick={() => setTab(item.id)}
              >
                <span>{item.icon}</span>
                {item.label}
              </button>
            ))}
          </nav>
          <div className="mode-note">
            <strong>{serverMode ? "SERVER MODE" : "STATIC MODE"}</strong>
            <span>
              {serverMode
                ? "Changes are stored for every visitor."
                : "Changes stay in this browser until exported."}
            </span>
          </div>
        </aside>

        <section className="studio-main glass-panel">
          {tab === "profile" && (
            <>
              <div className="section-heading">
                <div>
                  <h1>Profile and contact links</h1>
                  <p>Edit the identity shown across the public site.</p>
                </div>
              </div>
              <div className="editor-grid">
                <Field label="Site title" value={document.siteTitle} onChange={(siteTitle) => updateDocument({ ...document, siteTitle })} />
                <Field label="Site subtitle" value={document.siteSubtitle} onChange={(siteSubtitle) => updateDocument({ ...document, siteSubtitle })} />
                <Field label="Display name" value={document.profile.displayName} onChange={(displayName) => updateDocument({ ...document, profile: { ...document.profile, displayName } })} />
                <Field label="Username" value={document.profile.username} onChange={(username) => updateDocument({ ...document, profile: { ...document.profile, username } })} />
                <Field label="Tagline" value={document.profile.tagline} onChange={(tagline) => updateDocument({ ...document, profile: { ...document.profile, tagline } })} />
                <Field label="Status" value={document.profile.status} onChange={(status) => updateDocument({ ...document, profile: { ...document.profile, status } })} />
                <Field label="Bio" multiline value={document.profile.bio} onChange={(bio) => updateDocument({ ...document, profile: { ...document.profile, bio } })} />
              </div>
              <MediaEditor label="Profile avatar" media={document.profile.avatar} onChange={(avatar) => updateDocument({ ...document, profile: { ...document.profile, avatar } })} />

              <div className="section-heading embedded-heading">
                <div>
                  <h2>Contact links</h2>
                  <p>Add any services you want; nothing is hard-coded.</p>
                </div>
                <button
                  type="button"
                  className="add-button"
                  onClick={() =>
                    updateDocument({
                      ...document,
                      socials: [
                        ...document.socials,
                        {
                          id: uid("social"),
                          label: "New link",
                          url: "",
                          icon: "✦",
                        },
                      ],
                    })
                  }
                >
                  ＋ Add link
                </button>
              </div>
              <div className="item-stack">
                {document.socials.map((social, index) => {
                  const update = (next: SocialLink) => {
                    const socials = [...document.socials];
                    socials[index] = next;
                    updateDocument({ ...document, socials });
                  };
                  return (
                    <article className="editor-item compact-item" key={social.id}>
                      <ItemToolbar
                        title={social.label}
                        onDelete={() =>
                          updateDocument({
                            ...document,
                            socials: document.socials.filter((_, itemIndex) => itemIndex !== index),
                          })
                        }
                      />
                      <div className="editor-grid">
                        <Field label="Label" value={social.label} onChange={(label) => update({ ...social, label })} />
                        <Field label="Icon" value={social.icon} onChange={(icon) => update({ ...social, icon })} />
                        <Field label="URL" type="url" value={social.url} onChange={(url) => update({ ...social, url })} />
                        <label className="check-field">
                          <input
                            type="checkbox"
                            checked={Boolean(social.private)}
                            onChange={(event) => update({ ...social, private: event.target.checked })}
                          />
                          Keep this contact private
                        </label>
                        {social.private && (
                          <Field
                            label="Private placeholder"
                            value={social.privatePlaceholder || "Private contact"}
                            onChange={(privatePlaceholder) => update({ ...social, privatePlaceholder })}
                          />
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </>
          )}

          {tab === "pages" && (
            <>
              <div className="section-heading">
                <div>
                  <h1>Pages and navigation</h1>
                  <p>Show, hide, reorder, rename and change every tab icon.</p>
                </div>
              </div>
              <div className="item-stack">
                {document.pages.map((page, index) => {
                  const update = (next: PageDefinition) => {
                    const pages = [...document.pages];
                    pages[index] = next;
                    updateDocument({ ...document, pages });
                  };
                  return (
                    <article className="editor-item page-editor" key={page.id}>
                      <div className="item-toolbar">
                        <strong>{page.icon} {page.label}</strong>
                        <div>
                          <button type="button" onClick={() => updateDocument({ ...document, pages: moveItem(document.pages, index, -1) })}>↑</button>
                          <button type="button" onClick={() => updateDocument({ ...document, pages: moveItem(document.pages, index, 1) })}>↓</button>
                        </div>
                      </div>
                      <div className="editor-grid">
                        <label className="check-field">
                          <input type="checkbox" checked={page.enabled} onChange={(event) => update({ ...page, enabled: event.target.checked })} />
                          Show this page
                        </label>
                        <label className="check-field">
                          <input
                            type="checkbox"
                            checked={Boolean(page.private)}
                            onChange={(event) => update({ ...page, private: event.target.checked })}
                          />
                          Keep this page private
                        </label>
                        {page.private && (
                          <Field
                            label="Private placeholder"
                            value={page.privatePlaceholder || "Private page"}
                            onChange={(privatePlaceholder) => update({ ...page, privatePlaceholder })}
                          />
                        )}
                        <Field label="Tab name" value={page.label} onChange={(label) => update({ ...page, label })} />
                        <Field label="Icon" value={page.icon} onChange={(icon) => update({ ...page, icon })} />
                      </div>
                    </article>
                  );
                })}
              </div>
            </>
          )}

          {tab === "content" && (
            <>
              <div className="section-heading">
                <div>
                  <h1>Content blocks</h1>
                  <p>Move blocks between pages, reorder them or create completely custom sections.</p>
                </div>
                <button type="button" className="add-button" onClick={addCustomBlock}>＋ Custom section</button>
              </div>
              <div className="item-stack">
                {document.blocks.map((block, index) => (
                  <details className="block-editor editor-item" key={block.id} open={index === 0}>
                    <summary>
                      <span>{block.icon} {block.title}</span>
                      <small>{block.type}</small>
                    </summary>
                    <div className="block-controls editor-grid">
                      <label className="check-field">
                        <input
                          type="checkbox"
                          checked={block.enabled}
                          onChange={(event) => updateBlock(index, { ...block, enabled: event.target.checked })}
                        />
                        Show this block
                      </label>
                      <label className="check-field">
                        <input
                          type="checkbox"
                          checked={Boolean(block.private)}
                          onChange={(event) => updateBlock(index, { ...block, private: event.target.checked })}
                        />
                        Keep this section private
                      </label>
                      {block.private && (
                        <Field
                          label="Private placeholder"
                          value={block.privatePlaceholder || "Private section"}
                          onChange={(privatePlaceholder) =>
                            updateBlock(index, { ...block, privatePlaceholder })
                          }
                        />
                      )}
                      <Field label="Section title" value={block.title} onChange={(title) => updateBlock(index, { ...block, title })} />
                      <Field label="Icon" value={block.icon} onChange={(icon) => updateBlock(index, { ...block, icon })} />
                      <label className="editor-field">
                        <span>Page</span>
                        <select value={block.pageId} onChange={(event) => updateBlock(index, { ...block, pageId: event.target.value })}>
                          {document.pages.map((page) => <option value={page.id} key={page.id}>{page.label}</option>)}
                        </select>
                      </label>
                    </div>
                    <div className="block-toolbar">
                      <button type="button" onClick={() => updateDocument({ ...document, blocks: moveItem(document.blocks, index, -1) })}>Move up</button>
                      <button type="button" onClick={() => updateDocument({ ...document, blocks: moveItem(document.blocks, index, 1) })}>Move down</button>
                      {block.type === "custom" && (
                        <button
                          type="button"
                          className="danger-button"
                          onClick={() => updateDocument({ ...document, blocks: document.blocks.filter((_, itemIndex) => itemIndex !== index) })}
                        >
                          Delete custom section
                        </button>
                      )}
                    </div>
                    <BlockContentEditor block={block} onChange={(next) => updateBlock(index, next)} />
                  </details>
                ))}
              </div>
            </>
          )}

          {tab === "appearance" && (
            <>
              <div className="section-heading">
                <div>
                  <h1>Advanced options</h1>
                  <p>Style the whole site, individual pages and content blocks.</p>
                </div>
                <div className="mode-switch" role="group" aria-label="Settings mode">
                  <button
                    type="button"
                    className={advancedMode === "simple" ? "is-active" : ""}
                    onClick={() => setAdvancedMode("simple")}
                  >
                    Simple
                  </button>
                  <button
                    type="button"
                    className={advancedMode === "expert" ? "is-active" : ""}
                    onClick={() => setAdvancedMode("expert")}
                  >
                    Expert
                  </button>
                </div>
              </div>
              <div className="appearance-grid">
                <article className="appearance-card">
                  <h2>Theme</h2>
                  <label className="editor-field">
                    <span>Theme preset</span>
                    <select
                      value={document.appearance.themeId}
                      onChange={(event) => updateDocument({ ...document, appearance: { ...document.appearance, themeId: event.target.value } })}
                    >
                      <option value="aero-glass">Aero Glass</option>
                    </select>
                  </label>
                  <label className="color-field">
                    <span>Accent color</span>
                    <input type="color" value={document.appearance.accent} onChange={(event) => updateDocument({ ...document, appearance: { ...document.appearance, accent: event.target.value } })} />
                    <code>{document.appearance.accent}</code>
                  </label>
                  <label className="editor-field">
                    <span>Body font</span>
                    <select
                      value={document.appearance.fontFamily}
                      onChange={(event) => updateDocument({ ...document, appearance: { ...document.appearance, fontFamily: event.target.value } })}
                    >
                      <option value="Segoe UI, sans-serif">Segoe UI</option>
                      <option value="Arial, sans-serif">Arial</option>
                      <option value="Verdana, sans-serif">Verdana</option>
                      <option value="Georgia, serif">Georgia</option>
                      <option value="'Trebuchet MS', sans-serif">Trebuchet MS</option>
                      <option value="monospace">Monospace</option>
                    </select>
                  </label>
                  <label className="color-field">
                    <span>Text color</span>
                    <input type="color" value={document.appearance.textColor} onChange={(event) => updateDocument({ ...document, appearance: { ...document.appearance, textColor: event.target.value } })} />
                    <code>{document.appearance.textColor}</code>
                  </label>
                </article>
                <article className="appearance-card">
                  <h2>Animations</h2>
                  <label className="check-field">
                    <input
                      type="checkbox"
                      checked={document.appearance.animationsEnabled}
                      onChange={(event) => updateDocument({ ...document, appearance: { ...document.appearance, animationsEnabled: event.target.checked } })}
                    />
                    Allow animated effects
                  </label>
                  <label className="range-field">
                    <span>Intensity: {document.appearance.animationIntensity}%</span>
                    <input
                      type="range"
                      min="10"
                      max="100"
                      step="5"
                      disabled={!document.appearance.animationsEnabled}
                      value={document.appearance.animationIntensity}
                      onChange={(event) => updateDocument({ ...document, appearance: { ...document.appearance, animationIntensity: Number(event.target.value) } })}
                    />
                  </label>
                  <label className="range-field">
                    <span>Speed: {document.appearance.animationSpeed.toFixed(1)}×</span>
                    <input
                      type="range"
                      min="0.2"
                      max="3"
                      step="0.1"
                      disabled={!document.appearance.animationsEnabled}
                      value={document.appearance.animationSpeed}
                      onChange={(event) => updateDocument({ ...document, appearance: { ...document.appearance, animationSpeed: Number(event.target.value) } })}
                    />
                  </label>
                  <label className="editor-field">
                    <span>Easing</span>
                    <select
                      value={document.appearance.animationEasing}
                      onChange={(event) => updateDocument({ ...document, appearance: { ...document.appearance, animationEasing: event.target.value as SiteDocument["appearance"]["animationEasing"] } })}
                    >
                      {["linear", "ease", "ease-in", "ease-out", "ease-in-out"].map((value) => <option key={value}>{value}</option>)}
                    </select>
                  </label>
                </article>
              </div>
              <div className="appearance-grid">
                <article className="appearance-card">
                  <h2>Particles</h2>
                  <label className="editor-field">
                    <span>Particle type</span>
                    <select
                      value={document.appearance.particleType}
                      onChange={(event) => updateDocument({ ...document, appearance: { ...document.appearance, particleType: event.target.value as SiteDocument["appearance"]["particleType"] } })}
                    >
                      <option value="bubbles">Bubbles</option>
                      <option value="sparkles">Sparkles</option>
                      <option value="snow">Snow</option>
                      <option value="none">None</option>
                    </select>
                  </label>
                  <label className="range-field">
                    <span>Amount: {document.appearance.particleAmount}</span>
                    <input type="range" min="0" max="60" value={document.appearance.particleAmount} onChange={(event) => updateDocument({ ...document, appearance: { ...document.appearance, particleAmount: Number(event.target.value) } })} />
                  </label>
                  <label className="range-field">
                    <span>Size: {document.appearance.particleSize}px</span>
                    <input type="range" min="6" max="80" value={document.appearance.particleSize} onChange={(event) => updateDocument({ ...document, appearance: { ...document.appearance, particleSize: Number(event.target.value) } })} />
                  </label>
                  <label className="editor-field">
                    <span>Direction</span>
                    <select value={document.appearance.particleDirection} onChange={(event) => updateDocument({ ...document, appearance: { ...document.appearance, particleDirection: event.target.value as SiteDocument["appearance"]["particleDirection"] } })}>
                      {["up", "down", "left", "right"].map((value) => <option key={value}>{value}</option>)}
                    </select>
                  </label>
                </article>
                <article className="appearance-card">
                  <h2>Panels and spacing</h2>
                  <label className="color-field"><span>Panel color</span><input type="color" value={document.appearance.panelColor} onChange={(event) => updateDocument({ ...document, appearance: { ...document.appearance, panelColor: event.target.value } })} /><code>{document.appearance.panelColor}</code></label>
                  <label className="color-field"><span>Border color</span><input type="color" value={document.appearance.borderColor} onChange={(event) => updateDocument({ ...document, appearance: { ...document.appearance, borderColor: event.target.value } })} /><code>{document.appearance.borderColor}</code></label>
                  <label className="range-field"><span>Corner radius: {document.appearance.borderRadius}px</span><input type="range" min="0" max="40" value={document.appearance.borderRadius} onChange={(event) => updateDocument({ ...document, appearance: { ...document.appearance, borderRadius: Number(event.target.value) } })} /></label>
                  <label className="range-field"><span>Spacing: {document.appearance.contentSpacing}px</span><input type="range" min="4" max="48" value={document.appearance.contentSpacing} onChange={(event) => updateDocument({ ...document, appearance: { ...document.appearance, contentSpacing: Number(event.target.value) } })} /></label>
                </article>
              </div>
              <MediaEditor
                label="Whole-page background"
                media={document.appearance.background}
                onChange={(background) => updateDocument({ ...document, appearance: { ...document.appearance, background } })}
              />
              <div className="editor-grid">
                <label className="editor-field">
                  <span>Background fit</span>
                  <select
                    value={document.appearance.backgroundMode}
                    onChange={(event) => updateDocument({ ...document, appearance: { ...document.appearance, backgroundMode: event.target.value as SiteDocument["appearance"]["backgroundMode"] } })}
                  >
                    <option value="cover">Cover screen</option>
                    <option value="contain">Contain</option>
                    <option value="tile">Tile</option>
                    <option value="stretch">Stretch</option>
                  </select>
                </label>
                <label className="editor-field">
                  <span>Background position</span>
                  <select
                    value={document.appearance.backgroundPosition}
                    onChange={(event) => updateDocument({ ...document, appearance: { ...document.appearance, backgroundPosition: event.target.value as SiteDocument["appearance"]["backgroundPosition"] } })}
                  >
                    {["center", "top", "bottom", "left", "right"].map((position) => <option key={position}>{position}</option>)}
                  </select>
                </label>
              </div>
              {advancedMode === "expert" && (
                <>
                  <div className="section-heading embedded-heading">
                    <div>
                      <h2>Page overrides</h2>
                      <p>Override the accent and panel radius for a specific page.</p>
                    </div>
                  </div>
                  <div className="item-stack">
                    {document.pages.map((page) => {
                      const style = document.appearance.pageStyles[page.id] || {};
                      return (
                        <article className="editor-item compact-item" key={page.id}>
                          <strong>{page.icon} {page.label}</strong>
                          <div className="editor-grid">
                            <Field label="Accent override" value={style.accent || ""} placeholder="#24c8c0" onChange={(accent) => updateDocument({ ...document, appearance: { ...document.appearance, pageStyles: { ...document.appearance.pageStyles, [page.id]: { ...style, accent } } } })} />
                            <Field label="Corner radius" type="number" min={0} value={style.borderRadius ?? ""} onChange={(value) => updateDocument({ ...document, appearance: { ...document.appearance, pageStyles: { ...document.appearance.pageStyles, [page.id]: { ...style, borderRadius: value === "" ? undefined : Number(value) } } } })} />
                          </div>
                        </article>
                      );
                    })}
                  </div>
                  <div className="section-heading embedded-heading">
                    <div>
                      <h2>Section overrides</h2>
                      <p>Each content block can override color, radius and padding.</p>
                    </div>
                  </div>
                  <div className="item-stack">
                    {document.blocks.map((block, index) => (
                      <article className="editor-item compact-item" key={block.id}>
                        <strong>{block.icon} {block.title}</strong>
                        <div className="editor-grid">
                          <Field label="Background" value={block.style?.background || ""} placeholder="#ffffff" onChange={(background) => updateBlock(index, { ...block, style: { ...block.style, background } })} />
                          <Field label="Text color" value={block.style?.textColor || ""} placeholder="#073b50" onChange={(textColor) => updateBlock(index, { ...block, style: { ...block.style, textColor } })} />
                          <Field label="Corner radius" type="number" min={0} value={block.style?.borderRadius ?? ""} onChange={(value) => updateBlock(index, { ...block, style: { ...block.style, borderRadius: value === "" ? undefined : Number(value) } })} />
                          <Field label="Padding" type="number" min={0} value={block.style?.padding ?? ""} onChange={(value) => updateBlock(index, { ...block, style: { ...block.style, padding: value === "" ? undefined : Number(value) } })} />
                        </div>
                      </article>
                    ))}
                  </div>
                </>
              )}
            </>
          )}

          {tab === "publish" && (
            <>
              <div className="section-heading">
                <div>
                  <h1>Publish to GitHub</h1>
                  <p>The fine-grained token stays in memory and is forgotten when this page closes.</p>
                </div>
              </div>
              {serverMode ? (
                <div className="license-note">
                  GitHub publishing is available in the static edition.
                </div>
              ) : (
                <div className="editor-item">
                  <div className="editor-grid">
                    <Field label="Repository owner" value={github.owner} onChange={(owner) => setGithub({ ...github, owner })} />
                    <Field label="Repository name" value={github.repository} onChange={(repository) => setGithub({ ...github, repository })} />
                    <Field label="Branch" value={github.branch} onChange={(branch) => setGithub({ ...github, branch })} />
                    <Field label="Fine-grained token" type="password" value={github.token} onChange={(token) => setGithub({ ...github, token })} />
                  </div>
                  <p className="setup-note">
                    Give the token Contents read/write access only to this repository. MyHome never saves it.
                  </p>
                  <button
                    type="button"
                    className="primary-button"
                    disabled={busy || dirty}
                    onClick={async () => {
                      setBusy(true);
                      setMessage("");
                      try {
                        const envelope = await loadOwnerEnvelope();
                        if (!envelope) throw new Error("Encrypted owner configuration not found.");
                        await publishToGitHub({
                          ...github,
                          document,
                          envelope,
                        });
                        setGithub((current) => ({ ...current, token: "" }));
                        setMessage("Published directly to GitHub. The token was forgotten.");
                      } catch (error) {
                        setMessage(error instanceof Error ? error.message : "GitHub publishing failed.");
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    Commit to current branch
                  </button>
                  {dirty && <p className="form-message">Save changes before publishing.</p>}
                </div>
              )}
            </>
          )}

          {tab === "backup" && (
            <>
              <div className="section-heading">
                <div>
                  <h1>Portable site bundles</h1>
                  <p>One ZIP carries the theme, layout, content and locally uploaded media.</p>
                </div>
              </div>
              <div className="backup-grid">
                <article>
                  <span>FULL SITE</span>
                  <h2>Export one ZIP</h2>
                  <p>Use it as a backup, move to another MyHome installation or copy its files into a static deployment.</p>
                  <button
                    type="button"
                    className="primary-button"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        downloadBlob(await exportSiteBundle(document), "myhome-full-site.zip");
                        setMessage("Full MyHome ZIP exported.");
                      } catch (error) {
                        setMessage(error instanceof Error ? error.message : "Export failed.");
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    ⇩ Export full ZIP
                  </button>
                </article>
                <article>
                  <span>RESTORE</span>
                  <h2>Import ZIP or JSON</h2>
                  <p>Imported content is shown for review first. Press Save changes when you are happy.</p>
                  <label className="upload-button primary-upload">
                    ⇧ Choose backup
                    <input
                      type="file"
                      accept=".zip,.json,application/zip,application/json"
                      onChange={async (event) => {
                        const file = event.target.files?.[0];
                        if (!file) return;
                        setBusy(true);
                        try {
                          setDocument(
                            await importSiteBundle(
                              file,
                              runtimeMode === "server"
                                ? async (bytes, mimeType, path) => {
                                    const mediaBuffer = new ArrayBuffer(
                                      bytes.byteLength,
                                    );
                                    new Uint8Array(mediaBuffer).set(bytes);
                                    return storeMediaFile(
                                      new File([mediaBuffer], path.split("/").pop() || "media", {
                                        type: mimeType,
                                      }),
                                      mimeType.startsWith("audio/")
                                        ? "audio"
                                        : "image",
                                      "Restored from a MyHome full-site backup",
                                    );
                                  }
                                : undefined,
                            ),
                          );
                          setDirty(true);
                          setMessage("Backup imported. Review it, then save.");
                        } catch (error) {
                          setMessage(error instanceof Error ? error.message : "Import failed.");
                        } finally {
                          setBusy(false);
                          event.target.value = "";
                        }
                      }}
                    />
                  </label>
                </article>
                <article>
                  <span>THEMES</span>
                  <h2>Theme presets</h2>
                  <p>Share appearance settings without sharing anybody’s personal content.</p>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => downloadBlob(exportThemePreset({ ...aeroThemePreset, appearance: document.appearance }), "myhome-theme.json")}
                  >
                    Export theme
                  </button>
                  <label className="upload-button">
                    Import theme
                    <input
                      type="file"
                      accept=".json,application/json"
                      onChange={async (event) => {
                        const file = event.target.files?.[0];
                        if (!file) return;
                        try {
                          const preset = await importThemePreset(file);
                          updateDocument({ ...document, appearance: preset.appearance });
                          setMessage(`Theme “${preset.name}” imported.`);
                        } catch (error) {
                          setMessage(error instanceof Error ? error.message : "Theme import failed.");
                        }
                        event.target.value = "";
                      }}
                    />
                  </label>
                </article>
              </div>
              <div className="license-note">
                <strong>Required credit</strong>
                <p>The “MyHome by Geko” footer credit is part of the license and is not included as a removable setting.</p>
              </div>
            </>
          )}

          {message && <div className="studio-toast" role="status">{message}</div>}
        </section>
      </div>
    </main>
  );
}
