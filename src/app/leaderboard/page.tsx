"use client";

import { useState, useEffect } from "react";

interface PlayerStats {
  id: string;
  name: string;
  emoji: string;
  wins: number;
  losses: number;
  games_played: number;
  win_rate: number;
}

interface RecentGame {
  game: string;
  phase: string;
  updated_at: string;
  player_ids: string[];
  winner_id: string | null;
}

const GAME_ICONS: Record<string, string> = {
  dice: "\ud83c\udfb2",
  sketch: "\ud83c\udfa8",
  redblack: "\ud83c\udccf",
};

const GAME_NAMES: Record<string, string> = {
  dice: "Liar's Dice",
  sketch: "Sketch Duel",
  redblack: "Red or Black",
};

export default function LeaderboardPage() {
  const [players, setPlayers] = useState<PlayerStats[]>([]);
  const [recentGames, setRecentGames] = useState<RecentGame[]>([]);
  const [stats, setStats] = useState({ total_players: 0, total_games: 0, winners: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/leaderboard")
      .then((r) => r.json())
      .then((d) => {
        setPlayers(d.players ?? []);
        setRecentGames(d.recentGames ?? []);
        setStats(d.stats ?? {});
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="page"><div className="center-content">
        <div className="anim-pulse" style={{ fontSize: "2rem" }}>{"\ud83c\udfc6"}</div>
      </div></div>
    );
  }

  return (
    <div className="page" style={{ padding: "1rem" }}>
      <div style={{ maxWidth: 480, margin: "0 auto", width: "100%" }}>
        {/* Header */}
        <div className="anim-fade" style={{ textAlign: "center", marginBottom: "1.5rem" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: "0.3rem" }}>{"\ud83c\udfc6"}</div>
          <h1 style={{
            fontSize: "clamp(1.6rem, 6vw, 2.2rem)", fontWeight: 700, letterSpacing: "-0.03em",
            background: "linear-gradient(135deg, var(--neon-amber), var(--neon-green))",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          }}>
            Leaderboard
          </h1>
          <p style={{ color: "var(--text-dim)", fontSize: "0.85rem" }}>
            Top players across all games
          </p>
        </div>

        {/* Global stats */}
        <div className="anim-slide" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem", marginBottom: "1.5rem" }}>
          {[
            { label: "Players", value: stats.total_players ?? 0, color: "var(--neon-green)" },
            { label: "Games", value: stats.total_games ?? 0, color: "var(--neon-amber)" },
            { label: "Winners", value: stats.winners ?? 0, color: "var(--neon-pink)" },
          ].map((s) => (
            <div key={s.label} className="card" style={{ textAlign: "center", padding: "0.85rem 0.5rem" }}>
              <div style={{ fontSize: "1.5rem", fontWeight: 800, color: s.color, fontFamily: "var(--mono)" }}>{s.value}</div>
              <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Player rankings */}
        {players.length > 0 && (
          <div className="anim-slide" style={{ marginBottom: "1.5rem", animationDelay: "0.1s" }}>
            <div style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.5rem" }}>
              Rankings
            </div>
            {players.map((p, i) => {
              const medal = i === 0 ? "\ud83e\udd47" : i === 1 ? "\ud83e\udd48" : i === 2 ? "\ud83e\udd49" : null;
              return (
                <div key={p.id} className="card" style={{
                  display: "flex", alignItems: "center", gap: "0.75rem",
                  padding: "0.85rem 1rem", marginBottom: "0.4rem",
                  borderColor: i === 0 ? "rgba(251,191,36,0.3)" : undefined,
                  boxShadow: i === 0 ? "0 0 20px rgba(251,191,36,0.1)" : undefined,
                }}>
                  <span style={{ fontWeight: 700, color: i < 3 ? "var(--neon-amber)" : "var(--text-muted)", width: "1.5rem", textAlign: "center", fontSize: medal ? "1.2rem" : "0.85rem" }}>
                    {medal ?? `#${i + 1}`}
                  </span>
                  <span style={{ fontSize: "1.3rem" }}>{p.emoji}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, color: "#fff", fontSize: "0.9rem" }}>{p.name}</div>
                    <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                      {p.games_played} games &middot; {p.win_rate}% win rate
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontFamily: "var(--mono)", fontWeight: 700, color: "var(--neon-green)", fontSize: "1.1rem" }}>{p.wins}W</div>
                    <div style={{ fontFamily: "var(--mono)", fontSize: "0.7rem", color: "var(--text-muted)" }}>{p.losses}L</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Recent games */}
        {recentGames.length > 0 && (
          <div className="anim-slide" style={{ animationDelay: "0.2s" }}>
            <div style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.5rem" }}>
              Recent Games
            </div>
            {recentGames.slice(0, 10).map((g, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: "0.75rem",
                padding: "0.6rem 0", borderTop: i ? "1px solid var(--border)" : "none",
              }}>
                <span style={{ fontSize: "1.2rem" }}>{GAME_ICONS[g.game] ?? "\ud83c\udfae"}</span>
                <div style={{ flex: 1 }}>
                  <span style={{ fontWeight: 600, color: "#fff", fontSize: "0.82rem" }}>{GAME_NAMES[g.game] ?? g.game}</span>
                </div>
                <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                  {new Date(g.updated_at).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        )}

        {players.length === 0 && (
          <div className="card" style={{ textAlign: "center", padding: "2rem" }}>
            <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>{"\ud83c\udfae"}</div>
            <p style={{ color: "var(--text-dim)" }}>No games played yet. Be the first!</p>
          </div>
        )}

        <div style={{ textAlign: "center", marginTop: "1.5rem" }}>
          <a href="/" style={{ color: "var(--text-muted)", fontSize: "0.8rem", textDecoration: "none" }}>&larr; Back to games</a>
        </div>
      </div>
    </div>
  );
}
