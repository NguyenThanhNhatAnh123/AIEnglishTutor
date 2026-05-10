import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Generic data-fetching hook.
 *
 * @param {Function} fetchFn   - async function that returns data
 * @param {Array}    deps      - dependency array (re-fetches when changed)
 * @param {Object}   options   - { immediate: bool, initialData: any }
 *
 * @returns {{ data, loading, error, refetch }}
 *
 * Usage:
 *   const { data: exams, loading, error, refetch } = useFetch(
 *     () => examApi.getAll().then(r => r.data?.data || []),
 *     [],
 *   );
 */
export function useFetch(fetchFn, deps = [], { immediate = true, initialData = null } = {}) {
  const [data, setData]       = useState(initialData);
  const [loading, setLoading] = useState(immediate);
  const [error, setError]     = useState(null);
  const mountedRef = useRef(true); // true from start — component is mounted when hook runs

  useEffect(() => {
    // Only need cleanup — ref is already true
    return () => { mountedRef.current = false; };
  }, []);

  const execute = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchFn();
      if (mountedRef.current) setData(result);
    } catch (err) {
      if (mountedRef.current) setError(err);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    if (immediate) execute();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [execute]);

  return { data, loading, error, refetch: execute };
}

export default useFetch;
