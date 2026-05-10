import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { studentExamApi, speakingApi, aiApi, API_ORIGIN } from '../services/api';
import { useToast } from '../context/ToastContext';
import Modal from '../components/common/Modal';
import Button from '../components/common/Button';
import ExamTimer from '../components/ExamTimer';
import AudioPlayer from '../../../packages/ui/AudioPlayer.jsx';
import SpeakingRecorder from '../components/exam/SpeakingRecorder.jsx';

function resolveAudioSrc(url) {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('blob:')) return url;
  return `${API_ORIGIN}${url.startsWith('/') ? '' : '/'}${url}`;
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

/* ─── Question navigation sidebar ──────────────────────────────────────── */
function QuestionNav({ questions, answers, current, onSelect }) {
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
                aria-label={`Question ${idx + 1}${answered ? ' (answered)' : ''}`}
                aria-current={isCurrent ? 'step' : undefined}
                className={`w-8 h-8 rounded-lg text-xs font-bold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                  isCurrent
                    ? 'bg-blue-600 text-white ring-2 ring-blue-400 ring-offset-1 dark:ring-offset-slate-900'
                    : answered
                      ? 'bg-green-500 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-blue-600 dark:bg-slate-800 dark:text-slate-300'
                }`}
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
function MCQuestion({ question, value, onChange }) {
  return (
    <div className="space-y-2" role="radiogroup" aria-label="Answer options">
      {question.options?.map((opt) => (
        <label
          key={opt.id}
          className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all focus-within:ring-2 focus-within:ring-blue-400 ${
            value?.selectedOptionId === opt.id
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-400'
              : 'border-slate-200 hover:border-blue-300 bg-white dark:bg-slate-800 dark:border-slate-600'
          }`}
        >
          <input
            type="radio"
            name={`q-${question.id}`}
            checked={value?.selectedOptionId === opt.id}
            onChange={() => onChange({ selectedOptionId: opt.id })}
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
          <AudioPlayer src={promptSrc} disabled={interactionLocked} className="max-w-md" />
        </div>
      )}
      <p className="text-slate-800 dark:text-slate-100 font-medium mb-4">{question.questionText}</p>
      <p className="text-xs text-slate-400 mb-4">
        {question.points} pt{question.points !== 1 ? 's' : ''}
      </p>
      {(type === 'MULTIPLE_CHOICE' || type === 'LISTENING') && (
        <MCQuestion question={question} value={value} onChange={onChange} />
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
  const timerExpireRef = useRef(false);
  const saveRef = useRef(null);
  const submittingRef = useRef(false);
  const analyticsRef = useRef(initialAnalytics());
  const lastWarningAtRef = useRef(0);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('exam_dark', dark ? '1' : '0');
  }, [dark]);

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

  /* ─── Start / Resume exam ──────────────────────────────────────────── */
  const startExam = async () => {
    try {
      const res = await studentExamApi.start(id);
      const sub = res.data?.data;
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
          if (Object.keys(restored).length > 0) {
            setAnswers(restored);
            toast.info(`Restored ${Object.keys(restored).length} saved answer(s).`);
          }
        } catch {
          // Non-critical: continue without restored answers
        }
      }
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to start exam.');
    }
  };

  /* ─── Save answer (debounced) ──────────────────────────────────────── */
  const persistAnswer = useCallback(
    (questionId, data) => {
      if (!submission) return;
      if (data?.speakingBlob instanceof Blob && !data?.speakingAudioUrl) {
        // Keep local speaking audio in memory; upload only when student submits.
        return;
      }
      studentExamApi
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
        .catch(() => {});
    },
    [submission]
  );

  const saveAnswer = useCallback(
    (questionId, data) => {
      let mergedSlice;
      setAnswers((prev) => {
        mergedSlice = { ...(prev[questionId] || {}), ...data };
        return { ...prev, [questionId]: mergedSlice };
      });
      if (saveRef.current) clearTimeout(saveRef.current);
      saveRef.current = setTimeout(() => persistAnswer(questionId, mergedSlice), 600);
    },
    [persistAnswer]
  );

  useEffect(
    () => () => {
      if (saveRef.current) clearTimeout(saveRef.current);
    },
    []
  );

  /* ─── Flush all unsaved + submit ───────────────────────────────────── */
  const flushAnswers = useCallback(async (answerSnapshot) => {
    if (!submission) return;
    const entries = Object.entries(answerSnapshot).filter(([, data]) => data);
    await Promise.allSettled(
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
  }, [submission]);

  const uploadSpeakingBeforeSubmit = useCallback(async (answerSnapshot) => {
    if (!submission) return answerSnapshot;
    const next = { ...answerSnapshot };
    for (const q of allQuestions) {
      const type = (q?.questionType || '').toUpperCase();
      if (type !== 'SPEAKING') continue;
      const answer = next[q.id];
      if (!answer || !(answer.speakingBlob instanceof Blob)) continue;

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
    }
    return next;
  }, [allQuestions, submission]);

  const doSubmit = useCallback(async (force = false) => {
    if (!submission || submittingRef.current) return;

    // Cancel any pending debounced save before flushing (Bug fix: LOW-05)
    if (saveRef.current) {
      clearTimeout(saveRef.current);
      saveRef.current = null;
    }

    const requiredAnswers = Math.ceil(allQuestions.length * 0.5);
    if (!force && answeredCount < requiredAnswers) {
      toast.warning(`You need at least ${requiredAnswers}/${allQuestions.length} answered before submitting.`);
      setConfirmOpen(false);
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    try {
      let answerSnapshot = { ...answers };
      answerSnapshot = await uploadSpeakingBeforeSubmit(answerSnapshot);
      setAnswers(answerSnapshot);
      await flushAnswers(answerSnapshot);
      let clientTimeSpentSeconds;
      if (submission.startTime) {
        clientTimeSpentSeconds = Math.max(
          0,
          Math.floor((Date.now() - new Date(submission.startTime).getTime()) / 1000)
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
      navigate(`/result/${submission.id}`);
    } catch (e) {
      toast.error(e?.response?.data?.message || e?.message || 'Submission failed. Please try again.');
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
      setConfirmOpen(false);
    }
  }, [submission, allQuestions.length, answeredCount, answers, flushAnswers, uploadSpeakingBeforeSubmit, navigate, toast]);

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
              onClick={() => {
                setPageMode((m) => (m === 'all' ? 'one' : 'all'));
                setPageIndex(allQuestions.findIndex((q) => q.id === currentQ) || 0);
              }}
              className="text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
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
        <div className="flex items-center justify-center py-20 px-4">
          <div className="card max-w-3xl w-full dark:bg-slate-900 dark:border-slate-700">
            <div className="w-16 h-16 rounded-full bg-blue-50 dark:bg-slate-800 flex items-center justify-center text-blue-500 mx-auto mb-4">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414A1 1 0 0119 9.414V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 text-center mb-2">{exam.title}</h2>
            <p className="text-slate-500 dark:text-slate-300 text-sm text-center mb-6">{exam.description || 'No description.'}</p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 text-center">
                <p className="text-xs uppercase tracking-wide text-slate-500">Exam type</p>
                <p className="text-lg font-bold text-slate-800 dark:text-slate-100 mt-1">
                  {exam.examType === 'OFFICIAL' ? 'Official' : 'Practice'}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 text-center">
                <p className="text-xs uppercase tracking-wide text-slate-500">Duration</p>
                <p className="text-lg font-bold text-slate-800 dark:text-slate-100 mt-1">{exam.durationMinutes} min</p>
              </div>
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 text-center">
                <p className="text-xs uppercase tracking-wide text-slate-500">Questions</p>
                <p className="text-lg font-bold text-slate-800 dark:text-slate-100 mt-1">{allQuestions.length}</p>
              </div>
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 text-center col-span-2 sm:col-span-1">
                <p className="text-xs uppercase tracking-wide text-slate-500">Sections</p>
                <p className="text-lg font-bold text-slate-800 dark:text-slate-100 mt-1">{exam.sections?.length || 0}</p>
              </div>
            </div>
            {exam.examType === 'OFFICIAL' && (
              <div className="rounded-xl border border-amber-200 bg-amber-50/90 dark:bg-amber-950/30 dark:border-amber-800 p-4 text-sm text-amber-950 dark:text-amber-100 mb-6">
                <p className="font-semibold mb-1">Official exam</p>
                <p className="text-xs leading-relaxed opacity-90">
                  You can complete this exam only once. If you already submitted it, you cannot start again.
                  If you disconnected, resume your in-progress session from the submissions list.
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">Exam structure</p>
                <div className="space-y-2 max-h-44 overflow-auto pr-1">
                  {(exam.sections || []).map((s) => (
                    <div key={s.id} className="flex items-center justify-between text-sm">
                      <span className="text-slate-600 dark:text-slate-300 truncate">{s.name}</span>
                      <span className="text-slate-500 text-xs">{(s.questions || []).length} q</span>
                    </div>
                  ))}
                  {(!exam.sections || exam.sections.length === 0) && (
                    <p className="text-xs text-slate-400">No sections found.</p>
                  )}
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">Before you start</p>
                <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-300 list-disc pl-4">
                  <li>Keep a stable internet connection.</li>
                  <li>Use headphones for listening and speaking sections.</li>
                  <li>Allow microphone access for speaking answers (stored as MP3).</li>
                  <li>You must answer at least 50% of questions before you can submit.</li>
                </ul>
              </div>
            </div>

            <div className="text-xs text-slate-500 mb-4 text-center">
              Total questions from sections: {sectionQuestionCount(exam.sections)}
            </div>
            <Button variant="primary" size="lg" onClick={startExam} className="w-full">
              Start Exam
            </Button>
          </div>
        </div>
      ) : (
        /* ─── Exam body ──────────────────────────────────────────── */
        <div className="flex gap-6 p-6">
          <QuestionNav
            questions={allQuestions}
            answers={answers}
            current={currentQ}
            onSelect={(qid, idx) => {
              setCurrentQ(qid);
              setPageIndex(idx);
            }}
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
                    disabled={pageIndex <= 0}
                    onClick={() => setPageIndex((i) => Math.max(0, i - 1))}
                  >
                    &larr; Previous
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={pageIndex >= allQuestions.length - 1}
                    onClick={() => setPageIndex((i) => Math.min(allQuestions.length - 1, i + 1))}
                  >
                    Next &rarr;
                  </Button>
                </div>
              </div>
            ) : (
              exam.sections?.map((section) => (
                <div key={section.id}>
                  <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                    {section.name}
                  </h2>
                  <div className="space-y-4">
                    {section.questions?.map((q) => (
                      <div key={q.id} id={`q-${q.id}`} onClick={() => setCurrentQ(q.id)} role="presentation">
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
                </div>
              ))
            )}
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
