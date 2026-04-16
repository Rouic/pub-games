import { getPlayerId } from "@/lib/auth";
import { getRoom } from "@/lib/rooms";
import { query } from "@/lib/db";
import type { SketchState } from "@/lib/sketch-engine";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  const playerId = await getPlayerId();
  if (!playerId) return Response.json({ error: "No session" }, { status: 401 });

  const room = await getRoom(roomId);
  if (!room) return Response.json({ error: "Room not found" }, { status: 404 });

  const state = room.state as unknown as SketchState;

  // Fetch player names
  const playerRes = await query(
    "SELECT id, name, emoji FROM players WHERE id = ANY($1)",
    [room.player_ids]
  );
  const players = playerRes.rows;

  // Mask the word for the guesser
  const isArtist = playerId === state.artistId;
  const maskedState = {
    ...state,
    word: isArtist ? state.word : "",
  };

  return Response.json({
    room: { ...room, state: maskedState },
    playerId,
    players,
  });
}
