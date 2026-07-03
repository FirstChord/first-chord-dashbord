export function Card({ children, className = '', as: Element = 'div', ...props }) {
  return (
    <Element
      className={`rounded-[1.2rem] border border-blue-100 bg-white/90 p-5 shadow-[0_12px_36px_rgba(15,23,42,0.06)] ${className}`}
      {...props}
    >
      {children}
    </Element>
  );
}
