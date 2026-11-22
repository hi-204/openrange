// Tournament push/fold drill (D-089): a table on the bubble, at a final table or in a satellite,
// solved live with ICM and in chips; five hands per table, graded by ICM EV.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { pct } from '../../../lib/format';
import { t, type MessageKey } from '../../../lib/i18n';
import { Badge, ErrorState, Skeleton } from '../../../lib/ui/components';
import { solverClient } from '../../../lib/wasm/client';
import { CardRow } from '../../table/Card';
import { mulberry32 } from '../preflop/deal';
import { trainerStore } from '../store';
import { BOUNTY, BOUNTY_CASH_SHARE, chipValue, dealHand, gradeChoice, PAYOUTS, randomSpot, rangeShare, toJson, type Solved, type TournamentGrade, type TournamentProblem, type TournamentSpot } from './tournament';

const HANDS_PER_TABLE = 5;
const SEATS6 = ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
const seatName = (n: number, i: number) => SEATS6[6 - n + i]!;

export function TournamentDrill() {
  const rnd = useMemo(() => mulberry32(Date.now() & 0x7fffffff), []);
  const [table, setTable] = useState<{ spot: TournamentSpot; solved: Solved } | null>(null);
  const [hands, setHands] = useState(0);
  const [problem, setProblem] = useState<TournamentProblem | null>(null);
  const [result, setResult] = useState<{ chosen: 0 | 1; g: TournamentGrade } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const newTable = useCallback(async () => {
    setTable(null);
    setProblem(null);
    setResult(null);
    setError(null);
    try {
      const spot = randomSpot(rnd);
      const icm = await solverClient().call('pushFold', { spot: toJson(spot, true) });
      const chips = await solverClient().call('pushFold', { spot: toJson(spot, false) });
      setTable({ spot, solved: { icm, chips } });
      setHands(1);
      setProblem(dealHand(spot, icm.classes, rnd));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [rnd]);
  useEffect(() => {
    void newTable();
  }, [newTable]);

  const next = () => {
    if (!table || hands >= HANDS_PER_TABLE) return void newTable();
    // Same table, the other blind's decision half the time.
    const spot: TournamentSpot = { ...table.spot, role: rnd() < 0.5 ? 'shove' : 'call' };
    setTable({ ...table, spot });
    setHands((h) => h + 1);
    setResult(null);
    setProblem(dealHand(spot, table.solved.icm.classes, rnd));
  };

  const choose = async (chosen: 0 | 1) => {
    if (!table || !problem || result) return;
    const g = gradeChoice(problem, table.solved, chosen);
    setResult({ chosen, g });
    const s = problem.spot;
    await trainerStore().addAnswer({
      at: Date.now(),
      drill: 'tournament',
      graded: true,
      family: `tournament|${s.kind}|${s.role}`,
      reference: { engine: 'push/fold with ICM (live solve)', payouts: PAYOUTS[s.kind].join('/'), stacks: s.stacks.join('/') },
      hand: problem.combo,
      handClass: problem.handClass,
      actions: actions(s),
      chosen,
      unit: 'bb',
      category: g.grade.category,
      loss: g.grade.lossBb,
      gradedLoss: g.grade.gradedLoss,
      groups: { drill: 'tournament', scenario: s.kind, position: s.role === 'shove' ? 'SB' : 'BB', handClass: problem.handClass },
    });
  };

  if (error) return <ErrorState title={t('flow.errorTitle')} message={error} />;
  if (!table || !problem)
    return (
      <div className="space-y-2">
        <p className="text-sm text-ink-muted">{t('tourney.solving')}</p>
        <Skeleton className="h-64" />
      </div>
    );

  const s = problem.spot;
  const n = s.stacks.length;
  const side = s.role === 'shove' ? 'pusher' : 'caller';
  const pool = PAYOUTS[s.kind].reduce((a, b) => a + b, 0);
  const acts = actions(s);
  const icmShare = rangeShare(table.solved.icm[side], table.solved.icm.classes);
  const chipsShare = rangeShare(table.solved.chips[side], table.solved.chips.classes);
  const evText = (prize: number) => pct(prize / pool, 2);

  return (
    <div className="space-y-4" data-testid="tournament-drill">
      <p className="max-w-prose text-sm text-ink-muted">{t('tourney.intro')}</p>
      <section className="card space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="accent">{t(`tourney.kind.${s.kind}` as MessageKey)}</Badge>
          <span className="text-sm text-ink-muted">{t('tourney.payouts', { list: PAYOUTS[s.kind].map((p) => pct(p / pool, 0)).join(' / ') })}</span>
          <span className="text-xs text-ink-muted">{t('tourney.handOf', { n: hands, total: HANDS_PER_TABLE })}</span>
        </div>
        <ul className="flex flex-wrap gap-2 text-sm" aria-label={t('tourney.stacks')}>
          {s.stacks.map((st, i) => (
            <li key={i} className={`rounded-control border px-2 py-1 num ${i === (s.role === 'shove' ? s.sb : s.bb) ? 'border-accent bg-accent-soft' : 'border-line'}`}>
              {seatName(n, i)} {st} bb
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <p className="eyebrow mb-1">{t('lab.cards.hero')}</p>
            <CardRow cards={[problem.combo.slice(0, 2), problem.combo.slice(2)]} size="sm" />
          </div>
          <p className="text-lg font-medium" data-testid="tourney-question">
            {t(s.role === 'shove' ? 'tourney.q.shove' : 'tourney.q.call', { stack: Math.min(s.stacks[s.sb]!, s.stacks[s.bb]!) })}
          </p>
        </div>
        <div className="flex gap-2" role="group" aria-label={t('tourney.your')}>
          {acts.map((a, i) => (
            <button key={a} type="button" className={result?.chosen === i ? 'btn-primary' : 'btn-secondary'} disabled={!!result} onClick={() => void choose(i as 0 | 1)}>
              {a}
            </button>
          ))}
        </div>
      </section>
      {result && (
        <section className="card space-y-2 text-sm" data-testid="tourney-result" aria-live="polite">
          <p className="flex items-center gap-2 font-medium">
            <Badge tone={result.g.grade.category === 'best' ? 'good' : result.g.grade.category === 'acceptable' ? 'accent' : 'warn'}>{t(`trainer.category.${result.g.grade.category}` as MessageKey)}</Badge>
            {result.g.grade.lossBb < 1e-9 ? t('tourney.best', { action: acts[result.g.icmBest]! }) : t('tourney.loss', { loss: result.g.grade.lossBb.toFixed(2), action: acts[result.g.icmBest]! })}
          </p>
          <p>{t('tourney.icmEv', { a0: acts[0]!, e0: evText(result.g.icmEv[0]), a1: acts[1]!, e1: evText(result.g.icmEv[1]) })}</p>
          <p>{t('tourney.chipsEv', { a0: acts[0]!, e0: result.g.chipsEv[0].toFixed(2), a1: acts[1]!, e1: result.g.chipsEv[1].toFixed(2) })}</p>
          <p className="font-medium">{result.g.chipsBest === result.g.icmBest ? t('tourney.same', { action: acts[result.g.icmBest]! }) : t('tourney.differs', { icm: acts[result.g.icmBest]!, chips: acts[result.g.chipsBest]! })}</p>
          <p>{t(s.role === 'shove' ? 'tourney.ranges.shove' : 'tourney.ranges.call', { icm: pct(icmShare, 0), chips: pct(chipsShare, 0) })}</p>
          {s.kind === 'pko' && <p className="text-xs text-ink-muted">{t('tourney.pkoNote', { bounty: (BOUNTY * BOUNTY_CASH_SHARE).toFixed(0) })}</p>}
          <p className="text-xs text-ink-muted">{t('tourney.note', { chip: chipValue(s).toFixed(2) })}</p>
          <button type="button" className="btn-primary" onClick={next}>
            {hands >= HANDS_PER_TABLE ? t('tourney.newTable') : t('tourney.next')}
          </button>
        </section>
      )}
    </div>
  );
}

function actions(s: TournamentSpot): [string, string] {
  return s.role === 'shove' ? [t('tourney.fold'), t('tourney.shove')] : [t('tourney.fold'), t('tourney.call')];
}
