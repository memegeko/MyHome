import { useEffect, useMemo, useState } from "react";
import type {
  AnimeItem,
  ContentBlock,
  DirectoryItem,
  MediaRef,
  ProjectItem,
  RecordItem,
  SiteDocument,
} from "../types";

function safeHref(value: string) {
  if (!value) return "";
  try {
    const url = new URL(value, window.location.href);
    return ["http:", "https:", "mailto:"].includes(url.protocol)
      ? value
      : "";
  } catch {
    return "";
  }
}

function safeMediaSource(value: string, kind: "image" | "audio" = "image") {
  if (!value) return "";
  if (value.startsWith(`data:${kind}/`) || value.startsWith("blob:")) {
    return value;
  }
  try {
    const url = new URL(value, window.location.href);
    return ["http:", "https:"].includes(url.protocol) ? value : "";
  } catch {
    return "";
  }
}

function collectCredits(document: SiteDocument) {
  const credits: Array<{ label: string; media: MediaRef }> = [];
  const seen = new Set<string>();
  const visit = (value: unknown, label: string) => {
    if (!value || typeof value !== "object") return;
    const candidate = value as Partial<MediaRef>;
    if (
      typeof candidate.src === "string" &&
      typeof candidate.credit === "string" &&
      typeof candidate.sourceUrl === "string" &&
      candidate.src &&
      candidate.credit &&
      !seen.has(candidate.src)
    ) {
      seen.add(candidate.src);
      credits.push({ label, media: candidate as MediaRef });
    }
    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, `${label} ${index + 1}`));
    } else {
      Object.entries(value).forEach(([key, item]) => visit(item, key));
    }
  };
  visit(document, "Artwork");
  return credits;
}

function MediaImage({
  media,
  className,
  fallback,
}: {
  media?: MediaRef;
  className?: string;
  fallback: React.ReactNode;
}) {
  const src = safeMediaSource(media?.src || "");
  if (!src) return <>{fallback}</>;
  return (
    <img
      className={className}
      src={src}
      alt={media?.alt || ""}
      loading="lazy"
    />
  );
}

function EmptyBlock({ label }: { label: string }) {
  return (
    <div className="empty-block">
      <span aria-hidden="true">✦</span>
      <p>No {label.toLowerCase()} have been added yet.</p>
    </div>
  );
}

function ProjectGrid({ items }: { items: ProjectItem[] }) {
  if (!items.length) return <EmptyBlock label="projects" />;
  return (
    <div className="project-grid">
      {items.map((item) => (
        <article className="project-card" key={item.id}>
          <MediaImage
            media={item.cover}
            className="project-cover"
            fallback={<div className="project-cover placeholder">▦</div>}
          />
          <div>
            <span className="status-chip">{item.status || "Project"}</span>
            <h3>{item.title}</h3>
            <p>{item.description}</p>
            <div className="tag-row">
              {item.tags.map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
            <div className="card-actions">
              {safeHref(item.url) && (
                <a href={safeHref(item.url)} target="_blank" rel="noreferrer">
                  Open project ↗
                </a>
              )}
              {safeHref(item.sourceUrl) && (
                <a href={safeHref(item.sourceUrl)} target="_blank" rel="noreferrer">
                  Source ↗
                </a>
              )}
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

function RecordShelf({ items }: { items: RecordItem[] }) {
  const [playingId, setPlayingId] = useState("");
  if (!items.length) return <EmptyBlock label="records" />;
  return (
    <div className="record-grid">
      {items.map((item) => (
        <article className="record-card" key={item.id}>
          <div className={`record-art${playingId === item.id ? " is-playing" : ""}`}>
            <MediaImage
              media={item.cover}
              fallback={<div className="record-placeholder">♫</div>}
            />
            <span className="record-disc" aria-hidden="true" />
          </div>
          <div>
            <h3>{item.title}</h3>
            <p>{item.artist}</p>
            {safeMediaSource(item.sampleUrl, "audio") && (
              <audio
                controls
                preload="none"
                src={safeMediaSource(item.sampleUrl, "audio")}
                onPlay={() => setPlayingId(item.id)}
                onPause={() => setPlayingId("")}
                onEnded={() => setPlayingId("")}
              />
            )}
            {safeHref(item.spotifyUrl) && (
              <a
                className="glass-link"
                href={safeHref(item.spotifyUrl)}
                target="_blank"
                rel="noreferrer"
              >
                Open in Spotify ↗
              </a>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}

function animeProgress(item: AnimeItem) {
  if (item.status === "completed") return "Completed";
  const parts = [];
  if (item.currentSeason) parts.push(`Season ${item.currentSeason}`);
  if (item.currentEpisode) parts.push(`Episode ${item.currentEpisode}`);
  return parts.join(" · ") || item.status;
}

function AnimeGrid({ items }: { items: AnimeItem[] }) {
  if (!items.length) return <EmptyBlock label="anime" />;
  return (
    <div className="anime-grid">
      {items.map((item) => (
        <article className="anime-card" key={item.id}>
          <MediaImage
            media={item.cover}
            fallback={<div className="anime-placeholder">★</div>}
          />
          <div>
            <span className="status-chip">{item.status}</span>
            <h3>{item.title}</h3>
            <strong>{animeProgress(item)}</strong>
            {item.watchedSeasons.length > 0 && (
              <p>Watched seasons: {item.watchedSeasons.join(", ")}</p>
            )}
            {item.notes && <p>{item.notes}</p>}
          </div>
        </article>
      ))}
    </div>
  );
}

function DirectoryGrid({
  items,
  emptyLabel,
}: {
  items: DirectoryItem[];
  emptyLabel: string;
}) {
  if (!items.length) return <EmptyBlock label={emptyLabel} />;
  return (
    <div className="directory-grid">
      {items.map((item) => (
        <a
          className="directory-card"
          key={item.id}
          href={safeHref(item.url) || undefined}
          target={safeHref(item.url) ? "_blank" : undefined}
          rel={safeHref(item.url) ? "noreferrer" : undefined}
        >
          <MediaImage
            media={item.image}
            fallback={<span className="directory-placeholder">{item.name.slice(0, 2)}</span>}
          />
          <span>
            <strong>{item.name}</strong>
            <small>{item.description}</small>
          </span>
        </a>
      ))}
    </div>
  );
}

function BlockBody({ block }: { block: ContentBlock }) {
  switch (block.type) {
    case "about":
      return (
        <div className="prose">
          {block.body ? (
            block.body.split("\n").map((line, index) => <p key={index}>{line}</p>)
          ) : (
            <EmptyBlock label="about text" />
          )}
        </div>
      );
    case "projects":
      return <ProjectGrid items={block.items} />;
    case "records":
      return <RecordShelf items={block.items} />;
    case "anime":
      return <AnimeGrid items={block.items} />;
    case "gallery":
      return block.items.length ? (
        <div className="gallery-grid">
          {block.items.map((item) => (
            <figure key={item.id}>
              <MediaImage
                media={item.image}
                fallback={<div className="gallery-placeholder">▧</div>}
              />
              <figcaption>
                <strong>{item.title}</strong>
                {item.caption && <span>{item.caption}</span>}
              </figcaption>
            </figure>
          ))}
        </div>
      ) : (
        <EmptyBlock label="gallery images" />
      );
    case "people":
      return <DirectoryGrid items={block.items} emptyLabel="people" />;
    case "places":
      return <DirectoryGrid items={block.items} emptyLabel="places" />;
    case "custom":
      return (
        <div className="custom-content">
          {block.image.src && (
            <MediaImage media={block.image} fallback={null} />
          )}
          <div className="prose">
            {block.body.split("\n").map((line, index) => (
              <p key={index}>{line}</p>
            ))}
            {safeHref(block.linkUrl) && (
              <a
                className="glass-link"
                href={safeHref(block.linkUrl)}
                target="_blank"
                rel="noreferrer"
              >
                {block.linkLabel || "Open link"} ↗
              </a>
            )}
          </div>
        </div>
      );
  }
}

export default function SiteView({
  document,
  onOpenStudio,
  showcaseMode = false,
}: {
  document: SiteDocument;
  onOpenStudio: () => void;
  showcaseMode?: boolean;
}) {
  const enabledPages = useMemo(
    () => document.pages.filter((page) => page.enabled && !page.private),
    [document.pages],
  );
  const [activePageId, setActivePageId] = useState(
    enabledPages[0]?.id || "home",
  );
  const [effectsEnabled, setEffectsEnabled] = useState(() => {
    const saved = localStorage.getItem("myhome:effects");
    return saved === null ? true : saved === "on";
  });
  const [creditsOpen, setCreditsOpen] = useState(false);
  const credits = useMemo(() => collectCredits(document), [document]);
  const socialLinks = useMemo(
    () =>
      document.socials
        .filter((social) => !social.private)
        .map((social) => ({ social, href: safeHref(social.url) }))
        .filter(({ href }) => Boolean(href)),
    [document.socials],
  );

  useEffect(() => {
    if (!enabledPages.some((page) => page.id === activePageId)) {
      setActivePageId(enabledPages[0]?.id || "home");
    }
  }, [activePageId, enabledPages]);

  const ownerAllowsEffects = document.appearance.animationsEnabled;
  const showEffects = effectsEnabled && ownerAllowsEffects;
  const activeBlocks = document.blocks.filter(
    (block) => block.enabled && block.pageId === activePageId && !block.private,
  );
  const background = safeMediaSource(document.appearance.background.src);
  const backgroundStyle: React.CSSProperties = {
    "--accent": document.appearance.accent,
    "--site-font": document.appearance.fontFamily,
    "--heading-font": document.appearance.headingFontFamily,
    "--site-text": document.appearance.textColor,
    "--panel-color": document.appearance.panelColor,
    "--panel-border": document.appearance.borderColor,
    "--panel-border-width": `${document.appearance.borderWidth}px`,
    "--panel-radius": `${document.appearance.borderRadius}px`,
    "--content-gap": `${document.appearance.contentSpacing}px`,
    "--animation-speed": String(document.appearance.animationSpeed),
    "--animation-easing": document.appearance.animationEasing,
    "--particle-size": `${document.appearance.particleSize}px`,
    "--effect-strength": String(
      showEffects ? document.appearance.animationIntensity / 100 : 0,
    ),
  } as React.CSSProperties;

  if (background) {
    backgroundStyle.backgroundImage = `linear-gradient(rgba(3, 37, 58, .32), rgba(4, 62, 80, .18)), url(${JSON.stringify(background)})`;
    backgroundStyle.backgroundPosition =
      document.appearance.backgroundPosition;
    backgroundStyle.backgroundRepeat =
      document.appearance.backgroundMode === "tile" ? "repeat" : "no-repeat";
    backgroundStyle.backgroundSize =
      document.appearance.backgroundMode === "stretch"
        ? "100% 100%"
        : document.appearance.backgroundMode;
  }

  const toggleEffects = () => {
    const next = !effectsEnabled;
    setEffectsEnabled(next);
    localStorage.setItem("myhome:effects", next ? "on" : "off");
  };

  return (
    <div
      className={`site-world theme-${document.appearance.themeId}${background ? " has-custom-background" : ""}`}
      style={backgroundStyle}
    >
      <div className="aero-sky" aria-hidden="true">
        <span className="sun" />
        <span className="cloud cloud-one" />
        <span className="cloud cloud-two" />
        <span className="hill hill-one" />
        <span className="hill hill-two" />
      </div>
      {showEffects && document.appearance.particleType !== "none" && (
        <div
          className={`floating-bubbles particles-${document.appearance.particleType} direction-${document.appearance.particleDirection}`}
          aria-hidden="true"
        >
          {Array.from({ length: document.appearance.particleAmount }, (_, index) => (
            <span key={index} style={{ "--bubble-index": index } as React.CSSProperties} />
          ))}
        </div>
      )}

      <header className="site-header glass-panel">
        <div className="brand-orb" aria-hidden="true">⌂</div>
        <div className="site-brand">
          <strong>{document.siteTitle || "MyHome"}</strong>
          <span>{document.siteSubtitle || "a place of your own"}</span>
        </div>
        <div className="header-actions">
          <button
            type="button"
            onClick={toggleEffects}
            disabled={!ownerAllowsEffects}
            title={
              ownerAllowsEffects
                ? "Toggle animated effects"
                : "Animations are disabled by the site owner"
            }
          >
            {showEffects ? "FX ON" : "FX OFF"}
          </button>
          {showcaseMode ? (
            <a className="header-demo-link" href="./examples/myhome-showcase.zip">
              Download example ZIP
            </a>
          ) : (
            <button type="button" onClick={onOpenStudio}>
              Customize
            </button>
          )}
        </div>
      </header>

      <nav className="site-tabs glass-panel" aria-label="Site pages">
        {enabledPages.map((page) => (
          <button
            key={page.id}
            type="button"
            className={activePageId === page.id ? "is-active" : ""}
            onClick={() => setActivePageId(page.id)}
          >
            <span aria-hidden="true">{page.icon}</span>
            {page.label}
          </button>
        ))}
      </nav>

      <main className="site-layout">
        <aside className="profile-column">
          <section className="profile-card glass-panel">
            <div className="profile-image-wrap">
              <MediaImage
                media={document.profile.avatar}
                fallback={<div className="avatar-placeholder">☺</div>}
              />
              <span className="online-dot" title="Profile status" />
            </div>
            <h1>{document.profile.displayName || "Your name"}</h1>
            <p className="username">
              {document.profile.username || "@yourname"}
            </p>
            {document.profile.tagline && (
              <p className="tagline">{document.profile.tagline}</p>
            )}
            {document.profile.status && (
              <div className="profile-status">
                <span>NOW</span>
                {document.profile.status}
              </div>
            )}
          </section>

          <section className="contact-card glass-panel">
            <div className="panel-title">Contact</div>
            {socialLinks.length ? (
              <div className="social-list">
                {socialLinks.map(({ social, href }) => (
                  <a
                    key={social.id}
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <span aria-hidden="true">{social.icon || "✦"}</span>
                    {social.label}
                  </a>
                ))}
              </div>
            ) : (
              <p className="muted">No contact links yet.</p>
            )}
          </section>
        </aside>

        <div className="content-column">
          <section className="welcome-strip glass-panel">
            <span>WELCOME</span>
            <div>
              <strong>
                {document.profile.displayName
                  ? `${document.profile.displayName}’s home on the web`
                  : "Welcome to MyHome"}
              </strong>
              {document.profile.bio && <p>{document.profile.bio}</p>}
            </div>
          </section>

          {activeBlocks.length ? (
            activeBlocks.map((block) => {
              const pageStyle = document.appearance.pageStyles[activePageId] || {};
              const style = {
                "--accent": pageStyle.accent || document.appearance.accent,
                background: block.style?.background || undefined,
                color: block.style?.textColor || undefined,
                borderColor: block.style?.borderColor || undefined,
                borderWidth: block.style?.borderWidth,
                borderRadius: block.style?.borderRadius,
                padding: block.style?.padding,
                fontFamily: block.style?.fontFamily || undefined,
              } as React.CSSProperties;
              return <section className="content-panel glass-panel" key={block.id} style={style}>
                <div className="panel-title">
                  <span>{block.icon}</span>
                  {block.title}
                </div>
                <div className="panel-body">
                  <BlockBody block={block} />
                </div>
              </section>;
            })
          ) : (
            <section className="content-panel glass-panel">
              <div className="panel-title">This page is empty</div>
              <div className="panel-body">
                <EmptyBlock label="content blocks" />
              </div>
            </section>
          )}
        </div>
      </main>

      <footer className="site-footer glass-panel">
        <span>
          Built with{" "}
          <a
            href="https://github.com/memegeko/MyHome"
            target="_blank"
            rel="noreferrer"
          >
            MyHome by Geko
          </a>
        </span>
        <button type="button" onClick={() => setCreditsOpen(true)}>
          ⓘ Credits
        </button>
      </footer>

      {creditsOpen && (
        <div className="modal-backdrop" role="presentation">
          <section
            className="credits-modal glass-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="credits-title"
          >
            <div className="window-title">
              <strong id="credits-title">Artwork and media credits</strong>
              <button
                type="button"
                aria-label="Close credits"
                onClick={() => setCreditsOpen(false)}
              >
                ×
              </button>
            </div>
            <div className="credits-list">
              {credits.length ? (
                credits.map(({ label, media }) => (
                  <article key={media.src}>
                    <strong>{media.alt || label}</strong>
                    <span>{media.credit}</span>
                    {safeHref(media.sourceUrl) && (
                      <a
                        href={safeHref(media.sourceUrl)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Source ↗
                      </a>
                    )}
                  </article>
                ))
              ) : (
                <p>No credited media has been added yet.</p>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
