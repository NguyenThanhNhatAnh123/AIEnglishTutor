import { useEffect, useMemo, useState } from 'react';
import { motion as Motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  BookOpenCheck,
  ClipboardCheck,
  FileQuestion,
  GraduationCap,
  ShieldAlert,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  UsersRound,
} from 'lucide-react';
import { teacherDashboardApi } from '../services/api';
import Layout from '../components/Layout';
import ActivityTimeline from '../components/dashboard/ActivityTimeline';
import AIInsights from '../components/dashboard/AIInsights';
import DashboardLoading from '../components/dashboard/DashboardLoading';
import DashboardPanel from '../components/dashboard/DashboardPanel';
import ExamPerformanceChart from '../components/dashboard/ExamPerformanceChart';
import MetricCard from '../components/dashboard/MetricCard';
import StatusMixChart from '../components/dashboard/StatusMixChart';
import SubmissionTrendChart from '../components/dashboard/SubmissionTrendChart';
import { Badge, Button } from '../components/ui/shadcn';

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

function formatPercent(value) {
  if (!Number.isFinite(value)) return '0%';
  return `${Math.round(value)}%`;
}

function formatDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function buildInsights(stats) {
  const insights = [];

  if (stats.suspiciousSubs.length > 0) {
    insights.push({
      label: 'Integrity',
      title: `${stats.suspiciousSubs.length} flagged submissions need review`,
      description: 'Check suspicious events before publishing final outcomes or using the scores for placement.',
      action: 'Open results',
      severity: 'high',
      icon: ShieldAlert,
    });
  }

  if (stats.averageScore != null && stats.averageScore < 60) {
    insights.push({
      label: 'Difficulty',
      title: 'Average score is below target',
      description: 'The current exam mix may be too difficult or students may need a targeted review session.',
      action: 'Inspect exams',
      severity: 'medium',
      icon: TrendingDown,
    });
  }

  if (stats.completionRate > 0 && stats.completionRate < 72) {
    insights.push({
      label: 'Completion',
      title: 'Completion rate is trailing',
      description: 'A reminder campaign could help students finish open attempts before grading windows close.',
      action: 'View activity',
      severity: 'medium',
      icon: AlertTriangle,
    });
  }

  if (stats.inProgressSubs.length > 0) {
    insights.push({
      label: 'Live',
      title: `${stats.inProgressSubs.length} attempts are still in progress`,
      description: 'Monitor active sessions and watch for late submissions or unusual timing patterns.',
      action: 'Track sessions',
      severity: 'info',
      icon: Sparkles,
    });
  }

  if (insights.length === 0) {
    insights.push(
      {
        label: 'Healthy',
        title: 'No urgent review signals detected',
        description: 'Your current exam health looks stable. Keep watching submissions as new attempts arrive.',
        action: 'Keep monitoring',
        severity: 'low',
        icon: TrendingUp,
      },
      {
        label: 'Growth',
        title: 'Question bank is ready to expand',
        description: 'Add fresh listening, writing, and speaking prompts to improve exam variety.',
        action: 'Add questions',
        severity: 'info',
        icon: FileQuestion,
      }
    );
  }

  return insights.slice(0, 3);
}

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [classCount, setClassCount] = useState(0);
  const [exams, setExams] = useState([]);
  const [submissions, setSubmissions] = useState([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const summary = await teacherDashboardApi.summary().then((r) => r.data?.data || {});
        if (cancelled) return;
        setClassCount(summary.classCount || 0);
        setExams(summary.exams || []);
        setSubmissions(summary.submissions || []);
      } catch {
        if (!cancelled) {
          setClassCount(0);
          setExams([]);
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
    const questionTotal = manageableExams.reduce((sum, exam) => sum + toNumber(exam.questionCount), 0);
    const completedStatuses = new Set(['SUBMITTED', 'AUTO_SUBMITTED']);
    const completedSubs = submissions.filter((s) => completedStatuses.has((s.status || '').toUpperCase()));
    const inProgressSubs = submissions.filter((s) => (s.status || '').toUpperCase() === 'IN_PROGRESS');
    const pendingReviews = completedSubs.filter((s) => s.totalScore == null);
    const gradedSubs = completedSubs.filter((s) => s.totalScore != null);
    const suspiciousSubs = submissions.filter((s) => toNumber(s.suspiciousEventCount) > 0);
    const uniqueStudents = new Set(submissions.map((s) => s.studentId).filter(Boolean));

    const totalScore = gradedSubs.reduce((sum, s) => sum + toNumber(s.totalScore), 0);
    const averageScore = gradedSubs.length ? totalScore / gradedSubs.length : null;
    const passCount = gradedSubs.filter((s) => toNumber(s.totalScore) >= 50).length;
    const passRate = gradedSubs.length ? Math.round((passCount / gradedSubs.length) * 100) : 0;
    const completionRate = submissions.length ? (completedSubs.length / submissions.length) * 100 : 0;

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
      if (toNumber(s.suspiciousEventCount) > 0) current.suspiciousAttempts += 1;
      examAggMap.set(key, current);
    });

    const examPerformance = [...examAggMap.values()]
      .map((item) => ({
        ...item,
        avgScore: item.gradedAttempts ? item.scoreSum / item.gradedAttempts : null,
      }))
      .filter((item) => item.avgScore != null)
      .sort((a, b) => b.attempts - a.attempts)
      .slice(0, 7);

    const recentSubmissions = [...submissions]
      .sort((a, b) => latestWorkTime(b) - latestWorkTime(a))
      .slice(0, 7);

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
      questionTotal,
      completedSubs,
      inProgressSubs,
      pendingReviews,
      gradedSubs,
      suspiciousSubs,
      uniqueStudents,
      averageScore,
      passRate,
      completionRate,
      examPerformance,
      recentSubmissions,
      dayBuckets,
    };
  }, [exams, submissions]);

  const insights = useMemo(() => buildInsights(stats), [stats]);

  if (loading) {
    return (
      <Layout>
        <DashboardLoading />
      </Layout>
    );
  }

  const statusData = [
    { name: 'Completed', value: stats.completedSubs.length, color: '#10B981' },
    { name: 'In progress', value: stats.inProgressSubs.length, color: '#F59E0B' },
    { name: 'Flagged', value: stats.suspiciousSubs.length, color: '#EF4444' },
  ];

  const metricCards = [
    {
      label: 'Active Exams',
      value: stats.activeExams.length,
      hint: `${stats.manageableExams.length} manageable exams`,
      trend: 'Live',
      icon: ClipboardCheck,
      tone: 'indigo',
      miniData: stats.dayBuckets.map((item) => item.count),
    },
    {
      label: 'Average Score',
      value: formatScore(stats.averageScore),
      hint: `${stats.gradedSubs.length} graded submissions`,
      trend: `${stats.passRate}% pass`,
      icon: Target,
      tone: 'emerald',
      miniData: stats.examPerformance.map((item) => item.avgScore),
    },
    {
      label: 'Completion Rate',
      value: formatPercent(stats.completionRate),
      hint: `${stats.completedSubs.length} completed of ${submissions.length}`,
      trend: 'Workflow',
      icon: TrendingUp,
      tone: 'sky',
      miniData: [stats.completedSubs.length, stats.inProgressSubs.length, stats.pendingReviews.length],
    },
    {
      label: 'Pending Reviews',
      value: stats.pendingReviews.length,
      hint: 'Submitted without final score',
      trend: stats.pendingReviews.length ? 'Review' : 'Clear',
      icon: ShieldAlert,
      tone: stats.pendingReviews.length ? 'amber' : 'slate',
      miniData: [stats.pendingReviews.length, stats.suspiciousSubs.length, stats.inProgressSubs.length],
    },
  ];

  return (
    <Layout>
      <Motion.div
        initial="hidden"
        animate="show"
        variants={{
          hidden: { opacity: 0 },
          show: { opacity: 1, transition: { staggerChildren: 0.06 } },
        }}
        className="space-y-5"
      >
        <Motion.section
          variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }}
          className="overflow-hidden rounded-lg border border-white/70 bg-white/75 shadow-panel backdrop-blur-xl"
        >
          <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.75fr)] lg:p-7">
            <div>
              <Badge variant="outline" className="bg-white/80">
                AI-powered teacher command center
              </Badge>
              <h1 className="mt-4 max-w-3xl text-3xl font-bold tracking-normal text-slate-950 md:text-4xl">
                Teaching intelligence for exams, progress, and review quality.
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500 md:text-base">
                Monitor exam health, student activity, completion quality, and AI-detected risk signals from one calm workspace.
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-2">
                <Button asChild>
                  <Link to="/results">Review submissions</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to="/exams">Manage exams</Link>
                </Button>
                <Button asChild variant="ghost">
                  <Link to="/questions">Open question bank</Link>
                </Button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              <div className="rounded-lg bg-slate-950 p-4 text-white shadow-soft">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-200">Today signal</p>
                <p className="mt-3 text-3xl font-bold">{stats.dayBuckets.at(-1)?.count || 0}</p>
                <p className="mt-1 text-sm text-slate-300">attempts recorded today</p>
              </div>
              <div className="rounded-lg border border-white/70 bg-white/70 p-4">
                <UsersRound className="h-5 w-5 text-indigo-500" />
                <p className="mt-3 text-2xl font-bold text-slate-950">{stats.uniqueStudents.size}</p>
                <p className="text-sm text-slate-500">active students</p>
              </div>
              <div className="rounded-lg border border-white/70 bg-white/70 p-4">
                <BookOpenCheck className="h-5 w-5 text-violet-500" />
                <p className="mt-3 text-2xl font-bold text-slate-950">{stats.questionTotal}</p>
                <p className="text-sm text-slate-500">question bank items</p>
              </div>
            </div>
          </div>
        </Motion.section>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {metricCards.map((card) => (
            <MetricCard key={card.label} {...card} />
          ))}
        </div>

        <AIInsights insights={insights} />

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.65fr)]">
          <DashboardPanel
            title="Submission Trends"
            description="Attempts recorded over the last seven days."
            action={<Badge variant="info">{submissions.length} total</Badge>}
          >
            <SubmissionTrendChart data={stats.dayBuckets} />
          </DashboardPanel>

          <DashboardPanel
            title="Completion Mix"
            description="Completed, live, and flagged work."
            action={<Badge variant="success">{stats.passRate}% pass</Badge>}
          >
            <StatusMixChart data={statusData} total={submissions.length} passRate={stats.passRate} />
          </DashboardPanel>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(420px,1.05fr)]">
          <DashboardPanel
            title="Exam Performance"
            description="Average score by exam, ranked by activity."
            action={<Badge variant="outline">{stats.examPerformance.length} exams</Badge>}
          >
            <ExamPerformanceChart data={stats.examPerformance} />
          </DashboardPanel>

          <DashboardPanel
            title="Recent Activity"
            description="A live timeline of the latest student submissions."
            action={<Link to="/results" className="text-sm font-bold text-indigo-600 transition hover:text-indigo-700">Open results</Link>}
          >
            <ActivityTimeline items={stats.recentSubmissions} formatScore={formatScore} formatDateTime={formatDateTime} />
          </DashboardPanel>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <DashboardPanel className="lg:col-span-2">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="inline-flex items-center gap-2 rounded-md bg-indigo-50 px-2.5 py-1 text-xs font-bold uppercase tracking-[0.14em] text-indigo-600">
                  <GraduationCap className="h-3.5 w-3.5" />
                  Cohort overview
                </div>
                <h2 className="mt-3 text-xl font-bold text-slate-950">{classCount} managed classes</h2>
                <p className="mt-1 text-sm text-slate-500">Use classes to organize access, exam assignment, and performance review.</p>
              </div>
              <Button asChild variant="outline">
                <Link to="/classes">Manage classes</Link>
              </Button>
            </div>
          </DashboardPanel>

          <DashboardPanel>
                <p className="text-sm font-semibold text-slate-500">Question readiness</p>
                <div className="mt-4 flex items-end justify-between gap-4">
                  <div>
                <p className="text-4xl font-bold text-slate-950">{stats.questionTotal}</p>
                <p className="mt-1 text-sm text-slate-500">Reusable items</p>
              </div>
              <FileQuestion className="h-10 w-10 text-violet-500" />
            </div>
          </DashboardPanel>
        </div>
      </Motion.div>
    </Layout>
  );
}
