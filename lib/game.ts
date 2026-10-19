/**
 * SayBack — Game State Machine
 *
 * Explicit round state machine. All transitions are validated; invalid
 * transitions throw. Audio buffers are NOT stored here — only clip IDs.
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

export interface Round {
  id: string;
  originalClipId: string | null;
  reversedClipId: string | null;
  imitationClipId: string | null;
  reconstructedClipId: string | null;
  createdAt: number;
  completedAt: number | null;
}

export interface AudioError {
  code: string;
  message: string;
  retryable: boolean;
}

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

export function createRound(): Round {
  return {
    id: typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `round-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    originalClipId: null,
    reversedClipId: null,
    imitationClipId: null,
    reconstructedClipId: null,
    createdAt: Date.now(),
    completedAt: null,
  };
}

export interface GameMachine {
  state: GameState;
  round: Round | null;
  error: AudioError | null;
  subscribe: (fn: () => void) => () => void;
  canTransition: (next: GameState) => boolean;
  transition: (next: GameState) => void;
  setError: (code: AudioError['code'], message: string, retryable: boolean) => void;
  clearError: () => void;
  updateRound: (patch: Partial<Round>) => void;
  startNewRound: () => void;
  revealAnswer: () => void;
  restartRound: () => void;
}

export function createGameMachine(): GameMachine {
  let state: GameState = 'idle';
  let round: Round | null = null;
  let error: AudioError | null = null;

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
    if (error) error = null;
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

  const updateRound = (patch: Partial<Round>): void => {
    if (!round) throw new Error('No active round to update');
    round = { ...round, ...patch };
    emit();
  };

  const startNewRound = (): void => {
    round = createRound();
    error = null;
    state = 'requesting-microphone';
    emit();
  };

  const revealAnswer = (): void => {
    if (!round) return;
    round.completedAt = Date.now();
    state = 'revealed';
    emit();
  };

  const restartRound = (): void => {
    round = createRound();
    error = null;
    state = 'requesting-microphone';
    emit();
  };

  return {
    get state() { return state; },
    get round() { return round; },
    get error() { return error; },
    subscribe,
    canTransition,
    transition,
    setError,
    clearError,
    updateRound,
    startNewRound,
    revealAnswer,
    restartRound,
  };
}
