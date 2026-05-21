import { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { scoreApi, studentExamApi, submissionApi, API_ORIGIN } from '../services/api';
import AudioPlayer from '../../../packages/ui/AudioPlayer.jsx';
import SpeakingAudioPlayer from '../components/exam/SpeakingAudioPlayer.jsx';
import { PageLoader } from '../components/common/LoadingSpinner';
import Badge from '../components/common/Badge';

function resolveMediaUrl(url) {
  if (!url || typeof url !== 'string') return '';
  if (/^https?:\/\//i.test(url)) return url;
  return `${API_ORIGIN}${url.startsWith('/') ? '' : '/'}${url}`;
}

const AWAITING_REVIEW =
  'Awaiting teacher review and publication. Your score will appear as N/A until the review is published.';

function formatScore(v) {
  if (v == null || Number.isNaN(v)) return 'N/A';
  return String(Math.round(v * 10) / 10);
}

function numericScore(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function scoreBand(v) {
  const n = numericScore(v);
  if (n == null) return { label: 'Pending', tone: 'slate' };
  if (n >= 75) return { label: 'Strong', tone: 'emerald' };
  if (n >= 50) return { label: 'Practice', tone: 'amber' };
  return { label: 'Needs work', tone: 'rose' };
}

function toneClasses(tone) {
  return {
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    amber: 'border-amber-200 bg-amber-50 text-amber-800',
    rose: 'border-rose-200 bg-rose-50 text-rose-800',
    blue: 'border-blue-200 bg-blue-50 text-blue-800',
    slate: 'border-slate-200 bg-slate-50 text-slate-700',
  }[tone] || 'border-slate-200 bg-slate-50 text-slate-700';
}

function buildPracticePlan(score, answers) {
  if (!score) {
    return {
      title: 'Feedback is still loading',
      detail: 'Open this result again after the score and review data are available.',
      items: [
        ['Review status', 'Waiting for score data', 'slate'],
        ['Next step', 'Check submissions later', 'blue'],
      ],
    };
  }

  const total = numericScore(score.totalScore);
  const writing = numericScore(score.writingScore);
  const speaking = numericScore(score.speakingScore);
  const hasWritingAnswers = answers.some((a) => String(a.questionType || '').toUpperCase() === 'WRITING');
  const hasSpeakingAnswers = answers.some((a) => String(a.questionType || '').toUpperCase() === 'SPEAKING');
  const writingPending = hasWritingAnswers && score.writingReviewStatus && score.writingReviewStatus !== 'NOT_REQUIRED' && !score.writingReviewPublished;
  const speakingPending = hasSpeakingAnswers && score.speakingReviewStatus && score.speakingReviewStatus !== 'NOT_REQUIRED' && !score.speakingReviewPublished;

  if (writingPending || speakingPending || total == null) {
    return {
      title: 'Wait for teacher-published feedback',
      detail: 'Your subjective score may change after writing or speaking review is published.',
      items: [
        ['Writing', writingPending ? 'Awaiting review' : formatScore(writing), writingPending ? 'amber' : scoreBand(writing).tone],
        ['Speaking', speakingPending ? 'Awaiting review' : formatScore(speaking), speakingPending ? 'amber' : scoreBand(speaking).tone],
      ],
    };
  }

  const weakest = [
    ['Writing', writing],
    ['Speaking', speaking],
    ['MC / auto', numericScore(score.mcScore)],
  ]
    .filter(([, value]) => value != null)
    .sort((a, b) => a[1] - b[1])[0];

  return {
    title: total >= 75 ? 'Keep momentum with targeted practice' : 'Focus the next session on your weakest skill',
    detail: weakest
      ? `${weakest[0]} is the best place to practice next based on the published score breakdown.`
      : 'Review teacher comments and repeat a short practice round before the next exam.',
    items: [
      ['Overall', formatScore(total), scoreBand(total).tone],
      weakest ? ['Focus next', weakest[0], scoreBand(weakest[1]).tone] : ['Focus next', 'Review feedback', 'blue'],
    ],
  };
}

function ReviewCard({ title, score, published, message, children }) {
  return (
    <div className={`rounded-2xl border p-5 shadow-sm ${
      published ? 'border-emerald-200 bg-emerald-50/70' : 'border-amber-200 bg-amber-50/80'
    }`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{title}</p>
          <p className={`mt-1 text-sm font-semibold ${published ? 'text-emerald-800' : 'text-amber-800'}`}>
            {published ? 'Published by teacher' : 'Waiting for teacher publication'}
          </p>
        </div>
        <div className="rounded-xl bg-white px-4 py-2 text-right shadow-sm ring-1 ring-slate-100">
          <p className="text-[11px] font-semibold uppercase text-slate-400">Score</p>
          <p className="text-xl font-extrabold text-slate-900">{formatScore(score)}</p>
        </div>
      </div>
      <div className="mt-4 text-sm leading-relaxed text-slate-700 whitespace-pre-line">
        {published ? children : (message || AWAITING_REVIEW)}
      </div>
    </div>
  );
}

function PracticePlan({ plan }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">Next practice plan</p>
          <h2 className="mt-2 text-xl font-extrabold text-slate-900">{plan.title}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-500">{plan.detail}</p>
        </div>
        <Link
          to="/exams"
          className="inline-flex shrink-0 items-center justify-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-blue-700"
        >
          Find practice
        </Link>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {plan.items.map(([label, value, tone]) => (
          <div key={label} className={`rounded-xl border p-4 ${toneClasses(tone)}`}>
            <p className="text-[11px] font-bold uppercase tracking-wide opacity-75">{label}</p>
            <p className="mt-1 text-lg font-extrabold">{value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function SkillBreakdown({ score, answers }) {
  const hasWriting = answers.some((a) => String(a.questionType || '').toUpperCase() === 'WRITING');
  const hasSpeaking = answers.some((a) => String(a.questionType || '').toUpperCase() === 'SPEAKING');
  const cards = [
    {
      label: 'Auto-graded',
      value: formatScore(score?.mcScore),
      detail: 'Multiple choice and listening answers.',
      tone: scoreBand(score?.mcScore).tone,
    },
    {
      label: 'Writing',
      value: hasWriting ? formatScore(score?.writingScore) : 'Not used',
      detail: hasWriting
        ? (score?.writingReviewPublished ? 'Teacher feedback is published.' : 'Waiting for teacher review or score data.')
        : 'This submission has no writing answer.',
      tone: hasWriting ? scoreBand(score?.writingScore).tone : 'slate',
    },
    {
      label: 'Speaking',
      value: hasSpeaking ? formatScore(score?.speakingScore) : 'Not used',
      detail: hasSpeaking
        ? (score?.speakingReviewPublished ? 'Review recording feedback before the next prompt.' : 'Waiting for teacher review or score data.')
        : 'This submission has no speaking answer.',
      tone: hasSpeaking ? scoreBand(score?.speakingScore).tone : 'slate',
    },
  ];

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">Skill breakdown</p>
        <h2 className="mt-2 text-lg font-extrabold text-slate-900">What this result says</h2>
        <p className="mt-1 text-sm text-slate-500">Use these signals to decide the next short practice session.</p>
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        {cards.map((card) => (
          <div key={card.label} className={`rounded-xl border p-4 ${toneClasses(card.tone)}`}>
            <p className="text-[11px] font-bold uppercase tracking-wide opacity-75">{card.label}</p>
            <p className="mt-2 text-2xl font-extrabold">{card.value}</p>
            <p className="mt-1 text-xs leading-relaxed opacity-80">{card.detail}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function ExamResult() {
  const { submissionId } = useParams();
  const [submission, setSubmission] = useState(null);
  const [score, setScore] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const sortedAnswers = useMemo(
    () => [...answers].sort((a, b) => (a.questionId || 0) - (b.questionId || 0)),
    [answers]
  );

  useEffect(() => {
    let cancelled = false;

    const sid = Number(submissionId);
    Promise.all([
      submissionApi.getById(sid).catch(() => null),
      scoreApi.getBySubmissionId(sid).catch(() => null),
      studentExamApi.getAnswers(sid).catch(() => ({ data: { data: [] } })),
    ])
      .then(([subRes, scoreRes, ansRes]) => {
        if (cancelled) return;
        setSubmission(subRes?.data?.data ?? null);
        setScore(scoreRes?.data?.data ?? null);
        setAnswers(ansRes?.data?.data || []);
      })
      .catch((e) => {
        if (!cancelled) setError(e?.response?.data?.message || 'Failed to load result.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [submissionId]);

  if (loading) return <PageLoader />;

  if (error) {
    return (
      <div className="max-w-2xl mx-auto card space-y-4">
        <p className="text-red-700 text-sm">{error}</p>
        <Link to="/submissions" className="text-blue-600 text-sm font-semibold hover:underline">
          Back to submissions
        </Link>
      </div>
    );
  }

  const examTitle = submission?.examTitle || 'Exam result';
  const totalVisible = score?.totalScore;
  const totalLabel = totalVisible != null ? formatScore(totalVisible) : 'N/A';
  const practicePlan = buildPracticePlan(score, sortedAnswers);
  const isOfficialExam = submission?.examType === 'OFFICIAL';
  const integrityCount = Number(score?.suspiciousEventCount || 0);

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-10">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="bg-slate-950 px-6 py-7 text-white sm:px-8">
          <p className="text-xs font-bold uppercase tracking-wide text-blue-200">Submission review</p>
          <div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-2xl font-extrabold leading-tight sm:text-3xl">{examTitle}</h1>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          {submission?.status && <Badge status={submission.status} label={submission.status} />}
          {submission?.examType && (
            <span
              className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md ${
                submission.examType === 'OFFICIAL' ? 'bg-amber-200 text-amber-900' : 'bg-white/20 text-white'
              }`}
            >
              {submission.examType === 'OFFICIAL' ? 'Official' : 'Practice'}
            </span>
          )}
              </div>
            </div>
            <div className="rounded-2xl bg-white px-5 py-4 text-slate-950 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Total score</p>
              <p className="mt-1 text-4xl font-extrabold">{totalLabel}</p>
            </div>
          </div>
        </div>
        <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
          {score?.mcScore != null && (
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">MC / auto</p>
              <p className="mt-2 text-2xl font-extrabold text-slate-900">{formatScore(score.mcScore)}</p>
            </div>
          )}
          <div className="rounded-xl border border-amber-100 bg-amber-50 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-amber-700">Events</p>
            <p className="mt-2 text-2xl font-extrabold text-amber-800">{score?.suspiciousEventCount ?? 0}</p>
          </div>
          <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Answers</p>
            <p className="mt-2 text-2xl font-extrabold text-emerald-800">{sortedAnswers.length}</p>
          </div>
          <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-blue-700">Review state</p>
            <p className="mt-2 text-sm font-bold text-blue-900">
              {totalVisible != null ? 'Visible' : 'Pending'}
            </p>
          </div>
        </div>
      </div>

      <PracticePlan plan={practicePlan} />

      {score && (
        <>
          <SkillBreakdown score={score} answers={sortedAnswers} />

          <section className={`rounded-xl border p-5 shadow-sm ${
            isOfficialExam ? 'border-slate-200 bg-white' : 'border-slate-200 bg-slate-50/80'
          }`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-extrabold text-slate-900">
                  {isOfficialExam ? 'Session integrity' : 'Session notes'}
                </h2>
                <p className="text-sm text-slate-500">
                  {isOfficialExam
                    ? 'Activity markers recorded during the official exam session.'
                    : 'Light activity markers from this practice attempt.'}
                </p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${
                integrityCount > 0
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-emerald-100 text-emerald-800'
              }`}>
                {integrityCount > 0 ? 'Needs review' : 'Clean session'}
              </span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[
                ['Suspicious events', score.suspiciousEventCount ?? 0],
                ['Tab switches', score.tabSwitchCount ?? 0],
                ['Focus loss', score.focusLossCount ?? 0],
                ['Copy / paste', score.copyPasteCount ?? 0],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
                  <p className="mt-2 text-2xl font-extrabold text-slate-900">{value}</p>
                </div>
              ))}
            </div>
          </section>

          {score.writingReviewStatus && score.writingReviewStatus !== 'NOT_REQUIRED' && (
            <ReviewCard
              title="Writing review"
              score={score.writingScore}
              published={score.writingReviewPublished}
              message={score.writingReviewMessage}
            >
              {score.feedback || 'Teacher has published your writing score.'}
            </ReviewCard>
          )}

          {score.speakingReviewStatus && score.speakingReviewStatus !== 'NOT_REQUIRED' && (
            <ReviewCard
              title="Speaking review"
              score={score.speakingScore}
              published={score.speakingReviewPublished}
              message={score.speakingReviewMessage}
            >
              {score.speakingReviewMessage || 'Teacher has published your speaking score.'}
            </ReviewCard>
          )}
        </>
      )}

      <div>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900">Answer breakdown</h2>
            <p className="text-sm text-slate-500">Your saved responses and teacher-published feedback.</p>
          </div>
        </div>
        {sortedAnswers.length === 0 ? (
          <p className="text-sm text-slate-500">No saved answers for this submission.</p>
        ) : (
          <div className="grid gap-4">
            {sortedAnswers.map((a) => (
              <div key={a.id ?? `${a.questionId}`} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-[11px] font-bold uppercase text-blue-600 tracking-wide">
                      {a.questionType || 'Question'}
                    </p>
                    <p className="text-slate-900 font-bold text-sm mt-1">{a.questionText || `Question #${a.questionId}`}</p>
                  </div>
                </div>

                {a.questionType?.toUpperCase() === 'SPEAKING' && (
                  <div className="space-y-2">
                    {a.speakingAudioUrl && (
                      <SpeakingAudioPlayer submissionId={submission?.id} answerId={a.id} className="max-w-md" />
                    )}
                    {a.speakingPublishedTranscript && (
                      <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase">Transcript (published)</p>
                        <p className="text-sm text-slate-700 whitespace-pre-line mt-1">{a.speakingPublishedTranscript}</p>
                      </div>
                    )}
                    {(a.speakingPublishedScore != null || a.speakingPublishedFeedback || a.speakingPublishedTranscript) ? (
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-slate-700">
                        {a.speakingPublishedScore != null && (
                          <p>
                            Published score:{' '}
                            <span className="font-semibold">{formatScore(a.speakingPublishedScore)}</span>
                          </p>
                        )}
                        {a.speakingPublishedFeedback && (
                          <p className="mt-2 whitespace-pre-line text-slate-700">{a.speakingPublishedFeedback}</p>
                        )}
                      </div>
                    ) : (
                      a.speakingReviewStatus && <p className="text-xs text-amber-800">{AWAITING_REVIEW}</p>
                    )}
                  </div>
                )}

                {a.questionType?.toUpperCase() === 'WRITING' && (
                  <div className="space-y-2">
                    {a.imageUrl && (
                      <img
                        src={resolveMediaUrl(a.imageUrl)}
                        alt="Writing upload"
                        className="max-h-48 rounded-lg border border-slate-200 object-contain"
                      />
                    )}
                    {a.answerText && (
                      <p className="text-sm text-slate-700 whitespace-pre-wrap border border-slate-200 rounded-xl p-4 bg-slate-50">
                        {a.answerText}
                      </p>
                    )}
                    {(a.writingPublishedScore != null || a.writingPublishedFeedback) ? (
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-slate-700">
                        {a.writingPublishedScore != null && (
                          <p>
                            Published score:{' '}
                            <span className="font-semibold">{formatScore(a.writingPublishedScore)}</span>
                          </p>
                        )}
                        {a.writingPublishedFeedback && (
                          <p className="mt-2 whitespace-pre-line text-slate-700">{a.writingPublishedFeedback}</p>
                        )}
                      </div>
                    ) : (
                      a.writingReviewStatus && <p className="text-xs text-amber-800">{AWAITING_REVIEW}</p>
                    )}
                  </div>
                )}

                {['MULTIPLE_CHOICE', 'LISTENING'].includes(String(a.questionType || '').toUpperCase()) && (
                  <p className="text-sm text-slate-700">
                    Selected answer:{' '}
                    <span className="font-semibold">
                      {a.selectedOptionText || (a.selectedOptionId != null ? `Option #${a.selectedOptionId}` : '-')}
                    </span>
                  </p>
                )}

                {a.questionType &&
                  !['SPEAKING', 'WRITING', 'MULTIPLE_CHOICE', 'LISTENING'].includes(a.questionType.toUpperCase()) && (
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">{a.answerText || '-'}</p>
                  )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <Link
          to="/dashboard"
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition text-center"
        >
          Back to dashboard
        </Link>
        <Link
          to="/submissions"
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition text-center"
        >
          All submissions
        </Link>
      </div>
    </div>
  );
}
