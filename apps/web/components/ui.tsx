import Image from 'next/image';
import Link from 'next/link';
import type { ButtonHTMLAttributes, InputHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { initials } from '@/lib/format';

// Primitivas de UI — pequenas, consistentes e sem dependências externas.

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

const variants: Record<Variant, string> = {
  primary:
    'bg-accent text-white hover:bg-accent/90 dark:bg-accent-dark dark:text-stone-950 dark:hover:bg-accent-dark/90 shadow-sm',
  secondary:
    'border border-stone-300 bg-white text-ink hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-900 dark:text-ink-dark dark:hover:bg-stone-800',
  ghost:
    'text-stone-600 hover:bg-stone-100 hover:text-ink dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-ink-dark',
  danger: 'bg-red-600 text-white hover:bg-red-700 shadow-sm',
};

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors
        focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent
        disabled:pointer-events-none disabled:opacity-50
        ${size === 'sm' ? 'px-2.5 py-1.5 text-sm' : 'px-4 py-2 text-sm'}
        ${variants[variant]} ${className}`}
      {...props}
    />
  );
}

export function Input({
  className = '',
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-ink
        placeholder:text-stone-400 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20
        dark:border-stone-700 dark:bg-stone-900 dark:text-ink-dark dark:focus:border-accent-dark ${className}`}
      {...props}
    />
  );
}

export function Textarea({
  className = '',
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={`w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-ink
        placeholder:text-stone-400 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20
        dark:border-stone-700 dark:bg-stone-900 dark:text-ink-dark dark:focus:border-accent-dark ${className}`}
      {...props}
    />
  );
}

export function Spinner({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
      role="status"
      aria-label="Carregando"
    />
  );
}

export function Avatar({
  src,
  name,
  size = 36,
  className = '',
}: {
  src: string | null | undefined;
  name: string;
  size?: number;
  className?: string;
}) {
  if (src) {
    return (
      <Image
        src={src}
        alt={name}
        width={size}
        height={size}
        className={`rounded-full object-cover ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full bg-accent-soft font-medium text-accent dark:bg-stone-800 dark:text-accent-dark ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

export function Tag({
  href,
  children,
  active = false,
}: {
  href: string;
  children: React.ReactNode;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors
        ${
          active
            ? 'border-accent bg-accent-soft text-accent dark:border-accent-dark dark:bg-accent/20 dark:text-accent-dark'
            : 'border-stone-300 text-stone-600 hover:border-accent hover:text-accent dark:border-stone-700 dark:text-stone-400 dark:hover:border-accent-dark dark:hover:text-accent-dark'
        }`}
    >
      {children}
    </Link>
  );
}

export function EmptyState({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-stone-300 py-16 text-center dark:border-stone-700">
      <p className="font-display text-lg text-stone-500 dark:text-stone-400">{title}</p>
      {subtitle && <p className="mt-1 text-sm text-stone-400 dark:text-stone-500">{subtitle}</p>}
    </div>
  );
}
