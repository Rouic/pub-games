import { getPlayerId } from "@/lib/auth";
import { query } from "@/lib/db";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ groupId: string }> }
) {
  const { groupId } = await params;
  const playerId = await getPlayerId();
  if (!playerId) return Response.json({ error: "No session" }, { status: 401 });

  // Category averages across all pubs
  const avgRes = await query(
    `SELECT
       ROUND(AVG(rating_options), 2) as avg_options,
       ROUND(AVG(rating_atmosphere), 2) as avg_atmosphere,
       ROUND(AVG(rating_price), 2) as avg_price,
       ROUND(AVG(rating_seating), 2) as avg_seating,
       ROUND(AVG(rating_service), 2) as avg_service,
       ROUND(AVG(rating_food), 2) as avg_food,
       COUNT(*) as total_visits,
       COUNT(DISTINCT pub_id) as unique_pubs,
       COUNT(DISTINCT player_id) as active_raters
     FROM pub_visits WHERE group_id = $1`,
    [groupId]
  );

  // Monthly visit trend
  const monthlyRes = await query(
    `SELECT TO_CHAR(visited_at, 'YYYY-MM') as month, COUNT(*) as visits,
            ROUND(AVG(overall), 1) as avg_score
     FROM pub_visits WHERE group_id = $1
     GROUP BY month ORDER BY month DESC LIMIT 12`,
    [groupId]
  );

  // Top pubs by score
  const topRes = await query(
    `SELECT pb.name, ROUND(AVG(v.overall), 1) as score, COUNT(v.id) as visits
     FROM pub_visits v JOIN pubs pb ON pb.id = v.pub_id
     WHERE v.group_id = $1
     GROUP BY pb.id, pb.name HAVING COUNT(v.id) >= 1
     ORDER BY score DESC LIMIT 10`,
    [groupId]
  );

  // Per-member stats
  const memberRes = await query(
    `SELECT p.name, p.emoji, COUNT(v.id) as visits, ROUND(AVG(v.overall), 1) as avg_score
     FROM pub_visits v JOIN players p ON p.id = v.player_id
     WHERE v.group_id = $1
     GROUP BY p.id, p.name, p.emoji ORDER BY visits DESC`,
    [groupId]
  );

  return Response.json({
    averages: avgRes.rows[0],
    monthly: monthlyRes.rows,
    topPubs: topRes.rows,
    memberStats: memberRes.rows,
  });
}
