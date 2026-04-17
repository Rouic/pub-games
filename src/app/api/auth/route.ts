import { getExistingPlayer, deletePlayer } from "@/lib/auth";

export async function GET() {
  const player = await getExistingPlayer();
  if (player) {
    // Include email status (but not the actual email for privacy)
    return Response.json({
      player: {
        ...player,
        hasClaimed: !!(player as Record<string, unknown>).email,
      },
    });
  }
  return Response.json({ player: null });
}

export async function DELETE() {
  const deleted = await deletePlayer();
  if (!deleted) {
    return Response.json({ error: "No player to delete" }, { status: 404 });
  }
  return Response.json({ ok: true });
}
