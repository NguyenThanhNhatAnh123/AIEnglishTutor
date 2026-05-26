import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { studentExamApi, speakingApi, aiApi, API_ORIGIN } from '../services/api';
import { useToast } from '../context/ToastContext';
import Modal from '../components/common/Modal';
import Button from '../components/common/Button';
import ExamTimer from '../components/ExamTimer';
import AudioPlayer from '../../../packages/ui/AudioPlayer.jsx';
import SpeakingRecorder from '../components/exam/SpeakingRecorder.jsx';
import examRoomMainBg from '../assets/exam/backgrounds/exam-room-main-bg.jpg';
import examRoomStatCardBg from '../assets/exam/backgrounds/exam-room-stat-card-bg.jpg';
import examRoomPanelBg from '../assets/exam/backgrounds/exam-room-panel-bg.jpg';

function resolveAudioSrc(url) {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('blob:')) return url;
  return `${API_ORIGIN}${url.startsWith('/') ? '' : '/'}${url}`;
}

function examRoomBackground(image, overlay = 'rgba(255,255,255,0.92)') {
  return {
    backgroundImage: `linear-gradient(90deg, ${overlay}, rgba(255,255,255,0.7)), url(${image})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  };
}

function detectDeviceType() {
  if (typeof navigator === 'undefined') return 'UNKNOWN';
  const ua = (navigator.userAgent || '').toLowerCase();
  if (/(ipad|tablet)/.test(ua) || (/android/.test(ua) && !/mobile/.test(ua))) return 'TABLET';
  if (/(mobi|iphone|ipod|android)/.test(ua)) return 'MOBILE';
  return 'DESKTOP';
}

function initialAnalytics() {
  const ua = typeof navigator === 'undefined' ? '' : (navigator.userAgent || '');
  return {
    tabSwitchCount: 0,
    focusLossCount: 0,
    copyPasteCount: 0,
    suspiciousEventCount: 0,
    deviceType: detectDeviceType(),
    deviceLabel: ua.slice(0, 255),
  };
}

function resolveSubmissionStartEpochMs(submission) {
  if (!submission) return null;
  if (submission.deadlineEpochMs != null && submission.durationMinutes != null) {
    const fromDeadline = Number(submission.deadlineEpochMs) - Number(submission.durationMinutes) * 60_000;
    if (Number.isFinite(fromDeadline)) return fromDeadline;
  }
  if (submission.startTime) {
    const parsed = new Date(submission.startTime).getTime();
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

const DRAFT_KEY_PREFIX = 'exam_draft_v1';
const AUDIO_DRAFT_DB = 'exam_audio_drafts_v1';
const AUDIO_DRAFT_STORE = 'recordings';

function draftKeyFor(submissionId) {
  return submissionId ? `${DRAFT_KEY_PREFIX}_${submissionId}` : null;
}

function serializeDraftAnswers(answers) {
  const serialized = {};
  Object.entries(answers || {}).forEach(([questionId, answer]) => {
    if (!answer) return;
    serialized[questionId] = {
      answerText: answer.answerText,
      selectedOptionId: answer.selectedOptionId,
      speakingAudioUrl: answer.speakingAudioUrl,
      speakingDurationSeconds: answer.speakingDurationSeconds,
      speakingFormat: answer.speakingFormat,
      imageUrl: answer.imageUrl,
      localUpdatedAt: answer.localUpdatedAt,
      hasUnsavedSpeakingBlob: answer.speakingBlob instanceof Blob,
    };
  });
  return serialized;
}

function readLocalDraft(submissionId) {
  const key = draftKeyFor(submissionId);
  if (!key) return {};
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function clearLocalDraft(submissionId) {
  const key = draftKeyFor(submissionId);
  if (key) localStorage.removeItem(key);
}

function speakingDraftKey(submissionId, questionId) {
  return `${submissionId}:${questionId}`;
}

function openAudioDraftDb() {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    const request = indexedDB.open(AUDIO_DRAFT_DB, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(AUDIO_DRAFT_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
}

async function saveSpeakingDraftBlob(submissionId, questionId, blob) {
  if (!(blob instanceof Blob)) return;
  const db = await openAudioDraftDb();
  if (!db) return;
  await new Promise((resolve) => {
    const tx = db.transaction(AUDIO_DRAFT_STORE, 'readwrite');
    tx.objectStore(AUDIO_DRAFT_STORE).put(blob, speakingDraftKey(submissionId, questionId));
    tx.oncomplete = resolve;
    tx.onerror = resolve;
  });
  db.close();
}

async function readSpeakingDraftBlob(submissionId, questionId) {
  const db = await openAudioDraftDb();
  if (!db) return null;
  const blob = await new Promise((resolve) => {
    const tx = db.transaction(AUDIO_DRAFT_STORE, 'readonly');
    const request = tx.objectStore(AUDIO_DRAFT_STORE).get(speakingDraftKey(submissionId, questionId));
    request.onsuccess = () => resolve(request.result instanceof Blob ? request.result : null);
    request.onerror = () => resolve(null);
  });
  db.close();
  return blob;
}

async function deleteSpeakingDraftBlob(submissionId, questionId) {
  const db = await openAudioDraftDb();
  if (!db) return;
  await new Promise((resolve) => {
    const tx = db.transaction(AUDIO_DRAFT_STORE, 'readwrite');
    tx.objectStore(AUDIO_DRAFT_STORE).delete(speakingDraftKey(submissionId, questionId));
    tx.oncomplete = resolve;
    tx.onerror = resolve;
  });
  db.close();
}

async function restoreSpeakingDraftBlobs(submissionId, answerMap, questions) {
  const next = { ...answerMap };
  let restoredCount = 0;
  for (const question of questions) {
    if ((question?.questionType || '').toUpperCase() !== 'SPEAKING') continue;
    const blob = await readSpeakingDraftBlob(submissionId, question.id);
    if (!blob) continue;
    next[question.id] = {
      ...(next[question.id] || {}),
      speakingBlob: blob,
      speakingAudioUrl: next[question.id]?.speakingAudioUrl,
      speakingFormat: next[question.id]?.speakingFormat || blob.type || 'audio/webm',
    };
    restoredCount += 1;
  }
  return { answers: next, restoredCount };
}

/* ─── Question navigation sidebar ──────────────────────────────────────── */
function QuestionNav({ questions, answers, current, onSelect, disabled }) {
  return (
    <nav className="w-56 shrink-0 hidden lg:block" aria-label="Question navigation">
      <div className="card sticky top-4 dark:bg-slate-900 dark:border-slate-700">
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
          Questions
        </p>
        <div className="grid grid-cols-5 gap-1.5">
          {questions.map((q, idx) => {
            const answered = isAnswered(q, answers[q.id]);
            const isCurrent = current === q.id;
            return (
              <button
                key={q.id}
                type="button"
                onClick={() => onSelect(q.id, idx)}
                disabled={disabled}
                aria-label={`Question ${idx + 1}${answered ? ' (answered)' : ''}`}
                aria-current={isCurrent ? 'step' : undefined}
                className={`w-8 h-8 rounded-lg text-xs font-bold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                  isCurrent
                    ? 'bg-blue-600 text-white ring-2 ring-blue-400 ring-offset-1 dark:ring-offset-slate-900'
                    : answered
                      ? 'bg-green-500 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-blue-600 dark:bg-slate-800 dark:text-slate-300'
                } disabled:cursor-not-allowed disabled:opacity-60`}
              >
                {idx + 1}
              </button>
            );
          })}
        </div>
        <div className="mt-4 space-y-1.5">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span className="w-3 h-3 rounded-sm bg-green-500 inline-block" /> Answered
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span className="w-3 h-3 rounded-sm bg-slate-200 dark:bg-slate-600 inline-block" /> Not answered
          </div>
        </div>
      </div>
    </nav>
  );
}

/* ─── Answer type detection ────────────────────────────────────────────── */
function QuestionStrip({ questions, answers, current, onSelect, disabled }) {
  return (
    <div className="lg:hidden rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Questions
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {questions.filter((q) => isAnswered(q, answers[q.id])).length}/{questions.length} answered
        </p>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {questions.map((q, idx) => {
          const answered = isAnswered(q, answers[q.id]);
          const isCurrent = current === q.id;
          return (
            <button
              key={q.id}
              type="button"
              onClick={() => onSelect(q.id, idx)}
              disabled={disabled}
              aria-label={`Question ${idx + 1}${answered ? ' (answered)' : ''}`}
              aria-current={isCurrent ? 'step' : undefined}
              className={`h-9 min-w-9 rounded-lg px-3 text-xs font-bold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                isCurrent
                  ? 'bg-blue-600 text-white'
                  : answered
                    ? 'bg-green-500 text-white'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
              } disabled:cursor-not-allowed disabled:opacity-60`}
            >
              {idx + 1}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function isAnswered(question, value) {
  if (!value) return false;
  const type = question?.questionType?.toUpperCase() || '';
  switch (type) {
    case 'MULTIPLE_CHOICE':
    case 'LISTENING':
      return value.selectedOptionId != null;
    case 'WRITING':
      return typeof value.answerText === 'string' && value.answerText.trim().length > 0;
    case 'SPEAKING': {
      const u = value.speakingAudioUrl;
      const hasUploaded = typeof u === 'string' && u.length > 0 && !u.startsWith('blob:');
      const hasLocal = value.speakingBlob instanceof Blob;
      return hasUploaded || hasLocal;
    }
    default:
      return !!(value.selectedOptionId || value.answerText || value.speakingAudioUrl);
  }
}

/* ─── MCQ component ────────────────────────────────────────────────────── */
function MCQuestion({ question, value, onChange, disabled }) {
  return (
    <div className="space-y-2" role="radiogroup" aria-label="Answer options">
      {question.options?.map((opt) => (
        <label
          key={opt.id}
          className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all focus-within:ring-2 focus-within:ring-blue-400 ${
            value?.selectedOptionId === opt.id
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-400'
              : 'border-slate-200 hover:border-blue-300 bg-white dark:bg-slate-800 dark:border-slate-600'
          } ${disabled ? 'cursor-not-allowed opacity-70' : ''}`}
        >
          <input
            type="radio"
            name={`q-${question.id}`}
            checked={value?.selectedOptionId === opt.id}
            onChange={() => onChange({ selectedOptionId: opt.id })}
            disabled={disabled}
            className="w-4 h-4 text-blue-600 accent-blue-600"
          />
          <span className="text-sm text-slate-700 dark:text-slate-200">{opt.optionText}</span>
        </label>
      ))}
    </div>
  );
}

/* ─── Writing component ────────────────────────────────────────────────── */
function WritingQuestion({ value, onChange, toast, disabled }) {
  const [processing, setProcessing] = useState(false);

  const onPickImage = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      setProcessing(true);
      const res = await aiApi.imageOcrTts(file);
      const data = res.data?.data || {};
      onChange({
        imageUrl: data.imageUrl || undefined,
        answerText: data.extractedText || value?.answerText || '',
        speakingAudioUrl: data.audioUrl || undefined,
        speakingFormat: data.audioUrl ? 'mp3' : value?.speakingFormat,
      });
      toast.info('Image OCR + TTS completed.');
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to process image.');
    } finally {
      setProcessing(false);
    }
  };

  const generatedAudioSrc = resolveAudioSrc(value?.speakingAudioUrl);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800">
          <input
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/webp"
            onChange={onPickImage}
            disabled={disabled || processing}
            className="hidden"
          />
          {processing ? 'Processing image...' : 'Upload image for OCR + TTS'}
        </label>
        {value?.imageUrl && (
          <a
            href={resolveAudioSrc(value.imageUrl)}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-blue-600 hover:underline"
          >
            View uploaded image
          </a>
        )}
      </div>
      {generatedAudioSrc && (
        <AudioPlayer src={generatedAudioSrc} disabled={disabled} className="max-w-md" />
      )}
      <textarea
        value={value?.answerText || ''}
        onChange={(e) => onChange({ answerText: e.target.value })}
        placeholder="Write your answer here..."
        rows={8}
        aria-label="Your written answer"
        disabled={disabled}
        className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y disabled:opacity-60"
      />
    </div>
  );
}

function sectionQuestionCount(sections) {
  return (sections || []).reduce((acc, s) => acc + ((s.questions || []).length), 0);
}

function questionType(question) {
  return (question?.questionType || '').trim().toUpperCase();
}

function hasAnyQuestion(questions, type) {
  return questions.some((q) => questionType(q) === type);
}

function hasAnyAudioPrompt(questions) {
  return questions.some((q) => questionType(q) === 'LISTENING' || q.listeningAudioUrl || q.audioUrl);
}

function statusTone(ok, waiting = false) {
  if (ok) return 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-100';
  if (waiting) return 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200';
  return 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100';
}

function WaitingCheck({ label, detail, ok, waiting, action }) {
  return (
    <div
      className={`rounded-xl border p-4 ${statusTone(ok, waiting)}`}
      style={examRoomBackground(examRoomStatCardBg, ok ? 'rgba(236,253,245,0.94)' : waiting ? 'rgba(248,250,252,0.94)' : 'rgba(255,251,235,0.94)')}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold">{label}</p>
          <p className="mt-1 text-xs leading-relaxed opacity-80">{detail}</p>
        </div>
        <span className="shrink-0 rounded-full bg-white/70 px-2 py-1 text-[11px] font-bold dark:bg-slate-900/60">
          {ok ? 'Ready' : waiting ? 'Optional' : 'Needed'}
        </span>
      </div>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

/* ─── Question block ───────────────────────────────────────────────────── */
function QuestionBlock({ question, value, onChange, toast, interactionLocked, submissionId }) {
  const type = question.questionType?.toUpperCase();
  const promptSrc = resolveAudioSrc(question.listeningAudioUrl || question.audioUrl);
  return (
    <div className="card dark:bg-slate-900 dark:border-slate-700">
      <p className="text-xs font-semibold text-blue-500 dark:text-blue-400 uppercase tracking-wider mb-1">
        {type?.replace(/_/g, ' ')}
      </p>
      {promptSrc && (
        <div className="mb-4 space-y-2">
          <AudioPlayer src={promptSrc} disabled={interactionLocked} className="max-w-2xl" />
        </div>
      )}
      <p className="text-slate-800 dark:text-slate-100 font-medium mb-4">{question.questionText}</p>
      <p className="text-xs text-slate-400 mb-4">
        {question.points} pt{question.points !== 1 ? 's' : ''}
      </p>
      {(type === 'MULTIPLE_CHOICE' || type === 'LISTENING') && (
        <MCQuestion question={question} value={value} onChange={onChange} disabled={interactionLocked} />
      )}
      {type === 'WRITING' && (
        <WritingQuestion
          value={value}
          onChange={onChange}
          toast={toast}
          disabled={interactionLocked}
        />
      )}
      {type === 'SPEAKING' && submissionId != null && (
        <SpeakingRecorder
          submissionId={submissionId}
          questionId={question.id}
          instructionAudioUrl={question.listeningAudioUrl || question.audioUrl}
          disabled={interactionLocked}
          value={value}
          onChange={onChange}
        />
      )}
    </div>
  );
}

/* ─── Main Exam Page ───────────────────────────────────────────────────── */
export default function ExamPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [exam, setExam] = useState(null);
  const [submission, setSubmission] = useState(null);
  const [answers, setAnswers] = useState({});
  const [currentQ, setCurrentQ] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [endTimeMs, setEndTimeMs] = useState(null);
  const [pageMode, setPageMode] = useState('all');
  const [pageIndex, setPageIndex] = useState(0);
  const [dark, setDark] = useState(() => localStorage.getItem('exam_dark') === '1');
  const [interactionLocked, setInteractionLocked] = useState(false);
  const [saveState, setSaveState] = useState('idle');
  const [micStatus, setMicStatus] = useState('idle');
  const [audioChecked, setAudioChecked] = useState(false);
  const [rulesAccepted, setRulesAccepted] = useState(false);
  const [isOnline, setIsOnline] = useState(() => typeof navigator === 'undefined' ? true : navigator.onLine);
  const timerExpireRef = useRef(false);
  const saveTimersRef = useRef(new Map());
  const dirtyAnswerIdsRef = useRef(new Set());
  const draftHydratedRef = useRef(false);
  const submittingRef = useRef(false);
  const analyticsRef = useRef(initialAnalytics());
  const lastWarningAtRef = useRef(0);
  const lastSaveWarningAtRef = useRef(0);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('exam_dark', dark ? '1' : '0');
  }, [dark]);

  useEffect(() => {
    const updateOnline = () => setIsOnline(typeof navigator === 'undefined' ? true : navigator.onLine);
    window.addEventListener('online', updateOnline);
    window.addEventListener('offline', updateOnline);
    return () => {
      window.removeEventListener('online', updateOnline);
      window.removeEventListener('offline', updateOnline);
    };
  }, []);

  /* Load exam details */
  useEffect(() => {
    studentExamApi
      .getExam(id)
      .then((r) => {
        const e = r.data?.data;
        setExam(e);
        const allQ = e?.sections?.flatMap((s) => s.questions || []) || [];
        if (allQ[0]) setCurrentQ(allQ[0].id);
      })
      .catch(() => toast.error('Could not load exam.'))
      .finally(() => setLoading(false));
  }, [id, toast]);

  const markSuspicious = useCallback((type) => {
    if (!submission) return;
    const next = { ...analyticsRef.current };
    if (type === 'TAB_SWITCH') next.tabSwitchCount += 1;
    if (type === 'FOCUS_LOSS') next.focusLossCount += 1;
    if (type === 'COPY_PASTE') next.copyPasteCount += 1;
    next.suspiciousEventCount = next.tabSwitchCount + next.focusLossCount + next.copyPasteCount;
    analyticsRef.current = next;

    const now = Date.now();
    if (now - lastWarningAtRef.current > 2500) {
      lastWarningAtRef.current = now;
      toast.warning('Unusual activity was recorded during your exam session.');
    }
  }, [submission, toast]);

  useEffect(() => {
    if (!submission) return undefined;
    const onVis = () => {
      if (document.visibilityState === 'hidden') markSuspicious('TAB_SWITCH');
    };
    const onBlur = () => markSuspicious('FOCUS_LOSS');
    const onCopy = () => markSuspicious('COPY_PASTE');
    const onPaste = () => markSuspicious('COPY_PASTE');

    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('blur', onBlur);
    document.addEventListener('copy', onCopy);
    document.addEventListener('paste', onPaste);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('copy', onCopy);
      document.removeEventListener('paste', onPaste);
    };
  }, [submission, markSuspicious]);

  const allQuestions = useMemo(
    () => exam?.sections?.flatMap((s) => s.questions || []) || [],
    [exam]
  );
  const answeredCount = allQuestions.filter((q) => isAnswered(q, answers[q.id])).length;
  const minRequiredToSubmit = Math.ceil(allQuestions.length * 0.5);
  const canSubmitByProgress = answeredCount >= minRequiredToSubmit;
  const effectiveMaxAttempts = exam?.maxAttempts ?? (exam?.examType === 'OFFICIAL' ? 1 : null);
  const remainingAttempts = exam?.remainingAttempts;
  const attemptLimitReached = remainingAttempts === 0 && !exam?.hasInProgressSubmission;
  const canStartExam = allQuestions.length > 0 && !attemptLimitReached;
  const hasSpeakingQuestions = hasAnyQuestion(allQuestions, 'SPEAKING');
  const hasAudioQuestions = hasAnyAudioPrompt(allQuestions);
  const micReady = !hasSpeakingQuestions || micStatus === 'ok';
  const audioReady = !hasAudioQuestions || audioChecked;
  const preflightReady = isOnline && micReady && audioReady && rulesAccepted;
  const readyToStartExam = canStartExam && preflightReady;
  const attemptLimitText = exam?.hasInProgressSubmission
    ? 'Resume in-progress attempt'
    : effectiveMaxAttempts == null
      ? 'Unlimited attempts'
      : `${remainingAttempts ?? effectiveMaxAttempts}/${effectiveMaxAttempts} attempts left`;

  const checkMicrophone = async () => {
    if (!hasSpeakingQuestions) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      setMicStatus('error');
      toast.error('This browser cannot access the microphone.');
      return;
    }
    try {
      setMicStatus('checking');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      setMicStatus('ok');
      toast.success('Microphone is ready.');
    } catch {
      setMicStatus('error');
      toast.error('Microphone permission is required for speaking questions.');
    }
  };

  /* ─── Start / Resume exam ──────────────────────────────────────────── */
  const startExam = async () => {
    if (!readyToStartExam) {
      toast.warning('Complete the waiting room checks before starting.');
      return;
    }
    try {
      const res = await studentExamApi.start(id);
      const sub = res.data?.data;
      draftHydratedRef.current = false;
      setSubmission(sub);
      const endMs =
        sub.deadlineEpochMs ??
        (sub.startTime && sub.durationMinutes
          ? new Date(sub.startTime).getTime() + sub.durationMinutes * 60_000
          : Date.now() + (exam?.durationMinutes ?? 60) * 60_000);
      setEndTimeMs(endMs);
      timerExpireRef.current = false;
      setInteractionLocked(false);
      analyticsRef.current = initialAnalytics();
      toast.info('Exam started! Good luck!');

      // Load saved answers for resume
      if (sub.id) {
        try {
          const ansRes = await studentExamApi.getAnswers(sub.id);
          const savedAnswers = ansRes.data?.data || [];
          const restored = {};
          for (const ans of savedAnswers) {
            restored[ans.questionId] = {
              answerText: ans.answerText || undefined,
              selectedOptionId: ans.selectedOptionId || undefined,
              speakingAudioUrl: ans.speakingAudioUrl || undefined,
              speakingDurationSeconds: ans.speakingDurationSeconds ?? undefined,
              speakingFormat: ans.speakingFormat || undefined,
              speakingBlob: null,
              imageUrl: ans.imageUrl || undefined,
            };
          }
          const localDraft = readLocalDraft(sub.id);
          const merged = { ...restored, ...localDraft };
          const withAudioDrafts = await restoreSpeakingDraftBlobs(sub.id, merged, allQuestions);
          const restoredCount = Object.keys(withAudioDrafts.answers).length;
          if (restoredCount > 0) {
            setAnswers(withAudioDrafts.answers);
            toast.info(`Restored ${restoredCount} saved answer(s).`);
          }
          if (withAudioDrafts.restoredCount > 0) {
            toast.warning(`${withAudioDrafts.restoredCount} local speaking recording(s) will retry upload on submit.`);
          }
        } catch {
          // Non-critical: continue without restored answers
          const localDraft = readLocalDraft(sub.id);
          const withAudioDrafts = await restoreSpeakingDraftBlobs(sub.id, localDraft, allQuestions);
          if (Object.keys(withAudioDrafts.answers).length > 0) {
            setAnswers(withAudioDrafts.answers);
            toast.info(`Restored ${Object.keys(withAudioDrafts.answers).length} local draft answer(s).`);
          }
        }
      }
      draftHydratedRef.current = true;
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to start exam.');
    }
  };

  /* ─── Save answer (debounced) ──────────────────────────────────────── */
  useEffect(() => {
    if (!submission?.id || !draftHydratedRef.current) return;
    try {
      localStorage.setItem(
        draftKeyFor(submission.id),
        JSON.stringify(serializeDraftAnswers(answers))
      );
    } catch {
      // Local backup is best-effort; server autosave remains the source of truth.
    }
  }, [answers, submission?.id]);

  useEffect(() => {
    if (!submission) return undefined;
    const hasUnsavedLocalAudio = () =>
      Object.values(answers).some((answer) => answer?.speakingBlob instanceof Blob);
    const shouldWarn = () =>
      dirtyAnswerIdsRef.current.size > 0 || saveState === 'error' || hasUnsavedLocalAudio();
    const onBeforeUnload = (event) => {
      if (!shouldWarn()) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [answers, saveState, submission]);

  const persistAnswer = useCallback(
    (questionId, data) => {
      if (!submission) return;
      if (data?.speakingBlob instanceof Blob && !data?.speakingAudioUrl) {
        // Keep local speaking audio in memory; upload only when student submits.
        return;
      }
      setSaveState('saving');
      return studentExamApi
        .saveAnswer({
          submissionId: submission.id,
          questionId,
          answerText: data?.answerText ?? undefined,
          selectedOptionId: data?.selectedOptionId ?? undefined,
          speakingAudioUrl: data?.speakingAudioUrl ?? undefined,
          speakingDurationSeconds: data?.speakingDurationSeconds ?? undefined,
          speakingFormat: data?.speakingFormat ?? undefined,
          imageUrl: data?.imageUrl ?? undefined,
        })
        .then(() => {
          dirtyAnswerIdsRef.current.delete(questionId);
          setSaveState(dirtyAnswerIdsRef.current.size > 0 ? 'saving' : 'saved');
        })
        .catch((e) => {
          setSaveState('error');
          const now = Date.now();
          if (now - lastSaveWarningAtRef.current > 4000) {
            lastSaveWarningAtRef.current = now;
            toast.error('Could not auto-save this answer. Please check your connection before submitting.');
          }
          throw e;
        });
    },
    [submission, toast]
  );

  const saveAnswer = useCallback(
    (questionId, data) => {
      let mergedSlice;
      setAnswers((prev) => {
        mergedSlice = { ...(prev[questionId] || {}), ...data, localUpdatedAt: Date.now() };
        return { ...prev, [questionId]: mergedSlice };
      });
      if (submission?.id) {
        if (data?.speakingBlob instanceof Blob) {
          saveSpeakingDraftBlob(submission.id, questionId, data.speakingBlob);
        } else if (Object.prototype.hasOwnProperty.call(data || {}, 'speakingBlob') && data.speakingBlob == null) {
          deleteSpeakingDraftBlob(submission.id, questionId);
        }
      }
      dirtyAnswerIdsRef.current.add(questionId);
      if (saveTimersRef.current.has(questionId)) {
        clearTimeout(saveTimersRef.current.get(questionId));
      }
      const timerId = setTimeout(() => {
        saveTimersRef.current.delete(questionId);
        persistAnswer(questionId, mergedSlice)?.catch(() => {});
      }, 600);
      saveTimersRef.current.set(questionId, timerId);
    },
    [persistAnswer, submission?.id]
  );

  useEffect(
    () => () => {
      saveTimersRef.current.forEach((timerId) => clearTimeout(timerId));
      saveTimersRef.current.clear();
    },
    []
  );

  /* ─── Flush all unsaved + submit ───────────────────────────────────── */
  const flushAnswers = useCallback(async (answerSnapshot) => {
    if (!submission) return;
    const entries = Object.entries(answerSnapshot).filter(([, data]) => data);
    setSaveState('saving');
    const results = await Promise.allSettled(
      entries.map(([qId, data]) =>
        studentExamApi.saveAnswer({
          submissionId: submission.id,
          questionId: parseInt(qId, 10),
          answerText: data.answerText ?? undefined,
          selectedOptionId: data.selectedOptionId ?? undefined,
          speakingAudioUrl: data.speakingAudioUrl ?? undefined,
          speakingDurationSeconds: data.speakingDurationSeconds ?? undefined,
          speakingFormat: data.speakingFormat ?? undefined,
          imageUrl: data.imageUrl ?? undefined,
        })
      )
    );
    const failed = results.filter((r) => r.status === 'rejected');
    if (failed.length > 0) {
      setSaveState('error');
      throw new Error(`Could not save ${failed.length} answer(s). Please retry before submitting.`);
    }
    dirtyAnswerIdsRef.current.clear();
    setSaveState('saved');
  }, [submission]);

  const uploadSpeakingBeforeSubmit = useCallback(async (answerSnapshot, options = {}) => {
    if (!submission) return { answers: answerSnapshot, failures: [] };
    const { bestEffort = false } = options;
    const next = { ...answerSnapshot };
    const failures = [];
    for (const q of allQuestions) {
      const type = (q?.questionType || '').toUpperCase();
      if (type !== 'SPEAKING') continue;
      const answer = next[q.id];
      if (!answer || !(answer.speakingBlob instanceof Blob)) continue;

      try {
        const res = await speakingApi.upload(answer.speakingBlob, submission.id, q.id);
        const uploaded = res.data?.data;
        if (!uploaded?.url) {
          throw new Error('Speaking upload succeeded but no audio URL was returned.');
        }

        next[q.id] = {
          ...answer,
          speakingBlob: null,
          speakingAudioUrl: uploaded.url,
          speakingDurationSeconds: uploaded.durationSeconds,
          speakingFormat: uploaded.format,
        };
        await deleteSpeakingDraftBlob(submission.id, q.id);
      } catch (e) {
        if (!bestEffort) throw e;
        failures.push({ questionId: q.id, error: e });
      }
    }
    return { answers: next, failures };
  }, [allQuestions, submission]);

  const flushAnswersBeforeSubmit = useCallback(async (answerSnapshot, options = {}) => {
    try {
      await flushAnswers(answerSnapshot);
      return true;
    } catch (e) {
      if (!options.bestEffort) throw e;
      return false;
    }
  }, [flushAnswers]);

  const doSubmit = useCallback(async (force = false) => {
    if (!submission || submittingRef.current) return;

    // Cancel any pending debounced save before flushing (Bug fix: LOW-05)
    saveTimersRef.current.forEach((timerId) => clearTimeout(timerId));
    saveTimersRef.current.clear();

    const requiredAnswers = Math.ceil(allQuestions.length * 0.5);
    if (!force && answeredCount < requiredAnswers) {
      toast.warning(`You need at least ${requiredAnswers}/${allQuestions.length} answered before submitting.`);
      setConfirmOpen(false);
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    try {
      const bestEffortFinalization = force;
      let answerSnapshot = { ...answers };
      const uploadResult = await uploadSpeakingBeforeSubmit(answerSnapshot, { bestEffort: bestEffortFinalization });
      answerSnapshot = uploadResult.answers;
      setAnswers(answerSnapshot);
      const flushed = await flushAnswersBeforeSubmit(answerSnapshot, { bestEffort: bestEffortFinalization });
      if (bestEffortFinalization && uploadResult.failures.length > 0) {
        toast.warning('Time is up. Some local speaking audio could not upload, but the exam will still be submitted.');
      }
      if (bestEffortFinalization && !flushed) {
        toast.warning('Time is up. Some last-second answers may not have saved, but the exam will still be submitted.');
      }
      let clientTimeSpentSeconds;
      const startEpochMs = resolveSubmissionStartEpochMs(submission);
      if (startEpochMs != null) {
        clientTimeSpentSeconds = Math.max(
          0,
          Math.floor((Date.now() - startEpochMs) / 1000)
        );
      }
      const a = analyticsRef.current;
      await studentExamApi.submit(submission.id, {
        clientTimeSpentSeconds,
        tabSwitchCount: a.tabSwitchCount,
        focusLossCount: a.focusLossCount,
        copyPasteCount: a.copyPasteCount,
        suspiciousEventCount: a.suspiciousEventCount,
        deviceType: a.deviceType,
        deviceLabel: a.deviceLabel,
      });
      clearLocalDraft(submission.id);
      await Promise.all(
        allQuestions
          .filter((q) => (q?.questionType || '').toUpperCase() === 'SPEAKING')
          .map((q) => deleteSpeakingDraftBlob(submission.id, q.id))
      );
      navigate(`/result/${submission.id}`);
    } catch (e) {
      toast.error(e?.response?.data?.message || e?.message || 'Submission failed. Please try again.');
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
      setConfirmOpen(false);
    }
  }, [submission, allQuestions, answeredCount, answers, flushAnswersBeforeSubmit, uploadSpeakingBeforeSubmit, navigate, toast]);

  const onTimerExpire = useCallback(() => {
    if (timerExpireRef.current) return;
    timerExpireRef.current = true;
    setInteractionLocked(true);
    toast.warning('Time is up! Auto-submitting...');
    doSubmit(true);
  }, [doSubmit, toast]);

  const onExamTimerTick = useCallback((secondsLeft) => {
    setInteractionLocked(secondsLeft <= 0);
  }, []);
  const openSubmitConfirm = () => {
    if (!canSubmitByProgress) {
      toast.warning(`You need at least ${minRequiredToSubmit}/${allQuestions.length} answered before submitting.`);
      return;
    }
    setConfirmOpen(true);
  };


  /* ─── Page sync: keep pageIndex and currentQ in sync ────────────── */
  useEffect(() => {
    if (pageMode === 'one' && allQuestions[pageIndex]) {
      setCurrentQ(allQuestions[pageIndex].id);
    }
  }, [pageIndex, pageMode, allQuestions]);

  if (loading) {
    return (
      <div className="flex h-[80vh] items-center justify-center dark:bg-slate-950">
        <div className="w-10 h-10 rounded-full border-[3px] border-blue-100 border-t-blue-600 animate-spin" />
      </div>
    );
  }

  if (!exam) {
    return (
      <div className="card text-center py-16 text-slate-400 dark:bg-slate-900 dark:border-slate-700">
        Exam not found.
      </div>
    );
  }

  const pagedQuestion = pageMode === 'one' ? allQuestions[pageIndex] : null;
  const selectQuestion = (qid, idx) => {
    setCurrentQ(qid);
    setPageIndex(idx);
    if (pageMode === 'all') {
      requestAnimationFrame(() => {
        document.getElementById(`q-${qid}`)?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      });
    }
  };

  return (
    <div className="min-h-screen -m-6 bg-slate-50 dark:bg-slate-950 text-slate-900">
      {/* ─── Sticky header ─────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 px-4 sm:px-6 py-3 flex flex-col gap-3 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100 truncate">{exam.title}</h1>
            {exam.examType && (
              <span className={`text-[10px] uppercase tracking-wide font-bold px-2 py-0.5 rounded-md shrink-0 ${
                exam.examType === 'OFFICIAL'
                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200'
                  : 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200'
              }`}>
                {exam.examType === 'OFFICIAL' ? 'Official' : 'Practice'}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Progress: {answeredCount} / {allQuestions.length} answered
          </p>
          {submission && (
            <p className={`mt-1 text-xs font-medium ${
              saveState === 'error'
                ? 'text-red-600'
                : saveState === 'saving'
                  ? 'text-blue-600'
                  : 'text-slate-500 dark:text-slate-400'
            }`}>
              {saveState === 'saving'
                ? 'Saving answers...'
                : saveState === 'error'
                  ? 'Auto-save needs attention'
                  : saveState === 'saved'
                    ? 'All saved'
                    : 'Answers save automatically'}
            </p>
          )}
          <div className="mt-2 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden max-w-md">
            <div
              className="h-full bg-blue-600 rounded-full transition-all duration-300"
              style={{ width: `${allQuestions.length ? (answeredCount / allQuestions.length) * 100 : 0}%` }}
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setDark((d) => !d)}
            className="text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          >
            {dark ? 'Light mode' : 'Dark mode'}
          </button>
          {submission && allQuestions.length > 0 && (
            <button
              type="button"
              disabled={interactionLocked}
              onClick={() => {
                setPageMode((m) => (m === 'all' ? 'one' : 'all'));
                setPageIndex(allQuestions.findIndex((q) => q.id === currentQ) || 0);
              }}
              className="text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pageMode === 'all' ? 'One question / page' : 'Show all questions'}
            </button>
          )}
          {submission && endTimeMs != null && (
            <ExamTimer endTimeMs={endTimeMs} onExpire={onTimerExpire} onTick={onExamTimerTick} />
          )}
          {submission && (
            <Button variant="primary" onClick={openSubmitConfirm} disabled={submitting}>
              Submit Exam
            </Button>
          )}
        </div>
        </div>
      </div>

      {/* ─── Pre-start screen ──────────────────────────────────────── */}
      {!submission ? (
        <div className="flex items-center justify-center py-10 px-4">
          <div
            className="card max-w-5xl w-full dark:bg-slate-900 dark:border-slate-700"
            style={examRoomBackground(examRoomMainBg, 'rgba(255,255,255,0.9)')}
          >
            <div className="w-16 h-16 rounded-full bg-blue-50 dark:bg-slate-800 flex items-center justify-center text-blue-500 mx-auto mb-4">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414A1 1 0 0119 9.414V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 text-center mb-2">{exam.title}</h2>
            <p className="text-slate-500 dark:text-slate-300 text-sm text-center mb-6">{exam.description || 'No description.'}</p>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 text-center" style={examRoomBackground(examRoomStatCardBg, 'rgba(255,255,255,0.94)')}>
                <p className="text-xs uppercase tracking-wide text-slate-500">Exam type</p>
                <p className="text-lg font-bold text-slate-800 dark:text-slate-100 mt-1">
                  {exam.examType === 'OFFICIAL' ? 'Official' : 'Practice'}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 text-center" style={examRoomBackground(examRoomStatCardBg, 'rgba(255,255,255,0.94)')}>
                <p className="text-xs uppercase tracking-wide text-slate-500">Duration</p>
                <p className="text-lg font-bold text-slate-800 dark:text-slate-100 mt-1">{exam.durationMinutes} min</p>
              </div>
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 text-center" style={examRoomBackground(examRoomStatCardBg, 'rgba(255,255,255,0.94)')}>
                <p className="text-xs uppercase tracking-wide text-slate-500">Questions</p>
                <p className="text-lg font-bold text-slate-800 dark:text-slate-100 mt-1">{allQuestions.length}</p>
              </div>
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 text-center" style={examRoomBackground(examRoomStatCardBg, 'rgba(255,255,255,0.94)')}>
                <p className="text-xs uppercase tracking-wide text-slate-500">Sections</p>
                <p className="text-lg font-bold text-slate-800 dark:text-slate-100 mt-1">{exam.sections?.length || 0}</p>
              </div>
              <div className="rounded-xl border border-blue-100 dark:border-slate-700 bg-blue-50/60 dark:bg-slate-800 p-4 text-center col-span-2 sm:col-span-1" style={examRoomBackground(examRoomStatCardBg, 'rgba(239,246,255,0.94)')}>
                <p className="text-xs uppercase tracking-wide text-blue-600 dark:text-blue-300">Attempts</p>
                <p className="text-sm font-bold text-blue-800 dark:text-blue-100 mt-1">{attemptLimitText}</p>
                {exam.completedAttempts != null && (
                  <p className="text-[11px] text-slate-500 mt-1">{exam.completedAttempts} completed</p>
                )}
              </div>
            </div>
            {(exam.examType === 'OFFICIAL' || attemptLimitReached || allQuestions.length === 0) && (
              <div className={`rounded-xl border p-4 text-sm mb-6 ${
                attemptLimitReached || allQuestions.length === 0
                  ? 'border-red-200 bg-red-50/90 text-red-800 dark:bg-red-950/30 dark:border-red-800 dark:text-red-100'
                  : 'border-amber-200 bg-amber-50/90 text-amber-950 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-100'
              }`}>
                <p className="font-semibold mb-1">
                  {attemptLimitReached ? 'Attempt limit reached' : allQuestions.length === 0 ? 'Exam is not ready' : 'Official exam'}
                </p>
                <p className="text-xs leading-relaxed opacity-90">
                  {attemptLimitReached
                    ? 'You have used all allowed attempts for this exam.'
                    : allQuestions.length === 0
                      ? 'This paper has no questions yet. Please contact your teacher.'
                      : 'You can complete this exam only once unless your teacher increases the attempt limit.'}
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4" style={examRoomBackground(examRoomPanelBg, 'rgba(255,255,255,0.93)')}>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">Exam structure</p>
                <div className="space-y-2 max-h-44 overflow-auto pr-1">
                  {(exam.sections || []).map((s) => (
                    <div key={s.id} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800">
                      <div className="min-w-0">
                        <span className="block truncate font-semibold text-slate-700 dark:text-slate-200">{s.name}</span>
                        <span className="text-[11px] uppercase tracking-wide text-slate-400">{s.sectionType || 'SECTION'}</span>
                      </div>
                      <span className="shrink-0 text-right text-xs text-slate-500">
                        {(s.questions || []).length} q
                        <span className="block">{Math.max(1, Math.round(((s.questions || []).length / Math.max(1, allQuestions.length)) * (exam.durationMinutes || 0)))} min</span>
                      </span>
                    </div>
                  ))}
                  {(!exam.sections || exam.sections.length === 0) && (
                    <p className="text-xs text-slate-400">No sections found.</p>
                  )}
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4" style={examRoomBackground(examRoomPanelBg, 'rgba(255,255,255,0.93)')}>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">Waiting room</p>
                <div className="space-y-3">
                  <WaitingCheck
                    label="Connection"
                    detail={isOnline ? 'Browser reports an active connection.' : 'Reconnect before starting.'}
                    ok={isOnline}
                  />
                  <WaitingCheck
                    label="Microphone"
                    detail={hasSpeakingQuestions ? 'Required for speaking answers.' : 'This paper has no speaking section.'}
                    ok={micReady}
                    waiting={!hasSpeakingQuestions}
                    action={hasSpeakingQuestions && (
                      <button
                        type="button"
                        onClick={checkMicrophone}
                        disabled={micStatus === 'checking'}
                        className="rounded-lg bg-white px-3 py-2 text-xs font-bold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-60 dark:bg-slate-900 dark:text-slate-100 dark:ring-slate-700"
                      >
                        {micStatus === 'checking' ? 'Checking...' : micStatus === 'ok' ? 'Check again' : 'Check microphone'}
                      </button>
                    )}
                  />
                  <WaitingCheck
                    label="Audio"
                    detail={hasAudioQuestions ? 'Required for listening prompts.' : 'No listening audio detected.'}
                    ok={audioReady}
                    waiting={!hasAudioQuestions}
                    action={hasAudioQuestions && (
                      <label className="inline-flex items-center gap-2 text-xs font-bold">
                        <input
                          type="checkbox"
                          checked={audioChecked}
                          onChange={(e) => setAudioChecked(e.target.checked)}
                          className="h-4 w-4 accent-blue-600"
                        />
                        Headphones or speakers are ready
                      </label>
                    )}
                  />
                  <label className={`flex items-start gap-3 rounded-xl border p-4 text-sm ${statusTone(rulesAccepted)}`}>
                    <input
                      type="checkbox"
                      checked={rulesAccepted}
                      onChange={(e) => setRulesAccepted(e.target.checked)}
                      className="mt-0.5 h-4 w-4 accent-blue-600"
                    />
                    <span>
                      <span className="block font-bold">Exam rules</span>
                      <span className="mt-1 block text-xs opacity-80">
                        I will keep this tab active, avoid copy/paste, and submit only my own work.
                      </span>
                    </span>
                  </label>
                </div>
              </div>
            </div>

            <div className="text-xs text-slate-500 mb-4 text-center">
              Total questions from sections: {sectionQuestionCount(exam.sections)}
            </div>
            {!preflightReady && canStartExam && (
              <p className="mb-3 text-center text-xs font-semibold text-amber-700 dark:text-amber-300">
                Complete all required checks to unlock the exam.
              </p>
            )}
            <Button variant="primary" size="lg" onClick={startExam} className="w-full" disabled={!readyToStartExam}>
              {exam.hasInProgressSubmission ? 'Resume Exam' : 'Start Exam'}
            </Button>
          </div>
        </div>
      ) : (
        /* ─── Exam body ──────────────────────────────────────────── */
        <div className="space-y-4 p-4 sm:p-6">
          <QuestionStrip
            questions={allQuestions}
            answers={answers}
            current={currentQ}
            onSelect={selectQuestion}
            disabled={interactionLocked}
          />
          <div className="flex gap-6">
          <QuestionNav
            questions={allQuestions}
            answers={answers}
            current={currentQ}
            onSelect={selectQuestion}
            disabled={interactionLocked}
          />

          <div className="flex-1 space-y-4">
            {pageMode === 'one' && pagedQuestion ? (
              <div className="space-y-4">
                <QuestionBlock
                  question={pagedQuestion}
                  value={answers[pagedQuestion.id]}
                  onChange={(v) => saveAnswer(pagedQuestion.id, v)}
                  toast={toast}
                  interactionLocked={interactionLocked}
                  submissionId={submission?.id}
                />
                <div className="flex justify-between gap-3">
                  <Button
                    variant="secondary"
                    disabled={interactionLocked || pageIndex <= 0}
                    onClick={() => setPageIndex((i) => Math.max(0, i - 1))}
                  >
                    &larr; Previous
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={interactionLocked || pageIndex >= allQuestions.length - 1}
                    onClick={() => setPageIndex((i) => Math.min(allQuestions.length - 1, i + 1))}
                  >
                    Next &rarr;
                  </Button>
                </div>
              </div>
            ) : (
              exam.sections?.map((section) => (
                <section key={section.id} className="scroll-mt-28">
                  <div className="mb-3">
                    <h2 className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                      {section.name}
                    </h2>
                    <p className="text-[11px] uppercase tracking-wide text-slate-400">
                      {section.sectionType || 'SECTION'} - {(section.questions || []).length} question{(section.questions || []).length === 1 ? '' : 's'}
                    </p>
                  </div>
                  <div className="space-y-4">
                    {section.questions?.map((q) => (
                      <div key={q.id} id={`q-${q.id}`} className="scroll-mt-32" onClick={() => setCurrentQ(q.id)} role="presentation">
                        <QuestionBlock
                          question={q}
                          value={answers[q.id]}
                          onChange={(v) => saveAnswer(q.id, v)}
                          toast={toast}
                          interactionLocked={interactionLocked}
                          submissionId={submission?.id}
                        />
                      </div>
                    ))}
                  </div>
                </section>
              ))
            )}
          </div>
          </div>
        </div>
      )}

      {/* ─── Confirm modal ──────────────────────────────────────────── */}
      <Modal isOpen={confirmOpen} onClose={() => setConfirmOpen(false)} title="Submit Exam?">
        <p className="text-slate-600 dark:text-slate-300 text-sm">
          You have answered <strong>{answeredCount}</strong> of <strong>{allQuestions.length}</strong> questions.
          You must answer at least <strong>{minRequiredToSubmit}</strong>. Submitting is final.
        </p>
        <div className="flex gap-3 justify-end mt-6">
          <Button variant="secondary" onClick={() => setConfirmOpen(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => doSubmit()} loading={submitting} disabled={!canSubmitByProgress}>
            Submit Exam
          </Button>
        </div>
      </Modal>
    </div>
  );
}
