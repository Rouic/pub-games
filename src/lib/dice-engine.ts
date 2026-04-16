/**
 * Liar's Dice game engine.
 *
 * State shape:
 * {
 *   players: { [id]: { dice: number[], diceCount: number } },
 *   turnOrder: string[],       // player IDs in turn order
 *   currentTurn: number,       // index into turnOrder
 *   currentBid: { qty: number, face: number } | null,
 *   lastBidder: string | null,
 *   round: number,
 *   revealedDice: { [id]: number[] } | null, // set during reveal
 *   lastResult: { caller: string, bidder: string, bid: { qty: number, face: number }, totalOfFace: number, callerWon: boolean } | null,
 *   winner: string | null,
 * }
 */

export interface DiceState {
  players: Record<string, { dice: number[]; diceCount: number }>;
  turnOrder: string[];
  currentTurn: number;
  currentBid: { qty: number; face: number } | null;
  lastBidder: string | null;
  round: number;
  revealedDice: Record<string, number[]> | null;
  lastResult: {
    caller: string;
    bidder: string;
    bid: { qty: number; face: number };
    totalOfFace: number;
    callerWon: boolean;
  } | null;
  winner: string | null;
}

function rollDice(count: number): number[] {
  return Array.from({ length: count }, () => Math.floor(Math.random() * 6) + 1);
}

export function initGame(playerIds: string[]): DiceState {
  const players: DiceState["players"] = {};
  for (const id of playerIds) {
    players[id] = { dice: rollDice(5), diceCount: 5 };
  }
  return {
    players,
    turnOrder: [...playerIds],
    currentTurn: 0,
    currentBid: null,
    lastBidder: null,
    round: 1,
    revealedDice: null,
    lastResult: null,
    winner: null,
  };
}

/** Start a new round — reroll dice for everyone still alive. */
export function newRound(state: DiceState): DiceState {
  const alive = state.turnOrder.filter(
    (id) => state.players[id].diceCount > 0
  );
  if (alive.length <= 1) {
    return { ...state, winner: alive[0] ?? null };
  }

  const players = { ...state.players };
  for (const id of alive) {
    players[id] = {
      ...players[id],
      dice: rollDice(players[id].diceCount),
    };
  }

  return {
    ...state,
    players,
    turnOrder: alive,
    currentTurn: 0,
    currentBid: null,
    lastBidder: null,
    revealedDice: null,
    lastResult: null,
    round: state.round + 1,
  };
}

export function isValidBid(
  current: { qty: number; face: number } | null,
  bid: { qty: number; face: number }
): boolean {
  if (bid.face < 1 || bid.face > 6 || bid.qty < 1) return false;
  if (!current) return true; // first bid of the round
  // Must raise quantity or raise face at same quantity
  if (bid.qty > current.qty) return true;
  if (bid.qty === current.qty && bid.face > current.face) return true;
  return false;
}

export function placeBid(
  state: DiceState,
  playerId: string,
  bid: { qty: number; face: number }
): DiceState | null {
  if (state.winner) return null;
  if (state.turnOrder[state.currentTurn] !== playerId) return null;
  if (!isValidBid(state.currentBid, bid)) return null;

  const nextTurn = (state.currentTurn + 1) % state.turnOrder.length;
  return {
    ...state,
    currentBid: bid,
    lastBidder: playerId,
    currentTurn: nextTurn,
  };
}

export function callLiar(
  state: DiceState,
  callerId: string
): DiceState | null {
  if (state.winner) return null;
  if (!state.currentBid || !state.lastBidder) return null;
  if (state.turnOrder[state.currentTurn] !== callerId) return null;
  if (callerId === state.lastBidder) return null;

  const bid = state.currentBid;
  const bidderId = state.lastBidder;

  // Count all dice showing the bid face across all players
  let totalOfFace = 0;
  const revealedDice: Record<string, number[]> = {};
  for (const [id, p] of Object.entries(state.players)) {
    if (p.diceCount > 0) {
      revealedDice[id] = p.dice;
      totalOfFace += p.dice.filter((d) => d === bid.face).length;
    }
  }

  // If actual count >= bid qty, the bidder was telling the truth → caller loses a die
  // If actual count < bid qty, the bidder was bluffing → bidder loses a die
  const callerWon = totalOfFace < bid.qty;
  const loserId = callerWon ? bidderId : callerId;

  const players = { ...state.players };
  players[loserId] = {
    ...players[loserId],
    diceCount: Math.max(0, players[loserId].diceCount - 1),
  };

  return {
    ...state,
    players,
    revealedDice,
    lastResult: {
      caller: callerId,
      bidder: bidderId,
      bid,
      totalOfFace,
      callerWon,
    },
  };
}
