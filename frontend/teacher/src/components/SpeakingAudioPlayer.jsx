import { useEffect, useState } from 'react';
import AudioPlayer from '../../../packages/ui/AudioPlayer.jsx';
import SpeakingWaveform from '../../../packages/ui/SpeakingWaveform.jsx';
import { submissionApi } from '../services/api';

export default function SpeakingAudioPlayer({ submissionId, answerId, waveform = false }) {
  const audioKey = submissionId && answerId ? `${submissionId}:${answerId}` : '';
  const [audioState, setAudioState] = useState({ key: '', src: null, error: null });

  useEffect(() => {
    let cancelled = false;
    let objectUrl = null;

    if (!audioKey) {
      return undefined;
    }

    submissionApi.downloadSpeaking(submissionId, answerId)
      .then((res) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(res.data);
        setAudioState({ key: audioKey, src: objectUrl, error: null });
      })
      .catch(() => {
        if (!cancelled) setAudioState({ key: audioKey, src: null, error: 'Audio is unavailable.' });
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [answerId, audioKey, submissionId]);

  const { src, error } = audioState.key === audioKey
    ? audioState
    : { src: null, error: null };

  if (error) {
    return <p className="text-xs font-semibold text-amber-700">{error}</p>;
  }

  if (!src) {
    return <p className="text-xs text-slate-400">Loading audio...</p>;
  }

  return (
    <div className="space-y-2">
      <AudioPlayer src={src} disabled={false} />
      {waveform && <SpeakingWaveform src={src} />}
    </div>
  );
}
