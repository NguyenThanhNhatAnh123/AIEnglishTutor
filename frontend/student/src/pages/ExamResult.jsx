import { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { scoreApi, studentExamApi, submissionApi, API_ORIGIN } from '../services/api';
import AudioPlayer from '../../../packages/ui/AudioPlayer.jsx';
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
    setLoading(true);
    setError(null);

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

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-10">
      <div className="card bg-gradient-to-r from-blue-700 to-blue-500 text-white !p-8 space-y-3">
        <p className="text-blue-200 text-xs font-semibold uppercase tracking-wider">Submission</p>
        <h1 className="text-2xl font-bold leading-tight">{examTitle}</h1>
        <div className="flex flex-wrap items-center gap-2 text-sm">
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
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-white/20 text-sm">
          <div>
            <p className="text-blue-200 text-xs">Total score</p>
            <p className="text-xl font-bold">{totalLabel}</p>
          </div>
          {score?.mcScore != null && (
            <div>
              <p className="text-blue-200 text-xs">MC / auto</p>
              <p className="text-lg font-semibold">{formatScore(score.mcScore)}</p>
            </div>
          )}
        </div>
        <p className="text-blue-100 text-xs leading-relaxed">
          Proctoring summary below lists unusual events during the exam (tab switches, focus loss, copy/paste). It does
          not grade your answers.
        </p>
      </div>

      {score && (
        <>
          <h2 className="section-title">Proctoring summary</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="card">
              <p className="text-sm text-slate-500">Suspicious events</p>
              <p className="text-3xl font-extrabold text-amber-600 mt-1">{score.suspiciousEventCount ?? 0}</p>
            </div>
            <div className="card">
              <p className="text-sm text-slate-500">Tab switches</p>
              <p className="text-3xl font-extrabold text-slate-700 mt-1">{score.tabSwitchCount ?? 0}</p>
            </div>
            <div className="card">
              <p className="text-sm text-slate-500">Focus loss</p>
              <p className="text-3xl font-extrabold text-slate-700 mt-1">{score.focusLossCount ?? 0}</p>
            </div>
            <div className="card">
              <p className="text-sm text-slate-500">Copy / paste attempts</p>
              <p className="text-3xl font-extrabold text-slate-700 mt-1">{score.copyPasteCount ?? 0}</p>
            </div>
          </div>

          {score.writingReviewStatus && score.writingReviewStatus !== 'NOT_REQUIRED' && (
            <div className="card space-y-3">
              <h3 className="section-title !mb-0">Writing review</h3>
              {!score.writingReviewPublished ? (
                <p className="text-sm text-amber-800 font-medium">{score.writingReviewMessage || AWAITING_REVIEW}</p>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-slate-600">
                    Writing score:{' '}
                    <span className="font-bold text-slate-900">{formatScore(score.writingScore)}</span>
                  </p>
                  {score.feedback && (
                    <p className="text-sm text-slate-700 whitespace-pre-line">{score.feedback}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {score.speakingReviewStatus && score.speakingReviewStatus !== 'NOT_REQUIRED' && (
            <div className="card space-y-3">
              <h3 className="section-title !mb-0">Speaking review</h3>
              {!score.speakingReviewPublished ? (
                <p className="text-sm text-amber-800 font-medium">{score.speakingReviewMessage || AWAITING_REVIEW}</p>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-slate-600">
                    Speaking score:{' '}
                    <span className="font-bold text-slate-900">{formatScore(score.speakingScore)}</span>
                  </p>
                </div>
              )}
            </div>
          )}
        </>
      )}

      <div>
        <h2 className="section-title">Your answers</h2>
        {sortedAnswers.length === 0 ? (
          <p className="text-sm text-slate-500">No saved answers for this submission.</p>
        ) : (
          <div className="space-y-4">
            {sortedAnswers.map((a) => (
              <div key={a.id ?? `${a.questionId}`} className="card space-y-3 !p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wide">
                      {a.questionType || 'Question'}
                    </p>
                    <p className="text-slate-900 font-medium text-sm mt-1">{a.questionText || `Question #${a.questionId}`}</p>
                  </div>
                </div>

                {a.questionType?.toUpperCase() === 'SPEAKING' && (
                  <div className="space-y-2">
                    {a.speakingAudioUrl && (
                      <AudioPlayer src={resolveMediaUrl(a.speakingAudioUrl)} className="max-w-md" />
                    )}
                    {a.speakingPublishedTranscript && (
                      <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase">Transcript (published)</p>
                        <p className="text-sm text-slate-700 whitespace-pre-line mt-1">{a.speakingPublishedTranscript}</p>
                      </div>
                    )}
                    {(a.speakingPublishedScore != null || a.speakingPublishedFeedback || a.speakingPublishedTranscript) ? (
                      <div className="text-xs text-slate-600">
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
                      <p className="text-sm text-slate-700 whitespace-pre-wrap border border-slate-100 rounded-lg p-3 bg-slate-50">
                        {a.answerText}
                      </p>
                    )}
                    {(a.writingPublishedScore != null || a.writingPublishedFeedback) ? (
                      <div className="text-xs text-slate-600">
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
                    Selected option ID:{' '}
                    <span className="font-mono">{a.selectedOptionId != null ? a.selectedOptionId : '—'}</span>
                  </p>
                )}

                {a.questionType &&
                  !['SPEAKING', 'WRITING', 'MULTIPLE_CHOICE', 'LISTENING'].includes(a.questionType.toUpperCase()) && (
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">{a.answerText || '—'}</p>
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
