/**
 * Shared Card component.
 *
 * Variants:
 *   default  – white card with border and shadow
 *   flat     – no shadow
 *   outlined – colored border
 *   gradient – sky blue gradient header
 *
 * Usage:
 *   <Card title="My Card" subtitle="optional">...</Card>
 *   <Card variant="gradient">...</Card>
 */
export default function Card({
  children,
  title,
  subtitle,
  variant = 'default',
  className = '',
  headerAction,
}) {
  const bases = {
    default:  'bg-white rounded-2xl shadow-sm border border-slate-100',
    flat:     'bg-white rounded-2xl border border-slate-100',
    outlined: 'bg-white rounded-2xl border-2 border-sky-200',
    gradient: 'bg-gradient-to-r from-sky-400 to-sky-300 rounded-2xl text-white',
  };

  const style = bases[variant] || bases.default;

  return (
    <div className={`${style} ${className}`}>
      {(title || headerAction) && (
        <div className={`flex items-center justify-between px-5 py-4 ${variant !== 'gradient' ? 'border-b border-slate-100' : 'border-b border-white/20'}`}>
          <div>
            {title && (
              <h3 className={`font-semibold ${variant === 'gradient' ? 'text-white' : 'text-slate-800'}`}>
                {title}
              </h3>
            )}
            {subtitle && (
              <p className={`text-sm mt-0.5 ${variant === 'gradient' ? 'text-sky-50' : 'text-slate-400'}`}>
                {subtitle}
              </p>
            )}
          </div>
          {headerAction && <div>{headerAction}</div>}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
}