export default function EmptyState({ icon, title, description, action }) {
  const defaultIcon = (
    <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414A1 1 0 0119 9.414V19a2 2 0 01-2 2z"
      />
    </svg>
  );

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-20 h-20 rounded-full bg-blue-50 flex items-center justify-center text-blue-300 mb-4">
        {icon || defaultIcon}
      </div>
      <h3 className="text-base font-semibold text-slate-700 mb-1">{title || 'Nothing here yet'}</h3>
      {description && (
        <p className="text-sm text-slate-400 max-w-xs mb-5">{description}</p>
      )}
      {action && action}
    </div>
  );
}
