// Math Lab (D-087): one screen for the arithmetic behind decisions. Each topic has the formula,
// a plain-English explanation, a tool and a graded drill.

import { useEffect, useState } from 'react';
import { href, type Route } from '../../app/route';
import { t, type MessageKey } from '../../lib/i18n';
import { SubNav } from '../../lib/ui/SubNav';
import { Widget } from '../lessons/widgets/Widget';
import { MathDrill } from '../trainer/math/MathDrill';
import { trainerStore, type MathAttempt } from '../trainer/store';
import { calibration, estimateCount, MIN_ESTIMATES } from './calibration';
import { loadJson, type ChartFile } from '../../lib/provenance/types';
import { ErrorState, Skeleton } from '../../lib/ui/components';
import { rangeText } from '../trainer/postflop/features';
import { LabDrill, type Challenge } from './LabDrill';
import { MdfComparison, SizingTrainer } from './SolvedLab';
import type { AdvantageContext, LabDrillId } from './labDrills';
import { ImpliedOdds } from './tools';

/** Problems in a challenge set. */
const CHALLENGE_SIZE = 10;

type Topic = { id: string; tool: () => React.JSX.Element; drill: { lab: LabDrillId } | { classic: string } | { solved: 'sizing' }; extra?: () => React.JSX.Element };

/** Example inputs for the tools (cards and amounts to start from, not strategy data). */
export const TOPICS: Topic[] = [
  { id: 'potodds', tool: () => <Widget name="potodds" config={{ pot: 20, bet: 10, equity: 0.3 }} />, drill: { lab: 'potdecision' } },
  { id: 'outs', tool: () => <Widget name="outs" config={{ hero: 'AhKh', villain: 'QsQd', board: 'Qh7h2c' }} />, drill: { lab: 'rule24' } },
  { id: 'estimate', tool: () => <Widget name="equity" config={{ ranges: ['AKs', 'QQ'] }} />, drill: { lab: 'estimate' } },
  { id: 'ev', tool: () => <Widget name="ev" config={{ outcomes: [{ label: 'fold', p: 0.4, value: 10 }, { label: 'call, win', p: 0.2, value: 15 }, { label: 'call, lose', p: 0.4, value: -5 }] }} />, drill: { lab: 'ev' } },
  { id: 'implied', tool: () => <ImpliedOdds />, drill: { lab: 'implied' } },
  { id: 'mdf', tool: () => <Widget name="sizing" config={{ pot: 10, bet: 7.5 }} />, drill: { classic: 'mdf' }, extra: () => <MdfComparison /> },
  { id: 'blockers', tool: () => <Widget name="combos" config={{ hand: 'AK', dead: 'AsKd' }} />, drill: { lab: 'blockers' } },
  { id: 'spr', tool: () => <Widget name="spr" config={{ stack: 90, pot: 12 }} />, drill: { lab: 'spr' } },
  { id: 'advantage', tool: () => <Widget name="advantage" config={{ a: 'QQ+, AKs', b: '22+', board: 'Ks 7d 2c' }} />, drill: { lab: 'advantage' } },
  { id: 'sizing', tool: () => <Widget name="sizing" config={{ pot: 10, bet: 5 }} />, drill: { solved: 'sizing' } },
];

function CalibrationPanel() {
  const [math, setMath] = useState<MathAttempt[] | null>(null);
  useEffect(() => {
    trainerStore().math().then(setMath).catch(() => setMath([]));
  }, []);
  if (!math) return null;
  const c = calibration(math);
  return (
    <section className="card space-y-1 text-sm" data-testid="calibration">
      <h3 className="eyebrow">{t('lab.calibration')}</h3>
      {!c ? (
        <p className="text-ink-muted">{t('lab.calibration.none', { n: estimateCount(math), min: MIN_ESTIMATES })}</p>
      ) : (
        <>
          <p>{t('lab.calibration.result', { n: c.n, mae: (c.mae * 100).toFixed(1), bias: t(c.bias >= 0 ? 'lab.calibration.high' : 'lab.calibration.low'), biasAbs: (Math.abs(c.bias) * 100).toFixed(1) })}</p>
          {!c.clear && <p className="text-ink-muted">{t('lab.calibration.even')}</p>}
        </>
      )}
    </section>
  );
}

/** The advantage drill reads the flop report and the 100 bb cash chart ranges it was built from. */
function AdvantageDrill({ challenge, onExit }: { challenge?: Challenge; onExit?: () => void }) {
  const [ctx, setCtx] = useState<{ advantage: AdvantageContext } | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    (async () => {
      const report = await loadJson<{ flops: AdvantageContext['flops'] }>('data/reports/flop-srp-btn-bb.json');
      const cash = await loadJson<ChartFile>('data/charts/cash-6max-100bb.json');
      const col = (id: string, k: number) => {
        const c = cash.charts.find((x) => x.id === id)!;
        return rangeText(cash.classes, c.strategy.map((row) => row[k]!));
      };
      setCtx({ advantage: { flops: report.flops, btnRange: col('first-in-BTN', 1), bbRange: col('vs-open-BB-vs-BTN', 1) } });
    })().catch((e: Error) => setError(e.message));
  }, []);
  if (error) return <ErrorState title={t('flow.errorTitle')} message={error} />;
  if (!ctx) return <Skeleton className="h-40" />;
  return <LabDrill drill="advantage" ctx={ctx} challenge={challenge} onExit={onExit} />;
}

export function LabPage({ route }: { route: Route }) {
  const topic = TOPICS.find((x) => x.id === route.rest[0]) ?? TOPICS[0]!;
  const [drilling, setDrilling] = useState<false | 'practice' | 'challenge'>(false);
  const [timed, setTimed] = useState(false);
  useEffect(() => setDrilling(false), [topic.id]);
  const key = (k: string) => t(`lab.topic.${topic.id}${k}` as MessageKey);
  return (
    <div className="space-y-6">
      <p className="max-w-prose text-sm text-ink-muted">{t('lab.intro')}</p>
      <SubNav page="lab" label={t('lab.topics')} current={topic.id} items={TOPICS.map((x) => ({ id: x.id, label: t(`lab.topic.${x.id}` as MessageKey) }))} />
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card space-y-3" data-testid="lab-topic">
          <h2 className="text-xl font-semibold">{key('')}</h2>
          <div>
            <p className="eyebrow mb-1">{t('lab.formula')}</p>
            <p className="font-mono text-base" data-testid="lab-formula">
              {key('.formula')}
            </p>
          </div>
          <div>
            <p className="eyebrow mb-1">{t('lab.meaning')}</p>
            <p className="max-w-prose text-sm">{key('.meaning')}</p>
          </div>
        </section>
        <section className="space-y-2">
          <p className="eyebrow">{t('lab.tool')}</p>
          <topic.tool />
        </section>
      </div>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t('lab.drill')}</h2>
        {topic.id === 'estimate' && <CalibrationPanel />}
        {!drilling ? (
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className="btn-primary" onClick={() => setDrilling('practice')} data-testid="lab-start">
              {t('lab.startDrill')}
            </button>
            {'lab' in topic.drill && (
              <>
                <button type="button" className="btn-secondary" onClick={() => setDrilling('challenge')} data-testid="lab-challenge">
                  {t('lab.challenge.start', { n: CHALLENGE_SIZE })}
                </button>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={timed} onChange={(e) => setTimed(e.target.checked)} />
                  {t('lab.challenge.timed')}
                </label>
              </>
            )}
          </div>
        ) : 'solved' in topic.drill ? (
          <SizingTrainer />
        ) : 'lab' in topic.drill && topic.drill.lab === 'advantage' ? (
          <AdvantageDrill key={drilling} challenge={drilling === 'challenge' ? { n: CHALLENGE_SIZE, timed } : undefined} onExit={() => setDrilling(false)} />
        ) : 'lab' in topic.drill ? (
          <LabDrill key={`${topic.drill.lab}-${drilling}`} drill={topic.drill.lab} challenge={drilling === 'challenge' ? { n: CHALLENGE_SIZE, timed } : undefined} onExit={() => setDrilling(false)} />
        ) : (
          <MathDrill key={topic.drill.classic} drill={topic.drill.classic} />
        )}
        <p className="text-sm text-ink-muted">
          {t('lab.classic')}{' '}
          <a className="link" href={href('train', ['math'])}>
            {t('lab.classicLink')}
          </a>
        </p>
      </section>
      {topic.extra && <topic.extra />}
    </div>
  );
}
