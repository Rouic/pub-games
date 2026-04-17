import { getOrCreatePlayer } from "@/lib/auth";
import { query } from "@/lib/db";
import { nanoid } from "nanoid";

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export async function POST(req: Request) {
  const player = await getOrCreatePlayer();
  const body = await req.json();

  if (body.action === "create") {
    const id = nanoid(16);
    const code = generateCode();
    const name = (body.name || "Our Pub Crawl").trim().slice(0, 60);
    await query(
      `INSERT INTO pub_groups (id, code, name, created_by) VALUES ($1, $2, $3, $4)`,
      [id, code, name, player.id]
    );
    await query(
      `INSERT INTO pub_group_members (group_id, player_id) VALUES ($1, $2)`,
      [id, player.id]
    );
    return Response.json({ group: { id, code, name }, player });
  }

  if (body.action === "join") {
    const code = (body.code ?? "").trim().toUpperCase();
    if (!code || code.length !== 4)
      return Response.json({ error: "Enter a 4-letter code" }, { status: 400 });

    const res = await query("SELECT * FROM pub_groups WHERE code = $1", [code]);
    if (!res.rows[0])
      return Response.json({ error: "Group not found" }, { status: 404 });

    const group = res.rows[0];
    await query(
      `INSERT INTO pub_group_members (group_id, player_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [group.id, player.id]
    );
    return Response.json({ group, player });
  }

  // List my groups
  if (body.action === "list") {
    const res = await query(
      `SELECT g.*, COUNT(DISTINCT m2.player_id) as member_count,
              COUNT(DISTINCT v.id) as visit_count
       FROM pub_groups g
       JOIN pub_group_members m ON m.group_id = g.id AND m.player_id = $1
       LEFT JOIN pub_group_members m2 ON m2.group_id = g.id
       LEFT JOIN pub_visits v ON v.group_id = g.id
       GROUP BY g.id ORDER BY g.created_at DESC`,
      [player.id]
    );
    return Response.json({ groups: res.rows, player });
  }

  return Response.json({ error: "Invalid action" }, { status: 400 });
}
