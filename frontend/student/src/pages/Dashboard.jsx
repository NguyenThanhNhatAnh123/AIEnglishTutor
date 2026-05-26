import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { studentExamApi, submissionApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { PageLoader } from '../components/common/LoadingSpinner';
import dashboardMainBg from '../assets/exam/backgrounds/dashboard-main-bg.jpg';
import dashboardStatCardBg from '../assets/exam/backgrounds/dashboard-stat-card-bg.jpg';

function dashboardBackground(image, overlay = 'rgba(255, 255, 255, 0.92)') {
  return {
    backgroundImage: `linear-gradient(135deg, ${overlay}, rgba(255, 255, 255, 0.74)), url(${image})`,
    backgroundPosition: 'center',
    backgroundSize: 'cover',
  };
}

function StatCard({ label, value, icon, color }) {
  return (
    <div
      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
      style={dashboardBackground(dashboardStatCardBg, 'rgba(255, 255, 255, 0.94)')}
    >
      <div className={`mb-4 flex h-11 w-11 items-center justify-center rounded-xl ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-extrabold text-slate-900">{value}</p>
        <p className="mt-1 text-sm font-medium text-slate-500">{label}</p>
      </div>
    </div>
  );
}

function ActionCard({ eyebrow, title, description, to, action, tone = 'blue', reload = false }) {
  const tones = {
    blue: 'border-blue-100 bg-blue-50/70 text-blue-700',
    amber: 'border-amber-100 bg-amber-50/80 text-amber-700',
    emerald: 'border-emerald-100 bg-emerald-50/80 text-emerald-700',
  };
  return (
    <article
      className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
      style={dashboardBackground(dashboardMainBg, 'rgba(255, 255, 255, 0.93)')}
    >
      <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${tones[tone]}`}>
        {eyebrow}
      </span>
      <h3 className="mt-3 text-lg font-extrabold text-slate-900">{title}</h3>
      <p className="mt-1 text-sm leading-relaxed text-slate-500">{description}</p>
      {reload ? (
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-4 inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-blue-700"
        >
          {action}
        </button>
      ) : (
        <Link
          to={to}
          className="mt-4 inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-blue-700"
        >
          {action}
        </Link>
      )}
    </article>
  );
}

function SkillFocus({ title, detail, value, tone }) {
  const toneClass = {
    blue: 'bg-blue-50 text-blue-700',
    amber: 'bg-amber-50 text-amber-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    slate: 'bg-slate-100 text-slate-600',
  }[tone];
  return (
    <div
      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
      style={dashboardBackground(dashboardStatCardBg, 'rgba(255, 255, 255, 0.95)')}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-extrabold text-slate-900">{title}</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">{detail}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${toneClass}`}>{value}</span>
      </div>
    </div>
  );
}

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function getLatestAttemptTime(submission) {
  return new Date(submission.endTime || submission.submitTime || submission.startTime || 0).getTime();
}

function formatScore(value) {
  if (value == null || Number.isNaN(Number(value))) return '-';
  return Number(value).toFixed(1);
}

export default function Dashboard() {
  const { user } = useAuth();
  const [exams, setExams] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadWarning, setLoadWarning] = useState(null);

  useEffect(() => {
    Promise.allSettled([
      studentExamApi.getActiveExams().then((r) => r.data?.data || []),
      submissionApi.getMy().then((r) => r.data?.data || []),
    ])
      .then(([examResult, submissionResult]) => {
        const warnings = [];
        if (examResult.status === 'fulfilled') setExams(examResult.value);
        else warnings.push('assigned exams');
        if (submissionResult.status === 'fulfilled') setSubmissions(submissionResult.value);
        else warnings.push('submission history');
        setLoadWarning(warnings.length ? `Could not refresh ${warnings.join(' and ')}.` : null);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <PageLoader />;

  const completedStatuses = new Set(['SUBMITTED', 'AUTO_SUBMITTED']);
  const inProgressStatuses = new Set(['IN_PROGRESS']);
  const completedSubmissions = submissions.filter((s) => completedStatuses.has(s.status));
  const inProgressSubmissions = submissions.filter((s) => inProgressStatuses.has(s.status));

  const submittedExamIds = new Set(
    completedSubmissions.map((s) => s.examId)
  );
  const completedExamCount = submittedExamIds.size;
  const pendingExamCount = exams.filter((e) => !submittedExamIds.has(e.id)).length;
  const completionRate = exams.length > 0 ? Math.round((completedExamCount / exams.length) * 100) : 0;

  const scoredSubmissions = completedSubmissions.filter((s) => s.totalScore != null);
  const totalScore = scoredSubmissions.reduce((sum, s) => sum + toNumber(s.totalScore), 0);
  const averageScore = scoredSubmissions.length ? (totalScore / scoredSubmissions.length) : null;
  const bestScore = scoredSubmissions.length
    ? Math.max(...scoredSubmissions.map((s) => toNumber(s.totalScore)))
    : null;

  const scoreBands = scoredSubmissions.reduce((acc, s) => {
    const score = toNumber(s.totalScore);
    if (score >= 75) acc.strong += 1;
    else if (score >= 50) acc.average += 1;
    else acc.needsWork += 1;
    return acc;
  }, { strong: 0, average: 0, needsWork: 0 });

  const recentAttempts = [...submissions]
    .sort((a, b) => getLatestAttemptTime(b) - getLatestAttemptTime(a))
    .slice(0, 8);
  const latestInProgress = [...inProgressSubmissions]
    .sort((a, b) => getLatestAttemptTime(b) - getLatestAttemptTime(a))[0];
  const nextExam = exams.find((e) => !submittedExamIds.has(e.id));
  const latestPublished = completedSubmissions.find((s) => s.totalScore != null);

  const primaryAction = latestInProgress
    ? {
        eyebrow: 'Continue learning',
        title: latestInProgress.examTitle || `Exam #${latestInProgress.examId}`,
        description: 'You have an open attempt. Resume it before starting something new.',
        to: `/exam/${latestInProgress.examId}`,
        action: 'Resume exam',
        tone: 'amber',
      }
    : nextExam
      ? {
          eyebrow: 'Next exam',
          title: nextExam.title,
          description: `${nextExam.durationMinutes || 0} minutes - ${nextExam.examType === 'OFFICIAL' ? 'Official exam' : 'Practice exam'}.`,
          to: `/exam/${nextExam.id}`,
          action: 'Start exam',
          tone: nextExam.examType === 'OFFICIAL' ? 'amber' : 'blue',
        }
      : completedSubmissions.length
        ? {
            eyebrow: 'Feedback ready',
            title: 'Review your latest results',
            description: 'Check published scores, teacher notes, and the next skill to improve.',
            to: '/submissions',
            action: 'View feedback',
            tone: 'emerald',
          }
        : {
            eyebrow: loadWarning ? 'Needs attention' : 'Learning home',
            title: loadWarning ? 'Refresh your learning data' : 'No assigned exams yet',
            description: loadWarning
              ? 'Some learning data could not be loaded. Try again before starting a session.'
              : 'Your teacher has not assigned an active exam yet. This space will show the next activity when one is available.',
            to: loadWarning ? '/dashboard' : '/exams',
            action: loadWarning ? 'Refresh page' : 'Browse exams',
            tone: loadWarning ? 'amber' : 'blue',
            reload: Boolean(loadWarning),
          };

  const writingCount = submissions.reduce((sum, s) => sum + toNumber(s.writingAnswerCount), 0);
  const speakingCount = submissions.reduce((sum, s) => sum + toNumber(s.speakingAnswerCount), 0);
  const pendingReviewCount = submissions.filter((s) => s.subjectiveReviewStatus === 'PENDING').length;
  const practiceNext = averageScore == null
    ? 'Start with an assigned exam to unlock personalized practice.'
    : averageScore >= 75
      ? 'Keep momentum with timed practice and review any teacher notes.'
      : 'Review feedback first, then repeat the weakest skill in a shorter practice round.';

  return (
    <div className="space-y-5">
      {loadWarning && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
          {loadWarning} Some numbers may be incomplete.
        </div>
      )}

      <section
        className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
        style={dashboardBackground(dashboardMainBg, 'rgba(255, 255, 255, 0.9)')}
      >
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">Learning home</p>
            <h2 className="mt-2 text-2xl font-extrabold text-slate-950 sm:text-3xl">
              Welcome back, {user?.fullName || user?.username || 'Student'}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-500">
              Pick up the next exam, review feedback, and focus on the skill that needs the most attention.
            </p>
          </div>
          <div className="rounded-xl bg-slate-950 p-4 text-white shadow-sm lg:min-w-44">
            <p className="text-xs font-bold uppercase tracking-wide text-blue-200">Completion</p>
            <p className="mt-1 text-3xl font-extrabold">{completionRate}%</p>
            <p className="text-xs text-slate-300">{completedExamCount}/{exams.length || 0} exams completed</p>
          </div>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        <ActionCard {...primaryAction} />
        <article
          className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
          style={dashboardBackground(dashboardMainBg, 'rgba(255, 255, 255, 0.94)')}
        >
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Practice next</p>
          <h3 className="mt-2 text-xl font-extrabold text-slate-900">{formatScore(averageScore)} average score</h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">{practiceNext}</p>
          {latestPublished && (
            <Link to={`/result/${latestPublished.id}`} className="mt-4 inline-flex text-sm font-bold text-blue-600 hover:underline">
              Open latest result
            </Link>
          )}
        </article>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="To do"
          value={pendingExamCount}
          color="bg-blue-50 text-blue-600"
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414A1 1 0 0119 9.414V19a2 2 0 01-2 2z" />
            </svg>
          }
        />
        <StatCard
          label="In progress"
          value={inProgressSubmissions.length}
          color="bg-green-50 text-green-600"
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          }
        />
        <StatCard
          label="Pending review"
          value={pendingReviewCount}
          color="bg-amber-50 text-amber-600"
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <SkillFocus
          title="Writing"
          detail="Use teacher comments and written answers to decide what to rewrite next."
          value={writingCount || 'No data'}
          tone={writingCount ? 'blue' : 'slate'}
        />
        <SkillFocus
          title="Speaking"
          detail="Review recordings and published feedback before the next speaking prompt."
          value={speakingCount || 'No data'}
          tone={speakingCount ? 'emerald' : 'slate'}
        />
        <SkillFocus
          title="Score health"
          detail={`${scoreBands.needsWork} result(s) need more practice; best score ${formatScore(bestScore)}.`}
          value={averageScore == null ? 'New' : averageScore >= 75 ? 'Strong' : 'Practice'}
          tone={averageScore == null ? 'slate' : averageScore >= 75 ? 'emerald' : 'amber'}
        />
      </div>

      <div
        className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
        style={dashboardBackground(dashboardMainBg, 'rgba(255, 255, 255, 0.95)')}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900">Recent activity</h3>
            <p className="text-xs text-slate-500">Latest attempts, scores, and review states.</p>
          </div>
          <Link to="/submissions" className="text-sm text-blue-600 hover:underline font-medium">View all</Link>
        </div>
        {recentAttempts.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm font-semibold text-slate-700">No learning activity yet</p>
            <p className="mt-1 text-sm text-slate-400">Start an exam to see your progress and feedback here.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {recentAttempts.map((s) => (
              <div key={s.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-slate-900">{s.examTitle || `Exam #${s.examId}`}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {(s.endTime || s.submitTime || s.startTime)
                      ? new Date(s.endTime || s.submitTime || s.startTime).toLocaleString()
                      : 'No activity time'}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                    completedStatuses.has(s.status) ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                  }`}>
                    {s.status}
                  </span>
                  <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">
                    Score {formatScore(s.totalScore)}
                  </span>
                  <Link to={completedStatuses.has(s.status) ? `/result/${s.id}` : `/exam/${s.examId}`} className="text-xs font-bold text-blue-600 hover:underline">
                    {completedStatuses.has(s.status) ? 'View result' : 'Resume'}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
