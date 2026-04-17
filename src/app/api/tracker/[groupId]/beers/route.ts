import { getPlayerId } from "@/lib/auth";
import { query } from "@/lib/db";
import { nanoid } from "nanoid";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ groupId: string }> }
) {
  const { groupId } = await params;
  const playerId = await getPlayerId();
  if (!playerId) return Response.json({ error: "No session" }, { status: 401 });

  // All beers logged in this group, with avg price and log count
  const beers = await query(
    `SELECT b.id, b.name, b.brewery,
       COUNT(bl.id) as log_count,
       ROUND(AVG(bl.price_pint), 2) as avg_price,
       MIN(bl.price_pint) as min_price,
       MAX(bl.price_pint) as max_price
     FROM beer_logs bl
     JOIN beers b ON b.id = bl.beer_id
     WHERE bl.group_id = $1
     GROUP BY b.id ORDER BY log_count DESC`,
    [groupId]
  );

  return Response.json({ beers: beers.rows });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ groupId: string }> }
) {
  const { groupId } = await params;
  const playerId = await getPlayerId();
  if (!playerId) return Response.json({ error: "No session" }, { status: 401 });

  const body = await req.json();

  // Search for existing beers (autocomplete)
  if (body.action === "search") {
    const term = (body.term ?? "").trim().toLowerCase();
    if (!term) return Response.json({ beers: [] });

    const res = await query(
      `SELECT DISTINCT b.id, b.name, b.brewery
       FROM beers b
       LEFT JOIN beer_logs bl ON bl.beer_id = b.id AND bl.group_id = $1
       WHERE LOWER(b.name) LIKE $2
       ORDER BY b.name LIMIT 20`,
      [groupId, `%${term}%`]
    );
    return Response.json({ beers: res.rows });
  }

  // Log a beer at a pub
  if (body.action === "log") {
    let beerId = body.beerId;

    // Create new beer if needed
    if (!beerId && body.beerName) {
      beerId = nanoid(12);
      await query(
        `INSERT INTO beers (id, name, brewery, created_by) VALUES ($1, $2, $3, $4)
         ON CONFLICT (id) DO NOTHING`,
        [beerId, body.beerName.trim().slice(0, 100), (body.brewery || "").trim().slice(0, 100), playerId]
      );
    }
    if (!beerId) return Response.json({ error: "Beer name required" }, { status: 400 });

    const id = nanoid(16);
    await query(
      `INSERT INTO beer_logs (id, beer_id, pub_id, player_id, group_id, visit_id, price_pint, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        id, beerId, body.pubId || null, playerId, groupId,
        body.visitId || null,
        body.pricePint ? parseFloat(body.pricePint) : null,
        (body.notes || "").slice(0, 300),
      ]
    );
    return Response.json({ ok: true, logId: id, beerId });
  }

  return Response.json({ error: "Invalid action" }, { status: 400 });
}
