import { useEffect, useRef, useState } from 'react';
import Button from '../common/Button';
import { speakingApi, API_ORIGIN } from '../../services/api';

/**
 * Record → preview (blob URL) → upload via POST /api/speaking/upload.
 *
 * @param {object} props
 * @param {number} props.submissionId
 * @param {number} props.questionId
 * @param {boolean} [props.disabled] When true, recording/upload disabled (e.g. time up).
 * @param {{ speakingAudioUrl?: string, speakingDurationSeconds?: number, speakingFormat?: string }} [props.value]
 * @param {function} props.onChange Called with upload metadata from server (mp3 + duration).
 * @param {object} props.toast
 */
export default function AudioRecorder({
  submissionId,
  questionId,
  disabled = false,
  value,
  onChange,
  toast,
}) {
  const [recording, setRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const mediaRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);

  const serverUrl = value?.speakingAudioUrl;
  const resolvedServerUrl =
    serverUrl && !serverUrl.startsWith('http://') && !serverUrl.startsWith('https://') && !serverUrl.startsWith('blob:')
      ? `${API_ORIGIN}${serverUrl.startsWith('/') ? '' : '/'}${serverUrl}`
      : serverUrl;
  const hasServer = typeof serverUrl === 'string' && serverUrl.length > 0 && !serverUrl.startsWith('blob:');

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const startRecord = async () => {
    if (disabled) return;
    try {
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
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mime || 'audio/webm' });
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        const url = URL.createObjectURL(blob);
        setPreviewUrl(url);
      };
      recorder.start();
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

  const stopRecord = () => {
    mediaRef.current?.stop();
    setRecording(false);
  };

  const discardPreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
  };

  const uploadPreview = async () => {
    if (!previewUrl || disabled) return;
    setUploading(true);
    try {
      const blob = await fetch(previewUrl).then((r) => r.blob());
      const res = await speakingApi.upload(blob, submissionId, questionId);
      const payload = res.data?.data;
      if (payload?.url) {
        onChange?.({
          speakingAudioUrl: payload.url,
          speakingDurationSeconds: payload.durationSeconds,
          speakingFormat: payload.format,
        });
        discardPreview();
        toast.success('Recording uploaded.');
      } else {
        toast.error('Upload succeeded but no URL returned.');
      }
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const listenSrc = previewUrl || (hasServer ? resolvedServerUrl : null);

  return (
    <div className="flex flex-col items-center gap-4 py-6">
      <div
        className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${
          recording
            ? 'bg-red-100 animate-pulse dark:bg-red-950/50'
            : uploading
              ? 'bg-amber-50 dark:bg-amber-950/50'
              : 'bg-blue-50 dark:bg-slate-800'
        }`}
      >
        <svg
          className={`w-8 h-8 ${recording ? 'text-red-500' : uploading ? 'text-amber-500' : 'text-blue-400'}`}
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
          ? 'Recording disabled — exam time has ended.'
          : recording
            ? 'Recording… speak clearly.'
            : uploading
              ? 'Uploading…'
              : previewUrl
                ? 'Preview your recording, then upload or re-record.'
                : hasServer
                  ? 'Recording saved. You can re-record if needed.'
                  : 'Press start to record your answer.'}
      </p>

      <div className="flex flex-wrap gap-2 justify-center">
        {recording ? (
          <Button variant="danger" onClick={stopRecord} disabled={uploading || disabled}>
            Stop
          </Button>
        ) : (
          <Button variant="primary" onClick={startRecord} disabled={uploading || disabled}>
            {previewUrl || hasServer ? 'Re-record' : 'Start recording'}
          </Button>
        )}
        {previewUrl && !recording && (
          <>
            <Button variant="secondary" onClick={discardPreview} disabled={uploading || disabled}>
              Discard
            </Button>
            <Button variant="primary" onClick={uploadPreview} disabled={uploading || disabled}>
              {uploading ? 'Uploading…' : 'Upload recording'}
            </Button>
          </>
        )}
      </div>

      {hasServer && value?.speakingDurationSeconds != null && (
        <p className="text-xs text-slate-500">
          Saved MP3: {value.speakingDurationSeconds}s · {value.speakingFormat || 'mp3'}
        </p>
      )}
      {listenSrc && !recording && (
        <audio controls src={listenSrc} className="w-full max-w-xs mt-2" preload="metadata" />
      )}
    </div>
  );
}
