'use client';

import { Check, Loader2 } from 'lucide-react';

const VARIANT_CLASSES = {
  primary: 'border-slate-900 bg-slate-900 text-white hover:bg-slate-700',
  blue: 'border-blue-200 bg-blue-50 text-blue-900 hover:bg-blue-100',
  green: 'border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100',
  red: 'border-red-200 bg-white text-red-800 hover:bg-red-50',
  subtle: 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
};

export function ActionButton({
  children,
  pending = false,
  success = false,
  disabled = false,
  variant = 'primary',
  className = '',
  pendingLabel,
  successLabel,
  icon = null,
  type = 'button',
  ...props
}) {
  const label = pending
    ? (pendingLabel || children)
    : success
      ? (successLabel || children)
      : children;
  const variantClass = VARIANT_CLASSES[variant] || VARIANT_CLASSES.primary;

  return (
    <button
      type={type}
      disabled={disabled || pending}
      className={`inline-flex items-center justify-center gap-2 rounded-full border px-5 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${variantClass} ${className}`}
      {...props}
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : success ? <Check className="h-4 w-4" /> : icon}
      {label}
    </button>
  );
}
