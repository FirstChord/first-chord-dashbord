// Pure, framework-free helpers for the admin student-detail surface — extracted from
// AdminStudentDetailClient.js so they can be unit-tested and the component stays a view.
// Date/lifecycle/note formatting + the payment-expectation option list and its label
// lookup. No React, no hooks.

export const PAYMENT_EXPECTATION_OPTIONS = [
  { value: '', label: 'Not set' },
  { value: 'setup_pending', label: 'Setup pending' },
  { value: 'stripe_active_expected', label: 'Stripe active expected' },
  { value: 'stripe_paused_expected', label: 'Stripe paused expected' },
  { value: 'inactive_or_stopped', label: 'Inactive or stopped' },
];

export function formatDateTime(value) {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return parsed.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatTargetDate(value = '') {
  if (!value) return 'No date';
  const parsed = new Date(`${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

export function lifecycleClasses(status) {
  if (status === 'active') return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  if (status === 'paused') return 'border-violet-200 bg-violet-50 text-violet-800';
  if (status === 'waiting' || status === 'onboarding' || status === 'setup_pending') return 'border-blue-200 bg-blue-50 text-blue-800';
  if (status === 'stopped') return 'border-slate-200 bg-slate-100 text-slate-700';
  return 'border-amber-200 bg-amber-50 text-amber-800';
}

export function paymentExpectationLabel(value = '') {
  return PAYMENT_EXPECTATION_OPTIONS.find((option) => option.value === value)?.label || value || 'Not set';
}

export function noteStatusLabel(note = {}) {
  if (note.emailSendStatus === 'sent') return 'Sent';
  if (note.emailSendStatus === 'failed') return 'Email follow-up needed';
  if (note.mmsAttendanceSaved) return 'Saved to MMS';
  return 'Draft/snapshot';
}

export function noteStatusClasses(note = {}) {
  if (note.emailSendStatus === 'sent') return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  if (note.emailSendStatus === 'failed' || note.manualFollowUpNeeded) return 'border-amber-200 bg-amber-50 text-amber-900';
  if (note.mmsAttendanceSaved) return 'border-blue-200 bg-blue-50 text-blue-800';
  return 'border-slate-200 bg-slate-50 text-slate-700';
}

export function notePreview(note = {}) {
  const text = note.practiceGoals || note.rawNoteText || note.whatWeDid || '';
  if (!text) return 'No note preview stored.';
  return text.length > 220 ? `${text.slice(0, 220)}...` : text;
}
