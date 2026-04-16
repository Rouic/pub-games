/**
 * Sketch Duel game engine.
 *
 * State:
 * {
 *   round: number,
 *   maxRounds: 8,
 *   scores: { [playerId]: number },
 *   artistId: string,          // who's drawing
 *   guesserId: string,         // who's guessing
 *   word: string,              // the secret word
 *   wordHint: string,          // "_ _ _ _ _" hint for guesser
 *   roundStartedAt: number,    // epoch ms
 *   roundTimeLimit: 60,        // seconds
 *   guessedCorrectly: boolean,
 *   winner: string | null,
 * }
 */

export interface SketchState {
  round: number;
  maxRounds: number;
  scores: Record<string, number>;
  artistId: string;
  guesserId: string;
  word: string;
  wordHint: string;
  roundStartedAt: number;
  roundTimeLimit: number;
  guessedCorrectly: boolean;
  winner: string | null;
}

const WORDS = [
  // Animals
  "cat", "dog", "elephant", "penguin", "octopus", "giraffe", "spider", "butterfly",
  "whale", "flamingo", "lobster", "snail", "bat", "frog", "shark", "dinosaur",
  // Objects
  "guitar", "umbrella", "bicycle", "camera", "rocket", "scissors", "telescope",
  "candle", "diamond", "anchor", "crown", "sword", "balloon", "ladder", "bridge",
  // Food & Drink
  "pizza", "burger", "ice cream", "sushi", "cake", "cocktail", "taco", "popcorn",
  "pineapple", "watermelon", "pretzel", "donut", "banana", "cookie",
  // Actions / Concepts
  "surfing", "skydiving", "sleeping", "fishing", "dancing", "sneezing",
  "lightning", "volcano", "rainbow", "sunset", "tornado", "island",
  // Pub-themed
  "beer", "dartboard", "pool table", "jukebox", "karaoke", "pub quiz",
  "bar stool", "cocktail shaker", "wine glass", "pint glass",
];

function pickWord(usedWords: string[] = []): string {
  const available = WORDS.filter((w) => !usedWords.includes(w));
  if (available.length === 0) return WORDS[Math.floor(Math.random() * WORDS.length)];
  return available[Math.floor(Math.random() * available.length)];
}

function makeHint(word: string): string {
  return word
    .split("")
    .map((c) => (c === " " ? "  " : "_"))
    .join(" ");
}

export function initSketchGame(playerIds: string[]): SketchState {
  const [a, b] = playerIds;
  const word = pickWord();
  return {
    round: 1,
    maxRounds: 8,
    scores: { [a]: 0, [b]: 0 },
    artistId: a,
    guesserId: b,
    word,
    wordHint: makeHint(word),
    roundStartedAt: Date.now(),
    roundTimeLimit: 60,
    guessedCorrectly: false,
    winner: null,
  };
}

export function checkGuess(state: SketchState, guess: string): boolean {
  return guess.toLowerCase().trim() === state.word.toLowerCase().trim();
}

export function scoreGuess(state: SketchState): SketchState {
  const elapsed = (Date.now() - state.roundStartedAt) / 1000;
  // Faster guess = more points (max 100 if instant, min 10 if last second)
  const timeBonus = Math.max(10, Math.round(100 * (1 - elapsed / state.roundTimeLimit)));
  const scores = { ...state.scores };
  scores[state.guesserId] = (scores[state.guesserId] ?? 0) + timeBonus;
  scores[state.artistId] = (scores[state.artistId] ?? 0) + Math.round(timeBonus / 2); // artist gets half

  return { ...state, scores, guessedCorrectly: true };
}

/** Advance to the next round, swapping artist/guesser. */
export function nextSketchRound(
  state: SketchState,
  usedWords: string[]
): SketchState {
  const nextRound = state.round + 1;
  if (nextRound > state.maxRounds) {
    // Game over — highest score wins
    const entries = Object.entries(state.scores);
    entries.sort((a, b) => b[1] - a[1]);
    return { ...state, round: nextRound, winner: entries[0]?.[0] ?? null };
  }

  const word = pickWord(usedWords);
  return {
    ...state,
    round: nextRound,
    // Swap roles
    artistId: state.guesserId,
    guesserId: state.artistId,
    word,
    wordHint: makeHint(word),
    roundStartedAt: Date.now(),
    guessedCorrectly: false,
  };
}
