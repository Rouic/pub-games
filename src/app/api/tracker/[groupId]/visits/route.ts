import { getOrCreatePlayer } from "@/lib/auth";
import { query } from "@/lib/db";
import { nanoid } from "nanoid";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ groupId: string }> }
) {
  const { groupId } = await params;
  const player = await getOrCreatePlayer();
  const body = await req.json();

  // Verify membership
  const member = await query(
    "SELECT 1 FROM pub_group_members WHERE group_id = $1 AND player_id = $2",
    [groupId, player.id]
  );
  if (!member.rows[0]) return Response.json({ error: "Not a member" }, { status: 403 });

  // Create or find the pub
  let pubId = body.pubId;
  if (!pubId && body.pubName) {
    pubId = nanoid(12);
    await query(
      `INSERT INTO pubs (id, name, location, created_by) VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO NOTHING`,
      [pubId, body.pubName.trim().slice(0, 100), (body.pubLocation || "").trim().slice(0, 200), player.id]
    );
  }
  if (!pubId) return Response.json({ error: "Pub name required" }, { status: 400 });

  const id = nanoid(16);
  await query(
    `INSERT INTO pub_visits (id, pub_id, player_id, group_id, rating_options, rating_atmosphere, rating_price, rating_seating, rating_service, rating_food, notes, visited_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    [
      id, pubId, player.id, groupId,
      body.options || null, body.atmosphere || null, body.price || null,
      body.seating || null, body.service || null, body.food || null,
      (body.notes || "").slice(0, 500),
      body.visitedAt || new Date().toISOString().slice(0, 10),
    ]
  );

  return Response.json({ ok: true, visitId: id, pubId });
}
