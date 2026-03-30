import { useState, useRef } from 'react';

/**
 * SpeakingRecorder component.
 * Used inside ExamRoom for SPEAKING type questions.
 *
 * Props:
 *   value    {{ audioUrl, answerText }} – current answer state
 *   onChange {Function}                – called with { audioUrl, answerText: 'audio-recorded' }
 */
export default function SpeakingRecorder({ value, onChange }) {
  const [recording, setRecording]   = useState(false);
  const [error, setError]           = useState(null);
  const mediaRef = useRef(null);
  const chunksRef = useRef([]);

  const recorded = !!value?.audioUrl;

  const startRecording = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const url  = URL.createObjectURL(blob);
        onChange({ audioUrl: url, answerText: 'audio-recorded' });
        stream.getTracks().forEach((t) => t.stop());
      };

      recorder.start();
      setRecording(true);
    } catch (err) {
      setError('Microphone access was denied. Please allow access and try again.');
    }
  };

  const stopRecording = () => {
    mediaRef.current?.stop();
    setRecording(false);
  };

  return (
    <div className="flex flex-col items-center py-8 gap-5">
      {/* Mic icon */}
      <div
        className={`w-24 h-24 rounded-full flex items-center justify-center transition-all ${
          recording
            ? 'bg-red-100 ring-4 ring-red-300 ring-offset-2 animate-pulse'
            : recorded
            ? 'bg-green-100'
            : 'bg-blue-50'
        }`}
      >
        <svg
          className={`w-10 h-10 ${recording ? 'text-red-500' : recorded ? 'text-green-600' : 'text-blue-400'}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
        </svg>
      </div>

      {/* State label */}
      <p className="text-sm font-medium text-slate-600">
        {recording ? '🔴 Recording… speak clearly' : recorded ? '✅ Recording saved' : 'Press button to start recording'}
      </p>

      {/* Controls */}
      {recording ? (
        <button
          type="button"
          onClick={stopRecording}
          className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold text-sm shadow transition"
        >
          Stop Recording
        </button>
      ) : (
        <button
          type="button"
          onClick={startRecording}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-sm shadow transition"
        >
          {recorded ? 'Re-record' : 'Start Recording'}
        </button>
      )}

      {/* Playback */}
      {recorded && !recording && (
        <div className="w-full max-w-sm">
          <p className="text-xs text-slate-400 text-center mb-1">Playback</p>
          <audio controls src={value.audioUrl} className="w-full rounded-xl" />
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="text-sm text-red-500 bg-red-50 px-4 py-2 rounded-lg">{error}</p>
      )}
    </div>
  );
}
