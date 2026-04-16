import pg from "pg";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

await pool.query(`
  CREATE TABLE IF NOT EXISTS players (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    emoji TEXT NOT NULL DEFAULT '🎲',
    wins INT NOT NULL DEFAULT 0,
    losses INT NOT NULL DEFAULT 0,
    games_played INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS rooms (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    game TEXT NOT NULL CHECK (game IN ('dice', 'sketch')),
    state JSONB NOT NULL DEFAULT '{}',
    phase TEXT NOT NULL DEFAULT 'waiting',
    host_id TEXT REFERENCES players(id),
    player_ids TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  CREATE INDEX IF NOT EXISTS idx_rooms_code ON rooms(code);
  CREATE INDEX IF NOT EXISTS idx_rooms_updated ON rooms(updated_at);
`);

console.log("Database initialized");
await pool.end();
