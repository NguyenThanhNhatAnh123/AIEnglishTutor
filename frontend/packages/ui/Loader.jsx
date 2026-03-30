/**
 * Shared Loader / Spinner component.
 *
 * Sizes: sm | md | lg | xl
 * Variants: spinner | dots | bar
 *
 * Usage:
 *   <Loader />                       — medium sky blue spinner
 *   <Loader size="lg" />
 *   <Loader variant="dots" />
 *   <Loader.Page />                  — centred full-viewport loader
 *   <Loader.Inline label="Saving" /> — small inline spinner
 */

function Spinner({ size = 'md', className = '' }) {
  const sizes = {
    sm: 'w-4 h-4 border-2',
    md: 'w-8 h-8 border-[2.5px]',
    lg: 'w-12 h-12 border-[3px]',
    xl: 'w-16 h-16 border-4',
  };
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div
        className={`${sizes[size] || sizes.md} rounded-full border-sky-200 border-t-sky-400 animate-spin`}
      />
    </div>
  );
}

function Dots({ className = '' }) {
  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          className="w-2 h-2 rounded-full bg-sky-300 animate-bounce"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </div>
  );
}

function Bar({ className = '' }) {
  return (
    <div className={`w-full h-1 bg-sky-100 rounded-full overflow-hidden ${className}`}>
      <div className="h-full bg-sky-300 rounded-full animate-[loader-bar_1.4s_ease_infinite]" style={{ width: '40%' }} />
      <style>{`
        @keyframes loader-bar {
          0%   { transform: translateX(-100%); }
          50%  { transform: translateX(160%); }
          100% { transform: translateX(350%); }
        }
      `}</style>
    </div>
  );
}

function Page({ label = 'Loading...' }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm">
      <Spinner size="lg" />
      {label && <p className="mt-4 text-sm text-slate-400 font-medium">{label}</p>}
    </div>
  );
}

function Inline({ label, size = 'sm' }) {
  return (
    <span className="inline-flex items-center gap-2">
      <Spinner size={size} />
      {label && <span className="text-sm text-slate-500">{label}</span>}
    </span>
  );
}

// Default export
export default function Loader({ variant = 'spinner', size = 'md', className = '' }) {
  if (variant === 'dots') return <Dots className={className} />;
  if (variant === 'bar')  return <Bar className={className} />;
  return <Spinner size={size} className={className} />;
}

Loader.Page   = Page;
Loader.Inline = Inline;
Loader.Dots   = Dots;
Loader.Bar    = Bar;