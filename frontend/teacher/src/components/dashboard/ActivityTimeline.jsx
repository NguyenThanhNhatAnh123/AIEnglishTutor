import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Clock3 } from 'lucide-react';

function statusTone(status) {
  const normalized = (status || '').toUpperCase();
  if (normalized === 'SUBMITTED' || normalized === 'AUTO_SUBMITTED') {
    return { icon: CheckCircle2, className: 'bg-emerald-50 text-emerald-700 ring-emerald-100' };
  }
  if (normalized === 'IN_PROGRESS') {
    return { icon: Clock3, className: 'bg-amber-50 text-amber-700 ring-amber-100' };
  }
  return { icon: AlertTriangle, className: 'bg-slate-100 text-slate-600 ring-slate-200' };
}

export default function ActivityTimeline({ items, formatScore, formatDateTime }) {
  if (!items.length) {
    return (
      <div className="flex min-h-72 flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/70 text-center">
        <p className="text-sm font-bold text-slate-700">Chưa có bài nộp</p>
        <p className="mt-1 max-w-xs text-sm text-slate-500">Lần làm bài mới của học viên sẽ hiện tại đây theo dòng thời gian.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const tone = statusTone(item.status);
        const StatusIcon = tone.icon;
        return (
          <Link
            key={item.id}
            to="/results"
            className="group grid gap-3 rounded-lg border border-slate-100 bg-white/70 p-3 transition hover:border-indigo-100 hover:bg-white hover:shadow-soft sm:grid-cols-[auto_minmax(0,1fr)_auto]"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-slate-900 to-slate-700 text-sm font-bold text-white">
              {(item.studentName?.[0] || 'S').toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate text-sm font-bold text-slate-950">{item.studentName || `Học viên #${item.studentId}`}</p>
                <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-bold ring-1 ${tone.className}`}>
                  <StatusIcon className="h-3.5 w-3.5" />
                  {item.status || 'UNKNOWN'}
                </span>
              </div>
              <p className="mt-1 truncate text-xs font-medium text-slate-500">{item.examTitle || `Bài thi #${item.examId}`}</p>
              <p className="mt-2 text-xs text-slate-400">{formatDateTime(item.endTime || item.submitTime || item.startTime)}</p>
            </div>
            <div className="flex items-center justify-between gap-3 sm:block sm:text-right">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Điểm</p>
              <p className="mt-1 text-lg font-bold text-indigo-600">{formatScore(item.totalScore)}</p>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
