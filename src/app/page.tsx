"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import AccountSheet from "@/components/AccountSheet";

interface Player {
  id: string;
  name: string;
  emoji: string;
  wins: number;
  losses: number;
  games_played: number;
  hasClaimed?: boolean;
}

export default function Home() {
  const router = useRouter();
  const [player, setPlayer] = useState<Player | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [accountOpen, setAccountOpen] = useState(false);

  useEffect(() => {
    // Only check for existing player — don't create one on page load
    fetch("/api/auth")
      .then((r) => r.json())
      .then((d) => { if (d.player) setPlayer(d.player); })
      .catch(() => {});
  }, []);

  async function forgetMe() {
    if (!confirm("Delete all your game data? Your anonymous identity, win/loss record, and any active game rooms will be permanently removed.")) return;
    setBusy(true);
    try {
      await fetch("/api/auth", { method: "DELETE" });
      setPlayer(null);
    } catch { /* ignore */ }
    finally { setBusy(false); }
  }

  async function createGame(game: "dice" | "sketch" | "redblack") {
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
    <div className="page" style={{ overflow: "hidden" }}>
      {/* Animated background orbs */}
      <div style={{
        position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none",
      }}>
        <div style={{
          position: "absolute", top: "-20%", left: "-10%",
          width: "60vw", height: "60vw", borderRadius: "50%",
          background: "radial-gradient(circle, rgba(34,211,238,0.12) 0%, transparent 70%)",
          animation: "float1 8s ease-in-out infinite",
        }} />
        <div style={{
          position: "absolute", bottom: "-20%", right: "-10%",
          width: "50vw", height: "50vw", borderRadius: "50%",
          background: "radial-gradient(circle, rgba(244,114,182,0.1) 0%, transparent 70%)",
          animation: "float2 10s ease-in-out infinite",
        }} />
        <div style={{
          position: "absolute", top: "30%", right: "20%",
          width: "25vw", height: "25vw", borderRadius: "50%",
          background: "radial-gradient(circle, rgba(251,191,36,0.06) 0%, transparent 70%)",
          animation: "float3 12s ease-in-out infinite",
        }} />
      </div>

      <style>{`
        @keyframes float1 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(30px,-40px) scale(1.1); } }
        @keyframes float2 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(-40px,30px) scale(1.15); } }
        @keyframes float3 { 0%,100% { transform: translate(0,0); } 50% { transform: translate(20px,20px); } }

        .game-card {
          position: relative;
          display: flex; flex-direction: column; align-items: center;
          padding: 2rem 1.25rem 1.75rem;
          border-radius: 20px;
          cursor: pointer;
          transition: transform 0.25s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.25s;
          -webkit-tap-highlight-color: transparent;
          overflow: hidden;
          text-align: center;
        }
        .game-card::before {
          content: "";
          position: absolute; inset: 0;
          border-radius: 20px;
          padding: 2px;
          background: var(--card-gradient);
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          pointer-events: none;
        }
        .game-card:hover { transform: translateY(-6px) scale(1.02); }
        .game-card:active { transform: translateY(-2px) scale(0.98); }

        .game-card.dice {
          background: linear-gradient(160deg, rgba(34,211,238,0.08), rgba(6,182,212,0.02));
          --card-gradient: linear-gradient(135deg, rgba(34,211,238,0.6), rgba(34,211,238,0.1));
          box-shadow: 0 8px 40px rgba(34,211,238,0.15), inset 0 1px 0 rgba(255,255,255,0.05);
        }
        .game-card.dice:hover { box-shadow: 0 12px 50px rgba(34,211,238,0.3), inset 0 1px 0 rgba(255,255,255,0.08); }

        .game-card.sketch {
          background: linear-gradient(160deg, rgba(244,114,182,0.08), rgba(236,72,153,0.02));
          --card-gradient: linear-gradient(135deg, rgba(244,114,182,0.6), rgba(244,114,182,0.1));
          box-shadow: 0 8px 40px rgba(244,114,182,0.15), inset 0 1px 0 rgba(255,255,255,0.05);
        }
        .game-card.sketch:hover { box-shadow: 0 12px 50px rgba(244,114,182,0.3), inset 0 1px 0 rgba(255,255,255,0.08); }

        .game-card.redblack {
          background: linear-gradient(160deg, rgba(239,68,68,0.08), rgba(30,41,59,0.08));
          --card-gradient: linear-gradient(135deg, rgba(239,68,68,0.6), rgba(30,41,59,0.6));
          box-shadow: 0 8px 40px rgba(239,68,68,0.12), inset 0 1px 0 rgba(255,255,255,0.05);
        }
        .game-card.redblack:hover { box-shadow: 0 12px 50px rgba(239,68,68,0.25), inset 0 1px 0 rgba(255,255,255,0.08); }

        .game-icon {
          font-size: 4rem;
          margin-bottom: 0.75rem;
          filter: drop-shadow(0 0 20px rgba(255,255,255,0.2));
          animation: iconBounce 3s ease-in-out infinite;
        }
        .game-card.dice .game-icon { animation-delay: 0s; }
        .game-card.sketch .game-icon { animation-delay: 1.5s; }
        @keyframes iconBounce {
          0%,100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }

        .game-title {
          font-size: 1.35rem;
          font-weight: 700;
          color: #ffffff;
          margin-bottom: 0.4rem;
          letter-spacing: -0.01em;
        }
        .game-desc {
          font-size: 0.85rem;
          color: rgba(255,255,255,0.55);
          line-height: 1.4;
        }

        .join-section {
          background: rgba(17,24,39,0.7);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 20px;
          padding: 1.5rem;
          width: 100%;
        }

        .hero-title {
          font-size: clamp(2.2rem, 8vw, 3.5rem);
          font-weight: 800;
          letter-spacing: -0.04em;
          line-height: 1;
          text-align: center;
          background: linear-gradient(135deg, #22d3ee 0%, #f472b6 50%, #fbbf24 100%);
          background-size: 200% 200%;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: gradientShift 4s ease-in-out infinite;
        }
        @keyframes gradientShift {
          0%,100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }

        .subtitle {
          color: rgba(255,255,255,0.5);
          font-size: clamp(0.95rem, 3vw, 1.15rem);
          text-align: center;
          font-weight: 400;
        }

        .or-divider {
          display: flex; align-items: center; gap: 1rem;
          color: rgba(255,255,255,0.2);
          font-size: 0.75rem; font-weight: 600;
          letter-spacing: 0.15em; text-transform: uppercase;
          width: 100%;
        }
        .or-divider::before, .or-divider::after {
          content: ""; flex: 1; height: 1px;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent);
        }
      `}</style>

      <div className="center-content" style={{
        maxWidth: 440, margin: "0 auto", width: "100%",
        position: "relative", zIndex: 1,
        gap: "1.75rem",
      }}>
        {/* Hero */}
        <div className="anim-fade" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem" }}>
          <div style={{ fontSize: "3.5rem", filter: "drop-shadow(0 0 30px rgba(251,191,36,0.4))" }}>🍺</div>
          <h1 className="hero-title">Pub Games</h1>
          <p className="subtitle">Grab a friend. Grab a pint.</p>
          {player && (
            <button
              className="player-chip anim-fade"
              style={{ animationDelay: "0.3s", marginTop: "0.25rem", cursor: "pointer" }}
              onClick={() => setAccountOpen(true)}
            >
              <span style={{ fontSize: "1.1rem" }}>{player.emoji}</span>
              <span style={{ fontWeight: 600, color: "#fff" }}>{player.name}</span>
              {player.hasClaimed ? (
                <span style={{ fontSize: "0.65rem", color: "var(--neon-green)" }}>✓</span>
              ) : (
                <span style={{ fontSize: "0.6rem", opacity: 0.4, background: "rgba(255,255,255,0.1)", borderRadius: 4, padding: "1px 5px" }}>tap to save</span>
              )}
            </button>
          )}
        </div>

        {/* Game cards */}
        <div className="anim-slide" style={{
          display: "flex", flexDirection: "column",
          gap: "0.75rem", width: "100%",
          animationDelay: "0.15s",
        }}>
          {[
            { cls: "dice", game: "dice" as const, icon: "🎲", title: "Liar\u2019s Dice", desc: "Bluff your way to victory", players: "2 players" },
            { cls: "sketch", game: "sketch" as const, icon: "🎨", title: "Sketch Duel", desc: "Draw it. Guess it. Win it.", players: "2 players" },
            { cls: "redblack", game: "redblack" as const, icon: "🃏", title: "Red or Black", desc: "Guess wrong? Drink!", players: "2\u201310 players" },
          ].map((g) => (
            <button
              key={g.game}
              className={`game-card ${g.cls}`}
              onClick={() => createGame(g.game)}
              disabled={busy}
              style={{ flexDirection: "row", gap: "1rem", padding: "1.1rem 1.25rem", textAlign: "left" }}
            >
              <div className="game-icon" style={{ fontSize: "2.5rem", marginBottom: 0 }}>{g.icon}</div>
              <div style={{ flex: 1 }}>
                <div className="game-title" style={{ fontSize: "1.15rem" }}>{g.title}</div>
                <div className="game-desc">{g.desc}</div>
              </div>
              <div style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.35)", alignSelf: "center", whiteSpace: "nowrap" }}>{g.players}</div>
            </button>
          ))}
        </div>

        {/* Pub Tracker */}
        <button
          className="game-card anim-slide"
          onClick={() => router.push("/tracker")}
          style={{
            width: "100%",
            animationDelay: "0.2s",
            background: "linear-gradient(160deg, rgba(251,191,36,0.08), rgba(245,158,11,0.02))",
            boxShadow: "0 8px 40px rgba(251,191,36,0.12), inset 0 1px 0 rgba(255,255,255,0.05)",
            "--card-gradient": "linear-gradient(135deg, rgba(251,191,36,0.5), rgba(251,191,36,0.1))",
            flexDirection: "row",
            gap: "1rem",
            padding: "1.25rem 1.5rem",
          } as React.CSSProperties}
        >
          <div style={{ fontSize: "2.5rem" }}>🍻</div>
          <div style={{ textAlign: "left" }}>
            <div className="game-title">Pub Tracker</div>
            <div className="game-desc">Rate pubs with friends. Track your favourites over time.</div>
          </div>
        </button>

        {/* Leaderboard link */}
        <button
          className="game-card anim-slide"
          onClick={() => router.push("/leaderboard")}
          style={{
            width: "100%",
            animationDelay: "0.25s",
            background: "linear-gradient(160deg, rgba(167,139,250,0.06), rgba(139,92,246,0.02))",
            boxShadow: "0 4px 20px rgba(167,139,250,0.08), inset 0 1px 0 rgba(255,255,255,0.05)",
            "--card-gradient": "linear-gradient(135deg, rgba(167,139,250,0.4), rgba(167,139,250,0.1))",
            flexDirection: "row",
            gap: "1rem",
            padding: "1rem 1.5rem",
          } as React.CSSProperties}
        >
          <div style={{ fontSize: "2rem" }}>{"\ud83c\udfc6"}</div>
          <div style={{ textAlign: "left" }}>
            <div className="game-title" style={{ fontSize: "1.1rem" }}>Leaderboard</div>
            <div className="game-desc">See who&apos;s on top across all games</div>
          </div>
        </button>

        {/* Divider */}
        <div className="or-divider anim-fade" style={{ animationDelay: "0.3s" }}>or join a game</div>

        {/* Join section */}
        <div className="join-section anim-slide" style={{ animationDelay: "0.25s" }}>
          <div style={{ display: "flex", gap: "0.6rem" }}>
            <input
              className="input input-code"
              placeholder="CODE"
              maxLength={4}
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && joinGame()}
              style={{ flex: 1, background: "rgba(0,0,0,0.3)", borderColor: "rgba(255,255,255,0.1)" }}
            />
            <button
              className="btn btn-primary btn-lg"
              onClick={joinGame}
              disabled={busy || joinCode.length < 4}
              style={{ flexShrink: 0, padding: "1rem 1.75rem" }}
            >
              Join
            </button>
          </div>
        </div>

        {error && (
          <div className="anim-shake" style={{
            color: "var(--neon-red)",
            fontSize: "0.88rem",
            fontWeight: 600,
            textAlign: "center",
          }}>
            {error}
          </div>
        )}

        {/* Footer */}
        <div style={{
          color: "rgba(255,255,255,0.2)",
          fontSize: "0.7rem",
          textAlign: "center",
          marginTop: "auto",
          paddingTop: "0.75rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.5rem",
          alignItems: "center",
        }}>
          {player && (
            <button
              onClick={forgetMe}
              disabled={busy}
              style={{
                background: "none",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "var(--r-sm)",
                color: "rgba(255,255,255,0.35)",
                fontSize: "0.72rem",
                padding: "0.35rem 0.85rem",
                cursor: "pointer",
                transition: "color 0.15s, border-color 0.15s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = "var(--neon-red)"; e.currentTarget.style.borderColor = "rgba(248,113,113,0.3)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(255,255,255,0.35)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }}
            >
              Forget me &mdash; delete my data
            </button>
          )}
          <div>
            <a
              href="/privacy"
              style={{ color: "rgba(255,255,255,0.3)", textDecoration: "none" }}
            >
              Privacy
            </a>
            {" · "}
            Powered by{" "}
            <a
              href="https://system.rouic.com"
              target="_blank"
              rel="noopener"
              style={{ color: "rgba(34,211,238,0.5)", textDecoration: "none" }}
            >
              Rouic Platform
            </a>
          </div>
          <div style={{ fontSize: "0.65rem", maxWidth: "20rem", lineHeight: 1.5 }}>
            By creating or joining a game you agree to a functional cookie being set to remember your anonymous identity.{" "}
            <a href="/privacy" style={{ color: "rgba(34,211,238,0.4)", textDecoration: "none" }}>Learn more</a>
          </div>
        </div>
      </div>

      {/* Account sheet */}
      {player && (
        <AccountSheet
          player={player}
          open={accountOpen}
          onClose={() => setAccountOpen(false)}
          onUpdated={(p) => setPlayer(p as Player)}
        />
      )}
    </div>
  );
}
