import { motion as Motion } from 'framer-motion';
import { ArrowRight, Sparkles } from 'lucide-react';

const severityClass = {
  high: 'border-rose-100 bg-rose-50/80 text-rose-700',
  medium: 'border-amber-100 bg-amber-50/80 text-amber-700',
  low: 'border-emerald-100 bg-emerald-50/80 text-emerald-700',
  info: 'border-indigo-100 bg-indigo-50/80 text-indigo-700',
};

export default function AIInsights({ insights }) {
  return (
    <section className="rounded-lg border border-indigo-100/80 bg-gradient-to-br from-white/85 to-indigo-50/80 p-5 shadow-panel backdrop-blur-xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-md bg-white/80 px-2.5 py-1 text-xs font-bold uppercase tracking-[0.14em] text-indigo-600 ring-1 ring-indigo-100">
            <Sparkles className="h-3.5 w-3.5" />
            Gợi ý AI
          </div>
          <h2 className="mt-3 text-xl font-bold text-slate-950">Hành động đề xuất cho giáo viên</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Tín hiệu được tạo từ bài nộp, điểm số, mức độ hoàn thành và hoạt động bất thường.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-3">
        {insights.map((item, index) => (
          <Motion.article
            key={item.title}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.06, duration: 0.25 }}
            className="rounded-lg border border-white/70 bg-white/80 p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-soft"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <span className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-bold ${severityClass[item.severity] || severityClass.info}`}>
                  {item.label}
                </span>
                <h3 className="mt-3 text-sm font-bold text-slate-950">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">{item.description}</p>
              </div>
              <item.icon className="h-5 w-5 shrink-0 text-indigo-500" />
            </div>
            <div className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-indigo-600">
              {item.action}
              <ArrowRight className="h-3.5 w-3.5" />
            </div>
          </Motion.article>
        ))}
      </div>
    </section>
  );
}
