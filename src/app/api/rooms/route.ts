import { getOrCreatePlayer } from "@/lib/auth";
import { createRoom, joinRoom, broadcastEvent } from "@/lib/rooms";

export async function POST(req: Request) {
  const player = await getOrCreatePlayer();
  const body = await req.json();

  if (body.action === "create") {
    const game = body.game as string;
    if (!["dice", "sketch", "redblack", "highlow", "mostlikely"].includes(game)) {
      return Response.json({ error: "Invalid game type" }, { status: 400 });
    }
    const room = await createRoom(game, player.id);
    return Response.json({ room, player });
  }

  if (body.action === "join") {
    const code = (body.code ?? "").trim().toUpperCase();
    if (!code || code.length !== 4) {
      return Response.json({ error: "Enter a 4-letter room code" }, { status: 400 });
    }
    const room = await joinRoom(code, player.id);
    if (!room) {
      return Response.json(
        { error: "Room not found, full, or already started" },
        { status: 404 }
      );
    }
    // Notify the host (and any other listeners) that a player joined
    await broadcastEvent(room.id, { type: "player_joined", room });
    return Response.json({ room, player });
  }

  return Response.json({ error: "Invalid action" }, { status: 400 });
}
