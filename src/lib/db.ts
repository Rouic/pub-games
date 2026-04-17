import { Pool, type PoolClient } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
});

// Auto-migrate on first connection
const _migrate = pool.query(`
  ALTER TABLE pubs ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION;
  ALTER TABLE pubs ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;

  CREATE TABLE IF NOT EXISTS beers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    brewery TEXT,
    created_by TEXT REFERENCES players(id),
    created_at TIMESTAMPTZ DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS beer_logs (
    id TEXT PRIMARY KEY,
    beer_id TEXT REFERENCES beers(id),
    pub_id TEXT REFERENCES pubs(id),
    player_id TEXT REFERENCES players(id),
    group_id TEXT REFERENCES pub_groups(id),
    visit_id TEXT REFERENCES pub_visits(id),
    price_pint NUMERIC(6,2),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
  );

  CREATE INDEX IF NOT EXISTS idx_beers_name ON beers(LOWER(name));
  CREATE INDEX IF NOT EXISTS idx_beer_logs_group ON beer_logs(group_id);
  CREATE INDEX IF NOT EXISTS idx_beer_logs_pub ON beer_logs(pub_id);
  CREATE INDEX IF NOT EXISTS idx_beer_logs_beer ON beer_logs(beer_id);
  CREATE INDEX IF NOT EXISTS idx_pubs_location ON pubs(lat, lng) WHERE lat IS NOT NULL;

  -- Allow redblack game type
  ALTER TABLE rooms DROP CONSTRAINT IF EXISTS rooms_game_check;
  ALTER TABLE rooms ADD CONSTRAINT rooms_game_check CHECK (game IN ('dice', 'sketch', 'redblack'));
`).catch((e) => console.error("Migration error (non-fatal):", e.message));

export { pool };

export async function query(text: string, params?: unknown[]) {
  return pool.query(text, params);
}

export async function withClient<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}
