import { useEffect, useRef, useState } from 'react';

/**
 * Lightweight waveform from decoded audio (public URL; e.g. /uploads/...).
 */
export default function SpeakingWaveform({ src, className = '' }) {
  const canvasRef = useRef(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    if (!src) return undefined;
    let cancelled = false;
    (async () => {
      setErr(false);
      try {
        const res = await fetch(src);
        if (!res.ok) throw new Error('fetch');
        const buf = await res.arrayBuffer();
        const ctx = new AudioContext();
        const audioBuf = await ctx.decodeAudioData(buf.slice(0));
        if (cancelled) return;
        const ch = audioBuf.getChannelData(0);
        const w = canvasRef.current?.width ?? 200;
        const h = canvasRef.current?.height ?? 40;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const g = canvas.getContext('2d');
        if (!g) return;
        g.clearRect(0, 0, w, h);
        g.fillStyle = 'rgba(148, 163, 184, 0.35)';
        const step = Math.max(1, Math.floor(ch.length / w));
        for (let x = 0; x < w; x++) {
          let min = 1;
          let max = -1;
          for (let i = 0; i < step; i++) {
            const v = ch[x * step + i] || 0;
            min = Math.min(min, v);
            max = Math.max(max, v);
          }
          const y1 = (1 - max) * (h / 2);
          const y2 = (1 - min) * (h / 2);
          g.fillRect(x, y1, 1, Math.max(1, y2 - y1));
        }
        await ctx.close();
      } catch {
        if (!cancelled) setErr(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [src]);

  if (!src || err) return null;

  return (
    <canvas
      ref={canvasRef}
      width={200}
      height={40}
      className={`w-full max-w-[200px] h-10 rounded border border-slate-100 dark:border-slate-700 ${className}`}
      aria-hidden
    />
  );
}
