// A quiet pill beside a page title that states the surface's contract in a
// few words ("Read-only", "Intake only", "Estimate") — replaces the paragraph
// disclaimers that told users what the page does not do.
export default function ScopeBadge({ children }) {
  return (
    <span className="inline-flex items-center rounded-full border border-[#2F6B3D]/30 bg-green-50/80 px-2.5 py-0.5 align-middle text-xs font-semibold tracking-wide text-[#2F6B3D]">
      {children}
    </span>
  );
}
