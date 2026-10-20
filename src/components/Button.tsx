import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from 'react';

type Variant = 'dark' | 'light';

const BASE =
  'push inline-flex min-h-11 cursor-pointer items-center justify-center gap-2.5 border-3 font-mono font-bold uppercase no-underline';

const VARIANTS: Record<Variant, string> = {
  // Black button on a white page
  dark: 'border-ink bg-ink text-paper shadow-hard',
  // White button on a black section, grey shadow so it stays visible
  light:
    'border-paper bg-paper text-ink shadow-[6px_6px_0_var(--color-shadow-dark)] [--push-shadow:var(--color-shadow-dark)]',
};

function buttonClass(variant: Variant = 'dark', extra = ''): string {
  return `${BASE} ${VARIANTS[variant]} ${extra}`;
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export function Button({
  variant = 'dark',
  className = '',
  type = 'button',
  ...rest
}: ButtonProps) {
  return <button type={type} className={buttonClass(variant, className)} {...rest} />;
}

interface ButtonLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  variant?: Variant;
}

export function ButtonLink({ variant = 'dark', className = '', ...rest }: ButtonLinkProps) {
  return <a className={buttonClass(variant, className)} {...rest} />;
}
