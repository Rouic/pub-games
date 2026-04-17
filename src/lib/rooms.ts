import { query, pool } from "./db";
import { nanoid } from "nanoid";

/** Generate a short, typeable room code like "AXBF". */
function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I/O/0/1
  let code = "";
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export interface Room {
  id: string;
  code: string;
  game: string;
  state: Record<string, unknown>;
  phase: string;
  host_id: string;
  player_ids: string[];
  created_at: string;
  updated_at: string;
}

export async function createRoom(
  game: string,
  hostId: string
): Promise<Room> {
  const id = nanoid(16);
  let code = generateCode();

  // Retry on code collision (unlikely with 4 chars + old rooms pruned)
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const res = await query(
        `INSERT INTO rooms (id, code, game, host_id, player_ids)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [id, code, game, hostId, [hostId]]
      );
      return res.rows[0] as Room;
    } catch (e: unknown) {
      if ((e as { code?: string }).code === "23505") {
        code = generateCode();
        continue;
      }
      throw e;
    }
  }
  throw new Error("Could not generate unique room code");
}

export async function joinRoom(code: string, playerId: string): Promise<Room | null> {
  const res = await query(
    `UPDATE rooms
     SET player_ids = array_append(player_ids, $2),
         updated_at = now()
     WHERE code = $1
       AND NOT ($2 = ANY(player_ids))
       AND phase = 'waiting'
       AND array_length(player_ids, 1) < CASE WHEN game IN ('redblack', 'highlow', 'mostlikely') THEN 10 ELSE 2 END
     RETURNING *`,
    [code.toUpperCase(), playerId]
  );

  if (res.rows[0]) return res.rows[0] as Room;

  // Maybe already in the room?
  const existing = await query(
    "SELECT * FROM rooms WHERE code = $1 AND $2 = ANY(player_ids)",
    [code.toUpperCase(), playerId]
  );
  return existing.rows[0] as Room | null;
}

export async function getRoom(roomId: string): Promise<Room | null> {
  const res = await query("SELECT * FROM rooms WHERE id = $1", [roomId]);
  return (res.rows[0] as Room) ?? null;
}

export async function updateRoom(
  roomId: string,
  phase: string,
  state: unknown
): Promise<Room> {
  const res = await query(
    `UPDATE rooms SET phase = $2, state = $3, updated_at = now()
     WHERE id = $1 RETURNING *`,
    [roomId, phase, JSON.stringify(state)]
  );
  return res.rows[0] as Room;
}

/** Append a stroke to the room state without overwriting other fields. */
export async function appendStroke(roomId: string, stroke: unknown): Promise<void> {
  await query(
    `UPDATE rooms SET
       state = jsonb_set(
         jsonb_set(state, '{strokes}', COALESCE(state->'strokes', '[]'::jsonb) || $2::jsonb),
         '{strokes}',
         CASE
           WHEN jsonb_array_length(COALESCE(state->'strokes', '[]'::jsonb)) > 500
           THEN (COALESCE(state->'strokes', '[]'::jsonb) || $2::jsonb) - 0
           ELSE COALESCE(state->'strokes', '[]'::jsonb) || $2::jsonb
         END
       ),
       updated_at = now()
     WHERE id = $1`,
    [roomId, JSON.stringify([stroke])]
  );
}

/** Clear strokes in room state without overwriting other fields. */
export async function clearStrokes(roomId: string): Promise<void> {
  await query(
    `UPDATE rooms SET state = jsonb_set(state, '{strokes}', '[]'::jsonb), updated_at = now() WHERE id = $1`,
    [roomId]
  );
}

/** Broadcast an event to all listeners on this room via pg NOTIFY. */
export async function broadcastEvent(
  roomId: string,
  event: Record<string, unknown>
) {
  const channel = `room_${roomId.replace(/[^a-zA-Z0-9_]/g, "_")}`;
  await query(`SELECT pg_notify($1, $2)`, [
    channel,
    JSON.stringify(event),
  ]);
}
