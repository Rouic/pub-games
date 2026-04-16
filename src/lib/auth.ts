import { cookies } from "next/headers";
import { nanoid } from "nanoid";
import { query } from "./db";

const PLAYER_COOKIE = "pub_player_id";
const EMOJIS = [
  "🎲", "🎯", "🍺", "🎪", "🃏", "🎰", "🎱", "🍻",
  "🎭", "🎸", "🎶", "🐉", "🦊", "🐙", "🌶️", "⚡",
  "🔥", "🌊", "🏴‍☠️", "💎", "🎩", "🧊", "🍕", "🌮",
];

const ADJECTIVES = [
  "Lucky", "Sneaky", "Bold", "Wild", "Sly", "Crafty",
  "Cheeky", "Daring", "Fizzy", "Frosty", "Hazy", "Jolly",
  "Mighty", "Plucky", "Rusty", "Shady", "Swift", "Witty",
];

const NOUNS = [
  "Fox", "Bear", "Dice", "Ace", "Pint", "Barrel",
  "Raven", "Wolf", "Card", "Cork", "Dart", "Flame",
  "Ghost", "Joker", "Knight", "Otter", "Rogue", "Storm",
];

function randomName(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  return `${adj} ${noun}`;
}

function randomEmoji(): string {
  return EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
}

export interface Player {
  id: string;
  name: string;
  emoji: string;
  wins: number;
  losses: number;
  games_played: number;
}

/** Get or create the current player from cookies. */
export async function getOrCreatePlayer(): Promise<Player> {
  const jar = await cookies();
  let playerId = jar.get(PLAYER_COOKIE)?.value;

  if (playerId) {
    const res = await query("SELECT * FROM players WHERE id = $1", [playerId]);
    if (res.rows[0]) return res.rows[0] as Player;
  }

  // Create new anonymous player
  playerId = nanoid(12);
  const name = randomName();
  const emoji = randomEmoji();

  await query(
    "INSERT INTO players (id, name, emoji) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING",
    [playerId, name, emoji]
  );

  jar.set(PLAYER_COOKIE, playerId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365, // 1 year
    path: "/",
  });

  return { id: playerId, name, emoji, wins: 0, losses: 0, games_played: 0 };
}

/** Read the player ID from cookies without creating (for API routes). */
export async function getPlayerId(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(PLAYER_COOKIE)?.value ?? null;
}
