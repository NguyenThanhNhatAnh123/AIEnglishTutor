import { useEffect, useRef, useState } from 'react';

/**
 * Simple play/pause control; pauses and blocks playback when `disabled` is true.
 *
 * @param {object} props
 * @param {string} props.src Absolute or same-origin URL
 * @param {boolean} [props.disabled]
 * @param {string} [props.className]
 */
export default function AudioPlayer({ src, disabled = false, className = '' }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return undefined;
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => setPlaying(false);
    el.addEventListener('play', onPlay);
    el.addEventListener('pause', onPause);
    el.addEventListener('ended', onEnded);
    return () => {
      el.removeEventListener('play', onPlay);
      el.removeEventListener('pause', onPause);
      el.removeEventListener('ended', onEnded);
    };
  }, [src]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    if (disabled) {
      el.pause();
      setPlaying(false);
    }
    el.muted = disabled;
  }, [disabled]);

  if (!src) return null;

  const toggle = () => {
    if (disabled) return;
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) el.play().catch(() => {});
    else el.pause();
  };

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <audio ref={audioRef} src={src} preload="metadata" className="hidden" />
      <button
        type="button"
        onClick={toggle}
        disabled={disabled}
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
      <span className="text-xs text-slate-500 dark:text-slate-400">
        {disabled ? 'Unavailable (exam ended)' : 'Play / pause'}
      </span>
    </div>
  );
}
