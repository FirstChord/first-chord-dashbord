'use client';

import { useCallback, useRef, useState } from 'react';

export function useAsyncAction(action, { successMs = 1800 } = {}) {
  const timeoutRef = useRef(null);
  const [state, setState] = useState({
    pending: false,
    success: false,
    error: '',
  });

  const run = useCallback(async (...args) => {
    window.clearTimeout(timeoutRef.current);
    setState({ pending: true, success: false, error: '' });

    try {
      const result = await action(...args);
      setState({ pending: false, success: true, error: '' });
      timeoutRef.current = window.setTimeout(() => {
        setState((current) => ({ ...current, success: false }));
      }, successMs);
      return result;
    } catch (error) {
      setState({
        pending: false,
        success: false,
        error: error?.message || 'Something went wrong',
      });
      return null;
    }
  }, [action, successMs]);

  const reset = useCallback(() => {
    window.clearTimeout(timeoutRef.current);
    setState({ pending: false, success: false, error: '' });
  }, []);

  return {
    ...state,
    run,
    reset,
  };
}
