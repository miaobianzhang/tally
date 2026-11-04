import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

/**
 * Re-renders periodically and whenever the app returns to the foreground so
 * date headers and "today" ranges roll over at midnight.
 */
export function useDayKey(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), intervalMs);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') setNow(Date.now());
    });

    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [intervalMs]);

  return now;
}
