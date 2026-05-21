import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { studentExamApi } from '../services/api';
import Badge from '../components/common/Badge';
import EmptyState from '../components/common/EmptyState';
import { PageLoader } from '../components/common/LoadingSpinner';
import { useToast } from '../context/ToastContext';

const practiceModes = [
  {
    title: 'Timed exam',
    detail: 'Best for official readiness and pacing.',
    tone: 'bg-blue-50 text-blue-700 border-blue-100',
  },
  {
    title: 'Speaking drill',
    detail: 'Use short prompts to build fluency.',
    tone: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  },
  {
    title: 'Writing review',
    detail: 'Rewrite with teacher feedback in mind.',
    tone: 'bg-amber-50 text-amber-700 border-amber-100',
  },
];

function inferSkills(exam) {
  const text = `${exam.title || ''} ${exam.description || ''}`.toLowerCase();
  const fromSections = (exam.sections || [])
    .map((s) => s.sectionType || s.name)
    .filter(Boolean);
  const skills = new Set(fromSections.map((s) => String(s).replace(/_/g, ' ').toLowerCase()));
  [
    ['reading', 'Reading'],
    ['listening', 'Listening'],
    ['writing', 'Writing'],
    ['speaking', 'Speaking'],
  ].forEach(([needle, label]) => {
    if (text.includes(needle) || [...skills].some((s) => s.includes(needle))) skills.add(label);
  });
  return [...skills].map((s) => String(s).trim()).filter(Boolean).slice(0, 4);
}

export default function ExamList() {
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const toast = useToast();

  useEffect(() => {
    studentExamApi.getActiveExams()
      .then((r) => setExams(r.data?.data || []))
      .catch((err) => {
        setExams([]);
        const msg = err.response?.data?.message || 'Failed to load exams.';
        setError(msg);
        toast.error(msg);
      })
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = exams.filter((e) => {
    const q = search.trim().toLowerCase();
    const matchesText = !q
      || e.title?.toLowerCase().includes(q)
      || e.description?.toLowerCase().includes(q)
      || e.teacherName?.toLowerCase().includes(q);
    const matchesType = typeFilter === 'ALL' || e.examType === typeFilter;
    return matchesText && matchesType;
  });

  const stats = {
    total: exams.length,
    official: exams.filter((e) => e.examType === 'OFFICIAL').length,
    practice: exams.filter((e) => e.examType !== 'OFFICIAL').length,
    resume: exams.filter((e) => e.hasInProgressSubmission).length,
  };

  const attemptSummary = (exam) => {
    const effectiveMax = exam.maxAttempts ?? (exam.examType === 'OFFICIAL' ? 1 : null);
    if (exam.hasInProgressSubmission) return 'Resume available';
    if (effectiveMax == null) return 'Unlimited attempts';
    const remaining = exam.remainingAttempts ?? effectiveMax;
    if (remaining <= 0) return 'No attempts left';
    return `${remaining}/${effectiveMax} attempts left`;
  };

  if (loading) return <PageLoader />;

  if (error) {
    return (
      <EmptyState
        title="Could not load exams"
        description={error}
        action={
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition"
          >
            Retry
          </button>
        }
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-blue-100 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-500">Practice + exam center</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">Choose your next activity</h1>
            <p className="mt-1 text-sm text-slate-500">
              Start an assigned paper, resume an open attempt, or pick a practice focus before the next test.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:min-w-[460px]">
            {[
              ['Total', stats.total],
              ['Official', stats.official],
              ['Practice', stats.practice],
              ['Resume', stats.resume],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                <p className="text-[11px] font-semibold uppercase text-slate-500">{label}</p>
                <p className="text-xl font-bold text-blue-700">{value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-3">
          {practiceModes.map((mode) => (
            <div key={mode.title} className={`rounded-xl border px-4 py-3 ${mode.tone}`}>
              <p className="text-sm font-extrabold">{mode.title}</p>
              <p className="mt-1 text-xs leading-relaxed opacity-80">{mode.detail}</p>
            </div>
          ))}
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_auto]">
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
              fill="none" viewBox="0 0 24 24" stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              id="exam-search"
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by exam, description, or teacher..."
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Search exams"
            />
          </div>
          <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
            {[
              ['ALL', 'All'],
              ['OFFICIAL', 'Official'],
              ['PRACTICE', 'Practice'],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setTypeFilter(value)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  typeFilter === value
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-slate-500 hover:text-blue-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <EmptyState
          title="No exams found"
          description={search ? 'Try a different search term.' : 'There are no exams available yet.'}
        />
      ) : (
        <>
          <p className="text-sm text-slate-500">{filtered.length} {filtered.length === 1 ? 'activity' : 'activities'} found</p>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((exam) => {
              const exhausted = exam.remainingAttempts === 0 && !exam.hasInProgressSubmission;
              const skills = inferSkills(exam);
              const card = (
                <>
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414A1 1 0 0119 9.414V19a2 2 0 01-2 2z" />
                    </svg>
                    </div>
                    <Badge status={exam.status} label={exam.examType === 'OFFICIAL' ? 'Official' : 'Practice'} />
                  </div>
                  <h3 className="font-semibold text-slate-800 group-hover:text-blue-600 transition-colors mb-1">
                    {exam.title}
                  </h3>
                  {exam.description && (
                    <p className="text-sm text-slate-500 line-clamp-2 flex-1">{exam.description}</p>
                  )}
                  {skills.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {skills.map((skill) => (
                        <span key={skill} className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600">
                          {skill}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                    <div className="rounded-lg bg-slate-50 px-2 py-2">
                      <p className="text-slate-400">Time</p>
                      <p className="font-semibold text-slate-700">{exam.durationMinutes}m</p>
                    </div>
                    <div className="rounded-lg bg-slate-50 px-2 py-2">
                      <p className="text-slate-400">Questions</p>
                      <p className="font-semibold text-slate-700">{exam.questionCount ?? '-'}</p>
                    </div>
                    <div className="rounded-lg bg-slate-50 px-2 py-2">
                      <p className="text-slate-400">Sections</p>
                      <p className="font-semibold text-slate-700">{exam.sectionCount ?? '-'}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
                    <span className={`text-xs font-semibold ${exhausted ? 'text-red-600' : 'text-blue-700'}`}>
                      {attemptSummary(exam)}
                    </span>
                    <span className={`shrink-0 rounded-lg px-3 py-2 text-xs font-bold ${
                      exhausted ? 'bg-slate-100 text-slate-400' : 'bg-blue-600 text-white group-hover:bg-blue-700'
                    }`}>
                      {exhausted ? 'Limit reached' : exam.hasInProgressSubmission ? 'Resume' : 'Start'}
                    </span>
                  </div>
                </>
              );

              return exhausted ? (
                <div
                  key={exam.id}
                  className="card flex flex-col border border-slate-100 bg-slate-50/80 opacity-80"
                  aria-disabled="true"
                >
                  {card}
                </div>
              ) : (
                <Link
                  key={exam.id}
                  to={`/exam/${exam.id}`}
                  className="card group flex flex-col border border-slate-100 transition-all hover:border-blue-200 hover:shadow-md"
                >
                  {card}
                </Link>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
