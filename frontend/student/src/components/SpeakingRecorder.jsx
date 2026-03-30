import { useState } from 'react';

export default function SpeakingRecorder({ value, onChange }) {
  const [recording, setRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState(value?.audioUrl ?? '');

  const handleRecord = () => {
    setRecording(true);
    // Placeholder: in production use MediaRecorder API
    setTimeout(() => {
      setRecording(false);
      const mockUrl = 'https://example.com/recording.webm';
      setAudioUrl(mockUrl);
      onChange?.({ audioUrl: mockUrl });
    }, 3000);
  };

  const handleStop = () => setRecording(false);

  return (
    <div className="space-y-4">
      <p className="text-slate-400 text-sm">Record your speaking response</p>
      {recording ? (
        <button
          onClick={handleStop}
          className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white"
        >
          Stop Recording
        </button>
      ) : (
        <button
          onClick={handleRecord}
          className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold"
        >
          Start Recording
        </button>
      )}
      {audioUrl && <p className="text-green-400 text-sm">Recording saved</p>}
    </div>
  );
}
