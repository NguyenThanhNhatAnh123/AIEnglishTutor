import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

function StatusTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  return (
    <div className="rounded-lg border border-white/80 bg-white/95 px-3 py-2 text-sm shadow-panel">
      <p className="font-semibold text-slate-900">{item.name}</p>
      <p className="mt-1 text-slate-500">{item.value} attempts</p>
    </div>
  );
}

export default function StatusMixChart({ data, total, passRate }) {
  return (
    <div className="grid gap-5 md:grid-cols-[minmax(0,220px)_1fr] xl:grid-cols-1 2xl:grid-cols-[minmax(0,220px)_1fr]">
      <div className="relative h-56">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip content={<StatusTooltip />} />
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={64}
              outerRadius={88}
              paddingAngle={4}
              cornerRadius={8}
              animationDuration={800}
            >
              {data.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-3xl font-bold text-slate-950">{total}</p>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Attempts</p>
        </div>
      </div>

      <div className="space-y-4">
        {data.map((item) => (
          <div key={item.name} className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
              <span className="truncate text-sm font-semibold text-slate-700">{item.name}</span>
            </div>
            <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700">{item.value}</span>
          </div>
        ))}
        <div className="rounded-lg bg-slate-50 p-3">
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold text-slate-600">Pass rate</span>
            <span className="font-bold text-emerald-600">{passRate}%</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white">
            <div className="h-full rounded-full bg-app-success transition-all" style={{ width: `${passRate}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
}
