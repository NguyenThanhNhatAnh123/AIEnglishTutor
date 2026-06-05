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
        else warnings.push('bài thi được giao');
        if (submissionResult.status === 'fulfilled') setSubmissions(submissionResult.value);
        else warnings.push('lịch sử nộp bài');
        setLoadWarning(warnings.length ? `Không thể làm mới ${warnings.join(' và ')}.` : null);
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
        eyebrow: 'Tiếp tục học',
        title: latestInProgress.examTitle || `Bài thi #${latestInProgress.examId}`,
        description: 'Bạn đang có một lần làm bài chưa hoàn tất. Hãy tiếp tục trước khi bắt đầu bài mới.',
        to: `/exam/${latestInProgress.examId}`,
        action: 'Tiếp tục bài thi',
        tone: 'amber',
      }
    : nextExam
      ? {
          eyebrow: 'Bài thi tiếp theo',
          title: nextExam.title,
          description: `${nextExam.durationMinutes || 0} phút - ${nextExam.examType === 'OFFICIAL' ? 'Bài thi chính thức' : 'Bài luyện tập'}.`,
          to: `/exam/${nextExam.id}`,
          action: 'Bắt đầu bài thi',
          tone: nextExam.examType === 'OFFICIAL' ? 'amber' : 'blue',
        }
      : completedSubmissions.length
        ? {
            eyebrow: 'Có nhận xét mới',
            title: 'Xem lại kết quả gần nhất',
            description: 'Kiểm tra điểm đã công bố, ghi chú của giáo viên và kỹ năng cần cải thiện.',
            to: '/submissions',
            action: 'Xem nhận xét',
            tone: 'emerald',
          }
        : {
            eyebrow: loadWarning ? 'Cần chú ý' : 'Trang học tập',
            title: loadWarning ? 'Làm mới dữ liệu học tập' : 'Chưa có bài thi được giao',
            description: loadWarning
              ? 'Một số dữ liệu học tập chưa tải được. Hãy thử lại trước khi bắt đầu.'
              : 'Giáo viên chưa giao bài thi đang hoạt động. Khu vực này sẽ hiện hoạt động tiếp theo khi có.',
            to: loadWarning ? '/dashboard' : '/exams',
            action: loadWarning ? 'Tải lại trang' : 'Xem bài thi',
            tone: loadWarning ? 'amber' : 'blue',
            reload: Boolean(loadWarning),
          };

  const writingCount = submissions.reduce((sum, s) => sum + toNumber(s.writingAnswerCount), 0);
  const speakingCount = submissions.reduce((sum, s) => sum + toNumber(s.speakingAnswerCount), 0);
  const pendingReviewCount = submissions.filter((s) => s.subjectiveReviewStatus === 'PENDING').length;
  const practiceNext = averageScore == null
    ? 'Hãy bắt đầu với một bài thi được giao để mở gợi ý luyện tập cá nhân.'
    : averageScore >= 75
      ? 'Giữ nhịp độ bằng các bài luyện tính giờ và xem lại ghi chú của giáo viên.'
      : 'Hãy xem nhận xét trước, sau đó luyện lại kỹ năng yếu nhất trong một phiên ngắn hơn.';

  return (
    <div className="space-y-5">
      {loadWarning && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
          {loadWarning} Một số số liệu có thể chưa đầy đủ.
        </div>
      )}

      <section
        className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
        style={dashboardBackground(dashboardMainBg, 'rgba(255, 255, 255, 0.9)')}
      >
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">Trang học tập</p>
            <h2 className="mt-2 text-2xl font-extrabold text-slate-950 sm:text-3xl">
              Chào mừng trở lại, {user?.fullName || user?.username || 'Học viên'}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-500">
              Tiếp tục bài thi tiếp theo, xem nhận xét và tập trung vào kỹ năng cần cải thiện nhất.
            </p>
          </div>
          <div className="rounded-xl bg-slate-950 p-4 text-white shadow-sm lg:min-w-44">
            <p className="text-xs font-bold uppercase tracking-wide text-blue-200">Hoàn thành</p>
            <p className="mt-1 text-3xl font-extrabold">{completionRate}%</p>
            <p className="text-xs text-slate-300">{completedExamCount}/{exams.length || 0} bài thi đã hoàn thành</p>
          </div>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        <ActionCard {...primaryAction} />
        <article
          className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
          style={dashboardBackground(dashboardMainBg, 'rgba(255, 255, 255, 0.94)')}
        >
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Luyện tập tiếp theo</p>
          <h3 className="mt-2 text-xl font-extrabold text-slate-900">{formatScore(averageScore)} điểm trung bình</h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">{practiceNext}</p>
          {latestPublished && (
            <Link to={`/result/${latestPublished.id}`} className="mt-4 inline-flex text-sm font-bold text-blue-600 hover:underline">
              Mở kết quả gần nhất
            </Link>
          )}
        </article>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Cần làm"
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
          label="Đang làm"
          value={inProgressSubmissions.length}
          color="bg-green-50 text-green-600"
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          }
        />
        <StatCard
          label="Chờ chấm"
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
          title="Viết"
          detail="Dùng nhận xét của giáo viên và bài viết đã nộp để chọn nội dung cần viết lại."
          value={writingCount || 'Chưa có'}
          tone={writingCount ? 'blue' : 'slate'}
        />
        <SkillFocus
          title="Nói"
          detail="Nghe lại bài ghi âm và nhận xét đã công bố trước câu hỏi nói tiếp theo."
          value={speakingCount || 'Chưa có'}
          tone={speakingCount ? 'emerald' : 'slate'}
        />
        <SkillFocus
          title="Tình trạng điểm"
          detail={`${scoreBands.needsWork} kết quả cần luyện thêm; điểm cao nhất ${formatScore(bestScore)}.`}
          value={averageScore == null ? 'Mới' : averageScore >= 75 ? 'Tốt' : 'Cần luyện'}
          tone={averageScore == null ? 'slate' : averageScore >= 75 ? 'emerald' : 'amber'}
        />
      </div>

      <div
        className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
        style={dashboardBackground(dashboardMainBg, 'rgba(255, 255, 255, 0.95)')}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900">Hoạt động gần đây</h3>
            <p className="text-xs text-slate-500">Lần làm bài, điểm và trạng thái chấm mới nhất.</p>
          </div>
          <Link to="/submissions" className="text-sm text-blue-600 hover:underline font-medium">Xem tất cả</Link>
        </div>
        {recentAttempts.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm font-semibold text-slate-700">Chưa có hoạt động học tập</p>
            <p className="mt-1 text-sm text-slate-400">Bắt đầu một bài thi để xem tiến độ và nhận xét tại đây.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {recentAttempts.map((s) => (
              <div key={s.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-slate-900">{s.examTitle || `Bài thi #${s.examId}`}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {(s.endTime || s.submitTime || s.startTime)
                      ? new Date(s.endTime || s.submitTime || s.startTime).toLocaleString()
                      : 'Chưa có thời gian hoạt động'}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                    completedStatuses.has(s.status) ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                  }`}>
                    {s.status}
                  </span>
                  <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">
                    Điểm {formatScore(s.totalScore)}
                  </span>
                  <Link to={completedStatuses.has(s.status) ? `/result/${s.id}` : `/exam/${s.examId}`} className="text-xs font-bold text-blue-600 hover:underline">
                    {completedStatuses.has(s.status) ? 'Xem kết quả' : 'Tiếp tục'}
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
