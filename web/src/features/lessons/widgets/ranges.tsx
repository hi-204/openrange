import { useEffect, useId, useState } from 'react';
import { pct } from '../../../lib/format';
import { t } from '../../../lib/i18n';
import { cellName, cellOf } from '../../../lib/poker/hands';
import { ProvenanceBadge } from '../../../lib/provenance/ProvenanceBadge';
import { loadJson, type ChartFile } from '../../../lib/provenance/types';
import { solverClient } from '../../../lib/wasm/client';
import type { EquityResult } from '../../../lib/wasm/protocol';
import { ClassGrid } from '../../charts/ClassGrid';
import { actionColors } from '../../solver/colors';
import { rangeSummary } from '../../trainer/postflop/features';
import { COMBO_STRINGS } from './cards';

type Config = Record<string, unknown>;
const text = (c: Config, k: string, d: string) => (typeof c[k] === 'string' ? (c[k] as string) : d);
const CLASSES = Array.from({ length: 169 }, (_, i) => cellName(i));
const noop = () => undefined;

function TextInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium">
        {label}
      </label>
      <input id={id} className="field" value={value} onChange={(e) => onChange(e.target.value)} spellCheck={false} />
    </div>
  );
}

/** A range on the 13×13 grid, with its combo count. */
export function RangeGrid({ config }: { config: Config }) {
  const [range, setRange] = useState(text(config, 'range', 'QQ+, AKs'));
  const [res, setRes] = useState<{ weights: number[]; combos: number } | { error: string } | null>(null);
  useEffect(() => {
    let live = true;
    solverClient()
      .call('parseRange', { text: range })
      .then((r) => live && setRes(r.ok ? { weights: r.weights, combos: r.combos } : { error: r.error }))
      .catch((e: Error) => live && setRes({ error: e.message }));
    return () => {
      live = false;
    };
  }, [range]);
  let strategy: number[][] = [];
  if (res && 'weights' in res) {
    const sum = new Array(169).fill(0);
    const count = new Array(169).fill(0);
    COMBO_STRINGS.forEach((c, i) => {
      const k = cellOf(c).index;
      sum[k] += res.weights[i]!;
      count[k]++;
    });
    strategy = sum.map((s, k) => [1 - s / count[k], s / count[k]]);
  }
  return (
    <div className="space-y-3">
      <TextInput label={t('widget.range')} value={range} onChange={setRange} />
      {res && 'error' in res && <p className="text-sm text-amber-700 dark:text-amber-400">{res.error}</p>}
      {res && 'weights' in res && (
        <>
          <p className="text-sm" data-testid="grid-result">
            {t('widget.grid.count', { combos: res.combos, share: pct(res.combos / 1326, 1) })}
          </p>
          <div className="max-w-md">
            <ClassGrid classes={CLASSES} strategy={strategy} actions={[t('widget.grid.out'), t('widget.grid.in')]} colors={['transparent', '#E69F00']} selected={null} onSelect={noop} label={t('widget.range')} />
          </div>
        </>
      )}
    </div>
  );
}

/** A generated chart with its provenance badge (strategy numbers never live in lesson text). */
export function ChartEmbed({ config }: { config: Config }) {
  const file = text(config, 'file', '');
  const id = text(config, 'chart', '');
  const [doc, setDoc] = useState<ChartFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    loadJson<ChartFile>(`data/charts/${file}`).then(setDoc, (e: Error) => setError(e.message));
  }, [file]);
  const chart = doc?.charts.find((c) => c.id === id);
  if (error) return <p className="text-sm text-amber-700 dark:text-amber-400">{error}</p>;
  if (!doc) return <p className="text-sm">…</p>;
  if (!chart) return <p className="text-sm text-amber-700 dark:text-amber-400">{t('widget.chart.missing', { id })}</p>;
  const colors = actionColors(chart.actions, chart.actions.map((a) => /^(Raise|All-in)/.test(a)));
  // Share of all starting hands taking each action, counting only hands that reach the spot.
  const shares = chart.actions.map(() => 0);
  let total = 0;
  doc.classes.forEach((name, i) => {
    const w = (name.length === 2 ? 6 : name.endsWith('s') ? 4 : 12) * (chart.reach ? chart.reach[i]! : 1);
    total += w;
    chart.strategy[i]!.forEach((f, k) => (shares[k]! += w * f));
  });
  if (total > 0) shares.forEach((_, k) => (shares[k]! /= total));
  const outOfBand = doc.sanityBands?.some((b) => !b.inBand);
  return (
    <div className="space-y-2" data-testid="chart-embed">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium">{chart.title}</span>
        <ProvenanceBadge p={doc.provenance} />
      </div>
      <ul className="flex flex-wrap gap-3 text-sm" data-testid="chart-shares">
        {chart.actions.map((a, k) => (
          <li key={a} className="flex items-center gap-1">
            <span aria-hidden className="inline-block h-3 w-3 rounded-sm" style={{ background: colors[k] }} />
            {a} <span className="num text-ink-muted">{pct(shares[k]!, 1)}</span>
          </li>
        ))}
      </ul>
      <div className="max-w-md">
        <ClassGrid classes={doc.classes} strategy={chart.strategy} actions={chart.actions} colors={colors} reach={chart.reach} selected={null} onSelect={noop} label={chart.title} />
      </div>
      {doc.provenance.source !== 'solver_exact' && <p className="text-xs text-ink-muted">{t('widget.chart.approx')}</p>}
      {outOfBand && <p className="text-xs font-semibold text-[#a34700] dark:text-[#ff8f4a]">{t('widget.chart.outOfBand')}</p>}
    </div>
  );
}

/** Range vs range on a board: average equity, very strong hands, and the equity spread. */
export function RangeAdvantage({ config }: { config: Config }) {
  const [a, setA] = useState(text(config, 'a', 'QQ+, AKs'));
  const [b, setB] = useState(text(config, 'b', '22+'));
  const [board, setBoard] = useState(text(config, 'board', 'Ks 7d 2c'));
  const [r, setR] = useState<EquityResult | null>(null);
  useEffect(() => {
    let live = true;
    solverClient()
      .call('equity', { request: { ranges: [a, b], board, dead: '', mode: 'exact' } })
      .then((x) => live && setR(x))
      .catch((e: Error) => live && setR({ ok: false, error: e.message }));
    return () => {
      live = false;
    };
  }, [a, b, board]);
  const buckets = (per: { weight: number; equity: number }[]) => {
    const out = [0, 0, 0, 0, 0];
    const total = per.reduce((s, x) => s + x.weight, 0);
    for (const x of per) out[Math.min(4, Math.floor(x.equity * 5))]! += x.weight / total;
    return out;
  };
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <TextInput label={t('widget.rangeA')} value={a} onChange={setA} />
        <TextInput label={t('widget.rangeB')} value={b} onChange={setB} />
        <TextInput label={t('widget.boardCards')} value={board} onChange={setBoard} />
      </div>
      {!r ? (
        <p>…</p>
      ) : !r.ok ? (
        <p className="text-sm text-amber-700 dark:text-amber-400">{r.error}</p>
      ) : r.method !== 'exact' ? null : (
        <div className="grid gap-4 sm:grid-cols-2" data-testid="advantage-result">
          {r.players.map((p, i) => {
            const s = rangeSummary(p.perCombo, 0.85);
            return (
              <div key={i} className="space-y-1 text-sm">
                <p className="font-medium">{i === 0 ? t('widget.rangeA') : t('widget.rangeB')}</p>
                <p>{t('widget.advantage.equity', { eq: pct(s.equity, 1) })}</p>
                <p>{t('widget.advantage.nuts', { share: pct(s.nutShare, 0) })}</p>
                <ul className="space-y-0.5" aria-label={t('widget.advantage.spread')}>
                  {buckets(p.perCombo).map((w, k) => (
                    <li key={k} className="flex items-center gap-2">
                      <span className="w-16 font-mono text-xs">
                        {k * 20}–{(k + 1) * 20}%
                      </span>
                      <span className="h-3 rounded-sm bg-[#56B4E9]" style={{ width: `${w * 100}%` }} />
                      <span className="font-mono text-xs">{pct(w, 0)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Two hands or ranges, optional board: equity (exact when small enough, else sampled). */
export function EquityWidget({ config }: { config: Config }) {
  const init = (Array.isArray(config.ranges) ? config.ranges : ['AhKh', 'QsQd']) as string[];
  const [a, setA] = useState(init[0] ?? '');
  const [b, setB] = useState(init[1] ?? '');
  const [board, setBoard] = useState(text(config, 'board', ''));
  const [r, setR] = useState<EquityResult | null>(null);
  useEffect(() => {
    let live = true;
    const h = setTimeout(() => {
      solverClient()
        .call('equity', { request: { ranges: [a, b], board, dead: '', mode: 'auto', seed: 1 } })
        .then((x) => live && setR(x))
        .catch((e: Error) => live && setR({ ok: false, error: e.message }));
    }, 250);
    return () => {
      live = false;
      clearTimeout(h);
    };
  }, [a, b, board]);
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <TextInput label={t('widget.rangeA')} value={a} onChange={setA} />
        <TextInput label={t('widget.rangeB')} value={b} onChange={setB} />
        <TextInput label={t('widget.boardOptional')} value={board} onChange={setBoard} />
      </div>
      {!r ? (
        <p>…</p>
      ) : !r.ok ? (
        <p className="text-sm text-amber-700 dark:text-amber-400">{r.error}</p>
      ) : (
        <p className="text-sm" data-testid="equity-result">
          {t('widget.equity.result', { a: pct(r.players[0]!.equity, 1), b: pct(r.players[1]!.equity, 1) })}{' '}
          <span className="text-ink-muted">{r.method === 'exact' ? t('widget.equity.exact') : t('widget.equity.sampled', { se: pct(r.players[0]!.stdError, 2) })}</span>
        </p>
      )}
    </div>
  );
}
