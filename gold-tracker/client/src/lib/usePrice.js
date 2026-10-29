import { useEffect, useState } from 'react';

const REFRESH_MS = 10 * 60 * 1000;

async function fetchPrice(currency) {
  const res = await fetch(`/api/price?currency=${currency}`);
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
  return body;
}

// Live 24K price per gram from the server, refreshed every 10 minutes.
export function usePrice(currency) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      fetchPrice(currency).then(
        (data) => !cancelled && setState({ data, error: null, loading: false }),
        (err) =>
          !cancelled &&
          setState((s) => ({
            data: s.data?.currency === currency ? s.data : null,
            error: err.message,
            loading: false,
          })),
      );
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [currency, tick]);

  const refresh = () => {
    setState((s) => ({ ...s, loading: true }));
    setTick((t) => t + 1);
  };

  return { ...state, refresh };
}
