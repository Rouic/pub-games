"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface Player {
  id: string;
  name: string;
  emoji: string;
  wins: number;
  losses: number;
  games_played: number;
}

export default function Home() {
  const router = useRouter();
  const [player, setPlayer] = useState<Player | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/auth")
      .then((r) => r.json())
      .then((d) => setPlayer(d.player))
      .catch(() => {});
  }, []);

  async function createGame(game: "dice" | "sketch") {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", game }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      router.push(`/${game}/${data.room.id}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to create game");
    } finally {
      setBusy(false);
    }
  }

  async function joinGame() {
    if (!joinCode.trim()) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "join", code: joinCode.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      router.push(`/${data.room.game}/${data.room.id}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to join");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <div className="center-content" style={{ maxWidth: 480, margin: "0 auto", width: "100%" }}>
        {/* Header */}
        <div className="anim-fade" style={{ textAlign: "center" }}>
          <div style={{ fontSize: "3rem", marginBottom: "0.5rem" }}>🍺</div>
          <h1
            style={{
              fontSize: "clamp(1.8rem, 6vw, 2.4rem)",
              fontWeight: 700,
              letterSpacing: "-0.03em",
              background: "linear-gradient(135deg, var(--neon-green), var(--neon-pink))",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              marginBottom: "0.3rem",
            }}
          >
            Pub Games
          </h1>
          <p style={{ color: "var(--text-dim)", fontSize: "0.95rem" }}>
            Grab a friend, grab a pint.
          </p>
          {player && (
            <div
              className="anim-fade"
              style={{
                marginTop: "0.75rem",
                display: "inline-flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.4rem 1rem",
                background: "var(--bg-raised)",
                borderRadius: "var(--r)",
                border: "1px solid var(--border)",
                fontSize: "0.85rem",
              }}
            >
              <span>{player.emoji}</span>
              <span style={{ fontWeight: 600 }}>{player.name}</span>
              {player.games_played > 0 && (
                <span style={{ color: "var(--text-muted)", fontSize: "0.78rem" }}>
                  {player.wins}W / {player.losses}L
                </span>
              )}
            </div>
          )}
        </div>

        {/* Game cards */}
        <div
          className="anim-slide"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "0.85rem",
            width: "100%",
            animationDelay: "0.1s",
          }}
        >
          <button
            className="card card-interactive glow-green"
            onClick={() => createGame("dice")}
            disabled={busy}
            style={{
              border: "1px solid rgba(34, 211, 238, 0.25)",
              textAlign: "center",
              padding: "1.5rem 1rem",
            }}
          >
            <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>🎲</div>
            <div style={{ fontWeight: 700, fontSize: "1.05rem", marginBottom: "0.25rem" }}>
              Liar&apos;s Dice
            </div>
            <div style={{ color: "var(--text-muted)", fontSize: "0.78rem" }}>
              Bluff your way to victory
            </div>
          </button>

          <button
            className="card card-interactive glow-pink"
            onClick={() => createGame("sketch")}
            disabled={busy}
            style={{
              border: "1px solid rgba(244, 114, 182, 0.25)",
              textAlign: "center",
              padding: "1.5rem 1rem",
            }}
          >
            <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>🎨</div>
            <div style={{ fontWeight: 700, fontSize: "1.05rem", marginBottom: "0.25rem" }}>
              Sketch Duel
            </div>
            <div style={{ color: "var(--text-muted)", fontSize: "0.78rem" }}>
              Draw it, guess it, win it
            </div>
          </button>
        </div>

        {/* Join existing game */}
        <div
          className="card anim-slide"
          style={{ width: "100%", animationDelay: "0.2s" }}
        >
          <div
            style={{
              fontSize: "0.75rem",
              fontWeight: 600,
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              marginBottom: "0.75rem",
              textAlign: "center",
            }}
          >
            Join a friend&apos;s game
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <input
              className="input input-code"
              placeholder="CODE"
              maxLength={4}
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && joinGame()}
              style={{ flex: 1 }}
            />
            <button
              className="btn btn-primary"
              onClick={joinGame}
              disabled={busy || joinCode.length < 4}
              style={{ flexShrink: 0 }}
            >
              Join
            </button>
          </div>
        </div>

        {error && (
          <div
            className="anim-shake"
            style={{
              color: "var(--neon-red)",
              fontSize: "0.88rem",
              fontWeight: 600,
              textAlign: "center",
            }}
          >
            {error}
          </div>
        )}

        {/* Footer */}
        <div
          style={{
            color: "var(--text-muted)",
            fontSize: "0.72rem",
            textAlign: "center",
            marginTop: "auto",
            paddingTop: "1rem",
          }}
        >
          Powered by{" "}
          <a
            href="https://system.rouic.com"
            target="_blank"
            rel="noopener"
            style={{ color: "var(--neon-green)", textDecoration: "none" }}
          >
            Rouic Platform
          </a>
        </div>
      </div>
    </div>
  );
}
