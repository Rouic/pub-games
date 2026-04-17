import { query } from "@/lib/db";

export async function GET() {
  // Top players by wins (minimum 1 game played)
  const topPlayers = await query(
    `SELECT id, name, emoji, wins, losses, games_played,
       CASE WHEN games_played > 0 THEN ROUND(wins::numeric / games_played * 100) ELSE 0 END as win_rate
     FROM players
     WHERE games_played > 0
     ORDER BY wins DESC, win_rate DESC
     LIMIT 50`
  );

  // Recent games (last 20 completed rooms)
  const recentGames = await query(
    `SELECT r.game, r.phase, r.updated_at,
       r.player_ids,
       (r.state->>'winner') as winner_id
     FROM rooms r
     WHERE r.phase = 'finished'
     ORDER BY r.updated_at DESC
     LIMIT 20`
  );

  // Stats summary
  const stats = await query(
    `SELECT
       COUNT(DISTINCT id) FILTER (WHERE games_played > 0) as total_players,
       SUM(games_played) / 2 as total_games,
       COUNT(DISTINCT id) FILTER (WHERE games_played > 0 AND wins > losses) as winners
     FROM players`
  );

  return Response.json({
    players: topPlayers.rows,
    recentGames: recentGames.rows,
    stats: stats.rows[0] ?? { total_players: 0, total_games: 0, winners: 0 },
  });
}
