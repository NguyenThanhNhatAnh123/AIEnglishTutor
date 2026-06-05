import { useEffect, useRef, useState } from 'react';
import musicTrack from '../../../assets/learning/music/music.mp3';

export default function MusicControl({ compact = false, calmMotion, onCalmMotionChange }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(() => Number(localStorage.getItem('learningMusicVolume') || 0.22));

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
    localStorage.setItem('learningMusicVolume', String(volume));
  }, [volume]);

  const toggle = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
      return;
    }
    try {
      await audio.play();
      setPlaying(true);
    } catch {
      setPlaying(false);
    }
  };

  return (
    <div className={`flex flex-wrap items-center gap-2 rounded-lg border border-white/35 bg-white/92 px-3 py-2 text-slate-900 shadow-sm backdrop-blur ${compact ? 'justify-center' : ''}`}>
      <audio ref={audioRef} src={musicTrack} loop />
      <button
        type="button"
        onClick={toggle}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-950 text-xs font-bold text-white transition hover:bg-slate-700"
        title={playing ? 'Pause focus music' : 'Play focus music'}
      >
        {playing ? 'II' : '>'}
      </button>
      {compact && (
        <span>
          <span className="block text-sm font-black">Music</span>
          <span className="block text-xs font-semibold text-slate-500">{playing ? 'On' : 'Off'}</span>
        </span>
      )}
      <input
        aria-label="Focus music volume"
        type="range"
        min="0"
        max="1"
        step="0.05"
        value={volume}
        onChange={(event) => setVolume(Number(event.target.value))}
        className={`${compact ? 'hidden' : 'w-20'} accent-slate-950`}
      />
      {!compact && <label className="flex items-center gap-2 border-l border-slate-200 pl-2 text-xs font-bold text-slate-600">
        <input
          type="checkbox"
          checked={calmMotion}
          onChange={(event) => onCalmMotionChange(event.target.checked)}
          className="h-4 w-4 rounded border-slate-300 accent-blue-600"
        />
        Calm motion
      </label>}
    </div>
  );
}
