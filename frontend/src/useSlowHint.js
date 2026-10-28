import { useEffect, useState } from 'react';

// Render's free plan sleeps the API after ~15 idle minutes; the first request
// can then take up to a minute. Returns true once `active` has lasted `delay` ms.
export default function useSlowHint(active, delay = 4000) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!active) { setSlow(false); return undefined; }
    const timer = setTimeout(() => setSlow(true), delay);
    return () => clearTimeout(timer);
  }, [active, delay]);
  return slow;
}
