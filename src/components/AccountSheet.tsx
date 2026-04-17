"use client";

import { useState } from "react";

interface Player {
  id: string;
  name: string;
  emoji: string;
  hasClaimed?: boolean;
}

interface Props {
  player: Player;
  open: boolean;
  onClose: () => void;
  onUpdated: (player: Player) => void;
}

export default function AccountSheet({ player, open, onClose, onUpdated }: Props) {
  const [mode, setMode] = useState<"menu" | "claim" | "login">("menu");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState(player.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  if (!open) return null;

  async function handleClaim() {
    if (!email || !password) return;
    setBusy(true); setError(""); setSuccess("");
    try {
      const res = await fetch("/api/auth/upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "claim", email, password, displayName }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setSuccess("Account claimed! You can now sign in on any device.");
      onUpdated({ ...player, hasClaimed: true, name: displayName || player.name });
      setTimeout(() => { onClose(); setMode("menu"); setSuccess(""); }, 2000);
    } catch (e: unknown) { setError(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  }

  async function handleLogin() {
    if (!email || !password) return;
    setBusy(true); setError(""); setSuccess("");
    try {
      const res = await fetch("/api/auth/upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "login", email, password }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setSuccess("Welcome back! Session restored.");
      onUpdated(d.player);
      setTimeout(() => { onClose(); setMode("menu"); setSuccess(""); window.location.reload(); }, 1500);
    } catch (e: unknown) { setError(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: "fixed", inset: 0, zIndex: 90,
          background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
        }}
        onClick={() => { if (!busy) { onClose(); setMode("menu"); setError(""); } }}
      />

      {/* Sheet */}
      <div
        style={{
          position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 91,
          background: "var(--bg-card)", borderTop: "1px solid var(--border)",
          borderRadius: "20px 20px 0 0",
          padding: "1.5rem",
          paddingBottom: "calc(1.5rem + var(--safe-b, 0px))",
          maxHeight: "85vh", overflowY: "auto",
          animation: "slideUp 0.3s ease-out",
        }}
      >
        {/* Handle */}
        <div style={{ width: 36, height: 4, borderRadius: 2, background: "var(--border-hi)", margin: "0 auto 1.25rem" }} />

        {/* Menu mode */}
        {mode === "menu" && (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>{player.emoji}</div>
            <div style={{ fontWeight: 700, color: "#fff", fontSize: "1.2rem" }}>{player.name}</div>

            {player.hasClaimed ? (
              <div style={{ marginTop: "0.5rem" }}>
                <span className="pill live" style={{ fontSize: "0.75rem" }}>Account claimed</span>
                <p style={{ color: "var(--text-dim)", fontSize: "0.82rem", marginTop: "0.75rem" }}>
                  Your data is safe. Sign in with your email on any device.
                </p>
              </div>
            ) : (
              <div style={{ marginTop: "1rem" }}>
                <p style={{ color: "var(--text-dim)", fontSize: "0.85rem", marginBottom: "1rem", lineHeight: 1.6 }}>
                  You&apos;re anonymous right now. Add an email to keep your data forever and sign in on other devices.
                </p>
                <button
                  className="btn btn-primary btn-block btn-lg"
                  onClick={() => { setMode("claim"); setError(""); }}
                  style={{ marginBottom: "0.5rem" }}
                >
                  Save my account
                </button>
                <button
                  className="btn btn-ghost btn-block btn-sm"
                  onClick={() => { setMode("login"); setError(""); }}
                >
                  I already have an account — sign in
                </button>
              </div>
            )}

            <button
              className="btn btn-ghost btn-sm"
              onClick={onClose}
              style={{ marginTop: "1rem", color: "var(--text-muted)" }}
            >
              Close
            </button>
          </div>
        )}

        {/* Claim mode */}
        {mode === "claim" && (
          <div>
            <h2 style={{ fontWeight: 700, color: "#fff", fontSize: "1.1rem", marginBottom: "0.25rem" }}>
              Claim your account
            </h2>
            <p style={{ color: "var(--text-dim)", fontSize: "0.82rem", marginBottom: "1rem" }}>
              Your games, ratings, and stats will be linked to this email.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
              <input
                className="input"
                type="text"
                placeholder="Display name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
              <input
                className="input"
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
              <input
                className="input"
                type="password"
                placeholder="Choose a password (6+ chars)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>

            {error && <p style={{ color: "var(--neon-red)", fontSize: "0.82rem", fontWeight: 600, marginTop: "0.5rem" }}>{error}</p>}
            {success && <p style={{ color: "var(--neon-green)", fontSize: "0.82rem", fontWeight: 600, marginTop: "0.5rem" }}>{success}</p>}

            <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
              <button className="btn btn-ghost" onClick={() => setMode("menu")} disabled={busy} style={{ flex: 1 }}>Back</button>
              <button className="btn btn-primary" onClick={handleClaim} disabled={busy || !email || password.length < 6} style={{ flex: 2 }}>
                {busy ? "Saving..." : "Claim account"}
              </button>
            </div>
          </div>
        )}

        {/* Login mode */}
        {mode === "login" && (
          <div>
            <h2 style={{ fontWeight: 700, color: "#fff", fontSize: "1.1rem", marginBottom: "0.25rem" }}>
              Sign in
            </h2>
            <p style={{ color: "var(--text-dim)", fontSize: "0.82rem", marginBottom: "1rem" }}>
              Restore your account on this device. Any anonymous data here will be merged in.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
              <input
                className="input"
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
              <input
                className="input"
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>

            {error && <p style={{ color: "var(--neon-red)", fontSize: "0.82rem", fontWeight: 600, marginTop: "0.5rem" }}>{error}</p>}
            {success && <p style={{ color: "var(--neon-green)", fontSize: "0.82rem", fontWeight: 600, marginTop: "0.5rem" }}>{success}</p>}

            <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
              <button className="btn btn-ghost" onClick={() => setMode("menu")} disabled={busy} style={{ flex: 1 }}>Back</button>
              <button className="btn btn-primary" onClick={handleLogin} disabled={busy || !email || !password} style={{ flex: 2 }}>
                {busy ? "Signing in..." : "Sign in"}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
