import { getExistingPlayer, deletePlayer } from "@/lib/auth";

export async function GET() {
  const player = await getExistingPlayer();
  return Response.json({ player });
}

export async function DELETE() {
  const deleted = await deletePlayer();
  if (!deleted) {
    return Response.json({ error: "No player to delete" }, { status: 404 });
  }
  return Response.json({ ok: true });
}
