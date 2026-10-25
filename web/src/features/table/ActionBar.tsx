// Action buttons for drills and play: hue + glyph + label + shortcut, never colour alone.

import { t } from '../../lib/i18n';
import { Kbd } from '../../lib/ui/components';

export type ActionKind = 'fold' | 'check' | 'call' | 'raise' | 'allin';

export function actionKind(label: string): ActionKind {
  const l = label.toLowerCase();
  if (l.startsWith('fold')) return 'fold';
  if (l.startsWith('check')) return 'check';
  if (l.startsWith('call')) return 'call';
  if (l.startsWith('all-in')) return 'allin';
  return 'raise';
}

const GLYPH: Record<ActionKind, string> = { fold: '✕', check: '○', call: '●', raise: '▲', allin: '◆' };

/** Colour variable for an action; raises get warmer as they get bigger. */
export function actionColor(actions: string[], i: number): string {
  const kind = actionKind(actions[i]!);
  if (kind !== 'raise') return `var(--act-${kind === 'allin' ? 'allin' : kind})`;
  const raises = actions.map((a, k) => (actionKind(a) === 'raise' ? k : -1)).filter((k) => k >= 0);
  const rank = raises.indexOf(i);
  return `var(--act-raise-${Math.min(3, rank + 1 + (raises.length === 1 ? 1 : 0))})`;
}

/** Shortcut letter shown on a button (the number always works too). */
export function shortcutFor(actions: string[], i: number): string | null {
  const kind = actionKind(actions[i]!);
  const first = (k: ActionKind[]) => actions.findIndex((a) => k.includes(actionKind(a)));
  if (kind === 'fold' && first(['fold']) === i) return 'F';
  if ((kind === 'check' || kind === 'call') && first(['check', 'call']) === i) return 'C';
  if ((kind === 'raise' || kind === 'allin') && first(['raise', 'allin']) === i) return 'R';
  return null;
}

type Props = {
  actions: string[];
  onAction: (i: number) => void;
  disabled?: boolean;
  /** Index the user picked (after answering). */
  chosen?: number | null;
  /** Pot in bb, to show bet sizes as a share of the pot. */
  potBb?: number;
};

export function ActionBar({ actions, onAction, disabled, chosen, potBb }: Props) {
  return (
    <ul className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap" aria-label={t('solver.actions')} data-testid="action-bar">
      {actions.map((a, i) => {
        const kind = actionKind(a);
        const color = actionColor(actions, i);
        const letter = shortcutFor(actions, i);
        const amount = Number(a.split(' ').pop());
        const share = potBb && kind === 'raise' && Number.isFinite(amount) ? ` · ${Math.round((amount / potBb) * 100)}%` : '';
        return (
          <li key={a} className="sm:min-w-32">
            <button
              type="button"
              disabled={disabled}
              onClick={() => onAction(i)}
              aria-keyshortcuts={[letter, String(i + 1)].filter(Boolean).join(' ')}
              className={`group flex min-h-14 w-full items-center justify-between gap-3 rounded-control border-2 bg-surface px-4 text-left shadow-1 transition-[transform,background-color] hover:bg-surface-2 active:scale-[0.98] disabled:cursor-default ${chosen === i ? 'ring-2 ring-accent' : ''}`}
              style={{ borderColor: color, transitionDuration: 'calc(var(--dur-fast) * var(--motion))' }}
            >
              <span className="flex items-center gap-2">
                <span aria-hidden className="text-lg leading-none" style={{ color }}>
                  {GLYPH[kind]}
                </span>
                <span className="text-base font-semibold">
                  {a}
                  <span className="num text-xs font-normal text-ink-muted">{share}</span>
                </span>
              </span>
              <span className="flex gap-1">
                {letter && <Kbd>{letter}</Kbd>}
                <Kbd>{i + 1}</Kbd>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
