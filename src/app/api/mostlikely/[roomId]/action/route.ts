import { getPlayerId } from "@/lib/auth";
import { getRoom, updateRoom, broadcastEvent } from "@/lib/rooms";
import { query } from "@/lib/db";
import {
  type MostLikelyState, initMostLikelyGame, castVote,
  allVotesIn, tallyVotes, nextRound,
} from "@/lib/mostlikely-engine";

export async function POST(req: Request, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const playerId = await getPlayerId();
  if (!playerId) return Response.json({ error: "No session" }, { status: 401 });
  const room = await getRoom(roomId);
  if (!room) return Response.json({ error: "Room not found" }, { status: 404 });
  if (!room.player_ids.includes(playerId)) return Response.json({ error: "Not in this room" }, { status: 403 });

  const body = await req.json();
  let state = room.state as unknown as MostLikelyState;
  let phase = room.phase;

  if (body.action === "start") {
    if (room.host_id !== playerId) return Response.json({ error: "Only host can start" }, { status: 403 });
    if (room.player_ids.length < 3) return Response.json({ error: "Need at least 3 players" }, { status: 400 });
    state = initMostLikelyGame(room.player_ids);
    phase = "playing";
    await updateRoom(roomId, phase, state);
    await broadcastEvent(roomId, { type: "game_started", phase, state });
    return Response.json({ room: { ...room, phase, state } });
  }

  if (body.action === "vote") {
    const votedFor = body.votedFor as string;
    if (!votedFor) return Response.json({ error: "Must vote for someone" }, { status: 400 });
    const next = castVote(state, playerId, votedFor);
    if (!next) return Response.json({ error: "Cannot vote now" }, { status: 400 });
    state = next;

    // Check if all votes are in
    if (allVotesIn(state)) {
      state = tallyVotes(state);
      await updateRoom(roomId, phase, state);
      await broadcastEvent(roomId, { type: "votes_tallied", state });
    } else {
      await updateRoom(roomId, phase, state);
      await broadcastEvent(roomId, { type: "vote_cast", votesIn: Object.keys(state.votes).length, total: state.turnOrder.length });
    }
    return Response.json({ room: { ...room, phase, state } });
  }

  if (body.action === "next_round") {
    if (state.phase !== "results") return Response.json({ ok: true });
    state = nextRound(state);
    phase = state.winner ? "finished" : "playing";
    if (state.winner) {
      // Winner = fewest drinks. Everyone else "loses"
      for (const pid of room.player_ids) {
        if (pid === state.winner) await query("UPDATE players SET wins = wins + 1, games_played = games_played + 1 WHERE id = $1", [pid]);
        else await query("UPDATE players SET losses = losses + 1, games_played = games_played + 1 WHERE id = $1", [pid]);
      }
    }
    await updateRoom(roomId, phase, state);
    await broadcastEvent(roomId, { type: state.winner ? "game_over" : "new_round", phase, state });
    return Response.json({ room: { ...room, phase, state } });
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
}
