'use client';

import { ActionButton } from './ActionButton';

export function ConfirmButton({
  confirmMessage,
  onConfirm,
  onClick,
  children,
  ...props
}) {
  function handleClick(event) {
    onClick?.(event);
    if (event.defaultPrevented) return;

    if (confirmMessage && !window.confirm(confirmMessage)) {
      return;
    }

    onConfirm?.(event);
  }

  return (
    <ActionButton onClick={handleClick} {...props}>
      {children}
    </ActionButton>
  );
}
