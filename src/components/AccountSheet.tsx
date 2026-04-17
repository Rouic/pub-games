"use client";

import { useState } from "react";

const EMOJIS = [
  "\u{1F3B2}", "\u{1F3AF}", "\u{1F37A}", "\u{1F3AA}", "\u{1F0CF}", "\u{1F3B0}", "\u{1F3B1}", "\u{1F37B}",
  "\u{1F3AD}", "\u{1F3B8}", "\u{1F3B6}", "\u{1F409}", "\u{1F98A}", "\u{1F419}", "\u{1F336}\uFE0F", "\u26A1",
  "\u{1F525}", "\u{1F30A}", "\u{1F3F4}\u200D\u2620\uFE0F", "\u{1F48E}", "\u{1F3A9}", "\u{1F9CA}", "\u{1F355}", "\u{1F32E}",
];

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
  const [mode, setMode] = useState<"menu" | "edit" | "claim" | "login">("menu");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState(player.name);
  const [editName, setEditName] = useState(player.name);
  const [editEmoji, setEditEmoji] = useState(player.emoji);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  if (!open) return null;

  function resetAndClose() {
    if (!busy) { onClose(); setMode("menu"); setError(""); setSuccess(""); }
  }

  async function handleUpdate() {
    const nameChanged = editName.trim() && editName.trim() !== player.name;
    const emojiChanged = editEmoji && editEmoji !== player.emoji;
    if (!nameChanged && !emojiChanged) { setMode("menu"); return; }

    setBusy(true); setError(""); setSuccess("");
    try {
      const res = await fetch("/api/auth/upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update",
          name: nameChanged ? editName.trim() : undefined,
          emoji: emojiChanged ? editEmoji : undefined,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setSuccess("Updated!");
      onUpdated(d.player);
      setTimeout(() => { setMode("menu"); setSuccess(""); }, 800);
    } catch (e: unknown) { setError(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  }

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
      setTimeout(() => { resetAndClose(); }, 2000);
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
      setTimeout(() => { resetAndClose(); window.location.reload(); }, 1500);
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
        onClick={resetAndClose}
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

        {/* ── Menu mode ── */}
        {mode === "menu" && (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>{player.emoji}</div>
            <div style={{ fontWeight: 700, color: "#fff", fontSize: "1.2rem" }}>{player.name}</div>

            {player.hasClaimed && (
              <div style={{ marginTop: "0.5rem", marginBottom: "0.75rem" }}>
                <span className="pill live" style={{ fontSize: "0.75rem" }}>Account claimed</span>
              </div>
            )}

            {/* Edit profile button — always visible */}
            <button
              className="btn btn-block"
              onClick={() => { setEditName(player.name); setEditEmoji(player.emoji); setMode("edit"); setError(""); }}
              style={{ marginTop: "0.75rem" }}
            >
              Edit name &amp; emoji
            </button>

            {player.hasClaimed ? (
              <p style={{ color: "var(--text-dim)", fontSize: "0.82rem", marginTop: "0.75rem" }}>
                Your data is safe. Sign in with your email on any device.
              </p>
            ) : (
              <div style={{ marginTop: "0.75rem" }}>
                <p style={{ color: "var(--text-dim)", fontSize: "0.85rem", marginBottom: "0.75rem", lineHeight: 1.6 }}>
                  You&apos;re anonymous right now. Add an email to keep your data forever and sign in on other devices.
                </p>
                <button
                  className="btn btn-primary btn-block"
                  onClick={() => { setMode("claim"); setError(""); }}
                  style={{ marginBottom: "0.5rem" }}
                >
                  Save my account
                </button>
                <button
                  className="btn btn-ghost btn-block btn-sm"
                  onClick={() => { setMode("login"); setError(""); }}
                >
                  I already have an account &mdash; sign in
                </button>
              </div>
            )}

            <button
              className="btn btn-ghost btn-sm"
              onClick={onClose}
              style={{ marginTop: "0.75rem", color: "var(--text-muted)" }}
            >
              Close
            </button>
          </div>
        )}

        {/* ── Edit mode ── */}
        {mode === "edit" && (
          <div>
            <h2 style={{ fontWeight: 700, color: "#fff", fontSize: "1.1rem", marginBottom: "0.75rem" }}>
              Edit profile
            </h2>

            {/* Emoji picker */}
            <div style={{ marginBottom: "1rem" }}>
              <div style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.5rem" }}>
                Choose your emoji
              </div>
              <div style={{
                display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: "0.35rem",
              }}>
                {EMOJIS.map((e) => (
                  <button
                    key={e}
                    onClick={() => setEditEmoji(e)}
                    style={{
                      fontSize: "1.5rem", padding: "0.4rem",
                      background: editEmoji === e ? "rgba(34,211,238,0.15)" : "transparent",
                      border: editEmoji === e ? "2px solid var(--neon-green)" : "2px solid transparent",
                      borderRadius: "var(--r-sm)",
                      cursor: "pointer",
                      transition: "all 0.15s",
                      lineHeight: 1,
                    }}
                  >{e}</button>
                ))}
              </div>
            </div>

            {/* Name input */}
            <div style={{ marginBottom: "0.5rem" }}>
              <div style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.4rem" }}>
                Display name
              </div>
              <input
                className="input"
                type="text"
                placeholder="Your name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                maxLength={30}
              />
            </div>

            {error && <p style={{ color: "var(--neon-red)", fontSize: "0.82rem", fontWeight: 600, marginTop: "0.5rem" }}>{error}</p>}
            {success && <p style={{ color: "var(--neon-green)", fontSize: "0.82rem", fontWeight: 600, marginTop: "0.5rem" }}>{success}</p>}

            <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
              <button className="btn btn-ghost" onClick={() => setMode("menu")} disabled={busy} style={{ flex: 1 }}>Back</button>
              <button
                className="btn btn-primary"
                onClick={handleUpdate}
                disabled={busy || (!editName.trim())}
                style={{ flex: 2 }}
              >
                {busy ? "Saving..." : "Save changes"}
              </button>
            </div>
          </div>
        )}

        {/* ── Claim mode ── */}
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

        {/* ── Login mode ── */}
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
