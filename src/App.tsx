import { useEffect, useState } from "react";
import SetupWizard, { type OwnerSetup } from "./components/SetupWizard";
import SiteView from "./components/SiteView";
import Studio from "./components/Studio";
import { developerConfig } from "./config/developer";
import { createBlankDocument } from "./defaults";
import {
  loadDocument,
  runtimeMode,
  saveDocument,
} from "./runtime";
import type { SiteDocument } from "./types";

type AppRoute = "site" | "setup" | "admin";

function routeFromLocation(): AppRoute {
  const hash = window.location.hash.replace(/^#/, "");
  const path = hash || window.location.pathname;
  if (path.endsWith(developerConfig.adminPath)) return "admin";
  if (path.endsWith(developerConfig.setupPath)) return "setup";
  return "site";
}

function navigate(route: AppRoute) {
  const path =
    route === "admin"
      ? developerConfig.adminPath
      : route === "setup"
        ? developerConfig.setupPath
        : "/";
  if (route === "site") {
    history.replaceState(
      null,
      "",
      `${window.location.pathname}${window.location.search}#/`,
    );
  } else {
    window.location.hash = path;
  }
}

function OwnerLogin({
  onAuthenticated,
}: {
  onAuthenticated: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const login = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`${developerConfig.apiBase}/login`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok) throw new Error(payload.error || "Login failed.");
      onAuthenticated();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Login failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="setup-world">
      <form className="owner-login glass-panel" onSubmit={login}>
        <span className="brand-orb">⌂</span>
        <h1>MyHome owner login</h1>
        <p>Only the single owner account can open this editor.</p>
        <label>
          <span>Email</span>
          <input
            type="email"
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label>
          <span>Password</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        {message && <p className="form-message error">{message}</p>}
        <button className="primary-button" type="submit" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
        <button
          className="secondary-button"
          type="button"
          onClick={() => navigate("site")}
        >
          Return to site
        </button>
      </form>
    </main>
  );
}

export default function App() {
  const [document, setDocument] = useState<SiteDocument>(
    createBlankDocument,
  );
  const [route, setRoute] = useState<AppRoute>(routeFromLocation);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [authenticated, setAuthenticated] = useState(
    runtimeMode === "static",
  );

  useEffect(() => {
    const onHashChange = () => setRoute(routeFromLocation());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadDocument()
      .then((loaded) => {
        if (!cancelled) setDocument(loaded);
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "MyHome could not load its content.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (runtimeMode !== "server" || route !== "admin") return;
    fetch(`${developerConfig.apiBase}/session`, {
      credentials: "include",
      cache: "no-store",
    })
      .then((response) => setAuthenticated(response.ok))
      .catch(() => setAuthenticated(false));
  }, [route]);

  const completeSetup = async (
    nextDocument: SiteDocument,
    owner?: OwnerSetup,
  ) => {
    if (runtimeMode === "server") {
      const response = await fetch(`${developerConfig.apiBase}/setup`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ document: nextDocument, owner }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error || "Server setup failed.");
      }
      setAuthenticated(true);
      setDocument(nextDocument);
    } else {
      setDocument(await saveDocument(nextDocument));
    }
    navigate("site");
    setRoute("site");
  };

  const save = async (nextDocument: SiteDocument) => {
    const saved = await saveDocument(nextDocument);
    setDocument(saved);
  };

  if (loading) {
    return (
      <main className="loading-screen">
        <span className="brand-orb">⌂</span>
        <strong>Opening MyHome…</strong>
      </main>
    );
  }

  if (error) {
    return (
      <main className="loading-screen error-screen">
        <span>!</span>
        <strong>MyHome could not start</strong>
        <p>{error}</p>
        <button type="button" onClick={() => window.location.reload()}>
          Try again
        </button>
      </main>
    );
  }

  if (
    !document.configured ||
    (route === "setup" && runtimeMode === "static")
  ) {
    return (
      <SetupWizard
        serverMode={runtimeMode === "server"}
        onComplete={completeSetup}
      />
    );
  }

  if (route === "admin") {
    if (runtimeMode === "server" && !authenticated) {
      return <OwnerLogin onAuthenticated={() => setAuthenticated(true)} />;
    }
    return (
      <Studio
        initialDocument={document}
        serverMode={runtimeMode === "server"}
        onSave={save}
        onLogout={async () => {
          await fetch(`${developerConfig.apiBase}/logout`, {
            method: "POST",
            credentials: "include",
          });
          setAuthenticated(false);
          navigate("site");
          setRoute("site");
        }}
        onClose={() => {
          navigate("site");
          setRoute("site");
        }}
      />
    );
  }

  return (
    <SiteView
      document={document}
      onOpenStudio={() => {
        navigate("admin");
        setRoute("admin");
      }}
    />
  );
}
