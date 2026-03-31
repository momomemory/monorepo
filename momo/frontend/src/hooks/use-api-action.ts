import { useState, useCallback } from 'preact/hooks';
import type { ApiCallResult } from '../types';

export interface ApiActionState {
  loading: boolean;
  error: string | null;
  result: unknown | null;
}

// Generic run function — callers get typed results; internally uses unknown for useCallback compat
export type RunFn = <T>(fn: () => Promise<ApiCallResult<T>>) => Promise<ApiCallResult<T>>;

export function useApiAction(
  onAuthFailure?: (message: string) => void,
): [ApiActionState, RunFn, () => void] {
  const [state, setState] = useState<ApiActionState>({
    loading: false,
    error: null,
    result: null,
  });

  const runImpl = useCallback(
    async (fn: () => Promise<ApiCallResult<unknown>>): Promise<ApiCallResult<unknown>> => {
      setState({ loading: true, error: null, result: null });
      let res: ApiCallResult<unknown>;
      try {
        res = await fn();
      } catch (err) {
        res = {
          ok: false,
          status: 0,
          error: err instanceof Error ? err.message : 'Unknown error',
        };
      }
      if (res.ok) {
        // Store the envelope (which may contain { data: T }) or the raw response.
        // parseHealthData and JsonView both accept the envelope shape or raw data.
        setState({ loading: false, error: null, result: res.envelope ?? res.raw ?? null });
      } else if (res.status === 401) {
        setState({ loading: false, error: 'Authentication failed', result: null });
        onAuthFailure?.('Session expired. Please re-enter your API key.');
      } else {
        setState({ loading: false, error: res.error || 'Request failed', result: null });
      }
      return res;
    },
    [onAuthFailure],
  );

  // Sound cast: fn() produces ApiCallResult<T> at runtime; runImpl accepts it widened to unknown
  // and returns the same object, so casting back to ApiCallResult<T> is safe.
  const run = runImpl as RunFn;

  const reset = useCallback(() => {
    setState({ loading: false, error: null, result: null });
  }, []);

  return [state, run, reset];
}
