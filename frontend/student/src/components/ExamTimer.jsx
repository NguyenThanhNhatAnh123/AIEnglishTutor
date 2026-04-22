import { useState, useEffect, useRef, useCallback } from 'react';

function formatTime(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const sec = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

/**
 * Countdown until endTimeMs (epoch milliseconds). Calls onExpire once when time reaches zero.
 * Optional onTick(secondsLeft) for parent UI (e.g. disable audio).
 */
export default function ExamTimer({ endTimeMs, onExpire, onTick, className = '' }) {
  const [secondsLeft, setSecondsLeft] = useState(0);
  const expiredRef = useRef(false);

  const stableOnExpire = useCallback(() => {
    if (expiredRef.current) return;
    expiredRef.current = true;
    onExpire?.();
  }, [onExpire]);

  useEffect(() => {
    expiredRef.current = false;
  }, [endTimeMs]);

  useEffect(() => {
    if (endTimeMs == null) return undefined;

    const tick = () => {
      const next = Math.max(0, Math.floor((endTimeMs - Date.now()) / 1000));
      setSecondsLeft(next);
      onTick?.(next);
      if (next <= 0) {
        stableOnExpire();
      }
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endTimeMs, stableOnExpire, onTick]);

  if (endTimeMs == null) return null;

  const urgent = secondsLeft <= 60;

  return (
    <div
      className={`flex items-center gap-2 px-4 py-2 rounded-xl font-mono font-bold text-lg transition-colors ${
        urgent
          ? 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400'
          : 'bg-blue-50 text-blue-700 dark:bg-slate-800 dark:text-blue-300'
      } ${className}`}
      role="timer"
      aria-live="polite"
    >
      <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      {formatTime(secondsLeft)}
    </div>
  );
}
