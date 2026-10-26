// The component library (docs/DESIGN.md §4). Small, token-styled, accessible by default.

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { create } from 'zustand';
import { diagnostics } from '../diagnostics';
import { t } from '../i18n';
import { Icon, type IconName } from './Icon';

export function SegmentedControl<T extends string>({ label, value, options, onChange, size = 'md' }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; size?: 'sm' | 'md' }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-control border border-line bg-surface-2 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-[calc(var(--r-md)-2px)] font-medium transition-colors ${size === 'sm' ? 'min-h-9 px-2.5 text-xs' : 'min-h-10 px-3.5 text-sm'} ${value === o.value ? 'bg-surface text-ink shadow-1' : 'text-ink-muted hover:text-ink'}`}
          style={{ transitionDuration: 'calc(var(--dur-fast) * var(--motion))' }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Switch({ label, checked, onChange, description }: { label: string; checked: boolean; onChange: (v: boolean) => void; description?: string }) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <label htmlFor={id} className="text-sm font-medium text-ink">
          {label}
        </label>
        {description && <p className="text-xs text-ink-muted">{description}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors ${checked ? 'border-accent bg-accent' : 'border-line bg-surface-3'}`}
        style={{ transitionDuration: 'calc(var(--dur) * var(--motion))' }}
      >
        <span className={`inline-block h-5 w-5 rounded-full bg-surface shadow-1 transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} style={{ transitionDuration: 'calc(var(--dur) * var(--motion))' }} />
      </button>
    </div>
  );
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'accent' | 'good' | 'warn' | 'bad' }) {
  const cls = { neutral: 'border-line text-ink-muted', accent: 'border-accent text-accent', good: 'border-good text-good', warn: 'border-warn text-warn', bad: 'border-bad text-bad' }[tone];
  return <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${cls}`}>{children}</span>;
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded border border-line bg-surface-2 px-1.5 py-0.5 font-sans text-[0.7rem] font-semibold text-ink-muted">{children}</kbd>;
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded-control bg-surface-2 ${className}`} />;
}

export function EmptyState({ icon = 'spark', title, children, action }: { icon?: IconName; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center gap-3 py-10 text-center" data-testid="empty-state">
      <span className="rounded-full bg-accent-soft p-3 text-accent">
        <Icon name={icon} size={28} />
      </span>
      <h3 className="text-lg font-semibold">{title}</h3>
      {children && <div className="max-w-prose text-sm text-ink-muted">{children}</div>}
      {action}
    </div>
  );
}

export function ErrorState({ title, message, next, error }: { title: string; message: string; next?: ReactNode; error?: unknown }) {
  return (
    <div role="alert" className="card space-y-2 border-bad" data-testid="error-state">
      <p className="flex items-center gap-2 font-semibold text-bad">
        <Icon name="warning" /> {title}
      </p>
      <p className="text-sm text-ink-muted">{message}</p>
      <div className="flex flex-wrap items-center gap-2">
        {next}
        <CopyDiagnostics error={error ?? message} />
      </div>
    </div>
  );
}

/** Copies technical details for a bug report (no personal data, D-082). */
export function CopyDiagnostics({ error }: { error?: unknown }) {
  const [state, setState] = useState<'idle' | 'copied' | 'shown'>('idle');
  const [text, setText] = useState('');
  const copy = async () => {
    const mode = document.querySelector('main')?.getAttribute('data-mode') ?? undefined;
    const d = diagnostics({ error, mode });
    setText(d);
    try {
      await navigator.clipboard.writeText(d);
      setState('copied');
    } catch {
      setState('shown');
    }
  };
  return (
    <>
      <button type="button" className="btn-quiet" onClick={() => void copy()} data-testid="copy-diagnostics">
        {state === 'copied' ? t('diag.copied') : t('diag.copy')}
      </button>
      {state === 'shown' && <textarea readOnly aria-label={t('diag.label')} className="field h-32 w-full font-mono text-xs" value={text} />}
    </>
  );
}

export function ProgressBar({ value, label }: { value: number; label: string }) {
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value * 100)} className="h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
      <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, transitionDuration: 'calc(var(--dur-slow) * var(--motion))' }} />
    </div>
  );
}

/** Hover/focus tooltip for a term, with an optional "Learn more" link. */
export function Tip({ term, children, learnMore }: { term: string; children: ReactNode; learnMore?: string }) {
  const id = useId();
  return (
    <span className="gloss" tabIndex={0} aria-describedby={id}>
      {term}
      <span className="gloss-tip" role="tooltip" id={id}>
        {children}
        {learnMore && (
          <a className="mt-1 block text-xs text-accent underline" href={learnMore}>
            {t('ui.learnMore')}
          </a>
        )}
      </span>
    </span>
  );
}

export function Accordion({ title, children, defaultOpen = false, testId }: { title: string; children: ReactNode; defaultOpen?: boolean; testId?: string }) {
  return (
    <details className="group rounded-control border border-line" open={defaultOpen} data-testid={testId}>
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-4 text-sm font-medium">
        {title}
        <Icon name="chevronDown" size={18} className="transition-transform group-open:rotate-180" />
      </summary>
      <div className="space-y-4 border-t border-line p-4">{children}</div>
    </details>
  );
}

/** Focus-trapped modal dialog (native <dialog>). */
export function Modal({ open, title, onClose, children, testId }: { open: boolean; title: string; onClose?: () => void; children: ReactNode; testId?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-label={title}
      data-testid={testId}
      onCancel={(e) => {
        if (!onClose) e.preventDefault();
        else onClose();
      }}
      className="m-auto w-[min(36rem,calc(100vw-2rem))] rounded-[var(--r-xl)] border border-line bg-surface p-0 text-ink shadow-3 backdrop:bg-black/50"
    >
      <div className="space-y-4 p-6">{children}</div>
    </dialog>
  );
}

// Toasts: a polite live region with short messages.
type ToastItem = { id: number; text: string };
const useToasts = create<{ items: ToastItem[]; push: (text: string) => void }>((set) => ({
  items: [],
  push: (text) => {
    const id = Date.now() + Math.random();
    set((s) => ({ items: [...s.items, { id, text }] }));
    setTimeout(() => set((s) => ({ items: s.items.filter((x) => x.id !== id) })), 3500);
  },
}));
export const toast = (text: string) => useToasts.getState().push(text);

export function Toaster() {
  const items = useToasts((s) => s.items);
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex flex-col items-center gap-2 md:bottom-6">
      {items.map((i) => (
        <div key={i.id} className="pointer-events-auto rounded-control border border-line bg-surface px-4 py-2 text-sm shadow-2">
          {i.text}
        </div>
      ))}
    </div>
  );
}

/** Text field with a label. */
export function Field({ label, value, onChange, type = 'text', hint, ...rest }: { label: string; value: string | number; onChange: (v: string) => void; type?: string; hint?: string; min?: number; max?: number; step?: number }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium">
        {label}
      </label>
      <input id={id} className="field num" type={type} value={value} onChange={(e) => onChange(e.target.value)} {...rest} />
      {hint && <p className="mt-1 text-xs text-ink-muted">{hint}</p>}
    </div>
  );
}

export function useMediaQuery(q: string): boolean {
  const [m, setM] = useState(() => typeof matchMedia !== 'undefined' && matchMedia(q).matches);
  useEffect(() => {
    const mq = matchMedia(q);
    const h = () => setM(mq.matches);
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, [q]);
  return m;
}
