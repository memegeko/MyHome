import { useMemo, useState } from "react";
import { aeroThemePreset, createBlankDocument } from "../defaults";
import type { SiteDocument } from "../types";

export type OwnerSetup = {
  email: string;
  password: string;
};

const optionalModules = [
  {
    pageId: "projects",
    title: "Projects",
    description: "Show work, source links, status and cover art.",
    icon: "▦",
  },
  {
    pageId: "records",
    title: "Records",
    description: "Album covers, local samples and Spotify links.",
    icon: "♫",
  },
  {
    pageId: "anime",
    title: "Anime",
    description: "Track seasons, episodes and watch status.",
    icon: "★",
  },
  {
    pageId: "gallery",
    title: "Gallery",
    description: "Create a credited image collection.",
    icon: "▧",
  },
  {
    pageId: "links",
    title: "People & places",
    description: "Share cool people, communities and websites.",
    icon: "☻",
  },
];

export default function SetupWizard({
  serverMode,
  onComplete,
}: {
  serverMode: boolean;
  onComplete: (
    document: SiteDocument,
    owner?: OwnerSetup,
  ) => Promise<void>;
}) {
  const [step, setStep] = useState(0);
  const [document, setDocument] = useState(createBlankDocument);
  const [owner, setOwner] = useState<OwnerSetup>({ email: "", password: "" });
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const enabledModuleCount = useMemo(
    () =>
      document.pages.filter(
        (page) => page.id !== "home" && page.enabled,
      ).length,
    [document.pages],
  );

  const canContinue =
    step === 0
      ? Boolean(
          document.siteTitle.trim() &&
            document.profile.displayName.trim(),
        )
      : step === 1
        ? true
        : step === 2
          ? !serverMode ||
            (owner.email.includes("@") &&
              owner.password.length >= 12 &&
              owner.password === confirmPassword)
          : true;

  const togglePage = (pageId: string) => {
    setDocument((current) => ({
      ...current,
      pages: current.pages.map((page) =>
        page.id === pageId ? { ...page, enabled: !page.enabled } : page,
      ),
    }));
  };

  const finish = async () => {
    setBusy(true);
    setMessage("");
    try {
      await onComplete(
        {
          ...document,
          configured: true,
          updatedAt: new Date().toISOString(),
        },
        serverMode ? owner : undefined,
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Setup could not be saved.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <main
      className="setup-world"
      style={
        {
          "--accent": document.appearance.accent,
        } as React.CSSProperties
      }
    >
      <div className="setup-window glass-panel">
        <header className="setup-header">
          <span className="brand-orb">⌂</span>
          <div>
            <strong>Welcome to MyHome</strong>
            <small>
              {serverMode
                ? "Set up your site and its one owner account."
                : "Build a homepage locally, then export it anywhere."}
            </small>
          </div>
        </header>

        <ol className="setup-steps" aria-label="Setup progress">
          {["Identity", "Modules", serverMode ? "Owner" : "Style", "Finish"].map(
            (label, index) => (
              <li
                key={label}
                className={
                  index === step
                    ? "is-active"
                    : index < step
                      ? "is-complete"
                      : ""
                }
              >
                <span>{index < step ? "✓" : index + 1}</span>
                {label}
              </li>
            ),
          )}
        </ol>

        <section className="setup-content">
          {step === 0 && (
            <>
              <div className="setup-intro">
                <span>01</span>
                <div>
                  <h1>Make this place yours</h1>
                  <p>
                    Nothing personal is included by default. Start with a name,
                    then edit every detail later in the studio.
                  </p>
                </div>
              </div>
              <div className="form-grid">
                <label>
                  <span>Site title</span>
                  <input
                    autoFocus
                    value={document.siteTitle}
                    onChange={(event) =>
                      setDocument({
                        ...document,
                        siteTitle: event.target.value,
                      })
                    }
                    placeholder="My corner of the internet"
                  />
                </label>
                <label>
                  <span>Your display name</span>
                  <input
                    value={document.profile.displayName}
                    onChange={(event) =>
                      setDocument({
                        ...document,
                        profile: {
                          ...document.profile,
                          displayName: event.target.value,
                        },
                      })
                    }
                    placeholder="Your name"
                  />
                </label>
                <label>
                  <span>Username</span>
                  <input
                    value={document.profile.username}
                    onChange={(event) =>
                      setDocument({
                        ...document,
                        profile: {
                          ...document.profile,
                          username: event.target.value,
                        },
                      })
                    }
                    placeholder="@yourname"
                  />
                </label>
                <label>
                  <span>Short tagline</span>
                  <input
                    value={document.profile.tagline}
                    onChange={(event) =>
                      setDocument({
                        ...document,
                        profile: {
                          ...document.profile,
                          tagline: event.target.value,
                        },
                      })
                    }
                    placeholder="Collector of oddly specific things"
                  />
                </label>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <div className="setup-intro">
                <span>02</span>
                <div>
                  <h1>Choose your modules</h1>
                  <p>
                    Pick only what you want. Every page can be hidden, renamed,
                    reordered or removed later.
                  </p>
                </div>
              </div>
              <div className="module-picker">
                {optionalModules.map((module) => {
                  const enabled = document.pages.find(
                    (page) => page.id === module.pageId,
                  )?.enabled;
                  return (
                    <button
                      key={module.pageId}
                      type="button"
                      className={enabled ? "is-selected" : ""}
                      onClick={() => togglePage(module.pageId)}
                    >
                      <span aria-hidden="true">{module.icon}</span>
                      <strong>{module.title}</strong>
                      <small>{module.description}</small>
                      <b>{enabled ? "Included" : "Optional"}</b>
                    </button>
                  );
                })}
              </div>
              <p className="selection-count">
                {enabledModuleCount} optional module
                {enabledModuleCount === 1 ? "" : "s"} selected
              </p>
            </>
          )}

          {step === 2 && serverMode && (
            <>
              <div className="setup-intro">
                <span>03</span>
                <div>
                  <h1>Create the owner account</h1>
                  <p>
                    MyHome allows one owner only. The password is hashed before
                    it is stored and is never written to your site configuration.
                  </p>
                </div>
              </div>
              <div className="form-grid">
                <label className="wide">
                  <span>Owner email</span>
                  <input
                    type="email"
                    value={owner.email}
                    onChange={(event) =>
                      setOwner({ ...owner, email: event.target.value })
                    }
                    placeholder="owner@example.com"
                  />
                </label>
                <label>
                  <span>Password (12+ characters)</span>
                  <input
                    type="password"
                    value={owner.password}
                    onChange={(event) =>
                      setOwner({ ...owner, password: event.target.value })
                    }
                  />
                </label>
                <label>
                  <span>Confirm password</span>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(event) =>
                      setConfirmPassword(event.target.value)
                    }
                  />
                </label>
              </div>
            </>
          )}

          {step === 2 && !serverMode && (
            <>
              <div className="setup-intro">
                <span>03</span>
                <div>
                  <h1>Pick the starting style</h1>
                  <p>
                    The included Aero Glass preset uses CSS only—no personal
                    writing and no copyrighted artwork.
                  </p>
                </div>
              </div>
              <article className="theme-choice is-selected">
                <div className="theme-swatch">
                  <span />
                  <span />
                  <span />
                </div>
                <div>
                  <strong>{aeroThemePreset.name}</strong>
                  <p>{aeroThemePreset.description}</p>
                  <label>
                    Accent
                    <input
                      type="color"
                      value={document.appearance.accent}
                      onChange={(event) =>
                        setDocument({
                          ...document,
                          appearance: {
                            ...document.appearance,
                            accent: event.target.value,
                          },
                        })
                      }
                    />
                  </label>
                </div>
              </article>
            </>
          )}

          {step === 3 && (
            <>
              <div className="setup-intro">
                <span>04</span>
                <div>
                  <h1>Your MyHome is ready</h1>
                  <p>
                    Open the full studio after setup to add covers, progress,
                    projects, people, places, backgrounds and custom sections.
                  </p>
                </div>
              </div>
              <div className="setup-summary">
                <div>
                  <span>Site</span>
                  <strong>{document.siteTitle}</strong>
                </div>
                <div>
                  <span>Owner profile</span>
                  <strong>{document.profile.displayName}</strong>
                </div>
                <div>
                  <span>Optional modules</span>
                  <strong>{enabledModuleCount}</strong>
                </div>
                <div>
                  <span>Mode</span>
                  <strong>{serverMode ? "Server" : "Static"}</strong>
                </div>
              </div>
              <p className="setup-note">
                The small “MyHome by Geko” footer credit is required by the
                project license and stays visible in every edition.
              </p>
            </>
          )}
        </section>

        {message && <p className="form-message error">{message}</p>}

        <footer className="setup-footer">
          <button
            type="button"
            className="secondary-button"
            disabled={step === 0 || busy}
            onClick={() => setStep((current) => Math.max(0, current - 1))}
          >
            Back
          </button>
          {step < 3 ? (
            <button
              type="button"
              className="primary-button"
              disabled={!canContinue}
              onClick={() => setStep((current) => current + 1)}
            >
              Continue
            </button>
          ) : (
            <button
              type="button"
              className="primary-button"
              disabled={busy}
              onClick={() => void finish()}
            >
              {busy ? "Creating MyHome…" : "Finish setup"}
            </button>
          )}
        </footer>
      </div>
    </main>
  );
}
