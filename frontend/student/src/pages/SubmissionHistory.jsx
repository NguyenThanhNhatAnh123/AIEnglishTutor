import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { submissionApi } from '../services/api';
import Badge from '../components/common/Badge';
import EmptyState from '../components/common/EmptyState';
import { PageLoader } from '../components/common/LoadingSpinner';
import { useToast } from '../context/ToastContext';

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : '-';
}

function formatDuration(seconds) {
  if (seconds == null) return '-';
  const n = Math.max(0, Number(seconds) || 0);
  const m = Math.floor(n / 60);
  const s = n % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function reviewLabel(status) {
  if (status === 'PUBLISHED') return 'Published';
  if (status === 'PENDING') return 'Teacher review';
  return 'Not required';
}

function reviewClass(status) {
  if (status === 'PUBLISHED') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'PENDING') return 'border-amber-200 bg-amber-50 text-amber-700';
  return 'border-slate-200 bg-slate-50 text-slate-500';
}

function scoreLabel(submission) {
  if (submission.status === 'IN_PROGRESS') return 'In progress';
  if (submission.totalScore != null) return Math.round(submission.totalScore * 10) / 10;
  if (submission.subjectiveReviewStatus === 'PENDING') return 'Pending review';
  return 'N/A';
}

function SubmissionCard({ submission }) {
  const completed = submission.status === 'SUBMITTED' || submission.status === 'AUTO_SUBMITTED';
  const inProgress = submission.status === 'IN_PROGRESS';
  const eventCount = Number(submission.suspiciousEventCount || 0);
  const completion = submission.completionPercent != null
    ? `${submission.completionPercent}%`
    : submission.answeredQuestions != null && submission.totalQuestions != null
      ? `${submission.answeredQuestions}/${submission.totalQuestions}`
      : '-';

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge status={submission.status} label={submission.status} />
            <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${reviewClass(submission.subjectiveReviewStatus)}`}>
              {reviewLabel(submission.subjectiveReviewStatus)}
            </span>
          </div>
          <h3 className="mt-3 text-lg font-extrabold text-slate-900">
            {submission.examTitle || `Exam #${submission.examId}`}
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            {inProgress ? `Started ${formatDate(submission.startTime)}` : `Ended ${formatDate(submission.endTime || submission.submitTime)}`}
          </p>
        </div>

        <div className="rounded-2xl bg-slate-950 px-5 py-4 text-white lg:min-w-36">
          <p className="text-xs font-bold uppercase tracking-wide text-blue-200">Score</p>
          <p className="mt-1 text-2xl font-extrabold">{scoreLabel(submission)}</p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-[11px] font-bold uppercase text-slate-500">Completion</p>
          <p className="mt-1 font-bold text-slate-900">{completion}</p>
          {submission.answeredQuestions != null && submission.totalQuestions != null && (
            <p className="text-xs text-slate-500">{submission.answeredQuestions}/{submission.totalQuestions} answers</p>
          )}
        </div>
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-[11px] font-bold uppercase text-slate-500">Duration</p>
          <p className="mt-1 font-bold text-slate-900">{formatDuration(submission.durationSeconds)}</p>
        </div>
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-[11px] font-bold uppercase text-slate-500">Writing</p>
          <p className="mt-1 font-bold text-slate-900">{reviewLabel(submission.writingReviewStatus)}</p>
          <p className="text-xs text-slate-500">{submission.writingAnswerCount || 0} answer(s)</p>
        </div>
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-[11px] font-bold uppercase text-slate-500">Speaking</p>
          <p className="mt-1 font-bold text-slate-900">{reviewLabel(submission.speakingReviewStatus)}</p>
          <p className="text-xs text-slate-500">{submission.speakingAnswerCount || 0} answer(s)</p>
        </div>
        <div className={`rounded-xl p-3 ${eventCount > 0 ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-800'}`}>
          <p className="text-[11px] font-bold uppercase opacity-75">Integrity</p>
          <p className="mt-1 font-bold">{eventCount > 0 ? `${eventCount} event(s)` : 'Clean'}</p>
          <p className="text-xs opacity-75">{submission.deviceType || '-'}</p>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        {submission.subjectiveReviewStatus === 'PENDING' && completed ? (
          <p className="text-sm font-semibold text-amber-700">
            Subjective score is hidden until your teacher publishes the review.
          </p>
        ) : (
          <p className="text-sm text-slate-500">Latest activity: {formatDate(submission.endTime || submission.submitTime || submission.startTime)}</p>
        )}
        {completed ? (
          <Link to={`/result/${submission.id}`} className="rounded-xl bg-blue-600 px-4 py-2.5 text-center text-sm font-bold text-white transition hover:bg-blue-700">
            View result
          </Link>
        ) : inProgress ? (
          <Link to={`/exam/${submission.examId}`} className="rounded-xl bg-amber-500 px-4 py-2.5 text-center text-sm font-bold text-white transition hover:bg-amber-600">
            Resume exam
          </Link>
        ) : (
          <span className="text-sm text-slate-400">No action</span>
        )}
      </div>
    </article>
  );
}

export default function SubmissionHistory() {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const toast = useToast();

  useEffect(() => {
    submissionApi.getMy()
      .then((r) => setSubmissions(r.data?.data || []))
      .catch((err) => {
        setSubmissions([]);
        const msg = err.response?.data?.message || 'Failed to load submissions.';
        setError(msg);
        toast.error(msg);
      })
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = submissions.filter((s) => {
    const q = search.trim().toLowerCase();
    const name = (s.examTitle || `Exam #${s.examId}`).toLowerCase();
    const matchesText = !q || name.includes(q);
    const matchesStatus = statusFilter === 'ALL' || s.status === statusFilter || s.subjectiveReviewStatus === statusFilter;
    return matchesText && matchesStatus;
  });

  const stats = {
    total: submissions.length,
    inProgress: submissions.filter((s) => s.status === 'IN_PROGRESS').length,
    pendingReview: submissions.filter((s) => s.subjectiveReviewStatus === 'PENDING').length,
    published: submissions.filter((s) => s.subjectiveReviewStatus === 'PUBLISHED').length,
  };

  if (loading) return <PageLoader />;

  if (error) {
    return (
      <EmptyState
        title="Could not load submissions"
        description={error}
        action={
          <button
            onClick={() => window.location.reload()}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            Retry
          </button>
        }
      />
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-blue-600">Submission center</p>
            <h1 className="mt-1 text-2xl font-extrabold text-slate-900">Exam history</h1>
            <p className="mt-1 text-sm text-slate-500">Track progress, review publication, and saved results.</p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:min-w-[460px]">
            {[
              ['Total', stats.total],
              ['Open', stats.inProgress],
              ['Review', stats.pendingReview],
              ['Published', stats.published],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                <p className="text-[11px] font-semibold uppercase text-slate-500">{label}</p>
                <p className="text-xl font-bold text-blue-700">{value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_auto]">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              id="submission-search"
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by exam name..."
              aria-label="Search submissions"
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-4 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
            {[
              ['ALL', 'All'],
              ['IN_PROGRESS', 'Open'],
              ['PENDING', 'Review'],
              ['PUBLISHED', 'Published'],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setStatusFilter(value)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  statusFilter === value ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-blue-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {filtered.length === 0 ? (
        <EmptyState
          title="No submissions found"
          description={search ? 'Try a different search or filter.' : 'You have not started any exams yet.'}
          action={
            <Link to="/exams" className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700">
              Browse exams
            </Link>
          }
        />
      ) : (
        <div className="grid gap-4">
          {filtered.map((submission) => (
            <SubmissionCard key={submission.id} submission={submission} />
          ))}
        </div>
      )}
    </div>
  );
}
