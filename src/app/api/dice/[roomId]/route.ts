import { getPlayerId } from "@/lib/auth";
import { getRoom } from "@/lib/rooms";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  const playerId = await getPlayerId();
  if (!playerId) return Response.json({ error: "No session" }, { status: 401 });

  const room = await getRoom(roomId);
  if (!room) return Response.json({ error: "Room not found" }, { status: 404 });

  // Mask other player's dice unless we're in a reveal phase
  const state = room.state as Record<string, unknown>;
  const players = (state.players ?? {}) as Record<
    string,
    { dice: number[]; diceCount: number }
  >;
  const revealed = state.revealedDice as Record<string, number[]> | null;

  const maskedPlayers: Record<string, unknown> = {};
  for (const [id, p] of Object.entries(players)) {
    if (id === playerId || revealed) {
      maskedPlayers[id] = p;
    } else {
      maskedPlayers[id] = { diceCount: p.diceCount, dice: null };
    }
  }

  return Response.json({
    room: {
      ...room,
      state: { ...state, players: maskedPlayers },
    },
    playerId,
  });
}
