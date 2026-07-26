import { useEffect, useState } from "react";
import SetupWizard, { type OwnerSetup } from "./components/SetupWizard";
import SiteView from "./components/SiteView";
import Studio from "./components/Studio";
import { developerConfig } from "./config/developer";
import { createBlankDocument } from "./defaults";
import {
  loadDocument,
  loadOwnerEnvelope,
  runtimeMode,
  saveDocument,
  saveOwnerEnvelope,
} from "./runtime";
import {
  createOwnerEnvelope,
  unlockOwnerEnvelope,
} from "./ownerCrypto";
import type { OwnerEnvelope, SiteDocument } from "./types";

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
  serverMode,
  onAuthenticated,
}: {
  serverMode: boolean;
  onAuthenticated: (
    document?: SiteDocument,
    secret?: string,
    envelope?: OwnerEnvelope,
    recovery?: boolean,
  ) => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [recoveryMode, setRecoveryMode] = useState(false);

  const login = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      if (serverMode) {
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
      } else {
        const envelope = await loadOwnerEnvelope();
        if (!envelope) {
          throw new Error("Owner configuration not found. Run setup first.");
        }
        const unlocked = await unlockOwnerEnvelope(
          envelope,
          email,
          password,
          recoveryMode,
        );
        onAuthenticated(unlocked, password, envelope, recoveryMode);
      }
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
        <p>
          {serverMode
            ? "Only the single owner account can open this editor."
            : "Unlock the encrypted owner configuration to open Studio."}
        </p>
        {!recoveryMode && <label>
          <span>Email</span>
          <input
            type="email"
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>}
        <label>
          <span>{recoveryMode ? "Recovery key" : "Password"}</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        {message && <p className="form-message error">{message}</p>}
        <button className="primary-button" type="submit" disabled={busy}>
          {busy ? "Unlocking…" : recoveryMode ? "Recover access" : "Sign in"}
        </button>
        {!serverMode && (
          <button
            className="secondary-button"
            type="button"
            onClick={() => {
              setRecoveryMode((current) => !current);
              setPassword("");
              setMessage("");
            }}
          >
            {recoveryMode ? "Use email and password" : "Use recovery key"}
          </button>
        )}
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
    false,
  );
  const [staticSecret, setStaticSecret] = useState("");
  const [ownerEnvelope, setOwnerEnvelope] = useState<OwnerEnvelope | null>(null);

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
      if (!owner) throw new Error("Owner details are required.");
      const configured = await saveDocument(nextDocument);
      const envelope = await createOwnerEnvelope(
        owner.email,
        owner.password,
        owner.recoveryKey,
        owner.sessionPreference,
        configured,
      );
      await saveOwnerEnvelope(envelope);
      setOwnerEnvelope(envelope);
      setStaticSecret(owner.password);
      setAuthenticated(true);
      setDocument(configured);
      if (owner.sessionPreference === "session") {
        sessionStorage.setItem("myhome:owner-session", "active");
      } else if (owner.sessionPreference === "until-logout") {
        localStorage.setItem("myhome:owner-session", "active");
      }
    }
    navigate("site");
    setRoute("site");
  };

  const save = async (nextDocument: SiteDocument) => {
    const saved = await saveDocument(nextDocument);
    if (runtimeMode === "static") {
      if (!ownerEnvelope || !staticSecret) {
        throw new Error("Sign in again before saving encrypted changes.");
      }
      const refreshed = await createOwnerEnvelope(
        ownerEnvelope.email,
        staticSecret,
        staticSecret,
        ownerEnvelope.sessionPreference,
        saved,
      );
      // Preserve the independent recovery ciphertext until recovery rotation is added.
      refreshed.recovery = ownerEnvelope.recovery;
      await saveOwnerEnvelope(refreshed);
      setOwnerEnvelope(refreshed);
    }
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
    if (!authenticated) {
      return (
        <OwnerLogin
          serverMode={runtimeMode === "server"}
          onAuthenticated={(unlocked, secret, envelope, recovery) => {
            setAuthenticated(true);
            if (unlocked) setDocument(unlocked);
            if (secret && !recovery) setStaticSecret(secret);
            if (envelope) setOwnerEnvelope(envelope);
          }}
        />
      );
    }
    return (
      <Studio
        initialDocument={document}
        serverMode={runtimeMode === "server"}
        onSave={save}
        onLogout={async () => {
          if (runtimeMode === "server") {
            await fetch(`${developerConfig.apiBase}/logout`, {
              method: "POST",
              credentials: "include",
            });
          } else {
            sessionStorage.removeItem("myhome:owner-session");
            localStorage.removeItem("myhome:owner-session");
            setStaticSecret("");
            setOwnerEnvelope(null);
          }
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
