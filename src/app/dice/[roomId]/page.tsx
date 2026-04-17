"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";

const DICE_DOTS: Record<number, number[][]> = {
  1: [[1, 1]],
  2: [[0, 0], [2, 2]],
  3: [[0, 0], [1, 1], [2, 2]],
  4: [[0, 0], [0, 2], [2, 0], [2, 2]],
  5: [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]],
  6: [[0, 0], [0, 2], [1, 0], [1, 2], [2, 0], [2, 2]],
};

function Die({
  value,
  hidden,
  highlight,
  rolling,
  size = "md",
}: {
  value: number;
  hidden?: boolean;
  highlight?: boolean;
  rolling?: boolean;
  size?: "sm" | "md";
}) {
  const sz = size === "sm" ? "2.25rem" : "3.25rem";
  const pip = size === "sm" ? "4px" : "6px";
  if (hidden) {
    return (
      <div
        className="die"
        style={{ width: sz, height: sz, background: "linear-gradient(145deg, #1e293b, #0f172a)" }}
      >
        <span style={{ fontSize: size === "sm" ? "1rem" : "1.3rem", opacity: 0.3 }}>?</span>
      </div>
    );
  }
  const dots = DICE_DOTS[value] ?? [];
  return (
    <div
      className={`die ${rolling ? "rolling" : ""} ${highlight ? "highlight" : ""}`}
      style={{ width: sz, height: sz }}
    >
      <div
        className="die-face"
        style={{
          width: size === "sm" ? "1.5rem" : "2.2rem",
          height: size === "sm" ? "1.5rem" : "2.2rem",
        }}
      >
        {Array.from({ length: 9 }, (_, i) => {
          const row = Math.floor(i / 3);
          const col = i % 3;
          const hasDot = dots.some(([r, c]) => r === row && c === col);
          return hasDot ? (
            <span key={i} className="pip" style={{ width: pip, height: pip }} />
          ) : (
            <span key={i} />
          );
        })}
      </div>
    </div>
  );
}

interface GameData {
  room: {
    id: string;
    code: string;
    phase: string;
    player_ids: string[];
    host_id: string;
    state: {
      players?: Record<string, { dice: number[] | null; diceCount: number }>;
      turnOrder?: string[];
      currentTurn?: number;
      currentBid?: { qty: number; face: number } | null;
      lastBidder?: string | null;
      round?: number;
      revealedDice?: Record<string, number[]> | null;
      lastResult?: {
        caller: string;
        bidder: string;
        bid: { qty: number; face: number };
        totalOfFace: number;
        callerWon: boolean;
      } | null;
      winner?: string | null;
    };
  };
  playerId: string;
}

function diceEmoji(face: number) {
  return ["\u2680", "\u2680", "\u2681", "\u2682", "\u2683", "\u2684", "\u2685"][face] ?? String(face);
}

export default function DiceGame() {
  const params = useParams();
  const roomId = params.roomId as string;
  const [data, setData] = useState<GameData | null>(null);
  const [players, setPlayers] = useState<Record<string, { name: string; emoji: string }>>({});
  const [bidQty, setBidQty] = useState(1);
  const [bidFace, setBidFace] = useState(2);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const [rolling, setRolling] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  }, []);

  const fetchState = useCallback(async () => {
    try {
      const res = await fetch(`/api/dice/${roomId}`);
      const d = await res.json();
      if (d.room) setData(d);
    } catch { /* retry on next poll */ }
  }, [roomId]);

  // Fetch player names
  useEffect(() => {
    if (!data?.room.player_ids) return;
    fetch("/api/auth")
      .then((r) => r.json())
      .then((d) => {
        if (d.player) {
          setPlayers((prev) => ({ ...prev, [d.player.id]: { name: d.player.name, emoji: d.player.emoji } }));
        }
      });
  }, [data?.room.player_ids]);

  // Initial fetch + SSE + polling fallback
  useEffect(() => {
    fetchState();
    const es = new EventSource(`/api/dice/${roomId}/stream`);
    eventSourceRef.current = es;

    es.addEventListener("game", (e) => {
      const event = JSON.parse(e.data);
      if (event.type === "bid") {
        showToast(`Bid: ${event.bid.qty}\u00d7 ${diceEmoji(event.bid.face)}`);
      }
      if (event.type === "liar_called") {
        showToast("LIAR! called \u2014 revealing dice...");
        setRolling(true);
        setTimeout(() => setRolling(false), 600);
      }
      if (event.type === "game_over") {
        showToast("Game over!");
      }
      fetchState();
    });

    const poll = setInterval(fetchState, 3000);

    return () => { es.close(); clearInterval(poll); };
  }, [roomId, fetchState, showToast]);

  async function doAction(body: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch(`/api/dice/${roomId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await res.json();
      if (!res.ok) showToast(d.error || "Error");
      else fetchState();
    } catch {
      showToast("Network error");
    } finally {
      setBusy(false);
    }
  }

  if (!data) {
    return (
      <div className="page">
        <div className="center-content">
          <div className="anim-pulse" style={{ fontSize: "2rem" }}>🎲</div>
          <div style={{ color: "var(--text-dim)" }}>Loading...</div>
        </div>
      </div>
    );
  }

  const { room, playerId } = data;
  const state = room.state;
  const opponentId = room.player_ids.find((id) => id !== playerId);
  const opponentName = opponentId ? (players[opponentId]?.name ?? "Opponent") : "Waiting...";

  // ── Waiting room ──
  if (room.phase === "waiting") {
    return (
      <div className="page">
        <div className="center-content">
          <div className="anim-fade" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>🎲</div>
            <h2 style={{ fontWeight: 700, marginBottom: "0.25rem" }}>Liar&apos;s Dice</h2>
            <p style={{ color: "var(--text-dim)", fontSize: "0.88rem" }}>
              Share this code with your friend:
            </p>
          </div>
          <div className="room-code anim-scale">{room.code}</div>
          <div className="card anim-slide" style={{ textAlign: "center", width: "100%", maxWidth: 340 }}>
            <div style={{ marginBottom: "0.5rem" }}>
              <span style={{ color: "var(--neon-green)" }}>
                {room.player_ids.length}/2
              </span>{" "}
              <span style={{ color: "var(--text-dim)" }}>players</span>
            </div>

            {/* How to play */}
            <div style={{ textAlign: "left", margin: "0.75rem 0", padding: "0.75rem", background: "var(--bg-raised)", borderRadius: "var(--r-sm)", fontSize: "0.8rem", color: "var(--text-dim)", lineHeight: 1.6 }}>
              <div style={{ fontWeight: 700, color: "#fff", marginBottom: "0.4rem", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>How to play</div>
              <div style={{ marginBottom: "0.4rem" }}>Each player starts with <strong style={{ color: "#fff" }}>5 dice</strong>. You can see your own dice but not your opponent&apos;s.</div>
              <div style={{ marginBottom: "0.4rem" }}>Take turns bidding how many dice of a face value are on the table <em>in total</em>. E.g. &quot;three 4s&quot; means you think there are at least three dice showing 4 between both players.</div>
              <div style={{ marginBottom: "0.4rem" }}>Each bid must <strong style={{ color: "#fff" }}>raise the quantity or the face</strong> of the previous bid.</div>
              <div>If you think the last bid is too high, call <strong style={{ color: "var(--neon-red)" }}>LIAR!</strong> &mdash; all dice are revealed. If the bid was wrong, the bidder loses a die. If it was right, you lose one. Last player with dice wins!</div>
            </div>

            {room.player_ids.length >= 2 && room.host_id === playerId && (
              <button
                className="btn btn-primary btn-block btn-lg"
                onClick={() => doAction({ action: "start" })}
                disabled={busy}
              >
                Start Game
              </button>
            )}
            {room.player_ids.length >= 2 && room.host_id !== playerId && (
              <div className="anim-pulse" style={{ color: "var(--text-dim)" }}>
                Waiting for host to start...
              </div>
            )}
            {room.player_ids.length < 2 && (
              <div className="anim-pulse" style={{ color: "var(--text-dim)" }}>
                Waiting for a friend to join...
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  const myDice = state.players?.[playerId];
  const oppDice = opponentId ? state.players?.[opponentId] : null;
  const isMyTurn = state.turnOrder?.[state.currentTurn ?? 0] === playerId;
  const currentBid = state.currentBid;
  const revealed = state.revealedDice;
  const lastResult = state.lastResult;

  // Total dice in play (for capping bid quantity)
  const totalDice = Object.values(state.players ?? {}).reduce((sum, p) => sum + (p.diceCount || 0), 0);
  const maxBidQty = Math.max(totalDice, 1);

  // ── Finished ──
  if (room.phase === "finished" && state.winner) {
    const won = state.winner === playerId;
    return (
      <div className="page">
        <div className="center-content">
          <div className="anim-scale" style={{ fontSize: "4rem" }}>
            {won ? "🏆" : "😵"}
          </div>
          <h2
            className="anim-slide"
            style={{
              fontSize: "1.8rem",
              fontWeight: 700,
              background: won
                ? "linear-gradient(135deg, var(--neon-green), var(--neon-amber))"
                : "linear-gradient(135deg, var(--neon-red), var(--neon-pink))",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            {won ? "You won!" : "You lost!"}
          </h2>
          <button
            className="btn btn-primary btn-lg anim-fade"
            onClick={() => (window.location.href = "/")}
            style={{ animationDelay: "0.3s" }}
          >
            Play again
          </button>
        </div>
      </div>
    );
  }

  // ── Playing / Reveal ──
  return (
    <div className="page" style={{ padding: "1rem" }}>
      {/* Header bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "0.75rem",
        }}
      >
        <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
          Round {state.round ?? 1} &middot; {totalDice} dice left
        </div>
        <div className={`pill ${isMyTurn ? "live" : ""}`}>
          {isMyTurn ? "Your turn" : `${opponentName}'s turn`}
        </div>
      </div>

      {/* Opponent's dice */}
      <div className="card anim-fade" style={{ marginBottom: "0.75rem" }}>
        <div
          style={{
            fontSize: "0.72rem",
            fontWeight: 600,
            color: "var(--text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            marginBottom: "0.5rem",
          }}
        >
          {opponentName}&apos;s dice ({oppDice?.diceCount ?? 0})
        </div>
        <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
          {oppDice &&
            Array.from({ length: oppDice.diceCount }, (_, i) => (
              <Die
                key={i}
                value={revealed && opponentId ? (revealed[opponentId]?.[i] ?? 1) : 1}
                hidden={!revealed}
                rolling={rolling}
                highlight={
                  revealed && opponentId && currentBid
                    ? revealed[opponentId]?.[i] === currentBid.face
                    : false
                }
              />
            ))}
        </div>
      </div>

      {/* Current bid display */}
      {currentBid && (
        <div
          className="anim-scale"
          style={{
            textAlign: "center",
            padding: "0.75rem",
            marginBottom: "0.75rem",
            background: "var(--bg-raised)",
            borderRadius: "var(--r)",
            border: "1px solid var(--border)",
          }}
        >
          <span style={{ color: "var(--text-dim)", fontSize: "0.8rem" }}>Current bid: </span>
          <span style={{ fontWeight: 700, fontSize: "1.2rem", color: "var(--neon-amber)" }}>
            {currentBid.qty} &times; {diceEmoji(currentBid.face)}
          </span>
          {state.lastBidder && (
            <span style={{ color: "var(--text-muted)", fontSize: "0.75rem", marginLeft: "0.5rem" }}>
              by {state.lastBidder === playerId ? "you" : opponentName}
            </span>
          )}
        </div>
      )}

      {/* First turn hint (no bid yet) */}
      {!currentBid && isMyTurn && room.phase === "playing" && (
        <div style={{ textAlign: "center", padding: "0.5rem", marginBottom: "0.5rem", color: "var(--text-dim)", fontSize: "0.82rem" }}>
          You go first! Look at your dice and make a bid about how many of a face value are on the table in total.
        </div>
      )}

      {/* Reveal result */}
      {lastResult && room.phase === "reveal" && (
        <div
          className="card anim-scale"
          style={{
            marginBottom: "0.75rem",
            textAlign: "center",
            borderColor: lastResult.callerWon ? "var(--neon-green)" : "var(--neon-red)",
            boxShadow: lastResult.callerWon ? "var(--glow-green)" : "0 0 20px rgba(248, 113, 113, 0.3)",
          }}
        >
          <div style={{ fontSize: "1.5rem", marginBottom: "0.3rem" }}>
            {lastResult.callerWon ? "🎉 Bluff caught!" : "😅 Bid was true!"}
          </div>
          <div style={{ color: "var(--text-dim)", fontSize: "0.85rem", marginBottom: "0.3rem" }}>
            Actual count of {diceEmoji(lastResult.bid.face)}: <strong>{lastResult.totalOfFace}</strong>{" "}
            (bid was {lastResult.bid.qty})
          </div>
          <div style={{ color: "var(--text-muted)", fontSize: "0.78rem", marginBottom: "0.75rem" }}>
            {lastResult.callerWon
              ? `${lastResult.bidder === playerId ? "You lose" : opponentName + " loses"} a die`
              : `${lastResult.caller === playerId ? "You lose" : opponentName + " loses"} a die`}
          </div>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => doAction({ action: "next_round" })}
            disabled={busy}
          >
            Next round
          </button>
        </div>
      )}

      {/* My dice */}
      <div className="card" style={{ marginBottom: "0.75rem" }}>
        <div
          style={{
            fontSize: "0.72rem",
            fontWeight: 600,
            color: "var(--text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            marginBottom: "0.5rem",
          }}
        >
          Your dice ({myDice?.diceCount ?? 0})
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          {myDice?.dice?.map((v, i) => (
            <Die
              key={i}
              value={v}
              rolling={rolling}
              highlight={currentBid ? v === currentBid.face : false}
            />
          ))}
        </div>
      </div>

      {/* Bid controls (only when it's my turn + playing phase) */}
      {isMyTurn && room.phase === "playing" && (
        <div className="card anim-slide" style={{ marginBottom: "0.75rem" }}>
          <div style={{ marginBottom: "0.6rem" }}>
            <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.3rem" }}>
              How many? (total across both players)
            </label>
            <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap" }}>
              {Array.from({ length: maxBidQty }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  className={`btn btn-sm ${bidQty === n ? "btn-primary" : ""}`}
                  style={{ padding: "0.45rem 0.6rem", minWidth: "2rem", fontSize: "0.85rem" }}
                  onClick={() => setBidQty(n)}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          <div style={{ marginBottom: "0.6rem" }}>
            <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.3rem" }}>
              Which face?
            </label>
            <div style={{ display: "flex", gap: "0.35rem" }}>
              {[1, 2, 3, 4, 5, 6].map((f) => (
                <button
                  key={f}
                  className={`btn btn-sm ${bidFace === f ? "btn-primary" : ""}`}
                  style={{ padding: "0.4rem 0.6rem", minWidth: "2.5rem", fontSize: "1.1rem" }}
                  onClick={() => setBidFace(f)}
                >
                  {diceEmoji(f)}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              className="btn btn-primary"
              style={{ flex: 1 }}
              onClick={() => doAction({ action: "bid", qty: bidQty, face: bidFace })}
              disabled={busy}
            >
              Bid {bidQty} &times; {diceEmoji(bidFace)}
            </button>
            {currentBid && (
              <button
                className="btn btn-danger"
                style={{ flex: 1 }}
                onClick={() => doAction({ action: "call" })}
                disabled={busy}
              >
                🤥 LIAR!
              </button>
            )}
          </div>
          {currentBid && (
            <p style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "0.4rem", textAlign: "center" }}>
              Must bid higher than {currentBid.qty}&times;{diceEmoji(currentBid.face)} &mdash; raise the quantity or the face value
            </p>
          )}
        </div>
      )}

      {/* Waiting for opponent's turn */}
      {!isMyTurn && room.phase === "playing" && (
        <div
          className="anim-pulse"
          style={{ textAlign: "center", color: "var(--text-dim)", padding: "1rem" }}
        >
          Waiting for {opponentName} to {currentBid ? "bid or call LIAR" : "make the first bid"}...
        </div>
      )}

      {/* Toast */}
      <div className={`toast ${toast ? "show" : ""}`}>{toast}</div>
    </div>
  );
}
