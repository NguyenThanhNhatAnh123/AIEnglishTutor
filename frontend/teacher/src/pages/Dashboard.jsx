import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { classApi, examApi, questionApi, submissionApi } from '../services/api';
import Layout from '../components/Layout';
import { PageLoader } from '../components/common/LoadingSpinner';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Progress,
} from '../components/ui/shadcn';

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

function formatDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function statusVariant(status) {
  const normalized = (status || '').toUpperCase();
  if (normalized === 'SUBMITTED' || normalized === 'AUTO_SUBMITTED') return 'success';
  if (normalized === 'IN_PROGRESS') return 'warning';
  if (normalized === 'ACTIVE') return 'info';
  return 'secondary';
}

function StatCard({ label, value, hint, trend, accent = 'bg-slate-900' }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-slate-500">{label}</p>
            <p className="mt-2 text-2xl font-semibold tracking-normal text-slate-950">{value}</p>
          </div>
          <span className={`mt-1 h-2.5 w-2.5 rounded-full ${accent}`} />
        </div>
        <div className="mt-3 flex items-center justify-between gap-2 text-xs text-slate-500">
          <span>{hint}</span>
          {trend && <Badge variant="outline">{trend}</Badge>}
        </div>
      </CardContent>
    </Card>
  );
}

function DonutChart({ segments, size = 150, stroke = 18 }) {
  const total = segments.reduce((sum, item) => sum + item.value, 0);
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth={stroke}
        />
        {total > 0 && segments.map((item) => {
          const length = (item.value / total) * circumference;
          const circle = (
            <circle
              key={item.label}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={item.color}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={`${Math.max(0, length - 2)} ${circumference}`}
              strokeDashoffset={-offset}
            />
          );
          offset += length;
          return circle;
        })}
      </svg>
      <div className="absolute text-center">
        <p className="text-2xl font-semibold text-slate-950">{total}</p>
        <p className="text-xs text-slate-500">attempts</p>
      </div>
    </div>
  );
}

function BarChart({ data }) {
  const max = Math.max(1, ...data.map((item) => toNumber(item.avgScore)));
  if (data.length === 0) {
    return <div className="py-8 text-center text-sm text-slate-500">No performance data yet.</div>;
  }

  return (
    <div className="space-y-4">
      {data.map((item) => {
        const width = Math.max(4, (toNumber(item.avgScore) / max) * 100);
        return (
          <div key={item.examId} className="space-y-1.5">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="truncate font-medium text-slate-700">{item.examTitle}</span>
              <span className="tabular-nums text-slate-500">{formatScore(item.avgScore)}</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-sky-600"
                style={{ width: `${width}%` }}
              />
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span>{item.attempts} attempts</span>
              <span>{item.suspiciousAttempts} warnings</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AreaChart({ data }) {
  const width = 620;
  const height = 170;
  const padX = 18;
  const padY = 16;
  const max = Math.max(1, ...data.map((d) => d.count));
  const points = data.map((d, index) => {
    const x = padX + (index * (width - padX * 2)) / Math.max(1, data.length - 1);
    const y = height - padY - (d.count / max) * (height - padY * 2);
    return { ...d, x, y };
  });
  const line = points.map((p) => `${p.x},${p.y}`).join(' ');
  const area = `${padX},${height - padY} ${line} ${width - padX},${height - padY}`;

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-44 w-full">
        <defs>
          <linearGradient id="submissionArea" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#0f766e" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#0f766e" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {[0, 1, 2, 3].map((tick) => {
          const y = padY + (tick * (height - padY * 2)) / 3;
          return <line key={tick} x1={padX} x2={width - padX} y1={y} y2={y} stroke="#e2e8f0" strokeWidth="1" />;
        })}
        <polygon points={area} fill="url(#submissionArea)" />
        <polyline points={line} fill="none" stroke="#0f766e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p) => (
          <circle key={p.label} cx={p.x} cy={p.y} r="4" fill="#0f766e" stroke="#fff" strokeWidth="2" />
        ))}
      </svg>
      <div className="grid grid-cols-7 gap-2 text-center text-[11px] text-slate-500">
        {points.map((p) => <span key={p.label}>{p.label}</span>)}
      </div>
    </div>
  );
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
      .filter((item) => item.avgScore != null)
      .sort((a, b) => b.attempts - a.attempts)
      .slice(0, 8);

    const recentSubmissions = [...submissions]
      .sort((a, b) => latestWorkTime(b) - latestWorkTime(a))
      .slice(0, 8);

    const dayBuckets = Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - index));
      date.setHours(0, 0, 0, 0);
      return {
        key: date.toISOString().slice(0, 10),
        label: date.toLocaleDateString(undefined, { weekday: 'short' }),
        count: 0,
      };
    });
    const bucketMap = new Map(dayBuckets.map((item) => [item.key, item]));
    submissions.forEach((s) => {
      const time = latestWorkTime(s);
      if (!time) return;
      const key = new Date(time).toISOString().slice(0, 10);
      const bucket = bucketMap.get(key);
      if (bucket) bucket.count += 1;
    });

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
      dayBuckets,
    };
  }, [exams, submissions]);

  if (loading) {
    return (
      <Layout>
        <PageLoader />
      </Layout>
    );
  }

  const statusSegments = [
    { label: 'Completed', value: stats.completedSubs.length, color: '#059669', variant: 'success' },
    { label: 'In progress', value: stats.inProgressSubs.length, color: '#d97706', variant: 'warning' },
    { label: 'Warnings', value: stats.suspiciousSubs.length, color: '#e11d48', variant: 'danger' },
  ];

  return (
    <Layout>
      <div className="space-y-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Badge variant="outline">Teacher dashboard</Badge>
            <h1 className="mt-3 text-3xl font-semibold tracking-normal text-slate-950">Teaching overview</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-500">
              A compact workspace for exam health, submissions, grading throughput, and class access.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline">
              <Link to="/results" className="px-4">Results</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/exams" className="px-4">Exams</Link>
            </Button>
            <Button asChild>
              <Link to="/questions" className="px-4 text-white">Question bank</Link>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Classes" value={classes.length} hint="Managed cohorts" accent="bg-sky-600" />
          <StatCard label="Active Exams" value={stats.activeExams.length} hint={`${stats.manageableExams.length} total exams`} accent="bg-emerald-600" />
          <StatCard label="Question Bank" value={questions.length} hint="Reusable items" accent="bg-violet-600" />
          <StatCard label="Avg Score" value={formatScore(stats.averageScore)} hint={`${stats.gradedSubs.length} graded submissions`} trend={`${stats.passRate}% pass`} accent="bg-amber-500" />
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(340px,0.7fr)]">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Submission Activity</CardTitle>
              <CardDescription>Attempts recorded over the last seven days.</CardDescription>
            </CardHeader>
            <CardContent>
              <AreaChart data={stats.dayBuckets} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Status Mix</CardTitle>
              <CardDescription>Completed, open, and flagged attempts.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-[160px_minmax(0,1fr)] xl:grid-cols-1 2xl:grid-cols-[160px_minmax(0,1fr)]">
              <DonutChart segments={statusSegments} />
              <div className="space-y-3">
                {statusSegments.map((item) => (
                  <div key={item.label} className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-sm text-slate-600">{item.label}</span>
                    </div>
                    <Badge variant={item.variant}>{item.value}</Badge>
                  </div>
                ))}
                <Progress value={stats.passRate} indicatorClassName="bg-emerald-600" />
                <p className="text-xs text-slate-500">{stats.passRate}% pass rate from graded submissions.</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Top Exam Performance</CardTitle>
              <CardDescription>Average score by exam, ranked by attempts.</CardDescription>
            </CardHeader>
            <CardContent>
              <BarChart data={stats.examPerformance} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle>Recent Submissions</CardTitle>
                <CardDescription>Latest student work across your exams.</CardDescription>
              </div>
              <Link to="/results" className="text-sm font-medium text-sky-700 hover:underline">Open</Link>
            </CardHeader>
            <CardContent>
              {stats.recentSubmissions.length === 0 ? (
                <div className="py-8 text-center text-sm text-slate-500">No submissions yet.</div>
              ) : (
                <div className="space-y-3">
                  {stats.recentSubmissions.map((s) => (
                    <div key={s.id} className="grid gap-2 rounded-lg border border-slate-100 bg-slate-50/70 p-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-900">{s.studentName || `Student #${s.studentId}`}</p>
                        <p className="truncate text-xs text-slate-500">{s.examTitle || `Exam #${s.examId}`}</p>
                      </div>
                      <div className="flex items-center gap-2 sm:justify-end">
                        <Badge variant={statusVariant(s.status)}>{s.status}</Badge>
                        <span className="min-w-12 text-right text-sm font-semibold text-sky-700">{formatScore(s.totalScore)}</span>
                      </div>
                      <p className="text-xs text-slate-400 sm:col-span-2">{formatDateTime(s.endTime || s.submitTime || s.startTime)}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
