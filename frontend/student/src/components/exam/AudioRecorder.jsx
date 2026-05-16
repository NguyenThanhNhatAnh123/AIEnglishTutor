import { useEffect, useRef, useState } from 'react';
import Button from '../common/Button';
import { speakingApi } from '../../services/api';

/**
 * Record during exam and upload immediately after recording stops.
 * If upload fails, the local Blob is kept so submit can retry as a fallback.
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
  const [uploading, setUploading] = useState(false);
  const [localReady, setLocalReady] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [replaceMode, setReplaceMode] = useState(false);
  const mediaRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const startedAtRef = useRef(0);
  const timerRef = useRef(null);

  const hasServer = typeof value?.speakingAudioUrl === 'string' && value.speakingAudioUrl.length > 0;
  const hasLocalBlob = value?.speakingBlob instanceof Blob;

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  const stopRecord = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    mediaRef.current?.stop();
    setRecording(false);
  };

  const startRecord = async () => {
    if (disabled || uploading || submissionId == null || questionId == null) return;
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
        const elapsedMs = Math.max(0, Date.now() - startedAtRef.current);
        const seconds = Math.max(1, Math.round(elapsedMs / 1000));
        setLocalReady(true);
        onChange?.({
          speakingBlob: blob,
          speakingAudioUrl: undefined,
          speakingDurationSeconds: seconds,
          speakingFormat: mime || 'webm',
        });
        setUploading(true);
        toast.info('Recording saved locally. Uploading audio now...');
        try {
          const res = await speakingApi.upload(blob, submissionId, questionId);
          const uploaded = res.data?.data;
          if (!uploaded?.url) {
            throw new Error('Speaking upload succeeded but no audio URL was returned.');
          }
          setLocalReady(false);
          onChange?.({
            speakingBlob: null,
            speakingAudioUrl: uploaded.url,
            speakingDurationSeconds: uploaded.durationSeconds ?? seconds,
            speakingFormat: uploaded.format || 'mp3',
          });
          toast.success('Recording uploaded and saved.');
        } catch (e) {
          toast.error(e?.response?.data?.message || e?.message || 'Upload failed. Audio will retry when you submit.');
        } finally {
          setUploading(false);
        }
      };
      recorder.start();
      startedAtRef.current = Date.now();
      setElapsedSeconds(0);
      timerRef.current = setInterval(() => {
        const elapsed = Math.max(0, Math.floor((Date.now() - startedAtRef.current) / 1000));
        setElapsedSeconds(elapsed);
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

      <div className="flex flex-wrap gap-2 justify-center">
        {recording ? (
          <Button variant="danger" onClick={stopRecord} disabled={disabled || uploading}>
            Stop
          </Button>
        ) : replaceMode ? (
          <>
            <Button variant="primary" onClick={startRecord} disabled={disabled || uploading}>
              {uploading ? 'Uploading...' : 'Start new recording'}
            </Button>
            <Button variant="secondary" onClick={() => setReplaceMode(false)} disabled={disabled || uploading}>
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
            disabled={disabled || uploading}
          >
            {uploading ? 'Uploading...' : (localReady || hasLocalBlob || hasServer) ? 'Record again' : 'Start recording'}
          </Button>
        )}
        {(localReady || hasLocalBlob) && !recording && !replaceMode && (
          <Button variant="secondary" onClick={clearLocal} disabled={disabled || uploading}>
            Clear recording
          </Button>
        )}
      </div>

      {(hasLocalBlob || hasServer) && value?.speakingDurationSeconds != null && (
        <p className="text-xs text-slate-500">
          Duration: {value.speakingDurationSeconds}s - {value.speakingFormat || 'audio'}
        </p>
      )}
      {/* Student cannot replay speaking recordings during the exam. */}
    </div>
  );
}
