/**
 * SayBack — Game State Machine
 *
 * Explicit round state machine. All transitions are validated; invalid
 * transitions throw. Audio buffers are NOT stored in persisted state — only
 * metadata and references are kept here; the AudioEngine holds the binary data.
 */

export type GameState =
  | 'idle'
  | 'requesting-microphone'
  | 'recording-original'
  | 'processing-original'
  | 'listening-to-reversed'
  | 'recording-imitation'
  | 'processing-imitation'
  | 'listening-to-reconstructed'
  | 'guessing'
  | 'revealed'
  | 'error';

export type Difficulty = 'easy' | 'medium' | 'hard';
export type WordMode = 'preset' | 'custom';

export interface RoundResult {
  guess: string | null;
  correct: boolean | null;
  selfReported: boolean;
}

export interface Round {
  id: string;
  difficulty: Difficulty;
  wordMode: WordMode;
  secretAnswer: string | null;
  originalWordRevealed: boolean;

  originalClipId: string | null;
  reversedClipId: string | null;
  imitationClipId: string | null;
  reconstructedClipId: string | null;

  guess: string | null;
  result: RoundResult | null;

  createdAt: number;
  completedAt: number | null;
}

export interface GameConfig {
  difficulty: Difficulty;
  wordMode: WordMode;
  maxReversedPlays: number;
  maxReconstructedPlays: number;
}

export const DEFAULT_CONFIG: GameConfig = {
  difficulty: 'medium',
  wordMode: 'custom',
  maxReversedPlays: 3,
  maxReconstructedPlays: 3,
};

const VALID_TRANSITIONS: Record<GameState, GameState[]> = {
  idle: ['requesting-microphone', 'error'],
  'requesting-microphone': ['requesting-microphone', 'recording-original', 'error', 'idle'],
  'recording-original': ['processing-original', 'error', 'idle'],
  'processing-original': ['listening-to-reversed', 'error', 'idle'],
  'listening-to-reversed': ['recording-imitation', 'listening-to-reversed', 'error', 'idle'],
  'recording-imitation': ['processing-imitation', 'error', 'idle'],
  'processing-imitation': ['listening-to-reconstructed', 'error', 'idle'],
  'listening-to-reconstructed': ['guessing', 'listening-to-reconstructed', 'error', 'idle'],
  guessing: ['revealed', 'error', 'idle'],
  revealed: ['idle', 'requesting-microphone', 'error'],
  error: ['idle', 'requesting-microphone'],
};

export const PRESET_WORDS: Record<Difficulty, string[]> = {
  easy: ['cat', 'dog', 'sun', 'fish', 'milk'],
  medium: ['banana', 'planet', 'rocket', 'rainbow', 'mirror'],
  hard: ['strawberry', 'elephant', 'chocolate', 'backwards', 'microphone'],
};

export function pickPresetWord(difficulty: Difficulty): string {
  const list = PRESET_WORDS[difficulty];
  const word = list[Math.floor(Math.random() * list.length)];
  return word ?? list[0] ?? '';
}

export function createRound(
  config: GameConfig,
  secretAnswer: string | null,
): Round {
  return {
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `round-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    difficulty: config.difficulty,
    wordMode: config.wordMode,
    secretAnswer,
    originalWordRevealed: false,
    originalClipId: null,
    reversedClipId: null,
    imitationClipId: null,
    reconstructedClipId: null,
    guess: null,
    result: null,
    createdAt: Date.now(),
    completedAt: null,
  };
}

export interface AudioError {
  code: string;
  message: string;
  retryable: boolean;
}

export interface GameMachine {
  state: GameState;
  config: GameConfig;
  round: Round | null;
  error: AudioError | null;
  reversedPlays: number;
  reconstructedPlays: number;
  subscribe: (fn: () => void) => () => void;
  canTransition: (next: GameState) => boolean;
  transition: (next: GameState) => void;
  setError: (code: AudioError['code'], message: string, retryable: boolean) => void;
  clearError: () => void;
  setRound: (round: Round) => void;
  updateRound: (patch: Partial<Round>) => void;
  startNewRound: (config: GameConfig, secretAnswer: string | null) => void;
  replayAllowed: (kind: 'reversed' | 'reconstructed') => boolean;
  incrementPlay: (kind: 'reversed' | 'reconstructed') => void;
  resetPlays: () => void;
  revealAnswer: () => void;
  submitGuess: (guess: string) => void;
  selfReportResult: (correct: boolean) => void;
  restartRound: () => void;
}

export function createGameMachine(initialConfig: Partial<GameConfig> = {}): GameMachine {
  let state: GameState = 'idle';
  let config: GameConfig = { ...DEFAULT_CONFIG, ...initialConfig };
  let round: Round | null = null;
  let error: AudioError | null = null;
  let reversedPlays = 0;
  let reconstructedPlays = 0;

  const listeners: Array<() => void> = [];
  const subscribe = (fn: () => void) => {
    listeners.push(fn);
    return () => {
      const i = listeners.indexOf(fn);
      if (i >= 0) listeners.splice(i, 1);
    };
  };
  const emit = () => listeners.forEach((fn) => fn());

  const canTransition = (next: GameState): boolean => {
    const allowed = VALID_TRANSITIONS[state];
    return Array.isArray(allowed) && allowed.includes(next);
  };

  const transition = (next: GameState): void => {
    if (!canTransition(next)) {
      throw new Error(`Invalid game transition: ${state} -> ${next}`);
    }
    state = next;
    if (error) { error = null; }
    emit();
  };

  const setError = (code: AudioError['code'], message: string, retryable: boolean): void => {
    error = { code, message, retryable };
    state = 'error';
    emit();
  };

  const clearError = (): void => {
    error = null;
    state = 'idle';
    emit();
  };

  const setRound = (r: Round): void => {
    round = r;
    emit();
  };

  const updateRound = (patch: Partial<Round>): void => {
    if (!round) throw new Error('No active round to update');
    round = { ...round, ...patch };
    emit();
  };

  const startNewRound = (cfg: GameConfig, secretAnswer: string | null): void => {
    config = { ...cfg };
    round = createRound(config, secretAnswer);
    reversedPlays = 0;
    reconstructedPlays = 0;
    error = null;
    state = 'requesting-microphone';
    emit();
  };

  const replayAllowed = (kind: 'reversed' | 'reconstructed'): boolean => {
    if (!round) return false;
    if (kind === 'reversed') return reversedPlays < config.maxReversedPlays;
    return reconstructedPlays < config.maxReconstructedPlays;
  };

  const incrementPlay = (kind: 'reversed' | 'reconstructed'): void => {
    if (kind === 'reversed') reversedPlays += 1;
    else reconstructedPlays += 1;
    emit();
  };

  const resetPlays = (): void => {
    reversedPlays = 0;
    reconstructedPlays = 0;
    emit();
  };

  const revealAnswer = (): void => {
    if (!round) return;
    round.originalWordRevealed = true;
    state = 'revealed';
    round.completedAt = Date.now();
    emit();
  };

  const submitGuess = (guess: string): void => {
    if (!round) return;
    round.guess = guess.trim();
    // Submitting a guess reveals the answer (matches UI flow + tests
    // expecting secretAnswer hidden until 'revealed').
    round.originalWordRevealed = true;
    state = 'revealed';
    round.completedAt = Date.now();
    emit();
  };

  const selfReportResult = (correct: boolean): void => {
    if (!round) return;
    round.result = { guess: round.guess, correct, selfReported: true };
    emit();
  };

  const restartRound = (): void => {
    if (!round) return;
    const current = { ...round };
    // Keep difficulty/word-mode/limits from the current config; clear only the
    // audio + guess state by creating a fresh round.
    config = { ...config, difficulty: current.difficulty, wordMode: current.wordMode };
    round = createRound(config, current.secretAnswer);
    reversedPlays = 0;
    reconstructedPlays = 0;
    error = null;
    state = 'requesting-microphone';
    emit();
  };

  return {
    get state() { return state; },
    get config() { return config; },
    get round() { return round; },
    get error() { return error; },
    get reversedPlays() { return reversedPlays; },
    get reconstructedPlays() { return reconstructedPlays; },
    subscribe,
    canTransition,
    transition,
    setError,
    clearError,
    setRound,
    updateRound,
    startNewRound,
    replayAllowed,
    incrementPlay,
    resetPlays,
    revealAnswer,
    submitGuess,
    selfReportResult,
    restartRound,
  };
}
