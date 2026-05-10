import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { studentExamApi, submissionApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { PageLoader } from '../components/common/LoadingSpinner';

function StatCard({ label, value, icon, color }) {
  return (
    <div className="card flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-800">{value}</p>
        <p className="text-sm text-slate-500">{label}</p>
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

  useEffect(() => {
    Promise.all([
      studentExamApi.getActiveExams().then((r) => r.data?.data || []),
      submissionApi.getMy().then((r) => r.data?.data || []).catch(() => []),
    ])
      .then(([e, s]) => { setExams(e); setSubmissions(s); })
      .catch(() => {})
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

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-gradient-to-r from-blue-700 to-blue-500 p-6 text-white">
        <p className="text-blue-200 text-sm font-medium uppercase tracking-wider mb-1">Welcome back,</p>
        <h2 className="text-2xl font-bold">{user?.fullName || user?.username || 'Student'}</h2>
        <p className="text-blue-100 mt-1 text-sm">Track your learning progress and latest results.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        <StatCard
          label="Assigned Exams"
          value={exams.length}
          color="bg-blue-50 text-blue-600"
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414A1 1 0 0119 9.414V19a2 2 0 01-2 2z" />
            </svg>
          }
        />
        <StatCard
          label="Completed Exams"
          value={completedExamCount}
          color="bg-green-50 text-green-600"
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          }
        />
        <StatCard
          label="Pending Exams"
          value={pendingExamCount}
          color="bg-amber-50 text-amber-600"
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <StatCard
          label="Total Score"
          value={formatScore(totalScore)}
          color="bg-violet-50 text-violet-600"
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 8c-2.761 0-5 1.567-5 3.5S9.239 15 12 15s5 1.567 5 3.5S14.761 22 12 22m0-14V2m0 20v-7" />
            </svg>
          }
        />
        <StatCard
          label="Average Score"
          value={formatScore(averageScore)}
          color="bg-cyan-50 text-cyan-700"
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 17v-6m4 6V7m4 10v-3M5 21h14" />
            </svg>
          }
        />
        <StatCard
          label="Best Score"
          value={formatScore(bestScore)}
          color="bg-emerald-50 text-emerald-700"
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="m5 13 4 4L19 7" />
            </svg>
          }
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="card !p-5">
          <h3 className="section-title">Completion Rate</h3>
          <div className="mt-4">
            <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
              <div className="h-full bg-blue-600" style={{ width: `${completionRate}%` }} />
            </div>
            <p className="mt-2 text-sm text-slate-600">
              {completionRate}% ({completedExamCount}/{exams.length || 0} exams completed)
            </p>
            <p className="mt-1 text-xs text-slate-400">
              In progress submissions: {inProgressSubmissions.length}
            </p>
          </div>
        </div>
        <div className="card !p-5">
          <h3 className="section-title">Score Distribution</h3>
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Strong (&gt;=75)</span>
              <span className="font-semibold text-emerald-700">{scoreBands.strong}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Average (50-74.9)</span>
              <span className="font-semibold text-amber-700">{scoreBands.average}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Needs work (&lt;50)</span>
              <span className="font-semibold text-rose-700">{scoreBands.needsWork}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="card !p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700">Recent Attempts</h3>
          <Link to="/submissions" className="text-sm text-blue-600 hover:underline font-medium">View all</Link>
        </div>
        {recentAttempts.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">No submission data yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Exam</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Status</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Latest Time</th>
                  <th className="px-4 py-2 text-center text-xs font-semibold text-slate-500 uppercase">Score</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500 uppercase">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {recentAttempts.map((s) => (
                  <tr key={s.id}>
                    <td className="px-4 py-2 text-slate-700">{s.examTitle || `Exam #${s.examId}`}</td>
                    <td className="px-4 py-2">
                      <span className={`text-xs font-semibold ${
                        completedStatuses.has(s.status) ? 'text-emerald-700' : 'text-amber-700'
                      }`}>
                        {s.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-xs text-slate-500">
                      {(s.endTime || s.submitTime || s.startTime)
                        ? new Date(s.endTime || s.submitTime || s.startTime).toLocaleString()
                        : '-'}
                    </td>
                    <td className="px-4 py-2 text-center font-semibold text-blue-700">{formatScore(s.totalScore)}</td>
                    <td className="px-4 py-2 text-right">
                      <Link to={`/result/${s.id}`} className="text-xs text-blue-600 hover:underline">View Result</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
