"use client";
import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";

interface Player { id: string; name: string; emoji: string; }
interface GameState {
  turnOrder: string[]; round: number; maxRounds: number;
  prompt: string; votes: Record<string, string>;
  phase: "voting" | "results";
  results: { playerId: string; votes: number }[] | null;
  drinkers: string[]; scores: Record<string, number>;
  winner: string | null;
}

export default function MostLikelyGame() {
  const { roomId } = useParams() as { roomId: string };
  const [room, setRoom] = useState<Record<string, unknown> | null>(null);
  const [state, setState] = useState<GameState | null>(null);
  const [playerId, setPlayerId] = useState("");
  const [players, setPlayers] = useState<Player[]>([]);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");

  const showToast = useCallback((msg: string) => { setToast(msg); setTimeout(() => setToast(""), 2500); }, []);

  const fetchState = useCallback(async () => {
    try {
      const res = await fetch(`/api/mostlikely/${roomId}`);
      const d = await res.json();
      if (d.room) { setRoom(d.room); setState(d.room.state as GameState); setPlayerId(d.playerId); if (d.players) setPlayers(d.players); }
    } catch {}
  }, [roomId]);

  useEffect(() => {
    fetchState();
    const es = new EventSource(`/api/mostlikely/${roomId}/stream`);
    es.addEventListener("game", (e) => {
      const ev = JSON.parse(e.data);
      if (ev.type === "votes_tallied") showToast("Results are in!");
      if (ev.type === "game_over") showToast("Game over!");
      fetchState();
    });
    const poll = setInterval(fetchState, 3000);
    return () => { es.close(); clearInterval(poll); };
  }, [roomId, fetchState, showToast]);

  async function doAction(body: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch(`/api/mostlikely/${roomId}/action`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await res.json();
      if (!res.ok) showToast(d.error || "Error");
      else fetchState();
    } catch { showToast("Network error"); }
    finally { setBusy(false); }
  }

  const getName = (id: string) => players.find(p => p.id === id)?.name ?? "Player";
  const getEmoji = (id: string) => players.find(p => p.id === id)?.emoji ?? "?";

  if (!room || !state) return <div className="page"><div className="center-content"><div className="anim-pulse" style={{ fontSize: "2rem" }}>{"\ud83e\udd14"}</div></div></div>;

  const phase = (room as { phase: string }).phase;

  // ── Waiting room ──
  if (phase === "waiting") {
    const pids = (room as { player_ids: string[] }).player_ids;
    const hostId = (room as { host_id: string }).host_id;
    return (
      <div className="page">
        <div className="center-content">
          <div className="anim-fade" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>{"\ud83e\udd14"}</div>
            <h2 style={{ fontWeight: 700, marginBottom: "0.25rem" }}>Most Likely To</h2>
            <p style={{ color: "var(--text-dim)", fontSize: "0.88rem" }}>Share this code:</p>
          </div>
          <div className="room-code anim-scale">{(room as { code: string }).code}</div>
          <div className="card anim-slide" style={{ textAlign: "center", width: "100%", maxWidth: 340 }}>
            <div style={{ marginBottom: "0.5rem" }}><span style={{ color: "var(--neon-violet)" }}>{pids.length}</span> <span style={{ color: "var(--text-dim)" }}>players</span></div>
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center", flexWrap: "wrap", marginBottom: "0.75rem" }}>
              {pids.map(id => <span key={id} className="pill live" style={{ fontSize: "0.8rem" }}>{getEmoji(id)} {getName(id)}</span>)}
            </div>
            <div style={{ textAlign: "left", margin: "0.75rem 0", padding: "0.75rem", background: "var(--bg-raised)", borderRadius: "var(--r-sm)", fontSize: "0.8rem", color: "var(--text-dim)", lineHeight: 1.6 }}>
              <div style={{ fontWeight: 700, color: "#fff", marginBottom: "0.3rem", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>How to play</div>
              A prompt appears &mdash; everyone votes for who in the group fits best. The person with the most votes <strong style={{ color: "var(--neon-red)" }}>drinks</strong>! Fewest drinks at the end wins. Need at least 3 players.
            </div>
            {pids.length >= 3 && hostId === playerId && <button className="btn btn-primary btn-block btn-lg" onClick={() => doAction({ action: "start" })} disabled={busy} style={{ background: "linear-gradient(135deg, #7c3aed, #a78bfa)", borderColor: "var(--neon-violet)" }}>Start Game</button>}
            {pids.length >= 3 && hostId !== playerId && <div className="anim-pulse" style={{ color: "var(--text-dim)" }}>Waiting for host...</div>}
            {pids.length < 3 && <div className="anim-pulse" style={{ color: "var(--text-dim)" }}>Need at least 3 players...</div>}
          </div>
        </div>
      </div>
    );
  }

  // ── Finished ──
  if (phase === "finished" && state.winner) {
    const won = state.winner === playerId;
    const sorted = Object.entries(state.scores).sort((a, b) => a[1] - b[1]); // fewest drinks first
    return (
      <div className="page">
        <div className="center-content">
          <div className="anim-scale" style={{ fontSize: "4rem" }}>{won ? "\ud83c\udfc6" : "\ud83c\udf7b"}</div>
          <h2 className="anim-slide" style={{ fontSize: "1.8rem", fontWeight: 700, background: won ? "linear-gradient(135deg, var(--neon-violet), var(--neon-amber))" : "linear-gradient(135deg, var(--neon-red), var(--neon-pink))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            {won ? "You survived!" : `${getName(state.winner)} survived!`}
          </h2>
          <p style={{ color: "var(--text-dim)", fontSize: "0.85rem" }}>Fewest drinks wins</p>
          <div className="card anim-fade" style={{ width: "100%", maxWidth: 320 }}>
            {sorted.map(([id, drinks], i) => (
              <div key={id} style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.6rem 0", borderTop: i ? "1px solid var(--border)" : "none" }}>
                <span style={{ fontWeight: 700, color: i === 0 ? "var(--neon-amber)" : "var(--text-muted)", width: "1.25rem" }}>#{i + 1}</span>
                <span style={{ fontSize: "1.1rem" }}>{getEmoji(id)}</span>
                <span style={{ flex: 1, fontWeight: 600, color: "#fff" }}>{getName(id)}</span>
                <span style={{ fontFamily: "var(--mono)", fontWeight: 700, color: "var(--neon-red)" }}>{drinks} {"\ud83c\udf7a"}</span>
              </div>
            ))}
          </div>
          <button className="btn btn-primary btn-lg anim-fade" onClick={() => window.location.href = "/"}>Play again</button>
        </div>
      </div>
    );
  }

  // ── Playing ──
  const hasVoted = playerId in (state.votes ?? {});
  const votesIn = Object.keys(state.votes ?? {}).length;

  return (
    <div className="page" style={{ padding: "1rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>Round {state.round}/{state.maxRounds}</div>
        <div className="pill live" style={{ fontFamily: "var(--mono)" }}>{votesIn}/{state.turnOrder.length} voted</div>
      </div>

      {/* Drink scoreboard */}
      <div className="card" style={{ marginBottom: "1rem", padding: "0.75rem" }}>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", justifyContent: "center" }}>
          {state.turnOrder.map(id => (
            <div key={id} style={{ display: "flex", alignItems: "center", gap: "0.3rem", padding: "0.3rem 0.6rem", borderRadius: "var(--r-sm)", fontSize: "0.78rem", background: state.drinkers.includes(id) ? "rgba(239,68,68,0.1)" : "transparent", border: state.drinkers.includes(id) ? "1px solid rgba(239,68,68,0.3)" : "1px solid transparent" }}>
              <span>{getEmoji(id)}</span>
              <span style={{ fontWeight: 600, color: "#fff" }}>{id === playerId ? "You" : getName(id)}</span>
              {(state.scores[id] ?? 0) > 0 && <span style={{ fontFamily: "var(--mono)", fontWeight: 700, color: "var(--neon-red)", fontSize: "0.7rem" }}>{state.scores[id]}{"\ud83c\udf7a"}</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Prompt */}
      <div className="card anim-fade" style={{ textAlign: "center", padding: "1.5rem 1rem", marginBottom: "1.25rem", borderColor: "var(--neon-violet)", boxShadow: "0 0 20px rgba(167,139,250,0.15)" }}>
        <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.5rem" }}>Who is...</div>
        <div style={{ fontSize: "clamp(1.1rem, 4vw, 1.4rem)", fontWeight: 700, color: "#fff", lineHeight: 1.4 }}>
          {state.prompt}?
        </div>
      </div>

      {/* Voting phase */}
      {state.phase === "voting" && !hasVoted && (
        <div className="anim-slide">
          <div style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.5rem", textAlign: "center" }}>
            Vote for someone
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
            {state.turnOrder.map(id => (
              <button key={id} className="btn" style={{ justifyContent: "flex-start", gap: "0.75rem" }}
                onClick={() => doAction({ action: "vote", votedFor: id })} disabled={busy}>
                <span style={{ fontSize: "1.3rem" }}>{getEmoji(id)}</span>
                <span style={{ fontWeight: 600 }}>{id === playerId ? "Yourself" : getName(id)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {state.phase === "voting" && hasVoted && (
        <div className="anim-fade" style={{ textAlign: "center", color: "var(--text-dim)", padding: "1rem" }}>
          Vote cast! Waiting for others... ({votesIn}/{state.turnOrder.length})
        </div>
      )}

      {/* Results phase */}
      {state.phase === "results" && state.results && (
        <div className="anim-slide">
          <div className="card" style={{ padding: "1rem", marginBottom: "0.75rem", borderColor: state.drinkers.length > 0 ? "var(--neon-red)" : "var(--border)" }}>
            {state.drinkers.length > 0 && (
              <div style={{ textAlign: "center", marginBottom: "0.75rem" }}>
                <div style={{ fontSize: "1.5rem", marginBottom: "0.3rem" }}>{"\ud83c\udf7a"}</div>
                <div style={{ fontWeight: 700, color: "var(--neon-red)", fontSize: "1rem" }}>
                  {state.drinkers.map(id => id === playerId ? "You" : getName(id)).join(" & ")} drink{state.drinkers.length === 1 && !state.drinkers.includes(playerId) ? "s" : ""}!
                </div>
              </div>
            )}
            {state.results.map((r, i) => (
              <div key={r.playerId} style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.5rem 0", borderTop: i ? "1px solid var(--border)" : "none" }}>
                <span style={{ fontSize: "1.1rem" }}>{getEmoji(r.playerId)}</span>
                <span style={{ flex: 1, fontWeight: 600, color: "#fff" }}>{r.playerId === playerId ? "You" : getName(r.playerId)}</span>
                <div style={{ display: "flex", gap: "2px" }}>
                  {Array.from({ length: r.votes }, (_, j) => <span key={j} style={{ fontSize: "0.8rem" }}>{"\ud83d\udc46"}</span>)}
                </div>
                <span style={{ fontFamily: "var(--mono)", fontWeight: 700, color: state.drinkers.includes(r.playerId) ? "var(--neon-red)" : "var(--text-muted)" }}>{r.votes}</span>
              </div>
            ))}
          </div>
          <button className="btn btn-primary btn-block" onClick={() => doAction({ action: "next_round" })} disabled={busy}>
            Next prompt
          </button>
        </div>
      )}

      <div className={`toast ${toast ? "show" : ""}`}>{toast}</div>
    </div>
  );
}
