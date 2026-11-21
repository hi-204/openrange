// Math Lab tools without a lesson widget to reuse (D-087).

import { useState } from 'react';
import { pct } from '../../lib/format';
import { t } from '../../lib/i18n';
import { Slider } from '../lessons/widgets/math';

/**
 * Implied and reverse implied odds. You call C into a pot P (including the bet). With probability
 * e you hit and win the pot plus W more later; with probability q you "hit" but are still beaten
 * and lose L more later; otherwise you miss and lose the call:
 *   EV = e·(P + C + W) − (1 − e)·C − q·L.
 */
export function ImpliedOdds() {
  const [pot, setPot] = useState(20);
  const [call, setCall] = useState(10);
  const [hit, setHit] = useState(20);
  const [extra, setExtra] = useState(15);
  const [tainted, setTainted] = useState(0);
  const [loss, setLoss] = useState(20);
  const e = hit / 100;
  const q = Math.min(tainted / 100, 1 - e);
  const required = call / (pot + call);
  const evNow = e * (pot + call) - (1 - e) * call;
  const ev = e * (pot + call + extra) - (1 - e) * call - q * loss;
  const breakEven = e > 0 ? ((1 - e) * call + q * loss) / e - (pot + call) : Infinity;
  return (
    <div className="space-y-3">
      <Slider label={t('lab.implied.tool.pot')} value={pot} min={1} max={200} step={0.5} onChange={setPot} unit="bb" />
      <Slider label={t('lab.implied.tool.call')} value={call} min={0.5} max={200} step={0.5} onChange={setCall} unit="bb" />
      <Slider label={t('lab.implied.tool.hit')} value={hit} min={0} max={100} step={1} onChange={setHit} unit="%" />
      <Slider label={t('lab.implied.tool.extra')} value={extra} min={0} max={300} step={1} onChange={setExtra} unit="bb" />
      <Slider label={t('lab.implied.tool.tainted')} value={tainted} min={0} max={100 - hit} step={1} onChange={setTainted} unit="%" />
      <Slider label={t('lab.implied.tool.loss')} value={loss} min={0} max={300} step={1} onChange={setLoss} unit="bb" />
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm" data-testid="implied-result">
        <dt>{t('lab.implied.tool.required')}</dt>
        <dd className="font-mono">{pct(required, 1)}</dd>
        <dt>{t('lab.implied.tool.evNow')}</dt>
        <dd className="font-mono">{evNow.toFixed(2)} bb</dd>
        <dt>{t('lab.implied.tool.ev')}</dt>
        <dd className="font-mono">{ev.toFixed(2)} bb</dd>
        <dt>{t('lab.implied.tool.breakEven')}</dt>
        <dd className="font-mono">{Number.isFinite(breakEven) ? `${Math.max(0, breakEven).toFixed(2)} bb` : '—'}</dd>
      </dl>
      <p className="text-xs text-ink-muted">{t('lab.implied.tool.caveat')}</p>
    </div>
  );
}
