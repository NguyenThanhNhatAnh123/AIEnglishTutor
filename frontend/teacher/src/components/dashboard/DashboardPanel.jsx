import { motion as Motion } from 'framer-motion';

export default function DashboardPanel({ title, description, action, className = '', children }) {
  return (
    <Motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: 'easeOut' }}
      className={`rounded-lg border border-white/70 bg-white/75 shadow-panel backdrop-blur-xl ${className}`}
    >
      {(title || description || action) && (
        <div className="flex items-start justify-between gap-4 border-b border-slate-100/80 p-5">
          <div>
            {title && <h2 className="text-base font-bold text-slate-950">{title}</h2>}
            {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
          </div>
          {action}
        </div>
      )}
      <div className="p-5">{children}</div>
    </Motion.section>
  );
}
