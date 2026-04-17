import { getPlayerId } from "@/lib/auth";
import { query } from "@/lib/db";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ groupId: string }> }
) {
  const { groupId } = await params;
  const playerId = await getPlayerId();
  if (!playerId) return Response.json({ error: "No session" }, { status: 401 });

  const url = new URL(req.url);
  const pubId = url.searchParams.get("pubId");

  // Get visit history for a specific pub
  if (pubId) {
    const visits = await query(
      `SELECT v.id, v.rating_options, v.rating_atmosphere, v.rating_price,
              v.rating_seating, v.rating_service, v.rating_food, v.overall,
              v.notes, v.visited_at, v.created_at,
              p.name as player_name, p.emoji as player_emoji
       FROM pub_visits v
       JOIN players p ON p.id = v.player_id
       WHERE v.pub_id = $1 AND v.group_id = $2
       ORDER BY v.visited_at ASC, v.created_at ASC`,
      [pubId, groupId]
    );

    // Beer logs for this pub
    const beers = await query(
      `SELECT bl.id, bl.price_pint, bl.notes, bl.created_at,
              b.name as beer_name, b.brewery,
              p.name as player_name, p.emoji as player_emoji
       FROM beer_logs bl
       JOIN beers b ON b.id = bl.beer_id
       JOIN players p ON p.id = bl.player_id
       WHERE bl.pub_id = $1 AND bl.group_id = $2
       ORDER BY bl.created_at DESC`,
      [pubId, groupId]
    );

    return Response.json({ visits: visits.rows, beers: beers.rows });
  }

  // Search pubs in this group (for autocomplete)
  const term = url.searchParams.get("q")?.trim().toLowerCase();
  if (term) {
    const res = await query(
      `SELECT DISTINCT pb.id, pb.name, pb.location
       FROM pubs pb
       JOIN pub_visits v ON v.pub_id = pb.id AND v.group_id = $1
       WHERE LOWER(pb.name) LIKE $2
       ORDER BY pb.name LIMIT 15`,
      [groupId, `%${term}%`]
    );
    return Response.json({ pubs: res.rows });
  }

  // All pubs in this group
  const res = await query(
    `SELECT DISTINCT pb.id, pb.name, pb.location
     FROM pubs pb
     JOIN pub_visits v ON v.pub_id = pb.id AND v.group_id = $1
     ORDER BY pb.name`,
    [groupId]
  );
  return Response.json({ pubs: res.rows });
}
