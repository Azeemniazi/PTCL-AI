import { useCallback, useEffect, useRef, useState } from 'react';

export function useWorkspaceRequest() {
  const active = useRef<AbortController | undefined>(undefined);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  useEffect(() => () => active.current?.abort(), []);
  const run = useCallback(async (operation: (signal: AbortSignal) => Promise<void>, replace = false) => {
    if (active.current && !replace) return;
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    setError('');
    setPending(true);
    try {
      await operation(controller.signal);
    } catch (problem) {
      if (!controller.signal.aborted) setError(problem instanceof Error ? problem.message : 'Request failed.');
    } finally {
      if (active.current === controller) {
        active.current = undefined;
        if (!controller.signal.aborted) setPending(false);
      }
    }
  }, []);
  return { error, pending, run };
}
