export default function Badge({ status, label, className = '' }) {
  const text = label || status || '';
  const variants = {
    ACTIVE: 'bg-green-100 text-green-700 border border-green-200',
    PUBLISHED: 'bg-green-100 text-green-700 border border-green-200',
    DRAFT: 'bg-slate-100 text-slate-600 border border-slate-200',
    CLOSED: 'bg-red-100 text-red-600 border border-red-200',
    SUBMITTED: 'bg-blue-100 text-blue-700 border border-blue-200',
    GRADED: 'bg-purple-100 text-purple-700 border border-purple-200',
    IN_PROGRESS: 'bg-amber-100 text-amber-700 border border-amber-200',
    PENDING: 'bg-amber-100 text-amber-700 border border-amber-200',
    MULTIPLE_CHOICE: 'bg-blue-50 text-blue-600 border border-blue-100',
    WRITING: 'bg-violet-50 text-violet-600 border border-violet-100',
    SPEAKING: 'bg-rose-50 text-rose-600 border border-rose-100',
  };
  const style = variants[status?.toUpperCase()] || 'bg-slate-100 text-slate-600 border border-slate-200';
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${style} ${className}`}>
      {text.replace(/_/g, ' ')}
    </span>
  );
}
