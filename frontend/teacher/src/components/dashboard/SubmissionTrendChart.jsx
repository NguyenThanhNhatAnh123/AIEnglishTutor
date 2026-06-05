import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-white/80 bg-white/95 px-3 py-2 text-sm shadow-panel">
      <p className="font-semibold text-slate-900">{label}</p>
      <p className="mt-1 text-slate-500">
        <span className="font-bold text-indigo-600">{payload[0].value}</span> lần làm
      </p>
    </div>
  );
}

export default function SubmissionTrendChart({ data }) {
  if (!data.length) {
    return <div className="flex h-72 items-center justify-center text-sm text-slate-500">Chưa có hoạt động nộp bài.</div>;
  }

  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ left: -18, right: 8, top: 12, bottom: 0 }}>
          <defs>
            <linearGradient id="submissionTrendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#6366F1" stopOpacity={0.28} />
              <stop offset="95%" stopColor="#6366F1" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#E5E7EB" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} />
          <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF', fontSize: 12 }} />
          <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#C7D2FE', strokeWidth: 1 }} />
          <Area
            type="monotone"
            dataKey="count"
            stroke="#6366F1"
            strokeWidth={3}
            fill="url(#submissionTrendFill)"
            animationDuration={900}
            dot={{ r: 4, fill: '#6366F1', stroke: '#fff', strokeWidth: 2 }}
            activeDot={{ r: 6, fill: '#8B5CF6', stroke: '#fff', strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
