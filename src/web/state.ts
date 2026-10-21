import { useEffect, useState } from 'preact/hooks';
import type { WasmProgress } from '@/engine/typst-web';

export type EngineStatus = 'idle' | 'loading' | 'ready' | 'busy' | 'error';

export interface AppState {
  readonly engine: {
    readonly status: EngineStatus;
    readonly progress: WasmProgress | null;
    readonly message: string;
  };
}

let state: AppState = {
  engine: { status: 'idle', progress: null, message: '' },
};
const listeners = new Set<() => void>();

export function getState(): AppState {
  return state;
}

export function setState(patch: Partial<AppState>): void {
  state = { ...state, ...patch };
  listeners.forEach((listener) => {
    listener();
  });
}

export function useAppState(): AppState {
  const [snapshot, setSnapshot] = useState(state);
  useEffect(() => {
    const listener = () => {
      setSnapshot(state);
    };
    listeners.add(listener);
    listener();
    return () => {
      listeners.delete(listener);
    };
  }, []);
  return snapshot;
}
