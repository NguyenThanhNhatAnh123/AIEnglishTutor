import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { classApi, examApi, questionApi, submissionApi } from '../services/api';
import Layout from '../components/Layout';
import { PageLoader } from '../components/common/LoadingSpinner';

function StatCard({ label, value, hint, tone = 'slate' }) {
  const toneMap = {
    slate: 'bg-white border-slate-200 text-slate-800',
    blue: 'bg-blue-50 border-blue-200 text-blue-800',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    amber: 'bg-amber-50 border-amber-200 text-amber-800',
    violet: 'bg-violet-50 border-violet-200 text-violet-800',
    rose: 'bg-rose-50 border-rose-200 text-rose-800',
  };
  return (
    <div className={`rounded-2xl border p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${toneMap[tone] || toneMap.slate}`}>
      <p className="text-xs uppercase tracking-wide font-semibold opacity-80">{label}</p>
      <p className="text-3xl font-extrabold mt-2">{value}</p>
      {hint && <p className="text-xs mt-1 opacity-80">{hint}</p>}
    </div>
  );
}

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function latestWorkTime(submission) {
  return new Date(submission.endTime || submission.submitTime || submission.startTime || 0).getTime();
}

function formatScore(value) {
  if (value == null || Number.isNaN(Number(value))) return '-';
  return Number(value).toFixed(1);
}

function statusPill(status) {
  const normalized = (status || '').toUpperCase();
  if (normalized === 'SUBMITTED' || normalized === 'AUTO_SUBMITTED') {
    return 'text-emerald-700 bg-emerald-50 border-emerald-200';
  }
  if (normalized === 'IN_PROGRESS') {
    return 'text-amber-700 bg-amber-50 border-amber-200';
  }
  return 'text-slate-700 bg-slate-50 border-slate-200';
}

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState([]);
  const [exams, setExams] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [submissions, setSubmissions] = useState([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [classRes, examRes, questionRes] = await Promise.all([
          classApi.getAll().then((r) => r.data?.data || []),
          examApi.getAll().then((r) => r.data?.data || []),
          questionApi.getAll().then((r) => r.data?.data || []),
        ]);

        if (cancelled) return;
        setClasses(classRes);
        setExams(examRes);
        setQuestions(questionRes);

        const manageableExams = examRes.filter((e) => e.canManage !== false);
        const submissionBatches = await Promise.all(
          manageableExams.map((e) =>
            submissionApi.getByExamId(e.id)
              .then((r) => r.data?.data || [])
              .catch(() => [])
          )
        );
        if (!cancelled) {
          setSubmissions(submissionBatches.flat());
        }
      } catch {
        if (!cancelled) {
          setClasses([]);
          setExams([]);
          setQuestions([]);
          setSubmissions([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const stats = useMemo(() => {
    const manageableExams = exams.filter((e) => e.canManage !== false);
    const activeExams = manageableExams.filter((e) => (e.status || '').toUpperCase() === 'ACTIVE');
    const completedStatuses = new Set(['SUBMITTED', 'AUTO_SUBMITTED']);
    const completedSubs = submissions.filter((s) => completedStatuses.has((s.status || '').toUpperCase()));
    const inProgressSubs = submissions.filter((s) => (s.status || '').toUpperCase() === 'IN_PROGRESS');
    const gradedSubs = completedSubs.filter((s) => s.totalScore != null);
    const suspiciousSubs = submissions.filter((s) => toNumber(s.suspiciousEventCount) > 0);

    const totalScore = gradedSubs.reduce((sum, s) => sum + toNumber(s.totalScore), 0);
    const averageScore = gradedSubs.length ? totalScore / gradedSubs.length : null;
    const passCount = gradedSubs.filter((s) => toNumber(s.totalScore) >= 50).length;
    const passRate = gradedSubs.length ? Math.round((passCount / gradedSubs.length) * 100) : 0;

    const examAggMap = new Map();
    submissions.forEach((s) => {
      const key = s.examId;
      const current = examAggMap.get(key) || {
        examId: s.examId,
        examTitle: s.examTitle || `Exam #${s.examId}`,
        attempts: 0,
        gradedAttempts: 0,
        scoreSum: 0,
        suspiciousAttempts: 0,
      };
      current.attempts += 1;
      if (s.totalScore != null) {
        current.gradedAttempts += 1;
        current.scoreSum += toNumber(s.totalScore);
      }
      if (toNumber(s.suspiciousEventCount) > 0) {
        current.suspiciousAttempts += 1;
      }
      examAggMap.set(key, current);
    });
    const examPerformance = [...examAggMap.values()]
      .map((item) => ({
        ...item,
        avgScore: item.gradedAttempts ? (item.scoreSum / item.gradedAttempts) : null,
      }))
      .sort((a, b) => b.attempts - a.attempts)
      .slice(0, 8);

    const recentSubmissions = [...submissions]
      .sort((a, b) => latestWorkTime(b) - latestWorkTime(a))
      .slice(0, 10);

    return {
      manageableExams,
      activeExams,
      completedSubs,
      inProgressSubs,
      gradedSubs,
      suspiciousSubs,
      averageScore,
      passRate,
      examPerformance,
      recentSubmissions,
    };
  }, [exams, submissions]);

  if (loading) {
    return (
      <Layout>
        <PageLoader />
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-slate-950 p-6 text-white shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide font-bold text-blue-200">Teacher analytics</p>
              <h2 className="mt-2 text-3xl font-extrabold">Teaching overview</h2>
              <p className="mt-2 max-w-2xl text-sm text-slate-300">
                Monitor submissions, grading workload, score quality, and exam health in one workspace.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Link to="/results" className="rounded-xl bg-white px-4 py-2 font-bold text-slate-900 transition hover:bg-blue-50">Results</Link>
              <Link to="/exams" className="rounded-xl border border-white/20 px-4 py-2 font-bold text-white transition hover:bg-white/10">Exams</Link>
              <Link to="/questions" className="rounded-xl border border-white/20 px-4 py-2 font-bold text-white transition hover:bg-white/10">Question bank</Link>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          <StatCard label="Classes" value={classes.length} hint="Managed classes" tone="blue" />
          <StatCard label="Exams" value={stats.manageableExams.length} hint={`${stats.activeExams.length} active`} tone="emerald" />
          <StatCard label="Questions" value={questions.length} hint="All question types" tone="violet" />
          <StatCard label="Submissions" value={submissions.length} hint={`${stats.completedSubs.length} completed`} tone="slate" />
          <StatCard label="In Progress" value={stats.inProgressSubs.length} hint="Open exam sessions" tone="amber" />
          <StatCard label="Suspicious" value={stats.suspiciousSubs.length} hint="Attempts with warnings" tone="rose" />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Score Quality</h3>
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">Average score</span>
                <span className="font-semibold text-slate-800">{formatScore(stats.averageScore)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">Pass rate (&gt;= 50)</span>
                <span className="font-semibold text-slate-800">{stats.passRate}%</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full bg-emerald-600" style={{ width: `${stats.passRate}%` }} />
              </div>
              <p className="text-xs text-slate-500">
                Based on {stats.gradedSubs.length} graded submissions.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Exam Status Mix</h3>
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">Active exams</span>
                <span className="font-semibold text-slate-800">{stats.activeExams.length}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">Non-active exams</span>
                <span className="font-semibold text-slate-800">{Math.max(0, stats.manageableExams.length - stats.activeExams.length)}</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full bg-blue-600"
                  style={{
                    width: `${stats.manageableExams.length ? Math.round((stats.activeExams.length / stats.manageableExams.length) * 100) : 0}%`,
                  }}
                />
              </div>
              <p className="text-xs text-slate-500">
                Active ratio across manageable exams.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700">Recent Submissions</h3>
            <Link to="/results" className="text-sm text-blue-600 hover:underline">Open results</Link>
          </div>
          {stats.recentSubmissions.length === 0 ? (
            <div className="p-6 text-sm text-slate-500">No submissions yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[820px]">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Student</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Exam</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Status</th>
                    <th className="px-4 py-2 text-center text-xs font-semibold text-slate-500 uppercase">Score</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500 uppercase">Latest Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {stats.recentSubmissions.map((s) => (
                    <tr key={s.id}>
                      <td className="px-4 py-2 text-slate-700">{s.studentName || `Student #${s.studentId}`}</td>
                      <td className="px-4 py-2 text-slate-700">{s.examTitle || `Exam #${s.examId}`}</td>
                      <td className="px-4 py-2">
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${statusPill(s.status)}`}>
                          {s.status}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-center font-semibold text-blue-700">{formatScore(s.totalScore)}</td>
                      <td className="px-4 py-2 text-right text-xs text-slate-500">
                        {(s.endTime || s.submitTime || s.startTime)
                          ? new Date(s.endTime || s.submitTime || s.startTime).toLocaleString()
                          : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-700">Top Exam Performance</h3>
          </div>
          {stats.examPerformance.length === 0 ? (
            <div className="p-6 text-sm text-slate-500">No exam performance data yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[780px]">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Exam</th>
                    <th className="px-4 py-2 text-center text-xs font-semibold text-slate-500 uppercase">Attempts</th>
                    <th className="px-4 py-2 text-center text-xs font-semibold text-slate-500 uppercase">Avg Score</th>
                    <th className="px-4 py-2 text-center text-xs font-semibold text-slate-500 uppercase">Suspicious</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {stats.examPerformance.map((item) => (
                    <tr key={item.examId}>
                      <td className="px-4 py-2 text-slate-700">{item.examTitle}</td>
                      <td className="px-4 py-2 text-center font-semibold text-slate-700">{item.attempts}</td>
                      <td className="px-4 py-2 text-center font-semibold text-blue-700">{formatScore(item.avgScore)}</td>
                      <td className="px-4 py-2 text-center">
                        <span className={`text-xs font-semibold ${item.suspiciousAttempts > 0 ? 'text-amber-700' : 'text-slate-500'}`}>
                          {item.suspiciousAttempts}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
