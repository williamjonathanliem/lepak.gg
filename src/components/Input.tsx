import type { InputHTMLAttributes, Ref } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  id: string;
  ref?: Ref<HTMLInputElement>;
  /** Shown below the field and announced to screen readers. */
  error?: string | null;
}

/** Bordered brutalist text input. Pair with a visible <label htmlFor={id}>. */
export function Input({ id, error, className = '', ...rest }: InputProps) {
  const errorId = `${id}-error`;
  return (
    <input
      id={id}
      type="text"
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? errorId : undefined}
      className={`h-15 min-w-0 border-3 border-ink bg-paper px-[18px] font-mono text-lg text-ink ${className}`}
      {...rest}
    />
  );
}

export function InputError({ id, error }: { id: string; error?: string | null }) {
  return (
    <p id={`${id}-error`} role="alert" className="min-h-6 font-mono text-sm font-bold">
      {error ? `! ${error}` : ''}
    </p>
  );
}
