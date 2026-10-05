"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

export function Spinner({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={`animate-spin ${className}`}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Submit button that reads its own form's status: while that form's action runs it shows a
 * spinner and the pending label, and is disabled so it can't be sent twice. `disabled` adds
 * extra conditions, e.g. another form sharing the same action is already running.
 */
export function SubmitButton({
  children,
  pendingLabel,
  icon,
  disabled,
  className = "btn btn-primary",
  name,
  value,
}: {
  children: ReactNode;
  pendingLabel?: ReactNode;
  icon?: ReactNode;
  disabled?: boolean;
  className?: string;
  name?: string;
  value?: string;
}) {
  const { pending, data } = useFormStatus();
  // With several submit buttons in one form, only the one that was pressed shows the spinner.
  const mine = pending && (!name || data?.get(name) === value);
  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending || disabled}
      aria-busy={mine}
      className={className}
    >
      {mine ? <Spinner /> : icon}
      {mine && pendingLabel ? pendingLabel : children}
    </button>
  );
}
