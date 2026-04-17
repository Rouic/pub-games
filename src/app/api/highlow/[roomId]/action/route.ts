import { getPlayerId } from "@/lib/auth";
import { getRoom, updateRoom, broadcastEvent } from "@/lib/rooms";
import { query } from "@/lib/db";
import { type HighLowState, initHighLowGame, makeGuess, maskState } from "@/lib/highlow-engine";

export async function POST(req: Request, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const playerId = await getPlayerId();
  if (!playerId) return Response.json({ error: "No session" }, { status: 401 });
  const room = await getRoom(roomId);
  if (!room) return Response.json({ error: "Room not found" }, { status: 404 });
  if (!room.player_ids.includes(playerId)) return Response.json({ error: "Not in this room" }, { status: 403 });

  const body = await req.json();
  let state = room.state as unknown as HighLowState;
  let phase = room.phase;

  if (body.action === "start") {
    if (room.host_id !== playerId) return Response.json({ error: "Only host can start" }, { status: 403 });
    if (room.player_ids.length < 2) return Response.json({ error: "Need at least 2 players" }, { status: 400 });
    state = initHighLowGame(room.player_ids);
    phase = "playing";
    await updateRoom(roomId, phase, state);
    await broadcastEvent(roomId, { type: "game_started", phase, state: maskState(state) });
    return Response.json({ room: { ...room, phase, state: maskState(state) } });
  }

  if (body.action === "guess") {
    const guess = body.guess as "higher" | "lower";
    if (guess !== "higher" && guess !== "lower") return Response.json({ error: "Must be higher or lower" }, { status: 400 });
    const next = makeGuess(state, playerId, guess);
    if (!next) return Response.json({ error: "Not your turn or game over" }, { status: 400 });
    state = next;
    phase = state.winner ? "finished" : "playing";
    if (state.winner) {
      for (const pid of room.player_ids) {
        if (pid === state.winner) await query("UPDATE players SET wins = wins + 1, games_played = games_played + 1 WHERE id = $1", [pid]);
        else await query("UPDATE players SET losses = losses + 1, games_played = games_played + 1 WHERE id = $1", [pid]);
      }
    }
    await updateRoom(roomId, phase, state);
    await broadcastEvent(roomId, {
      type: state.winner ? "game_over" : "card_flipped",
      phase, state: maskState(state), card: state.currentCard,
      previousCard: state.previousCard, guess, correct: state.lastGuess?.correct, playerId,
    });
    return Response.json({ room: { ...room, phase, state: maskState(state) } });
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
}
