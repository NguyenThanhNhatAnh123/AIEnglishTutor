import { useEffect, useRef, useState } from 'react';
import Button from '../common/Button';
import { API_ORIGIN } from '../../services/api';
import AudioPlayer from '../../../../packages/ui/AudioPlayer.jsx';

/**
 * Record during exam and keep the audio locally until the exam is submitted.
 *
 * @param {object} props
 * @param {number} props.submissionId
 * @param {number} props.questionId
 * @param {boolean} [props.disabled]
 * @param {{ speakingAudioUrl?: string, speakingDurationSeconds?: number, speakingFormat?: string, speakingBlob?: Blob|null }} [props.value]
 * @param {function} props.onChange
 * @param {object} props.toast
 */
export default function AudioRecorder({
  submissionId,
  questionId,
  disabled = false,
  maxSeconds = 180,
  value,
  onChange,
  toast,
}) {
  const [recording, setRecording] = useState(false);
  const [localReady, setLocalReady] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [replaceMode, setReplaceMode] = useState(false);
  const [previewSrc, setPreviewSrc] = useState(null);
  const [inputLevel, setInputLevel] = useState(0);
  const mediaRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const startedAtRef = useRef(0);
  const timerRef = useRef(null);
  const previewUrlRef = useRef(null);
  const previewBlobRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);

  const hasServer = typeof value?.speakingAudioUrl === 'string' && value.speakingAudioUrl.length > 0;
  const hasLocalBlob = value?.speakingBlob instanceof Blob;
  const serverPreviewSrc = hasServer
    ? value.speakingAudioUrl.startsWith('http') || value.speakingAudioUrl.startsWith('blob:')
      ? value.speakingAudioUrl
      : `${API_ORIGIN}${value.speakingAudioUrl.startsWith('/') ? '' : '/'}${value.speakingAudioUrl}`
    : null;
  const playbackPreviewSrc = hasLocalBlob ? previewSrc : (serverPreviewSrc || previewSrc);

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    audioContextRef.current?.close?.();
  }, []);

  useEffect(() => {
    if (!(value?.speakingBlob instanceof Blob)) return;
    if (previewBlobRef.current === value.speakingBlob && previewSrc) return;
    setPreviewFromBlob(value.speakingBlob);
  }, [previewSrc, value?.speakingBlob]);

  const stopLevelMonitor = () => {
    sourceRef.current?.disconnect?.();
    sourceRef.current = null;
    analyserRef.current = null;
    audioContextRef.current?.close?.().catch(() => {});
    audioContextRef.current = null;
    setInputLevel(0);
  };

  const startLevelMonitor = (stream) => {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);
      sourceRef.current = source;
      audioContextRef.current = ctx;
      analyserRef.current = analyser;
    } catch {
      analyserRef.current = null;
    }
  };

  const sampleLevel = () => {
    const analyser = analyserRef.current;
    if (!analyser) return;
    const data = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(data);
    let sum = 0;
    for (const value of data) {
      const centered = value - 128;
      sum += centered * centered;
    }
    const rms = Math.sqrt(sum / data.length) / 128;
    setInputLevel(Math.min(1, rms * 8));
  };

  const setPreviewFromBlob = (blob) => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const url = URL.createObjectURL(blob);
    previewBlobRef.current = blob;
    previewUrlRef.current = url;
    setPreviewSrc(url);
  };

  const stopRecord = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    mediaRef.current?.stop();
    setRecording(false);
  };

  const startRecord = async () => {
    if (disabled || submissionId == null || questionId == null) return;
    try {
      setReplaceMode(false);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
      const mime = candidates.find((m) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported?.(m)) || '';
      const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      mediaRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        const blob = new Blob(chunksRef.current, { type: mime || 'audio/webm' });
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        stopLevelMonitor();
        const elapsedMs = Math.max(0, Date.now() - startedAtRef.current);
        const seconds = Math.max(1, Math.round(elapsedMs / 1000));
        setPreviewFromBlob(blob);
        setLocalReady(true);
        onChange?.({
          speakingBlob: blob,
          speakingAudioUrl: undefined,
          speakingDurationSeconds: seconds,
          speakingFormat: mime || 'webm',
        });
        toast.info('Recording saved locally. It will upload when you submit the exam.');
      };
      recorder.start();
      startedAtRef.current = Date.now();
      startLevelMonitor(stream);
      setElapsedSeconds(0);
      timerRef.current = setInterval(() => {
        const elapsed = Math.max(0, Math.floor((Date.now() - startedAtRef.current) / 1000));
        setElapsedSeconds(elapsed);
        sampleLevel();
        if (elapsed >= maxSeconds) {
          toast.info(`Recording stopped at ${maxSeconds}s.`);
          stopRecord();
        }
      }, 500);
      setLocalReady(false);
      setRecording(true);
    } catch (e) {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      stopLevelMonitor();
      if (e?.name === 'NotAllowedError' || e?.name === 'SecurityError') {
        toast.error('Microphone permission is required for speaking questions.');
      } else {
        toast.error('Could not start recording on this device/browser.');
      }
    }
  };

  const clearLocal = () => {
    setReplaceMode(false);
    setLocalReady(false);
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewBlobRef.current = null;
    previewUrlRef.current = null;
    setPreviewSrc(null);
    onChange?.({
      speakingBlob: null,
      speakingAudioUrl: undefined,
      speakingDurationSeconds: undefined,
      speakingFormat: undefined,
    });
  };

  return (
    <div className="flex flex-col items-center gap-4 py-6">
      <div
        className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${
          recording
            ? 'bg-red-100 animate-pulse dark:bg-red-950/50'
            : (localReady || hasLocalBlob)
              ? 'bg-emerald-50 dark:bg-emerald-950/50'
              : 'bg-blue-50 dark:bg-slate-800'
        }`}
      >
        <svg
          className={`w-8 h-8 ${recording ? 'text-red-500' : (localReady || hasLocalBlob) ? 'text-emerald-500' : 'text-blue-400'}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
          />
        </svg>
      </div>

      <p className="text-sm font-medium text-slate-600 dark:text-slate-300 text-center px-2">
        {disabled
          ? 'Recording disabled - exam time has ended.'
          : recording
            ? `Recording... ${elapsedSeconds}s / ${maxSeconds}s`
            : replaceMode
              ? 'Ready to record again. The new recording will replace the previous one.'
            : (localReady || hasLocalBlob)
              ? 'Recording saved locally. It will upload when you submit the exam.'
            : hasServer
                ? 'Your speaking answer is saved. You can record again to replace it.'
                : 'Press start to record your answer.'}
      </p>

      {recording && (
        <div className="w-full max-w-xs">
          <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-[width] duration-100"
              style={{ width: `${Math.round(inputLevel * 100)}%` }}
            />
          </div>
          <p className="mt-1 text-center text-xs text-slate-400">Mic level</p>
        </div>
      )}

      <div className="flex flex-wrap gap-2 justify-center">
        {recording ? (
          <Button variant="danger" onClick={stopRecord} disabled={disabled}>
            Stop
          </Button>
        ) : replaceMode ? (
          <>
            <Button variant="primary" onClick={startRecord} disabled={disabled}>
              Start new recording
            </Button>
            <Button variant="secondary" onClick={() => setReplaceMode(false)} disabled={disabled}>
              Keep current
            </Button>
          </>
        ) : (
          <Button
            variant={hasServer || hasLocalBlob || localReady ? 'secondary' : 'primary'}
            onClick={() => {
              if (hasServer || hasLocalBlob || localReady) {
                setReplaceMode(true);
                return;
              }
              startRecord();
            }}
            disabled={disabled}
          >
            {(localReady || hasLocalBlob || hasServer) ? 'Record again' : 'Start recording'}
          </Button>
        )}
        {(localReady || hasLocalBlob) && !recording && !replaceMode && (
          <Button variant="secondary" onClick={clearLocal} disabled={disabled}>
            Clear recording
          </Button>
        )}
      </div>

      {(hasLocalBlob || hasServer) && value?.speakingDurationSeconds != null && (
        <p className="text-xs text-slate-500">
          Duration: {value.speakingDurationSeconds}s - {value.speakingFormat || 'audio'}
        </p>
      )}
      {playbackPreviewSrc && !recording && !replaceMode && (
        <div className="w-full max-w-md">
          <AudioPlayer src={playbackPreviewSrc} disabled={disabled} />
        </div>
      )}
    </div>
  );
}
