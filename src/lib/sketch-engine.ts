/**
 * Sketch Duel game engine.
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
  usedWords: string[];
}

const WORDS = [
  // Animals
  "cat", "dog", "elephant", "penguin", "octopus", "giraffe", "spider", "butterfly",
  "whale", "flamingo", "lobster", "snail", "bat", "frog", "shark", "dinosaur",
  "parrot", "monkey", "kangaroo", "turtle", "dolphin", "lion", "tiger", "bear",
  "rabbit", "horse", "pig", "chicken", "cow", "zebra", "eagle", "owl",
  "crocodile", "hippo", "camel", "panda", "koala", "hedgehog", "squirrel", "ant",
  "bee", "jellyfish", "crab", "starfish", "seahorse", "gorilla", "wolf", "fox",
  // Objects
  "guitar", "umbrella", "bicycle", "camera", "rocket", "scissors", "telescope",
  "candle", "diamond", "anchor", "crown", "sword", "balloon", "ladder", "bridge",
  "piano", "headphones", "microphone", "binoculars", "hourglass", "compass",
  "lantern", "trophy", "key", "lock", "magnifying glass", "treasure chest",
  "parachute", "skateboard", "rollercoaster", "ferris wheel", "lighthouse",
  "windmill", "satellite", "helicopter", "submarine", "spaceship", "robot",
  "traffic light", "mailbox", "tent", "hammock", "swing", "seesaw",
  // Food & Drink
  "pizza", "burger", "ice cream", "sushi", "cake", "cocktail", "taco", "popcorn",
  "pineapple", "watermelon", "pretzel", "donut", "banana", "cookie",
  "pancake", "waffle", "hot dog", "french fries", "sandwich", "noodles",
  "cupcake", "lollipop", "chocolate", "cheese", "egg", "avocado",
  "grapes", "strawberry", "cherry", "coconut", "mushroom", "carrot",
  "broccoli", "corn", "milkshake", "smoothie", "coffee", "tea",
  // Actions / Concepts
  "surfing", "skydiving", "sleeping", "fishing", "dancing", "sneezing",
  "lightning", "volcano", "rainbow", "sunset", "tornado", "island",
  "swimming", "running", "climbing", "flying", "reading", "cooking",
  "painting", "singing", "juggling", "skiing", "snowboarding", "camping",
  "boxing", "wrestling", "yoga", "meditation", "handshake", "high five",
  "thumbs up", "peace sign", "selfie", "yawning", "crying", "laughing",
  // Places & Nature
  "beach", "mountain", "forest", "desert", "waterfall", "cave", "castle",
  "pyramid", "igloo", "treehouse", "hospital", "school", "library",
  "museum", "cinema", "stadium", "airport", "train station", "farm",
  "garden", "park", "moon", "sun", "star", "cloud", "rain", "snow",
  // Transport
  "car", "bus", "train", "airplane", "boat", "motorcycle", "tractor",
  "hot air balloon", "canoe", "sailboat", "ambulance", "fire truck",
  // Clothing & Body
  "hat", "glasses", "shoe", "glove", "scarf", "belt", "tie", "dress",
  "moustache", "beard", "brain", "heart", "skeleton", "muscle",
  // Pub-themed
  "beer", "dartboard", "pool table", "jukebox", "karaoke", "pub quiz",
  "bar stool", "cocktail shaker", "wine glass", "pint glass",
  "beer garden", "bouncer", "tipsy", "cheers", "hangover", "shots",
  "beer pong", "drinking game", "last orders", "happy hour",
  // Pop culture
  "pirate", "ninja", "wizard", "dragon", "unicorn", "mermaid", "alien",
  "ghost", "vampire", "zombie", "superhero", "cowboy", "knight",
  // Misc fun
  "treasure map", "magic wand", "crystal ball", "time machine",
  "disco ball", "fireworks", "confetti", "birthday cake", "snowman",
  "scarecrow", "jack o lantern", "christmas tree", "easter egg",
  "tooth fairy", "santa claus", "cupid", "leprechaun",
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
    usedWords: [word],
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
  // Artist gets 75% of the time bonus (reward good drawing)
  scores[state.artistId] = (scores[state.artistId] ?? 0) + Math.round(timeBonus * 0.75);
  // Guesser gets full time bonus
  scores[state.guesserId] = (scores[state.guesserId] ?? 0) + timeBonus;

  return { ...state, scores, guessedCorrectly: true };
}

/** Advance to the next round, swapping artist/guesser. */
export function nextSketchRound(state: SketchState): SketchState {
  const nextRound = state.round + 1;
  if (nextRound > state.maxRounds) {
    const entries = Object.entries(state.scores);
    entries.sort((a, b) => b[1] - a[1]);
    return { ...state, round: nextRound, winner: entries[0]?.[0] ?? null };
  }

  const word = pickWord(state.usedWords);
  return {
    ...state,
    round: nextRound,
    artistId: state.guesserId,
    guesserId: state.artistId,
    word,
    wordHint: makeHint(word),
    roundStartedAt: Date.now(),
    guessedCorrectly: false,
    usedWords: [...state.usedWords, word],
  };
}
