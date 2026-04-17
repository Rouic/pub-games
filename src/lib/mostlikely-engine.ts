/**
 * Most Likely To — voting drinking game.
 *
 * A prompt like "Most likely to fall asleep at the pub" is shown.
 * Everyone votes for who they think fits best. Person with the
 * most votes drinks. Ties = everyone tied drinks.
 */

export interface MostLikelyState {
  turnOrder: string[];
  round: number;
  maxRounds: number;
  prompt: string;
  votes: Record<string, string>;  // voterId -> votedForId
  phase: "voting" | "results";
  results: { playerId: string; votes: number }[] | null;
  drinkers: string[];  // who drinks this round
  scores: Record<string, number>;  // times you've had to drink (lower = better)
  usedPrompts: number[];
  winner: string | null;
}

const PROMPTS = [
  // Classic pub
  "most likely to fall asleep at the pub",
  "most likely to start a tab and forget to close it",
  "most likely to challenge a stranger to a game",
  "most likely to order the most expensive drink",
  "most likely to spill their drink",
  "most likely to get the whole pub singing",
  "most likely to befriend the bartender",
  "most likely to lose their phone on a night out",
  "most likely to end up at a kebab shop at 3am",
  "most likely to drunk text their ex",
  "most likely to start a bar fight",
  "most likely to cry after two drinks",
  "most likely to be the last one standing",
  "most likely to fall off a bar stool",
  "most likely to buy a round for strangers",
  "most likely to get banned from a pub",
  "most likely to order a cocktail with an umbrella",
  "most likely to steal a pint glass",
  "most likely to suggest shots at midnight",
  "most likely to wake up with a traffic cone",
  // Social / personality
  "most likely to become famous",
  "most likely to survive on a desert island",
  "most likely to win a reality TV show",
  "most likely to become a millionaire",
  "most likely to move to another country",
  "most likely to write a book",
  "most likely to go viral on social media",
  "most likely to run a marathon",
  "most likely to adopt 10 cats",
  "most likely to get lost in their own town",
  "most likely to forget someone's name mid-conversation",
  "most likely to laugh at the worst possible moment",
  "most likely to send a text to the wrong person",
  "most likely to trip over nothing",
  "most likely to binge an entire series in one sitting",
  "most likely to eat something off the floor",
  "most likely to cry at a Disney film",
  "most likely to talk their way out of a parking ticket",
  "most likely to accidentally like a photo from 3 years ago",
  "most likely to show up to the wrong event",
  // Hypothetical
  "most likely to survive a zombie apocalypse",
  "most likely to win the lottery and lose the ticket",
  "most likely to get arrested for something stupid",
  "most likely to accidentally start a fire",
  "most likely to get stuck in a lift and panic",
  "most likely to eat a ghost pepper for a dare",
  "most likely to sleep through an earthquake",
  "most likely to befriend a celebrity",
  "most likely to accidentally become a cult leader",
  "most likely to be on the news for a ridiculous reason",
  // Work / life
  "most likely to quit their job on the spot",
  "most likely to become the boss",
  "most likely to fall asleep in a meeting",
  "most likely to reply-all by accident",
  "most likely to bring homemade lunch every day",
  "most likely to have a secret talent nobody knows about",
  "most likely to be late to their own wedding",
  "most likely to still be partying at 60",
  "most likely to start a business",
  "most likely to retire the earliest",
];

function pickPrompt(usedIndices: number[]): { prompt: string; index: number } {
  const available = PROMPTS.map((p, i) => ({ p, i })).filter(({ i }) => !usedIndices.includes(i));
  if (available.length === 0) {
    const i = Math.floor(Math.random() * PROMPTS.length);
    return { prompt: PROMPTS[i], index: i };
  }
  const pick = available[Math.floor(Math.random() * available.length)];
  return { prompt: pick.p, index: pick.i };
}

export function initMostLikelyGame(playerIds: string[], rounds = 10): MostLikelyState {
  const { prompt, index } = pickPrompt([]);
  const scores: Record<string, number> = {};
  for (const id of playerIds) scores[id] = 0;
  return {
    turnOrder: [...playerIds],
    round: 1,
    maxRounds: Math.min(rounds, PROMPTS.length),
    prompt,
    votes: {},
    phase: "voting",
    results: null,
    drinkers: [],
    scores,
    usedPrompts: [index],
    winner: null,
  };
}

export function castVote(state: MostLikelyState, voterId: string, votedForId: string): MostLikelyState | null {
  if (state.winner || state.phase !== "voting") return null;
  if (!state.turnOrder.includes(voterId)) return null;
  if (!state.turnOrder.includes(votedForId)) return null;

  const votes = { ...state.votes, [voterId]: votedForId };
  return { ...state, votes };
}

export function allVotesIn(state: MostLikelyState): boolean {
  return state.turnOrder.every((id) => id in state.votes);
}

export function tallyVotes(state: MostLikelyState): MostLikelyState {
  // Count votes
  const counts: Record<string, number> = {};
  for (const id of state.turnOrder) counts[id] = 0;
  for (const votedFor of Object.values(state.votes)) {
    counts[votedFor] = (counts[votedFor] ?? 0) + 1;
  }

  const results = Object.entries(counts)
    .map(([playerId, votes]) => ({ playerId, votes }))
    .sort((a, b) => b.votes - a.votes);

  // Most votes drinks (ties = all tied drink)
  const maxVotes = results[0]?.votes ?? 0;
  const drinkers = maxVotes > 0
    ? results.filter((r) => r.votes === maxVotes).map((r) => r.playerId)
    : [];

  const scores = { ...state.scores };
  for (const id of drinkers) {
    scores[id] = (scores[id] ?? 0) + 1;
  }

  return { ...state, results, drinkers, scores, phase: "results" };
}

export function nextRound(state: MostLikelyState): MostLikelyState {
  const nextR = state.round + 1;
  if (nextR > state.maxRounds) {
    // Winner = person who had to drink the LEAST
    const entries = Object.entries(state.scores);
    entries.sort((a, b) => a[1] - b[1]); // ascending — fewest drinks wins
    return { ...state, round: nextR, winner: entries[0]?.[0] ?? null };
  }

  const { prompt, index } = pickPrompt(state.usedPrompts);
  return {
    ...state,
    round: nextR,
    prompt,
    votes: {},
    phase: "voting",
    results: null,
    drinkers: [],
    usedPrompts: [...state.usedPrompts, index],
  };
}
