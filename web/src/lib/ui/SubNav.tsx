import { href } from '../../app/route';

/** Sub-sections of a page as links (each has its own URL, so back/forward and sharing work). */
export function SubNav({ page, items, current, label }: { page: string; items: { id: string; label: string }[]; current: string; label: string }) {
  return (
    <nav aria-label={label} className="flex flex-wrap gap-1 border-b border-line">
      {items.map((i) => (
        <a
          key={i.id}
          href={href(page, [i.id])}
          aria-current={i.id === current ? 'page' : undefined}
          className={`-mb-px inline-flex min-h-11 items-center border-b-2 px-3 text-sm font-medium transition-colors ${i.id === current ? 'border-accent text-ink' : 'border-transparent text-ink-muted hover:text-ink'}`}
          style={{ transitionDuration: 'calc(var(--dur-fast) * var(--motion))' }}
        >
          {i.label}
        </a>
      ))}
    </nav>
  );
}
