import { useState, useEffect } from 'react';
import { examApi, submissionApi, scoreApi, writingReviewApi, speakingReviewApi } from '../services/api';
import Layout from '../components/Layout';
import Badge from '../components/common/Badge';
import Button from '../components/common/Button';
import Modal from '../components/common/Modal';
import ConfirmDialog from '../components/common/ConfirmDialog';
import EmptyState from '../components/common/EmptyState';
import { PageLoader } from '../components/common/LoadingSpinner';
import SpeakingAudioPlayer from '../components/SpeakingAudioPlayer.jsx';
import { useToast } from '../context/ToastContext';
import {
  Badge as UiBadge,
  Button as UiButton,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Progress,
} from '../components/ui/shadcn';

function formatDurationSeconds(sec) {
  if (sec == null || Number.isNaN(sec)) return '-';
  const n = Math.max(0, Math.floor(sec));
  const m = Math.floor(n / 60);
  const s = n % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s}s`;
}

function speakingAnswers(list) {
  return (list || []).filter((a) => {
    const t = (a.questionType || '').toUpperCase();
    if (t !== 'SPEAKING') return false;
    const u = a.speakingAudioUrl;
    return typeof u === 'string' && u.length > 0;
  });
}

function writingAnswers(list) {
  return (list || []).filter((a) => {
    const t = (a.questionType || '').toUpperCase();
    return t === 'WRITING' && typeof a.answerText === 'string' && a.answerText.trim().length > 0;
  });
}

function objectiveAnswers(list) {
  return (list || []).filter((a) => {
    const t = (a.questionType || '').toUpperCase();
    return t === 'MULTIPLE_CHOICE' || t === 'LISTENING';
  });
}

function totalSpeakingSeconds(list) {
  return speakingAnswers(list).reduce((sum, a) => sum + (a.speakingDurationSeconds || 0), 0);
}

function formatCompletion(submission) {
  const pct = submission.completionPercent;
  const answered = submission.answeredQuestions;
  const total = submission.totalQuestions;
  if (pct != null && total != null && answered != null) return `${pct}% (${answered}/${total})`;
  if (pct != null) return `${pct}%`;
  return 'N/A';
}

function formatSuspicious(submission) {
  const total = Number(submission.suspiciousEventCount || 0);
  const tab = Number(submission.tabSwitchCount || 0);
  const focus = Number(submission.focusLossCount || 0);
  const cp = Number(submission.copyPasteCount || 0);
  const base = `${total} evt`;
  if (total <= 0) return base;
  return `${base} (tab ${tab}, focus ${focus}, copy/paste ${cp})`;
}

async function downloadSpeakingClip(submissionId, answerId) {
  const res = await submissionApi.downloadSpeaking(submissionId, answerId);
  const blob = res.data;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `speaking-${submissionId}-${answerId}.mp3`;
  a.click();
  URL.revokeObjectURL(url);
}

function ReviewBadge({ status }) {
  const published = status === 'PUBLISHED';
  return (
    <UiBadge variant={published ? 'success' : 'warning'}>
      {published ? 'Published' : 'Draft / pending'}
    </UiBadge>
  );
}

function MetricTile({ label, value, tone = 'slate' }) {
  const tones = {
    blue: 'bg-sky-50 text-sky-800 border-sky-100',
    emerald: 'bg-emerald-50 text-emerald-800 border-emerald-100',
    violet: 'bg-violet-50 text-violet-800 border-violet-100',
    amber: 'bg-amber-50 text-amber-800 border-amber-100',
    slate: 'bg-slate-50 text-slate-800 border-slate-100',
  };
  return (
    <div className={`rounded-lg border px-3 py-2.5 ${tones[tone] || tones.slate}`}>
      <p className="text-[11px] font-medium uppercase tracking-normal opacity-70">{label}</p>
      <p className="mt-1 text-xl font-semibold tracking-normal">{value ?? '-'}</p>
    </div>
  );
}

function ReviewButton({ children, onClick, disabled, tone = 'blue' }) {
  const variants = {
    blue: 'outline',
    emerald: 'outline',
    violet: 'secondary',
    amber: 'outline',
  };
  return (
    <UiButton
      type="button"
      variant={variants[tone] || 'outline'}
      size="sm"
      className={tone === 'amber' ? 'border-amber-200 text-amber-700 hover:bg-amber-50' : ''}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </UiButton>
  );
}

function TextBlock({ title, children, tone = 'slate', tall = false }) {
  if (!children) return null;
  const tones = {
    slate: 'border-slate-200 bg-white text-slate-700',
    sky: 'border-sky-200 bg-sky-50 text-slate-700',
    emerald: 'border-emerald-200 bg-emerald-50 text-slate-700',
    violet: 'border-violet-200 bg-violet-50 text-slate-700',
  };
  return (
    <div className={`rounded-lg border p-3 ${tones[tone] || tones.slate}`}>
      <p className="text-[11px] font-semibold uppercase tracking-normal text-slate-500">{title}</p>
      <p className={`mt-2 text-sm leading-relaxed whitespace-pre-line ${tall ? 'max-h-56 overflow-y-auto pr-1' : ''}`}>
        {children}
      </p>
    </div>
  );
}

function SectionHeader({ title, count }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <h4 className="text-sm font-semibold text-slate-950">{title}</h4>
        <p className="text-xs text-slate-500">{count} answer{count === 1 ? '' : 's'}</p>
      </div>
    </div>
  );
}

function ReviewShell({ answer, type, status, children, controls }) {
  return (
    <Card className="overflow-hidden">
      <div className="grid min-h-[360px] xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4 p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <UiBadge variant="outline">{type} - Question #{answer.questionId}</UiBadge>
              <p className="mt-3 text-sm font-medium leading-relaxed text-slate-950">{answer.questionText || '-'}</p>
            </div>
            <ReviewBadge status={status} />
          </div>
          {children}
        </div>
        <aside className="border-t border-slate-200 bg-slate-50 p-4 xl:border-l xl:border-t-0">
          {controls}
        </aside>
      </div>
    </Card>
  );
}

function ScoreDetailModal({ submission, onClose }) {
  const [score, setScore] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generatingAnswerId, setGeneratingAnswerId] = useState(null);
  const [generatingAllReviews, setGeneratingAllReviews] = useState(false);
  const [savingAnswerId, setSavingAnswerId] = useState(null);
  const [publishingAnswerId, setPublishingAnswerId] = useState(null);
  const [editingAnswerId, setEditingAnswerId] = useState(null);
  const [customPromptByAnswer, setCustomPromptByAnswer] = useState({});
  const [draftByAnswer, setDraftByAnswer] = useState({});
  const [speakingGeneratingAnswerId, setSpeakingGeneratingAnswerId] = useState(null);
  const [speakingSavingAnswerId, setSpeakingSavingAnswerId] = useState(null);
  const [speakingPublishingAnswerId, setSpeakingPublishingAnswerId] = useState(null);
  const [speakingRevertingAnswerId, setSpeakingRevertingAnswerId] = useState(null);
  const [writingRevertingAnswerId, setWritingRevertingAnswerId] = useState(null);
  const [speakingEditingAnswerId, setSpeakingEditingAnswerId] = useState(null);
  const [speakingCustomPromptByAnswer, setSpeakingCustomPromptByAnswer] = useState({});
  const [speakingDraftByAnswer, setSpeakingDraftByAnswer] = useState({});
  const toast = useToast();

  // Confirm dialog state (replaces window.confirm)
  const [confirmState, setConfirmState] = useState({ isOpen: false, title: '', message: '', onConfirm: null, variant: 'primary' });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [scoreRes, ansRes] = await Promise.all([
          scoreApi.getBySubmissionId(submission.id),
          submissionApi.getAnswers(submission.id),
        ]);
        if (!cancelled) {
          setScore(scoreRes.data?.data ?? null);
          setAnswers(ansRes.data?.data ?? []);
        }
      } catch {
        if (!cancelled) {
          setScore(null);
          setAnswers([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [submission.id]);

  const mergeWritingReview = (answerId, review) => {
    setAnswers((prev) => prev.map((a) => (a.id !== answerId ? a : ({
      ...a,
      writingReviewStatus: review?.status ?? a.writingReviewStatus,
      writingDraftScore: review?.draftScore ?? a.writingDraftScore,
      writingDraftFeedback: review?.draftFeedback ?? a.writingDraftFeedback,
      writingPublishedScore: review?.publishedScore ?? a.writingPublishedScore,
      writingPublishedFeedback: review?.publishedFeedback ?? a.writingPublishedFeedback,
      writingPublishedAt: review?.publishedAt ?? a.writingPublishedAt,
    }))));
  };

  const mergeSpeakingReview = (answerId, review) => {
    setAnswers((prev) => prev.map((a) => (a.id !== answerId ? a : ({
      ...a,
      speakingReviewStatus: review?.status ?? a.speakingReviewStatus,
      speakingDraftScore: review?.draftScore ?? a.speakingDraftScore,
      speakingDraftFeedback: review?.draftFeedback ?? a.speakingDraftFeedback,
      speakingDraftTranscript: review?.draftTranscript ?? a.speakingDraftTranscript,
      speakingPublishedScore: review?.publishedScore ?? a.speakingPublishedScore,
      speakingPublishedFeedback: review?.publishedFeedback ?? a.speakingPublishedFeedback,
      speakingPublishedTranscript: review?.publishedTranscript ?? a.speakingPublishedTranscript,
      speakingPublishedAt: review?.publishedAt ?? a.speakingPublishedAt,
    }))));
  };

  const refreshScore = async () => {
    try {
      const latestScore = await scoreApi.getBySubmissionId(submission.id);
      setScore(latestScore.data?.data ?? score);
    } catch {
      // no-op
    }
  };

  const generateDraftReview = async (answer) => {
    if (!answer?.id) return;
    try {
      setGeneratingAnswerId(answer.id);
      const customPrompt = customPromptByAnswer[answer.id] || undefined;
      const res = await writingReviewApi.generateDraft(answer.id, customPrompt);
      mergeWritingReview(answer.id, res.data?.data);
      toast.success('Draft AI review generated.');
      await refreshScore();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Generate AI review failed.');
    } finally {
      setGeneratingAnswerId(null);
    }
  };

  const generateAllDraftReviews = async () => {
    const writing = writingAnswers(answers);
    const speaking = speakingAnswers(answers);
    if (writing.length === 0 && speaking.length === 0) return;

    try {
      setGeneratingAllReviews(true);
      // Keep it sequential to avoid API rate limit spikes.
      for (const a of writing) {
        const customPrompt = customPromptByAnswer[a.id] || undefined;
        const res = await writingReviewApi.generateDraft(a.id, customPrompt);
        mergeWritingReview(a.id, res.data?.data);
      }
      for (const a of speaking) {
        const customPrompt = speakingCustomPromptByAnswer[a.id] || undefined;
        const res = await speakingReviewApi.generateDraft(a.id, customPrompt, 'en');
        mergeSpeakingReview(a.id, res.data?.data);
      }
      toast.success('Draft AI reviews generated (Writing + Speaking).');
      await refreshScore();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Generate AI reviews failed.');
    } finally {
      setGeneratingAllReviews(false);
    }
  };

  const saveManualDraft = async (answer) => {
    if (!answer?.id) return;
    const draft = draftByAnswer[answer.id] || {};
    const parsedScore = draft.score === '' || draft.score == null ? null : Number(draft.score);
    try {
      setSavingAnswerId(answer.id);
      const res = await writingReviewApi.updateDraft(answer.id, {
        score: Number.isNaN(parsedScore) ? null : parsedScore,
        feedback: draft.feedback ?? null,
      });
      mergeWritingReview(answer.id, res.data?.data);
      setEditingAnswerId(null);
      toast.success('Draft review updated.');
      await refreshScore();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Update review failed.');
    } finally {
      setSavingAnswerId(null);
    }
  };

  const publishReview = async (answer) => {
    if (!answer?.id) return;
    try {
      setPublishingAnswerId(answer.id);
      const res = await writingReviewApi.approvePublish(answer.id);
      mergeWritingReview(answer.id, res.data?.data);
      toast.success('Writing review published.');
      await refreshScore();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Publish review failed.');
    } finally {
      setPublishingAnswerId(null);
    }
  };

  const generateSpeakingDraftReview = async (answer) => {
    if (!answer?.id) return;
    try {
      setSpeakingGeneratingAnswerId(answer.id);
      const customPrompt = speakingCustomPromptByAnswer[answer.id] || undefined;
      const res = await speakingReviewApi.generateDraft(answer.id, customPrompt, 'en');
      mergeSpeakingReview(answer.id, res.data?.data);
      toast.success('Draft AI speaking review generated.');
      await refreshScore();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Generate AI speaking review failed.');
    } finally {
      setSpeakingGeneratingAnswerId(null);
    }
  };

  const saveManualSpeakingDraft = async (answer) => {
    if (!answer?.id) return;
    const draft = speakingDraftByAnswer[answer.id] || {};
    const parsedScore = draft.score === '' || draft.score == null ? null : Number(draft.score);
    try {
      setSpeakingSavingAnswerId(answer.id);
      const res = await speakingReviewApi.updateDraft(answer.id, {
        score: Number.isNaN(parsedScore) ? null : parsedScore,
        feedback: draft.feedback ?? null,
        transcript: draft.transcript ?? null,
      });
      mergeSpeakingReview(answer.id, res.data?.data);
      setSpeakingEditingAnswerId(null);
      toast.success('Draft speaking review updated.');
      await refreshScore();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Update speaking review failed.');
    } finally {
      setSpeakingSavingAnswerId(null);
    }
  };

  const publishSpeakingReview = async (answer) => {
    if (!answer?.id) return;
    try {
      setSpeakingPublishingAnswerId(answer.id);
      const res = await speakingReviewApi.approvePublish(answer.id);
      mergeSpeakingReview(answer.id, res.data?.data);
      toast.success('Speaking review published.');
      await refreshScore();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Publish speaking review failed.');
    } finally {
      setSpeakingPublishingAnswerId(null);
    }
  };

  const revertSpeakingReview = async (answer) => {
    if (!answer?.id) return;
    setConfirmState({
      isOpen: true,
      title: 'Revert Speaking Review',
      message: 'Move this speaking review back to draft? Students will no longer see the published score.',
      variant: 'danger',
      onConfirm: async () => {
        setConfirmState((s) => ({ ...s, isOpen: false }));
        try {
          setSpeakingRevertingAnswerId(answer.id);
          const res = await speakingReviewApi.revertDraft(answer.id);
          mergeSpeakingReview(answer.id, res.data?.data);
          toast.success('Speaking review set to draft.');
          await refreshScore();
        } catch (err) {
          toast.error(err?.response?.data?.message || 'Revert speaking review failed.');
        } finally {
          setSpeakingRevertingAnswerId(null);
        }
      },
    });
  };

  const revertWritingReview = async (answer) => {
    if (!answer?.id) return;
    setConfirmState({
      isOpen: true,
      title: 'Revert Writing Review',
      message: 'Move this writing review back to draft? Students will no longer see the published score.',
      variant: 'danger',
      onConfirm: async () => {
        setConfirmState((s) => ({ ...s, isOpen: false }));
        try {
          setWritingRevertingAnswerId(answer.id);
          const res = await writingReviewApi.revertDraft(answer.id);
          mergeWritingReview(answer.id, res.data?.data);
          toast.success('Writing review set to draft.');
          await refreshScore();
        } catch (err) {
          toast.error(err?.response?.data?.message || 'Revert writing review failed.');
        } finally {
          setWritingRevertingAnswerId(null);
        }
      },
    });
  };

  const writingList = writingAnswers(answers);
  const speakingList = speakingAnswers(answers);
  const objectiveList = objectiveAnswers(answers);
  const subjectiveCount = writingList.length + speakingList.length;
  const completionValue = Number(submission.completionPercent || 0);

  return (
    <Modal isOpen onClose={onClose} title={`Review - ${submission.studentName || `Student #${submission.studentId}`}`} maxWidth="max-w-6xl">
      {loading ? <PageLoader /> : !score ? (
        <p className="text-slate-400 text-sm">Score not yet available for this submission.</p>
      ) : (
        <div className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <UiBadge variant="outline">AI review workspace</UiBadge>
                <h3 className="mt-3 text-2xl font-semibold tracking-normal text-slate-950">
                  {submission.examTitle || `Submission #${submission.id}`}
                </h3>
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                  <span>Started: {submission.startTime ? new Date(submission.startTime).toLocaleString() : '-'}</span>
                  <span>Ended: {submission.endTime ? new Date(submission.endTime).toLocaleString() : (submission.submitTime ? new Date(submission.submitTime).toLocaleString() : '-')}</span>
                  <span>Time: {formatDurationSeconds(submission.durationSeconds)}</span>
                </div>
              </div>
              <ReviewButton
                tone="violet"
                disabled={generatingAllReviews || subjectiveCount === 0}
                onClick={generateAllDraftReviews}
              >
                {generatingAllReviews ? 'Generating reviews...' : 'Generate all AI reviews'}
              </ReviewButton>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { label: 'Total', value: score.totalScore, tone: 'blue' },
              { label: 'MC / auto', value: score.mcScore, tone: 'slate' },
              { label: 'Writing', value: score.writingScore, tone: 'violet' },
              { label: 'Speaking', value: score.speakingScore, tone: 'emerald' },
            ].filter((x) => x.value != null).map((item) => (
              <MetricTile key={item.label} label={item.label} value={item.value} tone={item.tone} />
            ))}
          </div>

          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_280px]">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle>Completion</CardTitle>
                <CardDescription>{formatCompletion(submission)}</CardDescription>
              </CardHeader>
              <CardContent>
                <Progress value={completionValue} indicatorClassName="bg-emerald-600" />
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-500 sm:grid-cols-4">
                  <span>Objective: {objectiveList.length}</span>
                  <span>Writing: {writingList.length}</span>
                  <span>Speaking: {speakingList.length}</span>
                  <span>Warnings: {formatSuspicious(submission)}</span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle>Review Queue</CardTitle>
                <CardDescription>{subjectiveCount} subjective answer{subjectiveCount === 1 ? '' : 's'}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Writing</span>
                  <UiBadge variant={writingList.length > 0 ? 'info' : 'secondary'}>{writingList.length}</UiBadge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Speaking</span>
                  <UiBadge variant={speakingList.length > 0 ? 'success' : 'secondary'}>{speakingList.length}</UiBadge>
                </div>
              </CardContent>
            </Card>
          </div>

          {objectiveList.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Objective Answers</CardTitle>
                <CardDescription>Auto-graded multiple choice and listening answers.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {objectiveList.map((a) => (
                  <div key={a.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <UiBadge variant="outline">{a.questionType || 'N/A'}</UiBadge>
                      <span className="text-xs text-slate-500">Question #{a.questionId}</span>
                    </div>
                    <p className="mt-2 text-sm text-slate-800 whitespace-pre-wrap">{a.questionText || '-'}</p>
                    <p className="mt-2 rounded-md border border-slate-200 bg-white p-2 text-xs text-slate-700">
                      {a.selectedOptionText
                        || (a.selectedOptionId != null ? `Option #${a.selectedOptionId}` : null)
                        || (a.answerText && a.answerText.trim().length > 0 ? a.answerText : 'No answer')}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {speakingList.length > 0 && (
            <section className="space-y-3">
              <SectionHeader title="Speaking review" count={speakingList.length} />
              {speakingList.map((a) => (
                <ReviewShell
                  key={a.id}
                  answer={a}
                  type="Speaking"
                  status={a.speakingReviewStatus}
                  controls={(
                    <div className="space-y-3">
                      <p className="text-sm font-semibold text-slate-950">Review controls</p>
                      <input
                        type="text"
                        placeholder="Optional speaking custom prompt"
                        value={speakingCustomPromptByAnswer[a.id] ?? ''}
                        onChange={(e) => setSpeakingCustomPromptByAnswer((prev) => ({ ...prev, [a.id]: e.target.value }))}
                        className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <ReviewButton tone="emerald" disabled={speakingGeneratingAnswerId === a.id} onClick={() => generateSpeakingDraftReview(a)}>
                          {speakingGeneratingAnswerId === a.id ? 'Generating...' : 'Generate AI'}
                        </ReviewButton>
                        <ReviewButton
                          onClick={() => {
                            setSpeakingEditingAnswerId((prev) => (prev === a.id ? null : a.id));
                            setSpeakingDraftByAnswer((prev) => ({
                              ...prev,
                              [a.id]: {
                                score: a.speakingDraftScore ?? '',
                                feedback: a.speakingDraftFeedback ?? '',
                                transcript: a.speakingDraftTranscript ?? '',
                              },
                            }));
                          }}
                        >
                          Edit draft
                        </ReviewButton>
                        <ReviewButton tone="violet" disabled={speakingPublishingAnswerId === a.id} onClick={() => publishSpeakingReview(a)}>
                          {speakingPublishingAnswerId === a.id ? 'Publishing...' : 'Publish'}
                        </ReviewButton>
                        <ReviewButton tone="amber" disabled={speakingRevertingAnswerId === a.id || a.speakingReviewStatus !== 'PUBLISHED'} onClick={() => revertSpeakingReview(a)}>
                          {speakingRevertingAnswerId === a.id ? 'Reverting...' : 'Move draft'}
                        </ReviewButton>
                      </div>
                      {speakingEditingAnswerId === a.id && (
                        <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-3">
                          <label className="block text-xs font-medium text-slate-500">
                            Draft score
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={speakingDraftByAnswer[a.id]?.score ?? ''}
                              onChange={(e) => setSpeakingDraftByAnswer((prev) => ({ ...prev, [a.id]: { ...prev[a.id], score: e.target.value } }))}
                              className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                            />
                          </label>
                          <label className="block text-xs font-medium text-slate-500">
                            Draft transcript
                            <textarea
                              rows={4}
                              value={speakingDraftByAnswer[a.id]?.transcript ?? ''}
                              onChange={(e) => setSpeakingDraftByAnswer((prev) => ({ ...prev, [a.id]: { ...prev[a.id], transcript: e.target.value } }))}
                              className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                            />
                          </label>
                          <label className="block text-xs font-medium text-slate-500">
                            Draft feedback
                            <textarea
                              rows={5}
                              value={speakingDraftByAnswer[a.id]?.feedback ?? ''}
                              onChange={(e) => setSpeakingDraftByAnswer((prev) => ({ ...prev, [a.id]: { ...prev[a.id], feedback: e.target.value } }))}
                              className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                            />
                          </label>
                          <ReviewButton disabled={speakingSavingAnswerId === a.id} onClick={() => saveManualSpeakingDraft(a)}>
                            {speakingSavingAnswerId === a.id ? 'Saving...' : 'Save draft'}
                          </ReviewButton>
                        </div>
                      )}
                    </div>
                  )}
                >
                  <div className="space-y-3">
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <SpeakingAudioPlayer submissionId={submission.id} answerId={a.id} waveform />
                        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                          <span>{a.speakingDurationSeconds != null ? `${a.speakingDurationSeconds}s` : 'Unknown duration'}</span>
                          <span>{a.speakingFormat || 'mp3'}</span>
                          <button type="button" className="font-bold text-blue-700 hover:underline" onClick={() => downloadSpeakingClip(submission.id, a.id)}>
                            Download MP3
                          </button>
                        </div>
                      </div>
                      <div className="grid gap-3 lg:grid-cols-2">
                        <TextBlock title="Draft transcript" tone="sky" tall>{a.speakingDraftTranscript}</TextBlock>
                        <TextBlock title="Published transcript" tone="emerald" tall>{a.speakingPublishedTranscript}</TextBlock>
                        <TextBlock title={`Draft review${a.speakingDraftScore != null ? ` - ${a.speakingDraftScore}` : ''}`} tone="violet" tall>{a.speakingDraftFeedback}</TextBlock>
                        <TextBlock title={`Published review${a.speakingPublishedScore != null ? ` - ${a.speakingPublishedScore}` : ''}`} tone="emerald" tall>{a.speakingPublishedFeedback}</TextBlock>
                      </div>
                  </div>
                </ReviewShell>
              ))}
            </section>
          )}

          {writingList.length > 0 && (
            <section className="space-y-3">
              <SectionHeader title="Writing review" count={writingList.length} />
              {writingList.map((a) => (
                <ReviewShell
                  key={a.id}
                  answer={a}
                  type="Writing"
                  status={a.writingReviewStatus}
                  controls={(
                    <div className="space-y-3">
                      <p className="text-sm font-semibold text-slate-950">Review controls</p>
                      <input
                        type="text"
                        placeholder="Optional custom prompt"
                        value={customPromptByAnswer[a.id] ?? ''}
                        onChange={(e) => setCustomPromptByAnswer((prev) => ({ ...prev, [a.id]: e.target.value }))}
                        className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <ReviewButton tone="violet" disabled={generatingAnswerId === a.id} onClick={() => generateDraftReview(a)}>
                          {generatingAnswerId === a.id ? 'Generating...' : 'Generate AI'}
                        </ReviewButton>
                        <ReviewButton
                          onClick={() => {
                            setEditingAnswerId((prev) => (prev === a.id ? null : a.id));
                            setDraftByAnswer((prev) => ({
                              ...prev,
                              [a.id]: {
                                score: a.writingDraftScore ?? '',
                                feedback: a.writingDraftFeedback ?? '',
                              },
                            }));
                          }}
                        >
                          Edit draft
                        </ReviewButton>
                        <ReviewButton tone="emerald" disabled={publishingAnswerId === a.id} onClick={() => publishReview(a)}>
                          {publishingAnswerId === a.id ? 'Publishing...' : 'Publish'}
                        </ReviewButton>
                        <ReviewButton tone="amber" disabled={writingRevertingAnswerId === a.id || a.writingReviewStatus !== 'PUBLISHED'} onClick={() => revertWritingReview(a)}>
                          {writingRevertingAnswerId === a.id ? 'Reverting...' : 'Move draft'}
                        </ReviewButton>
                      </div>
                      {editingAnswerId === a.id && (
                        <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-3">
                          <label className="block text-xs font-medium text-slate-500">
                            Draft score
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={draftByAnswer[a.id]?.score ?? ''}
                              onChange={(e) => setDraftByAnswer((prev) => ({ ...prev, [a.id]: { ...prev[a.id], score: e.target.value } }))}
                              className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                            />
                          </label>
                          <label className="block text-xs font-medium text-slate-500">
                            Draft feedback
                            <textarea
                              rows={6}
                              value={draftByAnswer[a.id]?.feedback ?? ''}
                              onChange={(e) => setDraftByAnswer((prev) => ({ ...prev, [a.id]: { ...prev[a.id], feedback: e.target.value } }))}
                              className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                            />
                          </label>
                          <ReviewButton disabled={savingAnswerId === a.id} onClick={() => saveManualDraft(a)}>
                            {savingAnswerId === a.id ? 'Saving...' : 'Save draft'}
                          </ReviewButton>
                        </div>
                      )}
                    </div>
                  )}
                >
                  <div className="space-y-3">
                      <TextBlock title="Student answer" tall>{a.answerText}</TextBlock>
                      <div className="grid gap-3 lg:grid-cols-2">
                        <TextBlock title={`Draft review${a.writingDraftScore != null ? ` - ${a.writingDraftScore}` : ''}`} tone="violet" tall>{a.writingDraftFeedback}</TextBlock>
                        <TextBlock title={`Published review${a.writingPublishedScore != null ? ` - ${a.writingPublishedScore}` : ''}`} tone="emerald" tall>{a.writingPublishedFeedback}</TextBlock>
                      </div>
                  </div>
                </ReviewShell>
              ))}
            </section>
          )}
          {score.feedback && (
            <div className="rounded-lg border border-sky-100 bg-sky-50 p-4">
              <p className="mb-1 text-xs font-semibold uppercase tracking-normal text-sky-700">AI Feedback</p>
              <p className="text-sm text-slate-700">{score.feedback}</p>
            </div>
          )}
        </div>
      )}
      {/* Revert confirmation dialog (replaces window.confirm) */}
      <ConfirmDialog
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        confirmLabel="Revert"
        variant={confirmState.variant}
        onConfirm={confirmState.onConfirm || (() => {})}
        onCancel={() => setConfirmState((s) => ({ ...s, isOpen: false }))}
      />
    </Modal>
  );
}

export default function StudentResults() {
  const [exams, setExams] = useState([]);
  const [selectedExamId, setSelectedExamId] = useState('');
  const [submissions, setSubmissions] = useState([]);
  const [loadedExamId, setLoadedExamId] = useState('');
  const [selectedSub, setSelectedSub] = useState(null);
  const [search, setSearch] = useState('');
  const [answerMap, setAnswerMap] = useState({});
  const [minScore, setMinScore] = useState('');
  const [maxScore, setMaxScore] = useState('');
  const [minSpeakingSec, setMinSpeakingSec] = useState('');
  const toast = useToast();

  // Replaces window.confirm for delete submission
  const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, submissionId: null });

  useEffect(() => {
    examApi.getAll()
      .then((r) => {
        const list = (r.data?.data || []).filter((ex) => ex.canManage !== false);
        setExams(list);
        setSelectedExamId((prev) =>
          prev && list.some((ex) => String(ex.id) === String(prev)) ? prev : ''
        );
      })
      .catch(() => setExams([]));
  }, []);

  useEffect(() => {
    if (!selectedExamId || loadedExamId === selectedExamId) return;
    let cancelled = false;
    submissionApi.getByExamId(parseInt(selectedExamId))
      .then((r) => {
        if (!cancelled) {
          setSubmissions(r.data?.data || []);
          setLoadedExamId(selectedExamId);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setSubmissions([]);
          setLoadedExamId(selectedExamId);
        }
        if (err.response?.status === 403) {
          // Teacher doesn't own this exam - backend enforces ownership
          alert('You do not have permission to view submissions for this exam.');
        }
      })
    return () => { cancelled = true; };
  }, [loadedExamId, selectedExamId]);

  const loadingSubs = Boolean(selectedExamId) && loadedExamId !== selectedExamId;

  useEffect(() => {
    if (!submissions.length) {
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const r = await submissionApi.getAnswersBatch(submissions.map((s) => s.id));
        if (!cancelled) setAnswerMap(r.data?.data || {});
      } catch {
        if (!cancelled) {
          const fallback = {};
          submissions.forEach((s) => { fallback[s.id] = []; });
          setAnswerMap(fallback);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [submissions]);

  const filtered = submissions
    .filter((s) => {
      const name = (s.studentName || `Student #${s.studentId}`).toLowerCase();
      if (!name.includes(search.toLowerCase())) return false;
      if (minScore !== '' && (s.totalScore == null || Number(s.totalScore) < Number(minScore))) return false;
      if (maxScore !== '' && (s.totalScore == null || Number(s.totalScore) > Number(maxScore))) return false;
      if (minSpeakingSec !== '') {
        const sp = totalSpeakingSeconds(answerMap[s.id]);
        if (sp < Number(minSpeakingSec)) return false;
      }
      return true;
    })
    .sort((a, b) => {
      const aTime = new Date(a.endTime || a.submitTime || a.startTime || 0).getTime();
      const bTime = new Date(b.endTime || b.submitTime || b.startTime || 0).getTime();
      return bTime - aTime;
    });

  const selectedExamTitle = exams.find((e) => String(e.id) === String(selectedExamId))?.title || '';

  return (
    <Layout>
      <div className="space-y-5">
        <div className="card !p-4 flex flex-col sm:flex-row gap-3">
          <select
            value={selectedExamId}
            onChange={(e) => setSelectedExamId(e.target.value)}
            className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select an exam...</option>
            {exams.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
          </select>
          {selectedExamId && (
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search students..."
                className="pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          )}
        </div>

        {selectedExamId && (
          <div className="card !p-4 flex flex-wrap gap-3 items-end">
            <label className="text-xs text-slate-500 block">Min score
              <input type="number" value={minScore} onChange={(e) => setMinScore(e.target.value)} placeholder="0"
                className="mt-1 block w-24 px-3 py-2 rounded-lg border border-slate-200 text-sm" />
            </label>
            <label className="text-xs text-slate-500 block">Max score
              <input type="number" value={maxScore} onChange={(e) => setMaxScore(e.target.value)} placeholder="100"
                className="mt-1 block w-24 px-3 py-2 rounded-lg border border-slate-200 text-sm" />
            </label>
            <label className="text-xs text-slate-500 block">Min speaking (sum sec)
              <input type="number" value={minSpeakingSec} onChange={(e) => setMinSpeakingSec(e.target.value)} placeholder="0"
                className="mt-1 block w-28 px-3 py-2 rounded-lg border border-slate-200 text-sm" />
            </label>
          </div>
        )}

        {!selectedExamId ? (
          <EmptyState
            title={exams.length === 0 ? 'No manageable exams' : 'Select an exam'}
            description={
              exams.length === 0
                ? 'You can only view submissions for exams you own.'
                : 'Choose an exam above to view student submissions.'
            }
          />
        ) : loadingSubs ? (
          <PageLoader />
        ) : filtered.length === 0 ? (
          <EmptyState
            title={submissions.length === 0 ? 'No submissions' : 'No matches'}
            description={submissions.length === 0 ? 'No students have submitted this exam yet.' : 'Adjust filters or search.'}
          />
        ) : (
          <div className="card overflow-hidden !p-0">
            <div className="px-4 py-3 border-b border-slate-100">
              <p className="text-sm font-semibold text-slate-700">
                {filtered.length} submission{filtered.length !== 1 ? 's' : ''}
                {selectedExamTitle ? ` - ${selectedExamTitle}` : ''}
              </p>
            </div>
            <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[1200px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Student</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Start</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">End</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Duration</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Completion</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Suspicious</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Speaking</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Score</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-800">{s.studentName || `Student #${s.studentId}`}</td>
                    <td className="px-4 py-3"><Badge status={s.status} label={s.status} /></td>
                    <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">{s.startTime ? new Date(s.startTime).toLocaleString() : '-'}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">{(s.endTime || s.submitTime) ? new Date(s.endTime || s.submitTime).toLocaleString() : '-'}</td>
                    <td className="px-4 py-3 text-slate-600 text-xs whitespace-nowrap">{formatDurationSeconds(s.durationSeconds)}</td>
                    <td className="px-4 py-3 text-slate-600 text-xs whitespace-nowrap">{formatCompletion(s)}</td>
                    <td className="px-4 py-3 text-slate-600 text-xs max-w-[240px]">
                      <span className={`font-semibold ${Number(s.suspiciousEventCount || 0) > 0 ? 'text-amber-700' : 'text-slate-500'}`}>
                        {formatSuspicious(s)}
                      </span>
                      {s.deviceType && (
                        <span className="block text-[11px] text-slate-400 mt-0.5">{s.deviceType}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top">
                      {speakingAnswers(answerMap[s.id]).length === 0 ? (
                        <span className="text-slate-400">-</span>
                      ) : (
                        <div className="flex flex-col gap-2 max-w-[220px]">
                          {speakingAnswers(answerMap[s.id]).map((a) => (
                            <div key={a.id} className="space-y-1 border-b border-slate-50 pb-2 last:border-0">
                              <SpeakingAudioPlayer submissionId={s.id} answerId={a.id} waveform />
                              <button
                                type="button"
                                className="text-xs text-blue-600 hover:underline"
                                onClick={() => downloadSpeakingClip(s.id, a.id)}
                              >
                                Download MP3
                              </button>
                              {a.speakingDurationSeconds != null && (
                                <span className="text-xs text-slate-400 block">{a.speakingDurationSeconds}s</span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center font-bold text-blue-700">{s.totalScore ?? '-'}</td>
                    <td className="px-4 py-3 text-right space-x-1">
                      <Button variant="ghost" size="sm" onClick={() => setSelectedSub(s)}>View</Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600"
                        onClick={() => setDeleteConfirm({ isOpen: true, submissionId: s.id })}
                      >
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        )}
      </div>

      {selectedSub && <ScoreDetailModal submission={selectedSub} onClose={() => setSelectedSub(null)} />}
      {/* Delete submission confirmation */}
      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        title="Delete Submission"
        message="Delete this submission and remove all speaking files from the server?"
        confirmLabel="Delete"
        variant="danger"
        onConfirm={async () => {
          const sid = deleteConfirm.submissionId;
          setDeleteConfirm({ isOpen: false, submissionId: null });
          if (!sid) return;
          try {
            await submissionApi.delete(sid);
            setSubmissions((prev) => prev.filter((x) => x.id !== sid));
            setAnswerMap((prev) => {
              const next = { ...prev };
              delete next[sid];
              return next;
            });
          } catch {
            toast.error('Delete failed.');
          }
        }}
        onCancel={() => setDeleteConfirm({ isOpen: false, submissionId: null })}
      />
    </Layout>
  );
}

