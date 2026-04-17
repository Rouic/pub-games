"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";

interface Player { id: string; name: string; emoji: string; }
interface Stroke { points: { x: number; y: number }[]; color: string; width: number; }

export default function SketchGame() {
  const params = useParams();
  const roomId = params.roomId as string;
  const [room, setRoom] = useState<Record<string, unknown> | null>(null);
  const [state, setState] = useState<Record<string, unknown>>({});
  const [playerId, setPlayerId] = useState<string>("");
  const [players, setPlayers] = useState<Player[]>([]);
  const [guess, setGuess] = useState("");
  const [wrongGuesses, setWrongGuesses] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const [timer, setTimer] = useState(60);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const drawingRef = useRef(false);
  const pointsRef = useRef<{ x: number; y: number }[]>([]);
  const canvasInitRef = useRef(false);
  const drawnStrokeCountRef = useRef(0);
  const [brushColor, setBrushColor] = useState("#222222");
  const [brushWidth, setBrushWidth] = useState(4);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  }, []);

  // Draw a single stroke on canvas
  const drawStroke = useCallback((stroke: Stroke) => {
    const ctx = ctxRef.current;
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.width;
    ctx.beginPath();
    stroke.points.forEach((p, i) => {
      const x = p.x * rect.width;
      const y = p.y * rect.height;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }, []);

  const clearCanvas = useCallback(() => {
    const ctx = ctxRef.current;
    const canvas = canvasRef.current;
    if (ctx && canvas) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    drawnStrokeCountRef.current = 0;
  }, []);

  // Replay stored strokes (only draws new ones since last replay)
  const replayStrokes = useCallback((strokes: Stroke[]) => {
    if (!strokes || strokes.length === 0) {
      if (drawnStrokeCountRef.current > 0) {
        clearCanvas();
      }
      return;
    }
    // Only draw strokes we haven't drawn yet
    const startIdx = drawnStrokeCountRef.current;
    if (startIdx >= strokes.length) return;
    for (let i = startIdx; i < strokes.length; i++) {
      drawStroke(strokes[i]);
    }
    drawnStrokeCountRef.current = strokes.length;
  }, [drawStroke, clearCanvas]);

  const fetchState = useCallback(async () => {
    try {
      const res = await fetch(`/api/sketch/${roomId}`);
      const d = await res.json();
      if (d.room) {
        setRoom(d.room);
        const newState = d.room.state ?? {};
        setState(newState);
        setPlayerId(d.playerId);
        if (d.players) setPlayers(d.players);
        // Replay strokes from server state (incremental)
        if (newState.strokes) {
          replayStrokes(newState.strokes as Stroke[]);
        }
      }
    } catch { /* retry */ }
  }, [roomId, replayStrokes]);

  // SSE for real-time events
  useEffect(() => {
    fetchState();
    const es = new EventSource(`/api/sketch/${roomId}/stream`);

    es.addEventListener("game", (e) => {
      const event = JSON.parse(e.data);

      if (event.type === "stroke") {
        drawStroke(event.stroke);
        drawnStrokeCountRef.current++;
      }
      if (event.type === "clear_canvas") {
        clearCanvas();
      }
      if (event.type === "wrong_guess") {
        setWrongGuesses((prev) => [...prev.slice(-4), event.guess]);
      }
      if (event.type === "correct_guess") {
        showToast(`Correct! The word was "${event.word}"`);
        fetchState();
      }
      if (event.type === "time_up") {
        showToast(`Time's up! The word was "${event.word}"`);
        fetchState();
      }
      if (event.type === "new_round" || event.type === "game_started") {
        setWrongGuesses([]);
        clearCanvas();
        fetchState();
      }
      if (event.type === "game_over") {
        fetchState();
      }
    });

    // Poll every 3s as fallback — strokes are now persisted in state,
    // so replayStrokes will incrementally draw any we missed via SSE
    const poll = setInterval(fetchState, 3000);

    return () => { es.close(); clearInterval(poll); };
  }, [roomId, fetchState, showToast, drawStroke, clearCanvas]);

  // Timer countdown
  useEffect(() => {
    if (!state.roundStartedAt || !room || (room as { phase: string }).phase !== "playing") return;
    const limit = (state.roundTimeLimit as number) ?? 60;
    const interval = setInterval(() => {
      const elapsed = (Date.now() - (state.roundStartedAt as number)) / 1000;
      const remaining = Math.max(0, Math.ceil(limit - elapsed));
      setTimer(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
        doAction({ action: "time_up" });
      }
    }, 250);
    return () => clearInterval(interval);
  }, [state.roundStartedAt, state.roundTimeLimit, room]);

  // Init canvas — ONCE on mount, not on room state changes
  useEffect(() => {
    if (canvasInitRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0) return; // not visible yet
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.scale(2, 2);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctxRef.current = ctx;
      canvasInitRef.current = true;
    }
  });

  function getPos(e: React.TouchEvent | React.MouseEvent) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) / rect.width,
      y: (clientY - rect.top) / rect.height,
    };
  }

  const isArtist = playerId === state.artistId;

  function startDraw(e: React.TouchEvent | React.MouseEvent) {
    if (!isArtist) return;
    e.preventDefault();
    drawingRef.current = true;
    pointsRef.current = [getPos(e)];
  }

  function moveDraw(e: React.TouchEvent | React.MouseEvent) {
    if (!drawingRef.current || !isArtist) return;
    e.preventDefault();
    const pos = getPos(e);
    pointsRef.current.push(pos);
    const ctx = ctxRef.current;
    const canvas = canvasRef.current;
    if (ctx && canvas) {
      const rect = canvas.getBoundingClientRect();
      const pts = pointsRef.current;
      const prev = pts[pts.length - 2];
      ctx.strokeStyle = brushColor;
      ctx.lineWidth = brushWidth;
      ctx.beginPath();
      ctx.moveTo(prev.x * rect.width, prev.y * rect.height);
      ctx.lineTo(pos.x * rect.width, pos.y * rect.height);
      ctx.stroke();
    }
  }

  function endDraw() {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    const points = pointsRef.current;
    if (points.length > 1) {
      drawnStrokeCountRef.current++;
      fetch(`/api/sketch/${roomId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "stroke",
          stroke: { points, color: brushColor, width: brushWidth },
        }),
      }).catch(() => {});
    }
    pointsRef.current = [];
  }

  async function doAction(body: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch(`/api/sketch/${roomId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await res.json();
      if (!res.ok && d.error) showToast(d.error);
      else if (body.action === "guess" && !d.correct) {
        setWrongGuesses((prev) => [...prev.slice(-4), guess]);
        setGuess("");
      } else {
        fetchState();
        setGuess("");
      }
    } catch {
      showToast("Network error");
    } finally {
      setBusy(false);
    }
  }

  const getPlayerName = (id: string) => players.find((p) => p.id === id)?.name ?? "Player";

  if (!room) {
    return (
      <div className="page">
        <div className="center-content">
          <div className="anim-pulse" style={{ fontSize: "2rem" }}>🎨</div>
          <div style={{ color: "var(--text-dim)" }}>Loading...</div>
        </div>
      </div>
    );
  }

  const phase = (room as { phase: string }).phase;

  // ── Waiting room ──
  if (phase === "waiting") {
    const playerIds = (room as { player_ids: string[] }).player_ids;
    const hostId = (room as { host_id: string }).host_id;
    return (
      <div className="page">
        <div className="center-content">
          <div className="anim-fade" style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>🎨</div>
            <h2 style={{ fontWeight: 700, marginBottom: "0.25rem" }}>Sketch Duel</h2>
            <p style={{ color: "var(--text-dim)", fontSize: "0.88rem" }}>Share this code:</p>
          </div>
          <div className="room-code anim-scale">{(room as { code: string }).code}</div>
          <div className="card anim-slide" style={{ textAlign: "center", width: "100%", maxWidth: 320 }}>
            <div style={{ marginBottom: "0.5rem" }}>
              <span style={{ color: "var(--neon-pink)" }}>{playerIds.length}/2</span>{" "}
              <span style={{ color: "var(--text-dim)" }}>players</span>
            </div>

            {/* How to play */}
            <div style={{ textAlign: "left", margin: "0.75rem 0", padding: "0.75rem", background: "var(--bg-raised)", borderRadius: "var(--r-sm)", fontSize: "0.8rem", color: "var(--text-dim)", lineHeight: 1.6 }}>
              <div style={{ fontWeight: 700, color: "#fff", marginBottom: "0.3rem", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>How to play</div>
              Take turns drawing and guessing. The artist sees a word and draws it &mdash; the guesser types what they think it is. Faster guesses score more points. 8 rounds, highest score wins!
            </div>

            {playerIds.length >= 2 && hostId === playerId && (
              <button
                className="btn btn-primary btn-block btn-lg"
                onClick={() => doAction({ action: "start" })}
                disabled={busy}
                style={{ background: "linear-gradient(135deg, #be185d, #ec4899)", borderColor: "var(--neon-pink)", boxShadow: "var(--glow-pink)" }}
              >
                Start Game
              </button>
            )}
            {playerIds.length >= 2 && hostId !== playerId && (
              <div className="anim-pulse" style={{ color: "var(--text-dim)" }}>
                Waiting for host to start...
              </div>
            )}
            {playerIds.length < 2 && (
              <div className="anim-pulse" style={{ color: "var(--text-dim)" }}>
                Waiting for a friend to join...
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Finished ──
  if (phase === "finished" && state.winner) {
    const won = state.winner === playerId;
    const scores = (state.scores ?? {}) as Record<string, number>;
    return (
      <div className="page">
        <div className="center-content">
          <div className="anim-scale" style={{ fontSize: "4rem" }}>{won ? "🏆" : "😵"}</div>
          <h2 className="anim-slide" style={{
            fontSize: "1.8rem", fontWeight: 700,
            background: won ? "linear-gradient(135deg, var(--neon-pink), var(--neon-amber))" : "linear-gradient(135deg, var(--neon-red), var(--neon-pink))",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          }}>
            {won ? "You won!" : "You lost!"}
          </h2>
          <div className="score-bar anim-fade">
            {Object.entries(scores).map(([id, score]) => (
              <div key={id} className="score-item">
                <span style={{ color: "var(--text-dim)" }}>{getPlayerName(id)}</span>
                <span className="score-val" style={{ color: id === (state.winner as string) ? "var(--neon-amber)" : "var(--text-dim)" }}>{score}</span>
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

  // ── Playing / round_end ──
  const scores = (state.scores ?? {}) as Record<string, number>;
  const artistId = state.artistId as string;
  const word = state.word as string;
  const wordHint = state.wordHint as string;

  return (
    <div className="page" style={{ padding: "0.75rem", gap: "0.5rem", display: "flex", flexDirection: "column", height: "100dvh" }}>
      {/* Top bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
          Round {state.round as number}/{state.maxRounds as number}
        </div>
        <div className="score-bar" style={{ gap: "1rem" }}>
          {Object.entries(scores).map(([id, score]) => (
            <div key={id} className="score-item" style={{ fontSize: "0.78rem" }}>
              <span>{players.find((p) => p.id === id)?.emoji ?? "?"}</span>
              <span className="score-val" style={{ fontSize: "0.9rem", color: "var(--neon-amber)" }}>{score}</span>
            </div>
          ))}
        </div>
        <div
          className={`pill ${timer <= 10 ? "hot" : "live"}`}
          style={{ fontFamily: "var(--mono)", fontWeight: 700, fontSize: "0.85rem", minWidth: "3rem", textAlign: "center" }}
        >
          {timer}s
        </div>
      </div>

      {/* Role + word info */}
      <div style={{ textAlign: "center" }}>
        {isArtist ? (
          <div className="anim-fade">
            <span className="pill live" style={{ marginBottom: "0.3rem" }}>You&apos;re drawing</span>
            <div style={{ fontSize: "1.4rem", fontWeight: 700, marginTop: "0.3rem", color: "var(--neon-pink)" }}>
              {word || "..."}
            </div>
          </div>
        ) : (
          <div className="anim-fade">
            <span className="pill hot" style={{ marginBottom: "0.3rem" }}>{getPlayerName(artistId)} is drawing</span>
            <div style={{ fontFamily: "var(--mono)", fontSize: "1.4rem", fontWeight: 700, letterSpacing: "0.15em", marginTop: "0.3rem" }}>
              {wordHint || "..."}
            </div>
          </div>
        )}
      </div>

      {/* Round end overlay */}
      {phase === "round_end" && (
        <div className="card anim-scale" style={{ textAlign: "center", borderColor: "var(--neon-amber)", boxShadow: "var(--glow-amber)" }}>
          <div style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "0.3rem" }}>
            {(state.guessedCorrectly as boolean) ? "Correct!" : "Time's up!"}
          </div>
          <div style={{ color: "var(--text-dim)", marginBottom: "0.75rem" }}>
            The word was: <strong style={{ color: "var(--neon-pink)" }}>{(state as { word?: string }).word || word}</strong>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => doAction({ action: "next_round" })} disabled={busy}>
            Next round
          </button>
        </div>
      )}

      {/* Canvas */}
      <div
        className="canvas-wrap"
        style={{ flex: 1, minHeight: 0 }}
        onMouseDown={startDraw}
        onMouseMove={moveDraw}
        onMouseUp={endDraw}
        onMouseLeave={endDraw}
        onTouchStart={startDraw}
        onTouchMove={moveDraw}
        onTouchEnd={endDraw}
      >
        <canvas ref={canvasRef} />
      </div>

      {/* Artist: tools */}
      {isArtist && phase === "playing" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
          {/* Colour palette */}
          <div style={{ display: "flex", gap: "0.3rem", justifyContent: "center", alignItems: "center", flexWrap: "wrap" }}>
            {[
              "#222222", "#ef4444", "#f97316", "#eab308", "#22c55e",
              "#3b82f6", "#8b5cf6", "#ec4899", "#78716c", "#ffffff",
            ].map((c) => (
              <button
                key={c}
                onClick={() => setBrushColor(c)}
                style={{
                  width: 28, height: 28, borderRadius: "50%",
                  background: c, border: brushColor === c ? "3px solid var(--neon-green)" : c === "#ffffff" ? "2px solid #ccc" : "2px solid transparent",
                  cursor: "pointer", flexShrink: 0,
                  boxShadow: brushColor === c ? "0 0 8px rgba(34,211,238,0.4)" : "none",
                  transition: "border-color 0.15s, box-shadow 0.15s",
                }}
              />
            ))}
            {/* Brush sizes */}
            <div style={{ width: 1, height: 20, background: "var(--border)", margin: "0 0.2rem" }} />
            {[2, 4, 8, 14].map((w) => (
              <button
                key={w}
                onClick={() => setBrushWidth(w)}
                style={{
                  width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                  background: brushWidth === w ? "rgba(34,211,238,0.15)" : "transparent",
                  border: brushWidth === w ? "2px solid var(--neon-green)" : "2px solid var(--border)",
                  cursor: "pointer", flexShrink: 0,
                }}
              >
                <div style={{ width: w + 2, height: w + 2, borderRadius: "50%", background: "#fff" }} />
              </button>
            ))}
          </div>
          {/* Clear button */}
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => {
              clearCanvas();
              fetch(`/api/sketch/${roomId}/action`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "clear" }),
              });
            }}
          >
            Clear canvas
          </button>
        </div>
      )}

      {!isArtist && phase === "playing" && (
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <input
            className="input"
            placeholder="Type your guess..."
            value={guess}
            onChange={(e) => setGuess(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && guess.trim()) doAction({ action: "guess", guess: guess.trim() });
            }}
            style={{ flex: 1 }}
          />
          <button
            className="btn btn-primary btn-sm"
            onClick={() => doAction({ action: "guess", guess: guess.trim() })}
            disabled={busy || !guess.trim()}
          >
            Guess
          </button>
        </div>
      )}

      {/* Wrong guesses feed */}
      {wrongGuesses.length > 0 && (
        <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap", justifyContent: "center" }}>
          {wrongGuesses.map((g, i) => (
            <span key={i} className="pill" style={{ textDecoration: "line-through", opacity: 0.6 }}>{g}</span>
          ))}
        </div>
      )}

      <div className={`toast ${toast ? "show" : ""}`}>{toast}</div>
    </div>
  );
}
