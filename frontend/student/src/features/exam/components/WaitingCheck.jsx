import { examRoomBackground, statusTone } from '../examUtils';
import examRoomStatCardBg from '../../../assets/exam/backgrounds/exam-room-stat-card-bg.jpg';

export function WaitingCheck({ label, detail, ok, waiting, action }) {
  return (
    <div
      className={`rounded-xl border p-4 ${statusTone(ok, waiting)}`}
      style={examRoomBackground(examRoomStatCardBg, ok ? 'rgba(236,253,245,0.94)' : waiting ? 'rgba(248,250,252,0.94)' : 'rgba(255,251,235,0.94)')}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold">{label}</p>
          <p className="mt-1 text-xs leading-relaxed opacity-80">{detail}</p>
        </div>
        <span className="shrink-0 rounded-full bg-white/70 px-2 py-1 text-[11px] font-bold dark:bg-slate-900/60">
          {ok ? 'Ready' : waiting ? 'Optional' : 'Needed'}
        </span>
      </div>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
