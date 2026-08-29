import type { AppState, RuntimeSnapshot } from '@threxus/runtime';

export type CubeLogger = (message: string) => void;

export interface CubeViewState {
  events: string[];
  state: AppState;
  snapshot: RuntimeSnapshot | null;
  error: string | null;
}
