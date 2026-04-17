import { cookies } from "next/headers";
import { query } from "@/lib/db";
import { createHash } from "crypto";

const PLAYER_COOKIE = "pub_player_id";

function hashPassword(pw: string): string {
  // Simple SHA-256 hash — adequate for a demo game, not a bank
  return createHash("sha256").update(pw).digest("hex");
}

export async function POST(req: Request) {
  const jar = await cookies();
  const playerId = jar.get(PLAYER_COOKIE)?.value;
  const body = await req.json();
  const { action } = body;

  // ── Claim: upgrade anon account with email + password ──
  if (action === "claim") {
    if (!playerId) return Response.json({ error: "No session to upgrade" }, { status: 400 });

    const email = (body.email ?? "").trim().toLowerCase();
    const password = body.password ?? "";
    const displayName = (body.displayName ?? "").trim();

    if (!email || !email.includes("@"))
      return Response.json({ error: "Valid email required" }, { status: 400 });
    if (password.length < 6)
      return Response.json({ error: "Password must be at least 6 characters" }, { status: 400 });

    // Check email not taken by another player
    const existing = await query("SELECT id FROM players WHERE email = $1", [email]);
    if (existing.rows[0] && existing.rows[0].id !== playerId) {
      return Response.json({ error: "Email already in use" }, { status: 409 });
    }

    const hash = hashPassword(password);
    await query(
      `UPDATE players SET email = $1, password_hash = $2, display_name = COALESCE(NULLIF($3, ''), display_name), name = COALESCE(NULLIF($3, ''), name) WHERE id = $4`,
      [email, hash, displayName, playerId]
    );

    return Response.json({ ok: true });
  }

  // ── Login: sign in with email + password, restore session ──
  if (action === "login") {
    const email = (body.email ?? "").trim().toLowerCase();
    const password = body.password ?? "";

    if (!email || !password)
      return Response.json({ error: "Email and password required" }, { status: 400 });

    const hash = hashPassword(password);
    const res = await query(
      "SELECT * FROM players WHERE email = $1 AND password_hash = $2",
      [email, hash]
    );

    if (!res.rows[0])
      return Response.json({ error: "Invalid email or password" }, { status: 401 });

    const player = res.rows[0];

    // If we have an existing anon session, merge its data into the claimed account
    if (playerId && playerId !== player.id) {
      // Transfer any game rooms, visits, group memberships from the anon account
      await query("UPDATE pub_visits SET player_id = $1 WHERE player_id = $2", [player.id, playerId]);
      await query("UPDATE pub_group_members SET player_id = $1 WHERE player_id = $2 AND group_id NOT IN (SELECT group_id FROM pub_group_members WHERE player_id = $1)", [player.id, playerId]);
      await query("UPDATE rooms SET host_id = $1 WHERE host_id = $2", [player.id, playerId]);
      // Merge stats
      await query(
        `UPDATE players SET
           wins = wins + (SELECT COALESCE(wins, 0) FROM players WHERE id = $2),
           losses = losses + (SELECT COALESCE(losses, 0) FROM players WHERE id = $2),
           games_played = games_played + (SELECT COALESCE(games_played, 0) FROM players WHERE id = $2)
         WHERE id = $1`,
        [player.id, playerId]
      );
      // Remove the orphaned anon record
      await query("DELETE FROM pub_group_members WHERE player_id = $1", [playerId]);
      await query("DELETE FROM players WHERE id = $1", [playerId]);
    }

    // Set cookie to the claimed player
    jar.set(PLAYER_COOKIE, player.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365, // 1 year for claimed accounts
      path: "/",
    });

    return Response.json({
      player: {
        id: player.id,
        name: player.display_name || player.name,
        emoji: player.emoji,
        email: player.email,
        wins: player.wins,
        losses: player.losses,
        games_played: player.games_played,
      },
    });
  }

  // ── Update: change name or emoji (works for anon and claimed) ──
  if (action === "update") {
    if (!playerId) return Response.json({ error: "No session" }, { status: 400 });

    const name = (body.name ?? "").trim();
    const emoji = (body.emoji ?? "").trim();

    if (!name && !emoji)
      return Response.json({ error: "Nothing to update" }, { status: 400 });
    if (name && (name.length < 1 || name.length > 30))
      return Response.json({ error: "Name must be 1-30 characters" }, { status: 400 });

    const sets: string[] = [];
    const vals: unknown[] = [];
    let i = 1;

    if (name) { sets.push(`name = $${i}`); vals.push(name); i++; }
    if (emoji) { sets.push(`emoji = $${i}`); vals.push(emoji); i++; }
    vals.push(playerId);

    const res = await query(
      `UPDATE players SET ${sets.join(", ")} WHERE id = $${i} RETURNING id, name, emoji, email`,
      vals
    );

    if (!res.rows[0]) return Response.json({ error: "Player not found" }, { status: 404 });

    const p = res.rows[0];
    return Response.json({
      player: { id: p.id, name: p.name, emoji: p.emoji, hasClaimed: !!p.email },
    });
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
}
