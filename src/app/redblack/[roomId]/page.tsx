"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";

interface Player { id: string; name: string; emoji: string; }

interface CardData {
  suit: string;
  rank: string;
  color: "red" | "black";
}

interface GameState {
  currentCard: CardData | null;
  currentPlayer: number;
  turnOrder: string[];
  scores: Record<string, number>;
  streaks: Record<string, number>;
  bestStreaks: Record<string, number>;
  lastGuess: { playerId: string; guess: string; correct: boolean } | null;
  cardsPlayed: number;
  totalCards: number;
  deck: number; // remaining cards count (masked)
  winner: string | null;
}

const SUIT_SYMBOLS: Record<string, string> = {
  hearts: "\u2665", diamonds: "\u2666", clubs: "\u2663", spades: "\u2660",
};
const SUIT_COLORS: Record<string, string> = {
  hearts: "#ef4444", diamonds: "#ef4444", clubs: "#1e293b", spades: "#1e293b",
};

function PlayingCard({ card, size = "lg", flipping }: { card: CardData | null; size?: "sm" | "lg"; flipping?: boolean }) {
  const w = size === "lg" ? "7rem" : "3.5rem";
  const h = size === "lg" ? "10rem" : "5rem";
  const fontSize = size === "lg" ? "2rem" : "1rem";
  const suitSize = size === "lg" ? "3rem" : "1.5rem";

  if (!card) {
    return (
      <div style={{
        width: w, height: h, borderRadius: "var(--r)", display: "flex", alignItems: "center", justifyContent: "center",
        background: "linear-gradient(135deg, #1e40af, #3b82f6)", border: "2px solid #60a5fa",
        boxShadow: "0 4px 20px rgba(59,130,246,0.3)", fontSize: suitSize, color: "rgba(255,255,255,0.3)",
      }}>
        ?
      </div>
    );
  }

  return (
    <div style={{
      width: w, height: h, borderRadius: "var(--r)", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", gap: "0.25rem",
      background: "#fff", border: "2px solid #e5e7eb",
      boxShadow: flipping ? `0 8px 30px ${card.color === "red" ? "rgba(239,68,68,0.4)" : "rgba(30,41,59,0.4)"}` : "0 4px 15px rgba(0,0,0,0.2)",
      color: SUIT_COLORS[card.suit] ?? "#000",
      animation: flipping ? "cardFlip 0.4s ease-out" : undefined,
      position: "relative",
    }}>
      <span style={{ fontSize, fontWeight: 800, lineHeight: 1 }}>{card.rank}</span>
      <span style={{ fontSize: suitSize, lineHeight: 1 }}>{SUIT_SYMBOLS[card.suit] ?? ""}</span>
    </div>
  );
}

export default function RedBlackGame() {
  const params = useParams();
  const roomId = params.roomId as string;
  const [room, setRoom] = useState<Record<string, unknown> | null>(null);
  const [state, setState] = useState<GameState | null>(null);
  const [playerId, setPlayerId] = useState("");
  const [players, setPlayers] = useState<Player[]>([]);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const [flipping, setFlipping] = useState(false);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  }, []);

  const fetchState = useCallback(async () => {
    try {
      const res = await fetch(`/api/redblack/${roomId}`);
      const d = await res.json();
      if (d.room) {
        setRoom(d.room);
        setState(d.room.state as GameState);
        setPlayerId(d.playerId);
        if (d.players) setPlayers(d.players);
      }
    } catch { /* retry */ }
  }, [roomId]);

  useEffect(() => {
    fetchState();
    const es = new EventSource(`/api/redblack/${roomId}/stream`);

    es.addEventListener("game", (e) => {
      const event = JSON.parse(e.data);
      if (event.type === "card_flipped") {
        setFlipping(true);
        setTimeout(() => setFlipping(false), 500);
        if (event.correct) showToast("Correct! \ud83c\udf89");
        else showToast("Wrong! \ud83c\udf7a Drink!");
      }
      if (event.type === "game_over") showToast("Game over!");
      fetchState();
    });

    const poll = setInterval(fetchState, 3000);
    return () => { es.close(); clearInterval(poll); };
  }, [roomId, fetchState, showToast]);

  async function doAction(body: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch(`/api/redblack/${roomId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await res.json();
      if (!res.ok) showToast(d.error || "Error");
      else {
        if (body.action === "guess") {
          setFlipping(true);
          setTimeout(() => setFlipping(false), 500);
        }
        fetchState();
      }
    } catch { showToast("Network error"); }
    finally { setBusy(false); }
  }

  const getName = (id: string) => players.find((p) => p.id === id)?.name ?? "Player";
  const getEmoji = (id: string) => players.find((p) => p.id === id)?.emoji ?? "?";

  if (!room || !state) {
    return (
      <div className="page"><div className="center-content">
        <div className="anim-pulse" style={{ fontSize: "2rem" }}>🃏</div>
        <div style={{ color: "var(--text-dim)" }}>Loading...</div>
      </div></div>
    );
  }

  const phase = (room as { phase: string }).phase;

  // ── Waiting room ──
  if (phase === "waiting") {
    const playerIds = (room as { player_ids: string[] }).player_ids;
    const hostId = (room as { host_id: string }).host_id;
    return (
      <div className="page">
        <style>{`@keyframes cardFlip { 0% { transform: rotateY(180deg) scale(0.8); opacity: 0; } 100% { transform: rotateY(0) scale(1); opacity: 1; } }`}</style>
        <div className="center-content">
          <div className="anim-fade" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>🃏</div>
            <h2 style={{ fontWeight: 700, marginBottom: "0.25rem" }}>Red or Black</h2>
            <p style={{ color: "var(--text-dim)", fontSize: "0.88rem" }}>Share this code:</p>
          </div>
          <div className="room-code anim-scale">{(room as { code: string }).code}</div>
          <div className="card anim-slide" style={{ textAlign: "center", width: "100%", maxWidth: 340 }}>
            <div style={{ marginBottom: "0.5rem" }}>
              <span style={{ color: "var(--neon-amber)" }}>{playerIds.length}</span>{" "}
              <span style={{ color: "var(--text-dim)" }}>players joined</span>
            </div>

            {/* Players list */}
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center", flexWrap: "wrap", marginBottom: "0.75rem" }}>
              {playerIds.map((id) => (
                <span key={id} className="pill live" style={{ fontSize: "0.8rem" }}>
                  {getEmoji(id)} {getName(id)}
                </span>
              ))}
            </div>

            <div style={{ textAlign: "left", margin: "0.75rem 0", padding: "0.75rem", background: "var(--bg-raised)", borderRadius: "var(--r-sm)", fontSize: "0.8rem", color: "var(--text-dim)", lineHeight: 1.6 }}>
              <div style={{ fontWeight: 700, color: "#fff", marginBottom: "0.3rem", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>How to play</div>
              Take turns guessing <strong style={{ color: "#ef4444" }}>Red</strong> or <strong style={{ color: "#fff" }}>Black</strong>. A card is flipped &mdash; guess wrong and you drink! 52 cards in the deck, most correct guesses wins. Streaks count!
            </div>

            {playerIds.length >= 2 && hostId === playerId && (
              <button className="btn btn-primary btn-block btn-lg" onClick={() => doAction({ action: "start" })} disabled={busy}
                style={{ background: "linear-gradient(135deg, #dc2626, #1e293b)", borderColor: "var(--neon-amber)", boxShadow: "var(--glow-amber)" }}>
                Deal the cards
              </button>
            )}
            {playerIds.length >= 2 && hostId !== playerId && (
              <div className="anim-pulse" style={{ color: "var(--text-dim)" }}>Waiting for host to start...</div>
            )}
            {playerIds.length < 2 && (
              <div className="anim-pulse" style={{ color: "var(--text-dim)" }}>Need at least 2 players...</div>
            )}
          </div>
        </div>
      </div>
    );
  }

  const isMyTurn = state.turnOrder[state.currentPlayer] === playerId;
  const currentPlayerId = state.turnOrder[state.currentPlayer];
  const remaining = typeof state.deck === "number" ? state.deck : 0;

  // ── Finished ──
  if (phase === "finished" && state.winner) {
    const won = state.winner === playerId;
    const sorted = Object.entries(state.scores).sort((a, b) => b[1] - a[1]);
    return (
      <div className="page">
        <style>{`@keyframes cardFlip { 0% { transform: rotateY(180deg) scale(0.8); opacity: 0; } 100% { transform: rotateY(0) scale(1); opacity: 1; } }`}</style>
        <div className="center-content">
          <div className="anim-scale" style={{ fontSize: "4rem" }}>{won ? "\ud83c\udfc6" : "\ud83c\udf7b"}</div>
          <h2 className="anim-slide" style={{
            fontSize: "1.8rem", fontWeight: 700,
            background: won ? "linear-gradient(135deg, var(--neon-amber), var(--neon-green))" : "linear-gradient(135deg, var(--neon-red), var(--neon-pink))",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          }}>
            {won ? "You won!" : `${getName(state.winner)} wins!`}
          </h2>
          <div className="card anim-fade" style={{ width: "100%", maxWidth: 320 }}>
            {sorted.map(([id, score], i) => (
              <div key={id} style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.6rem 0", borderTop: i ? "1px solid var(--border)" : "none" }}>
                <span style={{ fontWeight: 700, color: i === 0 ? "var(--neon-amber)" : "var(--text-muted)", width: "1.25rem" }}>#{i + 1}</span>
                <span style={{ fontSize: "1.1rem" }}>{getEmoji(id)}</span>
                <span style={{ flex: 1, fontWeight: 600, color: "#fff" }}>{getName(id)}</span>
                <span style={{ fontFamily: "var(--mono)", fontWeight: 700, color: "var(--neon-green)" }}>{score}/{state.totalCards}</span>
                <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>best streak: {state.bestStreaks[id] ?? 0}</span>
              </div>
            ))}
          </div>
          <button className="btn btn-primary btn-lg anim-fade" onClick={() => (window.location.href = "/")} style={{ animationDelay: "0.3s" }}>
            Play again
          </button>
        </div>
      </div>
    );
  }

  // ── Playing ──
  return (
    <div className="page" style={{ padding: "1rem" }}>
      <style>{`@keyframes cardFlip { 0% { transform: rotateY(180deg) scale(0.8); opacity: 0; } 100% { transform: rotateY(0) scale(1); opacity: 1; } }`}</style>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
          {state.cardsPlayed}/{state.totalCards} cards
        </div>
        <div className="pill live" style={{ fontFamily: "var(--mono)", fontWeight: 700 }}>
          {remaining} left
        </div>
      </div>

      {/* Scoreboard */}
      <div className="card" style={{ marginBottom: "1rem", padding: "0.75rem" }}>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", justifyContent: "center" }}>
          {state.turnOrder.map((id) => {
            const isCurrent = id === currentPlayerId;
            return (
              <div key={id} style={{
                display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.4rem 0.7rem",
                borderRadius: "var(--r-sm)", fontSize: "0.8rem",
                background: isCurrent ? "rgba(34,211,238,0.1)" : "transparent",
                border: isCurrent ? "1px solid rgba(34,211,238,0.3)" : "1px solid transparent",
              }}>
                <span>{getEmoji(id)}</span>
                <span style={{ fontWeight: 600, color: isCurrent ? "#fff" : "var(--text-dim)" }}>
                  {id === playerId ? "You" : getName(id)}
                </span>
                <span style={{ fontFamily: "var(--mono)", fontWeight: 700, color: "var(--neon-amber)" }}>{state.scores[id] ?? 0}</span>
                {(state.streaks[id] ?? 0) >= 2 && (
                  <span style={{ fontSize: "0.65rem", color: "var(--neon-green)", fontWeight: 700 }}>{state.streaks[id]}\ud83d\udd25</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Current card display */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem", marginBottom: "1.5rem" }}>
        {/* Last guess result */}
        {state.lastGuess && (
          <div className="anim-fade" style={{
            fontSize: "0.85rem", fontWeight: 600, textAlign: "center",
            color: state.lastGuess.correct ? "var(--neon-green)" : "var(--neon-red)",
          }}>
            {getEmoji(state.lastGuess.playerId)} {state.lastGuess.playerId === playerId ? "You" : getName(state.lastGuess.playerId)} guessed {state.lastGuess.guess} &mdash;{" "}
            {state.lastGuess.correct ? "Correct!" : "Wrong! Drink! \ud83c\udf7a"}
          </div>
        )}

        <PlayingCard card={state.currentCard} flipping={flipping} />

        {/* Deck visualization */}
        <div style={{ display: "flex", gap: "2px", alignItems: "flex-end" }}>
          {Array.from({ length: Math.min(remaining, 20) }, (_, i) => (
            <div key={i} style={{
              width: 3, height: 8 + Math.random() * 4,
              background: i % 2 === 0 ? "rgba(239,68,68,0.4)" : "rgba(30,41,59,0.6)",
              borderRadius: 1,
            }} />
          ))}
        </div>
      </div>

      {/* Guess buttons */}
      {isMyTurn && (
        <div className="anim-slide">
          <div style={{ textAlign: "center", fontSize: "0.82rem", color: "var(--text-dim)", marginBottom: "0.75rem", fontWeight: 600 }}>
            Your turn &mdash; Red or Black?
          </div>
          <div style={{ display: "flex", gap: "0.75rem", maxWidth: 320, margin: "0 auto" }}>
            <button
              className="btn btn-lg"
              style={{
                flex: 1, background: "linear-gradient(135deg, #dc2626, #ef4444)",
                borderColor: "#ef4444", color: "#fff", fontSize: "1.2rem", fontWeight: 800,
                boxShadow: "0 4px 20px rgba(239,68,68,0.3)",
              }}
              onClick={() => doAction({ action: "guess", guess: "red" })}
              disabled={busy}
            >
              {"\u2665"} Red
            </button>
            <button
              className="btn btn-lg"
              style={{
                flex: 1, background: "linear-gradient(135deg, #0f172a, #1e293b)",
                borderColor: "#475569", color: "#fff", fontSize: "1.2rem", fontWeight: 800,
                boxShadow: "0 4px 20px rgba(30,41,59,0.5)",
              }}
              onClick={() => doAction({ action: "guess", guess: "black" })}
              disabled={busy}
            >
              {"\u2660"} Black
            </button>
          </div>
        </div>
      )}

      {/* Waiting for other player */}
      {!isMyTurn && (
        <div className="anim-pulse" style={{ textAlign: "center", color: "var(--text-dim)", padding: "1rem" }}>
          {getEmoji(currentPlayerId)} {getName(currentPlayerId)}&apos;s turn...
        </div>
      )}

      <div className={`toast ${toast ? "show" : ""}`}>{toast}</div>
    </div>
  );
}
