import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { studentExamApi, speakingApi } from '../services/api';
import { useToast } from '../context/ToastContext';
import Modal from '../components/common/Modal';
import Button from '../components/common/Button';
import ExamTimer from '../components/ExamTimer';
import { QuestionBlock } from '../features/exam/components/QuestionControls';
import { QuestionNav, QuestionStrip } from '../features/exam/components/QuestionNavigation';
import { WaitingCheck } from '../features/exam/components/WaitingCheck';
import {
  clearLocalDraft,
  deleteSpeakingDraftBlob,
  draftKeyFor,
  examRoomBackground,
  hasAnyAudioPrompt,
  hasAnyQuestion,
  initialAnalytics,
  isAnswered,
  readLocalDraft,
  resolveSubmissionStartEpochMs,
  restoreSpeakingDraftBlobs,
  saveSpeakingDraftBlob,
  sectionQuestionCount,
  serializeDraftAnswers,
  statusTone,
} from '../features/exam/examUtils';
import examRoomMainBg from '../assets/exam/backgrounds/exam-room-main-bg.jpg';
import examRoomStatCardBg from '../assets/exam/backgrounds/exam-room-stat-card-bg.jpg';
import examRoomPanelBg from '../assets/exam/backgrounds/exam-room-panel-bg.jpg';

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
    const payload = entries.map(([qId, data]) => ({
      submissionId: submission.id,
      questionId: parseInt(qId, 10),
      answerText: data.answerText ?? undefined,
      selectedOptionId: data.selectedOptionId ?? undefined,
      speakingAudioUrl: data.speakingAudioUrl ?? undefined,
      speakingDurationSeconds: data.speakingDurationSeconds ?? undefined,
      speakingFormat: data.speakingFormat ?? undefined,
      imageUrl: data.imageUrl ?? undefined,
    }));
    try {
      if (payload.length > 0) {
        await studentExamApi.saveAnswersBatch(payload);
      }
    } catch {
      setSaveState('error');
      throw new Error('Could not save answers. Please retry before submitting.');
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

    // Cancel pending debounced saves before the final flush.
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
