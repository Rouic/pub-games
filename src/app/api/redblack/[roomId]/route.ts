import { getPlayerId } from "@/lib/auth";
import { getRoom } from "@/lib/rooms";
import { query } from "@/lib/db";
import { type RedBlackState, maskState } from "@/lib/redblack-engine";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  const playerId = await getPlayerId();
  if (!playerId) return Response.json({ error: "No session" }, { status: 401 });

  const room = await getRoom(roomId);
  if (!room) return Response.json({ error: "Room not found" }, { status: 404 });

  const state = room.state as unknown as RedBlackState;

  const playerRes = await query(
    "SELECT id, name, emoji FROM players WHERE id = ANY($1)",
    [room.player_ids]
  );

  return Response.json({
    room: { ...room, state: state.deck ? maskState(state) : state },
    playerId,
    players: playerRes.rows,
  });
}
