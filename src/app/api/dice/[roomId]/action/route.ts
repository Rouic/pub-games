import { getPlayerId } from "@/lib/auth";
import { getRoom, updateRoom, broadcastEvent } from "@/lib/rooms";
import { query } from "@/lib/db";
import {
  type DiceState,
  initGame,
  placeBid,
  callLiar,
  newRound,
} from "@/lib/dice-engine";

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

  let state = room.state as DiceState;
  let phase = room.phase;

  // ── Start the game (host only, needs 2 players) ──
  if (action === "start") {
    if (room.host_id !== playerId) {
      return Response.json({ error: "Only the host can start" }, { status: 403 });
    }
    if (room.player_ids.length < 2) {
      return Response.json({ error: "Need 2 players" }, { status: 400 });
    }
    state = initGame(room.player_ids);
    phase = "playing";
    const updated = await updateRoom(roomId, phase, state);
    await broadcastEvent(roomId, { type: "game_started", phase, state: maskAll(state) });
    return Response.json({ room: updated });
  }

  // ── Place a bid ──
  if (action === "bid") {
    const bid = { qty: Number(body.qty), face: Number(body.face) };
    const next = placeBid(state, playerId, bid);
    if (!next) {
      return Response.json({ error: "Invalid bid" }, { status: 400 });
    }
    state = next;
    const updated = await updateRoom(roomId, phase, state);
    await broadcastEvent(roomId, {
      type: "bid",
      playerId,
      bid,
      currentTurn: state.currentTurn,
      state: maskAll(state),
    });
    return Response.json({ room: updated });
  }

  // ── Call "LIAR!" ──
  if (action === "call") {
    const result = callLiar(state, playerId);
    if (!result) {
      return Response.json({ error: "Cannot call liar now" }, { status: 400 });
    }
    state = result;
    phase = "reveal";
    await updateRoom(roomId, phase, state);
    await broadcastEvent(roomId, {
      type: "liar_called",
      callerId: playerId,
      lastResult: state.lastResult,
      revealedDice: state.revealedDice,
      state,
    });

    // After the reveal, check for a winner or start next round
    // (clients will show a reveal animation, then poll for next-round)
    return Response.json({ room: { ...room, phase, state } });
  }

  // ── Next round (after reveal) ──
  if (action === "next_round") {
    if (phase !== "reveal") {
      return Response.json({ error: "Not in reveal phase" }, { status: 400 });
    }
    state = newRound(state);
    phase = state.winner ? "finished" : "playing";

    if (state.winner) {
      // Update stats
      const winnerId = state.winner;
      const loserId = room.player_ids.find((id) => id !== winnerId);
      await query(
        "UPDATE players SET wins = wins + 1, games_played = games_played + 1 WHERE id = $1",
        [winnerId]
      );
      if (loserId) {
        await query(
          "UPDATE players SET losses = losses + 1, games_played = games_played + 1 WHERE id = $1",
          [loserId]
        );
      }
    }

    const updated = await updateRoom(roomId, phase, state);
    await broadcastEvent(roomId, {
      type: phase === "finished" ? "game_over" : "new_round",
      phase,
      state: phase === "finished" ? state : maskAll(state),
      winner: state.winner,
    });
    return Response.json({ room: updated });
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
}

/** Strip dice from the state so NOTIFY payload doesn't leak them. */
function maskAll(state: DiceState): DiceState {
  const players: DiceState["players"] = {};
  for (const [id, p] of Object.entries(state.players)) {
    players[id] = { diceCount: p.diceCount, dice: [] };
  }
  return { ...state, players };
}
