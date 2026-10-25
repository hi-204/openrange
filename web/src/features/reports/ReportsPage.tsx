// Aggregated flop report (D-077): one spot solved on a sample of flops by the CLI, grouped by
// texture. Data: data/reports/*.json (served from web/public/data/reports), with provenance.

import { useEffect, useState } from 'react';
import { pct } from '../../lib/format';
import { t, type MessageKey } from '../../lib/i18n';
import { ProvenanceBadge } from '../../lib/provenance/ProvenanceBadge';
import { loadJson } from '../../lib/provenance/types';
import { Skeleton } from '../../lib/ui/components';
import { cbet, foldVsCbet, groupsOf, lead, summarize, type FlopRow, type Group, type ReportFile } from './reportStats';

const FILE = 'data/reports/flop-srp-btn-bb.json';

function GroupTable({ title, groups, label }: { title: string; groups: Group[]; label: (k: string) => string }) {
  return (
    <div className="space-y-1">
      <h3 className="text-sm font-semibold">{title}</h3>
      <table className="w-full text-left text-sm">
        <thead>
          <tr>
            <th className="py-1 font-medium">{t('reports.group')}</th>
            <th className="py-1 font-medium">{t('reports.flops')}</th>
            <th className="py-1 font-medium">{t('reports.cbet')}</th>
            <th className="py-1 font-medium">{t('reports.fold')}</th>
            <th className="py-1 font-medium">{t('reports.equity')}</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => (
            <tr key={g.key} className="border-t border-slate-100 dark:border-slate-800">
              <th scope="row" className="py-1 font-normal">
                {label(g.key)}
              </th>
              <td className="num py-1">{g.flops}</td>
              <td className="num py-1">{pct(g.cbet, 0)}</td>
              <td className="num py-1">{pct(g.fold, 0)}</td>
              <td className="num py-1">{pct(g.equity, 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ReportsPage() {
  const [doc, setDoc] = useState<ReportFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<'board' | 'cbet' | 'equity'>('cbet');
  useEffect(() => {
    loadJson<ReportFile>(FILE).then(setDoc, (e: Error) => setError(e.message));
  }, []);
  if (error) return <p className="text-amber-700 dark:text-amber-400">{t('reports.missing', { error })}</p>;
  if (!doc) return <Skeleton className="h-64" />;
  const rows = [...doc.flops].sort((a, b) => (sort === 'board' ? a.board.localeCompare(b.board) : sort === 'cbet' ? cbet(b) - cbet(a) : b.btnEquity - a.btnEquity));
  const order = (gs: Group[], keys: string[]) => keys.map((k) => gs.find((g) => g.key === k)).filter((g): g is Group => !!g);
  const by = (f: (r: FlopRow) => string) => summarize(doc.flops, f);
  const worst = Math.max(...doc.flops.map((f) => f.exploitabilityPctPot));
  return (
    <div className="space-y-5" data-testid="reports">
      <section className="card space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold">{t('reports.title', { oop: doc.spot.oop, ip: doc.spot.ip })}</h2>
          <ProvenanceBadge p={doc.provenance} />
        </div>
        <p className="max-w-prose text-sm text-ink-muted">{t('reports.intro', { flops: doc.flops.length, pot: doc.spot.pot.toFixed(1), stack: doc.spot.stack.toFixed(1), flop: doc.spot.sizes.flop ?? 33, raises: doc.spot.raises, worst: worst.toFixed(2) })}</p>
        {doc.spot.raises === 0 && <p className="text-sm">{t('reports.noRaises')}</p>}
      </section>
      <section className="card grid gap-5 lg:grid-cols-2" data-testid="report-groups">
        <GroupTable title={t('reports.byHigh')} groups={order(by((r) => groupsOf(r.board).highCard), ['A', 'K', 'Q', 'J-T', '9-'])} label={(k) => t('reports.high', { rank: k })} />
        <GroupTable title={t('reports.bySuits')} groups={order(by((r) => groupsOf(r.board).suits), ['rainbow', 'twotone', 'monotone'])} label={(k) => t(`math.texture.${k}` as MessageKey)} />
        <GroupTable title={t('reports.byPair')} groups={order(by((r) => (groupsOf(r.board).paired ? 'paired' : 'unpaired')), ['unpaired', 'paired'])} label={(k) => t(`math.texture.${k}` as MessageKey)} />
        <GroupTable title={t('reports.byStraight')} groups={order(by((r) => (groupsOf(r.board).straight ? 'straight' : 'noStraight')), ['noStraight', 'straight'])} label={(k) => t(`math.texture.${k}` as MessageKey)} />
      </section>
      <section className="card space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">{t('reports.allFlops')}</h3>
          <label className="text-sm">
            {t('reports.sort')}{' '}
            <select className="field inline-block w-auto" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
              <option value="cbet">{t('reports.cbet')}</option>
              <option value="equity">{t('reports.equity')}</option>
              <option value="board">{t('reports.board')}</option>
            </select>
          </label>
        </div>
        <div className="max-h-[32rem] overflow-auto" tabIndex={0} role="region" aria-label={t('reports.allFlops')}>
          <table className="w-full text-left text-sm" data-testid="report-flops">
            <thead className="sticky top-0 bg-surface">
              <tr>
                <th className="py-1 font-medium">{t('reports.board')}</th>
                <th className="py-1 font-medium">{t('reports.lead')}</th>
                <th className="py-1 font-medium">{t('reports.cbet')}</th>
                <th className="py-1 font-medium">{t('reports.fold')}</th>
                <th className="py-1 font-medium">{t('reports.equity')}</th>
                <th className="py-1 font-medium">{t('reports.accuracy')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.board} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="py-1 font-mono">{r.board}</td>
                  <td className="num py-1">{pct(lead(r), 0)}</td>
                  <td className="num py-1">{pct(cbet(r), 0)}</td>
                  <td className="num py-1">{pct(foldVsCbet(r), 0)}</td>
                  <td className="num py-1">{pct(r.btnEquity, 0)}</td>
                  <td className="num py-1 text-ink-muted">{r.exploitabilityPctPot.toFixed(2)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
