"use client";
import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";

interface Player { id: string; name: string; emoji: string; }
interface CardData { suit: string; rank: string; value: number; color: "red" | "black"; }
interface GameState {
  currentCard: CardData; previousCard: CardData | null;
  currentPlayer: number; turnOrder: string[];
  scores: Record<string, number>; streaks: Record<string, number>; bestStreaks: Record<string, number>;
  lastGuess: { playerId: string; guess: string; correct: boolean } | null;
  cardsPlayed: number; totalCards: number; deck: number; winner: string | null;
}

const SUIT: Record<string, string> = { hearts: "\u2665", diamonds: "\u2666", clubs: "\u2663", spades: "\u2660" };
const SUIT_C: Record<string, string> = { hearts: "#ef4444", diamonds: "#ef4444", clubs: "#1e293b", spades: "#1e293b" };

function Card({ card, small, glow }: { card: CardData | null; small?: boolean; glow?: string }) {
  const w = small ? "3.5rem" : "6rem";
  const h = small ? "5rem" : "8.5rem";
  if (!card) return <div style={{ width: w, height: h, borderRadius: "var(--r)", background: "linear-gradient(135deg,#1e40af,#3b82f6)", border: "2px solid #60a5fa", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.3)", fontSize: small ? "1rem" : "1.5rem" }}>?</div>;
  return (
    <div style={{
      width: w, height: h, borderRadius: "var(--r)", background: "#fff", border: "2px solid #e5e7eb",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "0.15rem",
      color: SUIT_C[card.suit] ?? "#000",
      boxShadow: glow ? `0 4px 20px ${glow}` : "0 2px 10px rgba(0,0,0,0.15)",
      animation: glow ? "cardFlip 0.4s ease-out" : undefined,
    }}>
      <span style={{ fontSize: small ? "1rem" : "1.8rem", fontWeight: 800, lineHeight: 1 }}>{card.rank}</span>
      <span style={{ fontSize: small ? "1.2rem" : "2rem", lineHeight: 1 }}>{SUIT[card.suit]}</span>
    </div>
  );
}

export default function HighLowGame() {
  const { roomId } = useParams() as { roomId: string };
  const [room, setRoom] = useState<Record<string, unknown> | null>(null);
  const [state, setState] = useState<GameState | null>(null);
  const [playerId, setPlayerId] = useState("");
  const [players, setPlayers] = useState<Player[]>([]);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const [flipping, setFlipping] = useState(false);

  const showToast = useCallback((msg: string) => { setToast(msg); setTimeout(() => setToast(""), 2500); }, []);

  const fetchState = useCallback(async () => {
    try {
      const res = await fetch(`/api/highlow/${roomId}`);
      const d = await res.json();
      if (d.room) { setRoom(d.room); setState(d.room.state as GameState); setPlayerId(d.playerId); if (d.players) setPlayers(d.players); }
    } catch {}
  }, [roomId]);

  useEffect(() => {
    fetchState();
    const es = new EventSource(`/api/highlow/${roomId}/stream`);
    es.addEventListener("game", (e) => {
      const ev = JSON.parse(e.data);
      if (ev.type === "card_flipped") { setFlipping(true); setTimeout(() => setFlipping(false), 500); showToast(ev.correct ? "Correct! \ud83c\udf89" : "Wrong! Drink! \ud83c\udf7a"); }
      if (ev.type === "game_over") showToast("Game over!");
      fetchState();
    });
    const poll = setInterval(fetchState, 3000);
    return () => { es.close(); clearInterval(poll); };
  }, [roomId, fetchState, showToast]);

  async function doAction(body: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch(`/api/highlow/${roomId}/action`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await res.json();
      if (!res.ok) showToast(d.error || "Error");
      else { if (body.action === "guess") { setFlipping(true); setTimeout(() => setFlipping(false), 500); } fetchState(); }
    } catch { showToast("Network error"); }
    finally { setBusy(false); }
  }

  const getName = (id: string) => players.find(p => p.id === id)?.name ?? "Player";
  const getEmoji = (id: string) => players.find(p => p.id === id)?.emoji ?? "?";

  if (!room || !state) return <div className="page"><div className="center-content"><div className="anim-pulse" style={{ fontSize: "2rem" }}>🃏</div></div></div>;

  const phase = (room as { phase: string }).phase;

  if (phase === "waiting") {
    const pids = (room as { player_ids: string[] }).player_ids;
    const hostId = (room as { host_id: string }).host_id;
    return (
      <div className="page"><style>{`@keyframes cardFlip { 0% { transform: rotateY(180deg) scale(0.8); opacity: 0; } 100% { transform: rotateY(0) scale(1); opacity: 1; } }`}</style>
        <div className="center-content">
          <div className="anim-fade" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>📈</div>
            <h2 style={{ fontWeight: 700, marginBottom: "0.25rem" }}>Higher or Lower</h2>
            <p style={{ color: "var(--text-dim)", fontSize: "0.88rem" }}>Share this code:</p>
          </div>
          <div className="room-code anim-scale">{(room as { code: string }).code}</div>
          <div className="card anim-slide" style={{ textAlign: "center", width: "100%", maxWidth: 340 }}>
            <div style={{ marginBottom: "0.5rem" }}><span style={{ color: "var(--neon-green)" }}>{pids.length}</span> <span style={{ color: "var(--text-dim)" }}>players</span></div>
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center", flexWrap: "wrap", marginBottom: "0.75rem" }}>
              {pids.map(id => <span key={id} className="pill live" style={{ fontSize: "0.8rem" }}>{getEmoji(id)} {getName(id)}</span>)}
            </div>
            <div style={{ textAlign: "left", margin: "0.75rem 0", padding: "0.75rem", background: "var(--bg-raised)", borderRadius: "var(--r-sm)", fontSize: "0.8rem", color: "var(--text-dim)", lineHeight: 1.6 }}>
              <div style={{ fontWeight: 700, color: "#fff", marginBottom: "0.3rem", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>How to play</div>
              A card is face up. Guess if the next card will be <strong style={{ color: "#fff" }}>higher</strong> or <strong style={{ color: "#fff" }}>lower</strong>. Same value counts as wrong. Guess wrong &mdash; drink! Most correct guesses wins.
            </div>
            {pids.length >= 2 && hostId === playerId && <button className="btn btn-primary btn-block btn-lg" onClick={() => doAction({ action: "start" })} disabled={busy}>Flip the first card</button>}
            {pids.length >= 2 && hostId !== playerId && <div className="anim-pulse" style={{ color: "var(--text-dim)" }}>Waiting for host...</div>}
            {pids.length < 2 && <div className="anim-pulse" style={{ color: "var(--text-dim)" }}>Need at least 2 players...</div>}
          </div>
        </div>
      </div>
    );
  }

  const isMyTurn = state.turnOrder[state.currentPlayer] === playerId;
  const currentPid = state.turnOrder[state.currentPlayer];
  const remaining = typeof state.deck === "number" ? state.deck : 0;

  if (phase === "finished" && state.winner) {
    const won = state.winner === playerId;
    const sorted = Object.entries(state.scores).sort((a, b) => b[1] - a[1]);
    return (
      <div className="page"><style>{`@keyframes cardFlip { 0% { transform: rotateY(180deg) scale(0.8); opacity: 0; } 100% { transform: rotateY(0) scale(1); opacity: 1; } }`}</style>
        <div className="center-content">
          <div className="anim-scale" style={{ fontSize: "4rem" }}>{won ? "\ud83c\udfc6" : "\ud83c\udf7b"}</div>
          <h2 className="anim-slide" style={{ fontSize: "1.8rem", fontWeight: 700, background: won ? "linear-gradient(135deg, var(--neon-green), var(--neon-amber))" : "linear-gradient(135deg, var(--neon-red), var(--neon-pink))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            {won ? "You won!" : `${getName(state.winner)} wins!`}
          </h2>
          <div className="card anim-fade" style={{ width: "100%", maxWidth: 320 }}>
            {sorted.map(([id, score], i) => (
              <div key={id} style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.6rem 0", borderTop: i ? "1px solid var(--border)" : "none" }}>
                <span style={{ fontWeight: 700, color: i === 0 ? "var(--neon-amber)" : "var(--text-muted)", width: "1.25rem" }}>#{i + 1}</span>
                <span style={{ fontSize: "1.1rem" }}>{getEmoji(id)}</span>
                <span style={{ flex: 1, fontWeight: 600, color: "#fff" }}>{getName(id)}</span>
                <span style={{ fontFamily: "var(--mono)", fontWeight: 700, color: "var(--neon-green)" }}>{score}</span>
                <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>streak: {state.bestStreaks[id] ?? 0}</span>
              </div>
            ))}
          </div>
          <button className="btn btn-primary btn-lg anim-fade" onClick={() => window.location.href = "/"}>Play again</button>
        </div>
      </div>
    );
  }

  return (
    <div className="page" style={{ padding: "1rem" }}>
      <style>{`@keyframes cardFlip { 0% { transform: rotateY(180deg) scale(0.8); opacity: 0; } 100% { transform: rotateY(0) scale(1); opacity: 1; } }`}</style>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>{state.cardsPlayed}/{state.totalCards}</div>
        <div className="pill live" style={{ fontFamily: "var(--mono)", fontWeight: 700 }}>{remaining} left</div>
      </div>

      {/* Scoreboard */}
      <div className="card" style={{ marginBottom: "1rem", padding: "0.75rem" }}>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", justifyContent: "center" }}>
          {state.turnOrder.map(id => (
            <div key={id} style={{
              display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.4rem 0.7rem",
              borderRadius: "var(--r-sm)", fontSize: "0.8rem",
              background: id === currentPid ? "rgba(34,211,238,0.1)" : "transparent",
              border: id === currentPid ? "1px solid rgba(34,211,238,0.3)" : "1px solid transparent",
            }}>
              <span>{getEmoji(id)}</span>
              <span style={{ fontWeight: 600, color: id === currentPid ? "#fff" : "var(--text-dim)" }}>{id === playerId ? "You" : getName(id)}</span>
              <span style={{ fontFamily: "var(--mono)", fontWeight: 700, color: "var(--neon-amber)" }}>{state.scores[id] ?? 0}</span>
              {(state.streaks[id] ?? 0) >= 2 && <span style={{ fontSize: "0.65rem", color: "var(--neon-green)", fontWeight: 700 }}>{state.streaks[id]}{"\ud83d\udd25"}</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Cards display */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem", marginBottom: "1.5rem" }}>
        {state.lastGuess && (
          <div className="anim-fade" style={{ fontSize: "0.85rem", fontWeight: 600, color: state.lastGuess.correct ? "var(--neon-green)" : "var(--neon-red)" }}>
            {getEmoji(state.lastGuess.playerId)} {state.lastGuess.playerId === playerId ? "You" : getName(state.lastGuess.playerId)} said {state.lastGuess.guess} &mdash; {state.lastGuess.correct ? "Correct!" : "Wrong! Drink! \ud83c\udf7a"}
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          {state.previousCard && <Card card={state.previousCard} small />}
          {state.previousCard && <span style={{ color: "var(--text-muted)", fontSize: "1.2rem" }}>&rarr;</span>}
          <Card card={state.currentCard} glow={flipping ? (state.lastGuess?.correct ? "rgba(34,211,238,0.4)" : "rgba(239,68,68,0.4)") : undefined} />
        </div>
        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
          Card value: <strong style={{ color: "#fff" }}>{state.currentCard.value}</strong> (A=1, K=13)
        </div>
      </div>

      {/* Guess buttons */}
      {isMyTurn && (
        <div className="anim-slide">
          <div style={{ textAlign: "center", fontSize: "0.82rem", color: "var(--text-dim)", marginBottom: "0.75rem", fontWeight: 600 }}>
            Your turn &mdash; will the next card be higher or lower than {state.currentCard.rank}?
          </div>
          <div style={{ display: "flex", gap: "0.75rem", maxWidth: 320, margin: "0 auto" }}>
            <button className="btn btn-lg" style={{ flex: 1, background: "linear-gradient(135deg, #059669, #10b981)", borderColor: "#34d399", color: "#fff", fontSize: "1.1rem", fontWeight: 800 }}
              onClick={() => doAction({ action: "guess", guess: "higher" })} disabled={busy}>{"\u2191"} Higher</button>
            <button className="btn btn-lg" style={{ flex: 1, background: "linear-gradient(135deg, #dc2626, #ef4444)", borderColor: "#f87171", color: "#fff", fontSize: "1.1rem", fontWeight: 800 }}
              onClick={() => doAction({ action: "guess", guess: "lower" })} disabled={busy}>{"\u2193"} Lower</button>
          </div>
        </div>
      )}
      {!isMyTurn && <div className="anim-pulse" style={{ textAlign: "center", color: "var(--text-dim)", padding: "1rem" }}>{getEmoji(currentPid)} {getName(currentPid)}&apos;s turn...</div>}
      <div className={`toast ${toast ? "show" : ""}`}>{toast}</div>
    </div>
  );
}
