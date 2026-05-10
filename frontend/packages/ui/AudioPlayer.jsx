import { useEffect, useRef, useState, useCallback } from 'react';

function formatTime(sec) {
  if (sec == null || Number.isNaN(sec) || !Number.isFinite(sec)) return '0:00';
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

/**
 * Audio controls with progress bar and seek (disabled when `disabled` is true).
 *
 * @param {object} props
 * @param {string} props.src Absolute or same-origin URL
 * @param {boolean} [props.disabled]
 * @param {string} [props.className]
 */
export default function AudioPlayer({ src, disabled = false, className = '' }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');

  const syncTime = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    setCurrent(el.currentTime || 0);
    if (el.duration && Number.isFinite(el.duration)) {
      setDuration(el.duration);
    }
  }, []);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return undefined;
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => {
      setPlaying(false);
      setCurrent(0);
    };
    const onLoadStart = () => {
      setLoadError('');
      setLoading(true);
    };
    const onCanPlay = () => setLoading(false);
    const onError = () => {
      setLoading(false);
      setPlaying(false);
      setLoadError('Cannot load this audio file.');
    };
    const onTime = () => syncTime();
    const onLoaded = () => {
      if (el.duration && Number.isFinite(el.duration)) setDuration(el.duration);
      syncTime();
    };
    el.addEventListener('play', onPlay);
    el.addEventListener('pause', onPause);
    el.addEventListener('ended', onEnded);
    el.addEventListener('loadstart', onLoadStart);
    el.addEventListener('canplay', onCanPlay);
    el.addEventListener('error', onError);
    el.addEventListener('timeupdate', onTime);
    el.addEventListener('loadedmetadata', onLoaded);
    el.addEventListener('durationchange', onLoaded);
    return () => {
      el.removeEventListener('play', onPlay);
      el.removeEventListener('pause', onPause);
      el.removeEventListener('ended', onEnded);
      el.removeEventListener('loadstart', onLoadStart);
      el.removeEventListener('canplay', onCanPlay);
      el.removeEventListener('error', onError);
      el.removeEventListener('timeupdate', onTime);
      el.removeEventListener('loadedmetadata', onLoaded);
      el.removeEventListener('durationchange', onLoaded);
    };
  }, [src, syncTime]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    if (disabled) {
      el.pause();
      setPlaying(false);
    }
    el.muted = disabled;
  }, [disabled]);

  useEffect(() => {
    setCurrent(0);
    setDuration(0);
    setPlaying(false);
    setLoading(false);
    setLoadError('');
  }, [src]);

  if (!src) return null;

  const toggle = () => {
    if (disabled) return;
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) el.play().catch(() => {});
    else el.pause();
  };

  const pct = duration > 0 ? Math.min(100, Math.max(0, (current / duration) * 100)) : 0;

  const onSeek = (e) => {
    if (disabled) return;
    const el = audioRef.current;
    if (!el || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.min(Math.max(0, e.clientX - rect.left), rect.width);
    const next = (x / rect.width) * duration;
    el.currentTime = next;
    setCurrent(next);
  };

  return (
    <div className={`flex flex-col gap-2 min-w-[200px] ${className}`}>
      <audio ref={audioRef} src={src} preload="metadata" className="hidden" />
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={toggle}
          disabled={disabled || !!loadError}
          className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          aria-label={playing ? 'Pause audio' : 'Play audio'}
        >
          {playing ? (
            <span className="text-lg leading-none" aria-hidden>
              &#10074;&#10074;
            </span>
          ) : (
            <span className="text-lg leading-none pl-0.5" aria-hidden>
              &#9654;
            </span>
          )}
        </button>
        <div className="flex-1 min-w-0">
          <div
            role="slider"
            tabIndex={disabled ? -1 : 0}
            aria-valuemin={0}
            aria-valuemax={Math.round(duration || 0)}
            aria-valuenow={Math.round(current || 0)}
            aria-label="Playback position"
            className={`h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
            onClick={onSeek}
            onKeyDown={(e) => {
              if (disabled) return;
              const el = audioRef.current;
              if (!el || !duration) return;
              if (e.key === 'ArrowRight') {
                el.currentTime = Math.min(duration, el.currentTime + 5);
                syncTime();
              }
              if (e.key === 'ArrowLeft') {
                el.currentTime = Math.max(0, el.currentTime - 5);
                syncTime();
              }
            }}
          >
            <div
              className="h-full bg-blue-600 rounded-full transition-[width] duration-75"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex justify-between text-[11px] text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
            <span>{formatTime(current)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
      </div>
      {loading && <span className="text-xs text-slate-500 dark:text-slate-400">Loading audio...</span>}
      {loadError && <span className="text-xs text-rose-600">{loadError}</span>}
      {disabled && (
        <span className="text-xs text-slate-500 dark:text-slate-400">Unavailable (exam ended)</span>
      )}
    </div>
  );
}
