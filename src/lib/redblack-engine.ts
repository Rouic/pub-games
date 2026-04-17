/**
 * Red or Black — drinking card game.
 *
 * A shuffled 52-card deck. Players take turns guessing "red" or "black".
 * A card is flipped — if correct, the next player drinks. If wrong, you drink.
 * Track streaks and scores. Game ends when the deck runs out.
 */

export type Suit = "hearts" | "diamonds" | "clubs" | "spades";
export type Color = "red" | "black";

export interface Card {
  suit: Suit;
  rank: string;    // "A", "2"-"10", "J", "Q", "K"
  value: number;   // 1-13
  color: Color;
}

export interface RedBlackState {
  deck: Card[];
  currentCard: Card | null;
  currentPlayer: number;   // index into turnOrder
  turnOrder: string[];
  scores: Record<string, number>;    // correct guesses
  streaks: Record<string, number>;   // current streak
  bestStreaks: Record<string, number>; // best streak per player
  lastGuess: { playerId: string; guess: Color; correct: boolean } | null;
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

export function initRedBlackGame(playerIds: string[]): RedBlackState {
  const deck = shuffle(makeDeck());
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
    currentCard: null,
    currentPlayer: 0,
    turnOrder: [...playerIds],
    scores,
    streaks,
    bestStreaks,
    lastGuess: null,
    cardsPlayed: 0,
    totalCards: 52,
    winner: null,
  };
}

export function makeGuess(state: RedBlackState, playerId: string, guess: Color): RedBlackState | null {
  if (state.winner) return null;
  if (state.turnOrder[state.currentPlayer] !== playerId) return null;
  if (state.deck.length === 0) return null;

  const deck = [...state.deck];
  const card = deck.pop()!;
  const correct = card.color === guess;

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

  // Game over when deck is empty
  let winner: string | null = null;
  if (deck.length === 0) {
    const entries = Object.entries(scores);
    entries.sort((a, b) => b[1] - a[1]);
    winner = entries[0]?.[0] ?? null;
  }

  return {
    ...state,
    deck,
    currentCard: card,
    currentPlayer: nextPlayer,
    scores,
    streaks,
    bestStreaks,
    lastGuess: { playerId, guess, correct },
    cardsPlayed,
    winner,
  };
}

/** Mask deck for client — don't reveal remaining cards */
export function maskState(state: RedBlackState): Omit<RedBlackState, "deck"> & { deck: number } {
  return {
    ...state,
    deck: state.deck.length, // just the count
  };
}
