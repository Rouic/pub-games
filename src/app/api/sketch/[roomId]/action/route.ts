import { getPlayerId } from "@/lib/auth";
import { getRoom, updateRoom, broadcastEvent, appendStroke, clearStrokes } from "@/lib/rooms";
import { query } from "@/lib/db";
import {
  type SketchState,
  initSketchGame,
  checkGuess,
  scoreGuess,
  nextSketchRound,
} from "@/lib/sketch-engine";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  const playerId = await getPlayerId();
  if (!playerId) return Response.json({ error: "No session" }, { status: 401 });

  const room = await getRoom(roomId);
  if (!room) return Response.json({ error: "Room not found" }, { status: 404 });
  if (!room.player_ids.includes(playerId)) {
    return Response.json({ error: "Not in this room" }, { status: 403 });
  }

  const body = await req.json();
  const action = body.action as string;

  let state = room.state as unknown as SketchState;
  let phase = room.phase;

  // ── Start game ──
  if (action === "start") {
    if (room.host_id !== playerId)
      return Response.json({ error: "Only host can start" }, { status: 403 });
    if (room.player_ids.length < 2)
      return Response.json({ error: "Need 2 players" }, { status: 400 });

    state = initSketchGame(room.player_ids);
    phase = "playing";
    await updateRoom(roomId, phase, { ...state, strokes: [] });
    // Send word only to the artist (via separate masked event)
    await broadcastEvent(roomId, {
      type: "game_started",
      phase,
      state: maskWord(state),
    });
    return Response.json({ room: { ...room, phase, state } });
  }

  // ── Draw stroke (artist sends canvas data) ──
  if (action === "stroke") {
    if (playerId !== state.artistId) {
      return Response.json({ error: "Not the artist" }, { status: 403 });
    }
    // Atomic append — doesn't overwrite artistId/guesserId/phase
    await appendStroke(roomId, body.stroke);
    await broadcastEvent(roomId, {
      type: "stroke",
      stroke: body.stroke,
    });
    return Response.json({ ok: true });
  }

  // ── Clear canvas ──
  if (action === "clear") {
    if (playerId !== state.artistId) {
      return Response.json({ error: "Not the artist" }, { status: 403 });
    }
    await clearStrokes(roomId);
    await broadcastEvent(roomId, { type: "clear_canvas" });
    return Response.json({ ok: true });
  }

  // ── Submit guess ──
  if (action === "guess") {
    if (playerId !== state.guesserId) {
      return Response.json({ error: "Not the guesser" }, { status: 403 });
    }
    const guess = (body.guess ?? "").trim();
    if (!guess) return Response.json({ error: "Empty guess" }, { status: 400 });

    const correct = checkGuess(state, guess);
    if (correct) {
      state = scoreGuess(state);
      phase = "round_end";
      await updateRoom(roomId, phase, state);
      await broadcastEvent(roomId, {
        type: "correct_guess",
        guess,
        word: state.word,
        scores: state.scores,
        state,
      });
    } else {
      // Wrong guess — broadcast so both players see it
      await broadcastEvent(roomId, {
        type: "wrong_guess",
        guess,
        playerId,
      });
    }
    return Response.json({ correct, state: correct ? state : undefined });
  }

  // ── Time's up (either player can trigger) ──
  if (action === "time_up") {
    if (phase !== "playing") {
      return Response.json({ ok: true }); // already ended
    }
    phase = "round_end";
    await updateRoom(roomId, phase, state);
    await broadcastEvent(roomId, {
      type: "time_up",
      word: state.word,
      scores: state.scores,
    });
    return Response.json({ ok: true });
  }

  // ── Next round ──
  if (action === "next_round") {
    if (phase !== "round_end") {
      return Response.json({ ok: true }); // already advanced
    }
    // Collect used words from state history (simple: just the current word + any in extended state)
    const usedWords = [state.word];
    state = nextSketchRound(state, usedWords);
    phase = state.winner ? "finished" : "playing";

    if (state.winner) {
      const loserId = room.player_ids.find((id) => id !== state.winner);
      await query(
        "UPDATE players SET wins = wins + 1, games_played = games_played + 1 WHERE id = $1",
        [state.winner]
      );
      if (loserId) {
        await query(
          "UPDATE players SET losses = losses + 1, games_played = games_played + 1 WHERE id = $1",
          [loserId]
        );
      }
    }

    await updateRoom(roomId, phase, { ...state, strokes: [] });
    await broadcastEvent(roomId, {
      type: state.winner ? "game_over" : "new_round",
      phase,
      state: state.winner ? state : maskWord(state),
      winner: state.winner,
    });
    return Response.json({ room: { ...room, phase, state } });
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
}

function maskWord(state: SketchState): SketchState {
  return { ...state, word: "" };
}
