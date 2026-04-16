import { getOrCreatePlayer } from "@/lib/auth";

export async function GET() {
  const player = await getOrCreatePlayer();
  return Response.json({ player });
}
