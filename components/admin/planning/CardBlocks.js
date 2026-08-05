'use client';

// Two shared shapes for planning cards.
//
// The card had grown eleven top-level conditional blocks, and four of them were
// the same thing wearing different clothes: "here is a message to send" for the
// parent reply, the pause confirmation, the absence notice and the final
// confirmation — in violet, amber, indigo and emerald respectively.
//
// That colour encoded *card type*, which the heading already states, so it cost
// attention without carrying information (Sweller would call it extraneous
// load). Uniform layout means the message, the copy action and the confirmation
// land in the same place every time, which is the whole argument for consistency
// in Apple's HIG: a familiar pattern is one you stop having to decode.
//
// Colour is kept only where it encodes *severity*, which is real information —
// hence CardNotice's two tones and MessageToSend's one.

const NOTICE_TONES = {
  // Something is off and it changes what you should do next.
  warning: 'border-amber-200 bg-amber-50 text-amber-900',
  // Context worth knowing that does not, by itself, change the action.
  info: 'border-blue-100 bg-blue-50/70 text-slate-600',
};

export function CardNotice({ tone = 'warning', children }) {
  if (!children) return null;

  return (
    <p className={`mb-3 rounded-xl border px-3 py-2 text-xs leading-5 ${NOTICE_TONES[tone] || NOTICE_TONES.warning}`}>
      {children}
    </p>
  );
}

// `guidance` is the one line explaining why this message exists and what sending
// it does or does not settle. It is deliberately a prop rather than something
// this component invents: that copy is load-bearing and differs per message.
export function MessageToSend({ label, guidance = '', message = '', actions = null }) {
  if (!message) return null;

  return (
    <section className="mt-4 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</p>
      {guidance ? <p className="mt-1 text-xs leading-5 text-slate-600">{guidance}</p> : null}
      <p className="mt-3 whitespace-pre-wrap rounded-lg border border-slate-200 bg-white p-3 text-sm leading-6 text-slate-800">
        {message}
      </p>
      {actions ? <div className="mt-3 flex flex-wrap items-center gap-2">{actions}</div> : null}
    </section>
  );
}

// The card's buttons were hand-rolled at every call site. These two keep the
// primary/secondary distinction visible without another bespoke class string.
export function CardButton({ variant = 'secondary', className = '', ...props }) {
  const tone = variant === 'primary'
    ? 'bg-slate-900 text-white hover:bg-slate-700 border-slate-900'
    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50';

  return (
    <button
      type="button"
      className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${tone} ${className}`}
      {...props}
    />
  );
}
