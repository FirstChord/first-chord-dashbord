const VARIANTS = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  error: 'border-red-200 bg-red-50 text-red-900',
  warning: 'border-amber-200 bg-amber-50 text-amber-950',
  info: 'border-blue-200 bg-blue-50 text-blue-950',
};

export function StatusBanner({ children, variant = 'info', className = '' }) {
  if (!children) return null;

  return (
    <div className={`rounded-2xl border px-4 py-3 text-sm font-medium ${VARIANTS[variant] || VARIANTS.info} ${className}`}>
      {children}
    </div>
  );
}
