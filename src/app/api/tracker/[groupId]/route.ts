import { getOrCreatePlayer } from "@/lib/auth";
import { query } from "@/lib/db";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ groupId: string }> }
) {
  const { groupId } = await params;
  const player = await getOrCreatePlayer();

  const groupRes = await query("SELECT * FROM pub_groups WHERE id = $1", [groupId]);
  if (!groupRes.rows[0]) return Response.json({ error: "Not found" }, { status: 404 });

  const members = await query(
    `SELECT p.id, p.name, p.emoji, COUNT(v.id) as visit_count
     FROM pub_group_members m
     JOIN players p ON p.id = m.player_id
     LEFT JOIN pub_visits v ON v.player_id = p.id AND v.group_id = $1
     WHERE m.group_id = $1 GROUP BY p.id`,
    [groupId]
  );

  const pubs = await query(
    `SELECT pb.*,
       COUNT(v.id) as visit_count,
       ROUND(AVG(v.overall), 1) as avg_overall,
       ROUND(AVG(v.rating_options), 1) as avg_options,
       ROUND(AVG(v.rating_atmosphere), 1) as avg_atmosphere,
       ROUND(AVG(v.rating_price), 1) as avg_price,
       ROUND(AVG(v.rating_seating), 1) as avg_seating,
       ROUND(AVG(v.rating_service), 1) as avg_service,
       ROUND(AVG(v.rating_food), 1) as avg_food,
       MAX(v.visited_at) as last_visit
     FROM pubs pb
     JOIN pub_visits v ON v.pub_id = pb.id AND v.group_id = $1
     GROUP BY pb.id
     ORDER BY avg_overall DESC`,
    [groupId]
  );

  const recentVisits = await query(
    `SELECT v.*, p.name as player_name, p.emoji as player_emoji, pb.name as pub_name
     FROM pub_visits v
     JOIN players p ON p.id = v.player_id
     JOIN pubs pb ON pb.id = v.pub_id
     WHERE v.group_id = $1
     ORDER BY v.created_at DESC LIMIT 20`,
    [groupId]
  );

  return Response.json({
    group: groupRes.rows[0],
    members: members.rows,
    pubs: pubs.rows,
    recentVisits: recentVisits.rows,
    playerId: player.id,
  });
}
