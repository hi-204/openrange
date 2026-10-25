import { useEffect, useState } from 'react';
import { t, type MessageKey } from '../../../lib/i18n';
import { Cards } from '../../../lib/poker/Cards';
import { solverClient } from '../../../lib/wasm/client';
import { splitCards } from './cards';

type Config = Record<string, unknown>;

/** 6-max seats clockwise from the button (the order the cards are dealt from the small blind). */
const SEATS = ['BTN', 'SB', 'BB', 'UTG', 'HJ', 'CO'] as const;

/** The 6-max table: seats, button and blinds; highlighted seats are drawn darker. */
export function TableDiagram({ config }: { config: Config }) {
  const highlight = new Set((Array.isArray(config.highlight) ? config.highlight : []) as string[]);
  const cx = 200;
  const cy = 110;
  return (
    <div>
      <svg viewBox="0 0 400 220" className="w-full max-w-md" role="img" aria-label={t('widget.table.label')}>
        <ellipse cx={cx} cy={cy} rx={150} ry={70} className="fill-green-700/20 stroke-green-800 dark:stroke-green-400" strokeWidth={3} />
        {SEATS.map((seat, i) => {
          // Start at the bottom (button) and go clockwise.
          const a = Math.PI / 2 + (i * 2 * Math.PI) / SEATS.length;
          const x = cx + 175 * Math.cos(a);
          const y = cy + 92 * Math.sin(a);
          const on = highlight.has(seat);
          return (
            <g key={seat}>
              <circle cx={x} cy={y} r={22} className={on ? 'fill-slate-900 dark:fill-slate-100' : 'fill-white stroke-slate-400 dark:fill-slate-900'} strokeWidth={2} />
              <text x={x} y={y + 4} textAnchor="middle" className={`text-[11px] font-semibold ${on ? 'fill-white dark:fill-slate-900' : 'fill-slate-800 dark:fill-slate-200'}`}>
                {seat}
              </text>
              {seat === 'BTN' && (
                <g>
                  <circle cx={x + 30} cy={y - 18} r={9} className="fill-white stroke-slate-700" strokeWidth={1.5} />
                  <text x={x + 30} y={y - 14} textAnchor="middle" className="fill-slate-900 text-[10px] font-bold">
                    D
                  </text>
                </g>
              )}
            </g>
          );
        })}
      </svg>
      <p className="text-xs text-ink-muted">{t('widget.table.note')}</p>
    </div>
  );
}

const STEPS = ['blinds', 'deal', 'preflop', 'flop', 'turn', 'river', 'showdown'] as const;

/** Step through one hand: blinds, hole cards, the four betting rounds and the showdown. */
export function HandFlow({ config }: { config: Config }) {
  const hero = splitCards(typeof config.hero === 'string' ? config.hero : 'Ah Qd');
  const villain = splitCards(typeof config.villain === 'string' ? config.villain : 'Kc Ks');
  const board = splitCards(typeof config.board === 'string' ? config.board : 'Qs 7h 2c Qc 9d');
  const [step, setStep] = useState(0);
  const [winner, setWinner] = useState<string | null>(null);
  const name = STEPS[step]!;
  const shown = name === 'flop' ? 3 : name === 'turn' ? 4 : name === 'river' || name === 'showdown' ? 5 : 0;
  useEffect(() => {
    if (name !== 'showdown') return;
    let live = true;
    const c = solverClient();
    Promise.all([c.call('evaluateHand', { cards: [...hero, ...board].join('') }), c.call('evaluateHand', { cards: [...villain, ...board].join('') })]).then(([a, b]) => {
      if (!live || !a.ok || !b.ok) return;
      setWinner(a.strength > b.strength ? t('widget.flow.youWin', { hand: a.category }) : a.strength < b.strength ? t('widget.flow.theyWin', { hand: b.category }) : t('widget.flow.split'));
    });
    return () => {
      live = false;
    };
  }, [name, hero.join(), villain.join(), board.join()]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="space-y-3">
      <ol className="flex flex-wrap gap-1 text-xs" aria-label={t('widget.flow.steps')}>
        {STEPS.map((s, i) => (
          <li key={s} aria-current={i === step ? 'step' : undefined} className={`rounded px-2 py-0.5 ${i === step ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : 'bg-slate-100 dark:bg-slate-800'}`}>
            {t(`widget.flow.${s}.name` as MessageKey)}
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap items-center gap-6">
        <div>
          <p className="text-xs text-ink-muted">{t('widget.yourCards')}</p>
          {step >= 1 ? <Cards cards={hero} size="xl" /> : <span className="text-sm">—</span>}
        </div>
        <div>
          <p className="text-xs text-ink-muted">{t('widget.boardCards')}</p>
          {shown ? <Cards cards={board.slice(0, shown)} size="xl" /> : <span className="text-sm">—</span>}
        </div>
        <div>
          <p className="text-xs text-ink-muted">{t('widget.theirCards')}</p>
          {name === 'showdown' ? <Cards cards={villain} size="xl" /> : <span className="text-sm">{step >= 1 ? '🂠 🂠' : '—'}</span>}
        </div>
      </div>
      <p className="text-sm" data-testid="flow-text">
        {t(`widget.flow.${name}.text` as MessageKey)} {name === 'showdown' && winner}
      </p>
      <div className="flex gap-2">
        <button type="button" className="btn-secondary" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
          {t('widget.flow.back')}
        </button>
        <button type="button" className="btn-primary" disabled={step === STEPS.length - 1} onClick={() => setStep((s) => s + 1)}>
          {t('widget.flow.next')}
        </button>
      </div>
    </div>
  );
}
