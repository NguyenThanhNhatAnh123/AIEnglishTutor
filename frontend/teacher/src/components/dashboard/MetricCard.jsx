import { motion as Motion } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';

export default function MetricCard({ label, value, hint, trend, icon: Icon, tone = 'indigo', miniData = [] }) {
  const toneClass = {
    indigo: 'from-indigo-500 to-violet-500 text-indigo-600 bg-indigo-50',
    emerald: 'from-emerald-500 to-teal-500 text-emerald-600 bg-emerald-50',
    amber: 'from-amber-500 to-orange-500 text-amber-600 bg-amber-50',
    rose: 'from-rose-500 to-red-500 text-rose-600 bg-rose-50',
    sky: 'from-sky-500 to-cyan-500 text-sky-600 bg-sky-50',
    slate: 'from-slate-800 to-slate-600 text-slate-700 bg-slate-100',
  }[tone];

  const max = Math.max(1, ...miniData.map((item) => Number(item) || 0));

  return (
    <Motion.article
      whileHover={{ y: -4 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      className="group rounded-lg border border-white/70 bg-white/75 p-4 shadow-panel backdrop-blur-xl"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-bold tracking-normal text-slate-950">{value}</p>
        </div>
        {Icon && (
          <div className={`flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-to-br text-white shadow-sm ${toneClass.split(' ').slice(0, 2).join(' ')}`}>
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>

      <div className="mt-4 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-slate-500">{hint}</p>
          {trend && (
            <div className={`mt-2 inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-bold ${toneClass.split(' ').slice(2).join(' ')}`}>
              <ArrowUpRight className="h-3.5 w-3.5" />
              {trend}
            </div>
          )}
        </div>
        {miniData.length > 0 && (
          <div className="flex h-10 items-end gap-1">
            {miniData.map((item, index) => (
              <span
                key={`${item}-${index}`}
                className="w-1.5 rounded-full bg-slate-200 transition group-hover:bg-indigo-300"
                style={{ height: `${Math.max(18, ((Number(item) || 0) / max) * 40)}px` }}
              />
            ))}
          </div>
        )}
      </div>
    </Motion.article>
  );
}
