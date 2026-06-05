import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

function PerformanceTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  return (
    <div className="max-w-64 rounded-lg border border-white/80 bg-white/95 px-3 py-2 text-sm shadow-panel">
      <p className="truncate font-semibold text-slate-900">{label}</p>
      <p className="mt-1 text-slate-500">Điểm trung bình: <span className="font-bold text-indigo-600">{item.avgScore.toFixed(1)}</span></p>
      <p className="text-slate-500">{item.attempts} lần làm, {item.suspiciousAttempts} cảnh báo</p>
    </div>
  );
}

export default function ExamPerformanceChart({ data }) {
  if (!data.length) {
    return <div className="flex h-80 items-center justify-center text-sm text-slate-500">Chưa có hiệu suất bài thi đã chấm.</div>;
  }

  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 12, right: 16, top: 8, bottom: 8 }}>
          <defs>
            <linearGradient id="examPerformanceFill" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#6366F1" />
              <stop offset="100%" stopColor="#8B5CF6" />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#E5E7EB" strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF', fontSize: 12 }} />
          <YAxis
            dataKey="examTitle"
            type="category"
            width={132}
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#6B7280', fontSize: 12 }}
          />
          <Tooltip content={<PerformanceTooltip />} cursor={{ fill: 'rgba(99,102,241,0.06)' }} />
          <Bar dataKey="avgScore" fill="url(#examPerformanceFill)" radius={[0, 8, 8, 0]} barSize={16} animationDuration={900} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
