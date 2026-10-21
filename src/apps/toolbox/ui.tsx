import { useState, type ReactNode } from 'react';

// Small shared pieces for Toolbox screens.

export function Field({ label, id, children }: { label: string; id: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={id} className="font-mono text-xs uppercase">
        {label}
      </label>
      {children}
    </div>
  );
}

/** A value with a copy button. */
export function Output({ label, value, big }: { label: string; value: string; big?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="font-mono text-xs uppercase">{label}</span>
      <div className="flex min-w-0 border-3 border-ink">
        <output
          className={`flex min-h-12 min-w-0 flex-1 items-center overflow-x-auto bg-paper px-3 font-mono break-all ${big ? 'text-2xl font-bold' : ''}`}
        >
          {value || '-'}
        </output>
        <button
          type="button"
          disabled={!value}
          onClick={() =>
            void navigator.clipboard?.writeText(value).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1200);
            })
          }
          className="cursor-pointer border-0 border-l-3 border-ink bg-ink px-3 font-mono text-xs font-bold text-paper uppercase disabled:opacity-40"
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </div>
  );
}
