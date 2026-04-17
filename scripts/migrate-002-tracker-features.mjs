import pg from "pg";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

await pool.query(`
  -- Add geolocation to pubs
  ALTER TABLE pubs ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION;
  ALTER TABLE pubs ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;

  -- Beers table
  CREATE TABLE IF NOT EXISTS beers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    brewery TEXT,
    created_by TEXT REFERENCES players(id),
    created_at TIMESTAMPTZ DEFAULT now()
  );

  -- Beer logs (what beer was drunk where, with price)
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
`);

console.log("Migration 002 complete: tracker features (lat/lng, beers, beer_logs)");
await pool.end();
