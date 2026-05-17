import { cloneElement, isValidElement } from 'react';

const cn = (...classes) => classes.filter(Boolean).join(' ');

export function Card({ className = '', children, ...props }) {
  return (
    <div
      className={cn('rounded-lg border border-white/70 bg-white/75 text-slate-950 shadow-panel backdrop-blur-xl', className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className = '', children, ...props }) {
  return (
    <div className={cn('flex flex-col space-y-1.5 p-5', className)} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({ className = '', children, ...props }) {
  return (
    <h3 className={cn('text-base font-semibold leading-tight tracking-normal text-slate-950', className)} {...props}>
      {children}
    </h3>
  );
}

export function CardDescription({ className = '', children, ...props }) {
  return (
    <p className={cn('text-sm text-slate-500', className)} {...props}>
      {children}
    </p>
  );
}

export function CardContent({ className = '', children, ...props }) {
  return (
    <div className={cn('p-5 pt-0', className)} {...props}>
      {children}
    </div>
  );
}

export function Badge({ variant = 'default', className = '', children, ...props }) {
  const variants = {
    default: 'border-transparent bg-slate-900 text-white',
    secondary: 'border-transparent bg-slate-100 text-slate-700',
    outline: 'border-slate-200 bg-white text-slate-700',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    warning: 'border-amber-200 bg-amber-50 text-amber-700',
    danger: 'border-rose-200 bg-rose-50 text-rose-700',
    info: 'border-sky-200 bg-sky-50 text-sky-700',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium transition-colors',
        variants[variant] || variants.default,
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}

export function Button({ variant = 'default', size = 'default', className = '', asChild = false, children, ...props }) {
  const variants = {
    default: 'bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-glow hover:from-indigo-600 hover:to-violet-600',
    secondary: 'bg-slate-100 text-slate-900 hover:bg-slate-200',
    outline: 'border border-white/70 bg-white/75 hover:bg-white',
    ghost: 'hover:bg-slate-100 text-slate-700',
    destructive: 'bg-rose-600 text-white hover:bg-rose-700',
  };
  const sizes = {
    default: 'h-9 px-4 py-2',
    sm: 'h-8 rounded-md px-3 text-xs',
    icon: 'h-9 w-9',
  };
  const resolvedClassName = cn(
    'inline-flex items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
    variants[variant] || variants.default,
    sizes[size] || sizes.default,
    className
  );
  if (asChild && isValidElement(children)) {
    return cloneElement(children, {
      className: cn(resolvedClassName, children.props.className || ''),
      ...props,
    });
  }
  return (
    <button className={resolvedClassName} {...props}>
      {children}
    </button>
  );
}

export function Progress({ value = 0, className = '', indicatorClassName = '' }) {
  const safeValue = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div className={cn('relative h-2 w-full overflow-hidden rounded-full bg-slate-100', className)}>
      <div
        className={cn('h-full rounded-full bg-slate-900 transition-all', indicatorClassName)}
        style={{ width: `${safeValue}%` }}
      />
    </div>
  );
}
