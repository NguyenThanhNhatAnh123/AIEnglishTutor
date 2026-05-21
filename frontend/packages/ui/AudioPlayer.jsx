import { useEffect, useRef, useState, useCallback } from 'react';

function formatTime(sec) {
  if (sec == null || Number.isNaN(sec) || !Number.isFinite(sec)) return '0:00';
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

function srcRequiresAuth(src) {
  return typeof src === 'string' && src.includes('/api/media/files/');
}

/**
 * Audio controls with progress bar and seek (disabled when `disabled` is true).
 * Legacy `/api/media/files/**` URLs are loaded with the JWT (HTML audio cannot send headers).
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
  const [authSrc, setAuthSrc] = useState(null);

  const syncTime = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    setCurrent(el.currentTime || 0);
    if (el.duration && Number.isFinite(el.duration)) {
      setDuration(el.duration);
    }
  }, []);

  useEffect(() => {
    if (!src || !srcRequiresAuth(src)) {
      setAuthSrc(null);
      return undefined;
    }

    let cancelled = false;
    let objectUrl = null;
    setLoading(true);
    setLoadError('');

    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    fetch(src, { headers })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.blob();
      })
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setAuthSrc(objectUrl);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setAuthSrc(null);
          setLoading(false);
          setLoadError('Cannot load this audio file.');
        }
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src]);

  const playbackSrc = srcRequiresAuth(src) ? authSrc : src;

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
  }, [playbackSrc, syncTime]);

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
    if (!srcRequiresAuth(src)) {
      setLoading(false);
      setLoadError('');
    }
  }, [src]);

  if (!src) return null;

  const toggle = () => {
    if (disabled || !playbackSrc) return;
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) el.play().catch(() => {});
    else el.pause();
  };

  const pct = duration > 0 ? Math.min(100, Math.max(0, (current / duration) * 100)) : 0;

  const onSeek = (e) => {
    if (disabled || !playbackSrc) return;
    const el = audioRef.current;
    if (!el || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.min(Math.max(0, e.clientX - rect.left), rect.width);
    const next = (x / rect.width) * duration;
    el.currentTime = next;
    setCurrent(next);
  };

  return (
    <div className={`w-full min-w-[240px] rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900 ${className}`}>
      <audio ref={audioRef} src={playbackSrc || undefined} preload="metadata" className="hidden" />
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={toggle}
          disabled={disabled || !!loadError || !playbackSrc}
          className="shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
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
            className={`h-3 rounded-full border border-slate-300 bg-slate-100 dark:border-slate-600 dark:bg-slate-800 overflow-hidden ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
            onClick={onSeek}
            onKeyDown={(e) => {
              if (disabled || !playbackSrc) return;
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
          <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mt-1.5 tabular-nums">
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
