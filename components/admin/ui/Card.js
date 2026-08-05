// One home for the admin card surface.
//
// These class strings existed in eight places — two lib client-helper modules,
// three page components that each declared their own local `cardClasses`, this
// file, and two route pages with the string inline. They had already drifted
// into two variants, so both are named here rather than silently merged:
// whether Showcase and Holiday should match everything else is a design
// decision, and this is the place to make it.
export const CARD_CLASSES = 'rounded-[1.2rem] border border-blue-100 bg-white/90 p-5 shadow-[0_12px_36px_rgba(15,23,42,0.06)]';

// Rounder, roomier, blurred — currently only Showcase and Holiday workflow.
export const CARD_CLASSES_ROOMY = 'rounded-[1.6rem] border border-blue-100 bg-white/90 p-6 shadow-[0_12px_36px_rgba(15,23,42,0.06)] backdrop-blur-sm';

export function cardClasses(extra = '') {
  return `${CARD_CLASSES}${extra ? ` ${extra}` : ''}`;
}

export function roomyCardClasses(extra = '') {
  return `${CARD_CLASSES_ROOMY}${extra ? ` ${extra}` : ''}`;
}

export function Card({ children, className = '', as: Element = 'div', ...props }) {
  return (
    <Element className={cardClasses(className)} {...props}>
      {children}
    </Element>
  );
}
