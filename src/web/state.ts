import { useEffect, useState } from 'preact/hooks';
import type { Dataset } from '@/core/dataset/types';
import type { Issue } from '@/core/issues';
import type { InputFile, LoadResult } from '@/core/pipeline';
import type { WasmProgress } from '@/engine/typst-web';

export type EngineStatus = 'idle' | 'loading' | 'ready' | 'busy' | 'error';

export interface AppState {
  readonly files: readonly InputFile[];
  readonly dataset: Dataset | null;
  readonly issues: readonly Issue[];
  readonly loadResult: LoadResult | null;
  readonly engine: {
    readonly status: EngineStatus;
    readonly progress: WasmProgress | null;
    readonly message: string;
  };
}

const initialState: AppState = {
  files: [],
  dataset: null,
  issues: [],
  loadResult: null,
  engine: { status: 'idle', progress: null, message: '' },
};

let state: AppState = initialState;
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

export function resetState(): void {
  setState({
    files: initialState.files,
    dataset: null,
    issues: initialState.issues,
    loadResult: null,
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
