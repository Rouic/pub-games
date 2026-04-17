/**
 * Higher or Lower — card drinking game.
 *
 * A card is face up. Guess if the next card is higher or lower.
 * Equal counts as wrong. Wrong = drink. Track streaks.
 * Players take turns. Deck of 52, game ends when empty.
 */

export type Suit = "hearts" | "diamonds" | "clubs" | "spades";

export interface Card {
  suit: Suit;
  rank: string;
  value: number; // 1(A) - 13(K)
  color: "red" | "black";
}

export interface HighLowState {
  deck: Card[];
  currentCard: Card;
  previousCard: Card | null;
  currentPlayer: number;
  turnOrder: string[];
  scores: Record<string, number>;
  streaks: Record<string, number>;
  bestStreaks: Record<string, number>;
  lastGuess: { playerId: string; guess: "higher" | "lower"; correct: boolean } | null;
  cardsPlayed: number;
  totalCards: number;
  winner: string | null;
}

function makeDeck(): Card[] {
  const suits: Suit[] = ["hearts", "diamonds", "clubs", "spades"];
  const ranks = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
  const deck: Card[] = [];
  for (const suit of suits) {
    for (let i = 0; i < ranks.length; i++) {
      deck.push({
        suit,
        rank: ranks[i],
        value: i + 1,
        color: suit === "hearts" || suit === "diamonds" ? "red" : "black",
      });
    }
  }
  return deck;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function initHighLowGame(playerIds: string[]): HighLowState {
  const deck = shuffle(makeDeck());
  const firstCard = deck.pop()!;
  const scores: Record<string, number> = {};
  const streaks: Record<string, number> = {};
  const bestStreaks: Record<string, number> = {};
  for (const id of playerIds) {
    scores[id] = 0;
    streaks[id] = 0;
    bestStreaks[id] = 0;
  }
  return {
    deck,
    currentCard: firstCard,
    previousCard: null,
    currentPlayer: 0,
    turnOrder: [...playerIds],
    scores,
    streaks,
    bestStreaks,
    lastGuess: null,
    cardsPlayed: 1,
    totalCards: 52,
    winner: null,
  };
}

export function makeGuess(
  state: HighLowState,
  playerId: string,
  guess: "higher" | "lower"
): HighLowState | null {
  if (state.winner) return null;
  if (state.turnOrder[state.currentPlayer] !== playerId) return null;
  if (state.deck.length === 0) return null;

  const deck = [...state.deck];
  const nextCard = deck.pop()!;
  const correct =
    (guess === "higher" && nextCard.value > state.currentCard.value) ||
    (guess === "lower" && nextCard.value < state.currentCard.value);
  // Equal = wrong

  const scores = { ...state.scores };
  const streaks = { ...state.streaks };
  const bestStreaks = { ...state.bestStreaks };

  if (correct) {
    scores[playerId] = (scores[playerId] ?? 0) + 1;
    streaks[playerId] = (streaks[playerId] ?? 0) + 1;
    if (streaks[playerId] > (bestStreaks[playerId] ?? 0)) {
      bestStreaks[playerId] = streaks[playerId];
    }
  } else {
    streaks[playerId] = 0;
  }

  const cardsPlayed = state.cardsPlayed + 1;
  const nextPlayer = (state.currentPlayer + 1) % state.turnOrder.length;

  let winner: string | null = null;
  if (deck.length === 0) {
    const entries = Object.entries(scores);
    entries.sort((a, b) => b[1] - a[1]);
    winner = entries[0]?.[0] ?? null;
  }

  return {
    ...state,
    deck,
    previousCard: state.currentCard,
    currentCard: nextCard,
    currentPlayer: nextPlayer,
    scores,
    streaks,
    bestStreaks,
    lastGuess: { playerId, guess, correct },
    cardsPlayed,
    winner,
  };
}

export function maskState(state: HighLowState): Omit<HighLowState, "deck"> & { deck: number } {
  return { ...state, deck: state.deck.length };
}
