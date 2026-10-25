import { useEffect, useId, useMemo, useState } from 'react';
import { t, type MessageKey } from '../../lib/i18n';
import { applyPreset, DEFAULTS, type AppSettings, type Preset } from '../../lib/settings/settings';
import { useSettings } from '../../lib/settings/useSettings';
import { Accordion, Field, SegmentedControl, Switch, toast } from '../../lib/ui/components';
import { Icon } from '../../lib/ui/Icon';
import { solverClient } from '../../lib/wasm/client';
import { PRESETS, toSpot } from '../solver/spotForm';
import { ThresholdSettings, DataSettings } from '../trainer/ReviewPage';
import { trainerStore, type TrainerSettings } from '../trainer/store';

type Section = 'game' | 'training' | 'coaching' | 'solver' | 'display' | 'data';
type S = AppSettings;

/** One setting: where it lives, how it is edited, and its plain-English help. */
type Def = {
  section: Section;
  id: string;
  advanced?: boolean;
  render: (s: S, set: (f: (s: S) => S) => void) => React.JSX.Element;
};

const seg = <T extends string>(id: string, get: (s: S) => T, put: (s: S, v: T) => S, values: readonly T[]) =>
  function SegSetting(s: S, set: (f: (s: S) => S) => void) {
    return (
      <SegmentedControl
        label={t(`settings.${id}` as MessageKey)}
        value={get(s)}
        onChange={(v) => set((x) => put(x, v))}
        options={values.map((v) => ({ value: v, label: t(`settings.${id}.${v}` as MessageKey) }))}
      />
    );
  };

const D = (s: S, d: Partial<S['display']>): S => ({ ...s, display: { ...s.display, ...d } });
const T = (s: S, d: Partial<S['training']>): S => ({ ...s, training: { ...s.training, ...d } });
const C = (s: S, d: Partial<S['coaching']>): S => ({ ...s, coaching: { ...s.coaching, ...d } });
const G = (s: S, d: Partial<S['game']>): S => ({ ...s, game: { ...s.game, ...d } });
const V = (s: S, d: Partial<S['solver']>): S => ({ ...s, solver: { ...s.solver, ...d } });
const num = (v: string, lo: number, hi: number, fallback: number) => {
  const x = Number(v);
  return Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : fallback;
};

const DEFS: Def[] = [
  // Display
  { section: 'display', id: 'theme', render: seg('theme', (s) => s.display.theme, (s, theme) => D(s, { theme }), ['system', 'dark', 'light'] as const) },
  { section: 'display', id: 'palette', render: seg('palette', (s) => s.display.palette, (s, palette) => D(s, { palette }), ['studio', 'okabe-ito'] as const) },
  { section: 'display', id: 'felt', render: seg('felt', (s) => s.display.felt, (s, felt) => D(s, { felt }), ['green', 'navy', 'burgundy', 'charcoal'] as const) },
  { section: 'display', id: 'deck', render: seg('deck', (s) => s.display.deck, (s, deck) => D(s, { deck }), ['four', 'two'] as const) },
  { section: 'display', id: 'cardBack', render: seg('cardBack', (s) => s.display.cardBack, (s, cardBack) => D(s, { cardBack }), ['classic', 'lattice', 'plain'] as const) },
  { section: 'display', id: 'units', render: seg('units', (s) => s.display.units, (s, units) => D(s, { units }), ['bb', 'chips'] as const) },
  { section: 'display', id: 'animation', render: seg('animation', (s) => s.display.animation, (s, animation) => D(s, { animation }), ['off', 'fast', 'normal'] as const) },
  { section: 'display', id: 'reduceMotion', render: seg('reduceMotion', (s) => s.display.reduceMotion, (s, reduceMotion) => D(s, { reduceMotion }), ['system', 'on', 'off'] as const) },
  {
    section: 'display',
    id: 'textSize',
    render: seg('textSize', (s) => String(s.display.textSize) as '90' | '100' | '112' | '125', (s, v) => D(s, { textSize: Number(v) as 90 | 100 | 112 | 125 }), ['90', '100', '112', '125'] as const),
  },
  { section: 'display', id: 'density', render: seg('density', (s) => s.display.density, (s, density) => D(s, { density }), ['comfortable', 'compact'] as const) },
  { section: 'display', id: 'sound', render: (s, set) => <Switch label={t('settings.sound')} checked={s.display.sound} onChange={(sound) => set((x) => D(x, { sound }))} /> },
  // Training
  { section: 'training', id: 'hints', render: (s, set) => <Switch label={t('settings.hints')} checked={s.training.hints} onChange={(hints) => set((x) => T(x, { hints }))} /> },
  { section: 'training', id: 'autoAdvance', render: (s, set) => <Switch label={t('settings.autoAdvance')} checked={s.training.autoAdvance} onChange={(autoAdvance) => set((x) => T(x, { autoAdvance }))} /> },
  {
    section: 'training',
    id: 'timer',
    render: seg('timer', (s) => String(s.training.timerSeconds) as '0' | '10' | '20' | '30', (s, v) => T(s, { timerSeconds: Number(v) as 0 | 10 | 20 | 30 }), ['0', '10', '20', '30'] as const),
  },
  { section: 'training', id: 'srs', render: seg('srs', (s) => s.training.srs, (s, srs) => T(s, { srs }), ['light', 'normal', 'intense'] as const) },
  // Coaching
  { section: 'coaching', id: 'detail', render: seg('detail', (s) => s.coaching.detail, (s, detail) => C(s, { detail }), ['simple', 'standard', 'detailed'] as const) },
  { section: 'coaching', id: 'showMath', render: (s, set) => <Switch label={t('settings.showMath')} checked={s.coaching.showMath} onChange={(showMath) => set((x) => C(x, { showMath }))} /> },
  { section: 'coaching', id: 'liveCoach', render: (s, set) => <Switch label={t('settings.liveCoach')} checked={s.coaching.liveCoach} onChange={(liveCoach) => set((x) => C(x, { liveCoach }))} /> },
  // Game
  { section: 'game', id: 'tableSize', render: (s, set) => <Field label={t('settings.tableSize')} type="number" min={2} max={9} value={s.game.tableSize} onChange={(v) => set((x) => G(x, { tableSize: num(v, 2, 9, 6) }))} /> },
  { section: 'game', id: 'stack', render: (s, set) => <Field label={t('settings.stack')} type="number" min={1} max={500} value={s.game.stack} onChange={(v) => set((x) => G(x, { stack: num(v, 1, 500, 100) }))} /> },
  { section: 'game', id: 'gameType', render: seg('gameType', (s) => s.game.gameType, (s, gameType) => G(s, { gameType }), ['cash', 'tournament'] as const) },
  { section: 'game', id: 'ante', advanced: true, render: (s, set) => <Field label={t('settings.ante')} type="number" min={0} max={5} step={0.05} value={s.game.ante} onChange={(v) => set((x) => G(x, { ante: num(v, 0, 5, 0) }))} /> },
  {
    section: 'game',
    id: 'rake',
    advanced: true,
    render: (s, set) => (
      <div className="space-y-3">
        <Switch label={t('settings.rake')} checked={s.game.rake.on} onChange={(on) => set((x) => G(x, { rake: { ...x.game.rake, on } }))} />
        {s.game.rake.on && (
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('settings.rakePercent')} type="number" min={0} max={10} step={0.5} value={s.game.rake.percent} onChange={(v) => set((x) => G(x, { rake: { ...x.game.rake, percent: num(v, 0, 10, 5) } }))} />
            <Field label={t('settings.rakeCap')} type="number" min={0} max={20} step={0.5} value={s.game.rake.capBb} onChange={(v) => set((x) => G(x, { rake: { ...x.game.rake, capBb: num(v, 0, 20, 3) } }))} />
          </div>
        )}
      </div>
    ),
  },
  // Solver (advanced)
  { section: 'solver', id: 'algorithm', advanced: true, render: seg('algorithm', (s) => s.solver.algorithm, (s, algorithm) => V(s, { algorithm }), ['dcfr', 'cfr+'] as const) },
  { section: 'solver', id: 'maxIterations', advanced: true, render: (s, set) => <Field label={t('settings.maxIterations')} type="number" min={10} max={20000} value={s.solver.maxIterations} onChange={(v) => set((x) => V(x, { maxIterations: num(v, 10, 20000, 1000) }))} /> },
  { section: 'solver', id: 'targetPct', advanced: true, render: (s, set) => <Field label={t('settings.targetPct')} type="number" min={0} max={10} step={0.05} value={s.solver.targetPct} onChange={(v) => set((x) => V(x, { targetPct: num(v, 0, 10, 0.3) }))} /> },
  { section: 'solver', id: 'memoryMb', advanced: true, render: (s, set) => <Field label={t('settings.memoryMb')} type="number" min={50} max={3000} value={s.solver.memoryMb} onChange={(v) => set((x) => V(x, { memoryMb: num(v, 50, 3000, 1000) }))} /> },
  { section: 'solver', id: 'simplify', advanced: true, render: (s, set) => <Switch label={t('settings.simplify')} checked={s.solver.simplify} onChange={(simplify) => set((x) => V(x, { simplify }))} /> },
  {
    section: 'solver',
    id: 'threads',
    advanced: true,
    render: () => <Field label={t('settings.threads')} type="number" value={1} onChange={() => undefined} min={1} max={1} hint={t('settings.threads.fixed')} />,
  },
];

const SECTIONS: Section[] = ['display', 'training', 'coaching', 'game', 'solver', 'data'];

/** Live memory estimate for the default flop spot under the current solver settings. */
function MemoryEstimate({ s }: { s: S }) {
  const [bytes, setBytes] = useState<number | null>(null);
  useEffect(() => {
    let live = true;
    solverClient()
      .call('estimateMemory', { spot: toSpot(PRESETS.flop) })
      .then((r) => live && setBytes(r.bytes))
      .catch(() => live && setBytes(null));
    return () => {
      live = false;
    };
  }, []);
  if (bytes === null) return null;
  const fits = bytes <= s.solver.memoryMb * 1e6;
  return (
    <p className="text-sm" data-testid="settings-memory">
      {t('settings.memoryEstimate', { mb: (bytes / 1e6).toFixed(0), limit: s.solver.memoryMb })} {fits ? t('settings.memoryFits') : t('settings.memoryNoFit')}
    </p>
  );
}

export function SettingsPage() {
  const { settings, update } = useSettings();
  const [query, setQuery] = useState('');
  const [trainer, setTrainer] = useState<TrainerSettings>({ thresholds: null });
  const searchId = useId();
  useEffect(() => {
    trainerStore().settings().then(setTrainer).catch(() => undefined);
  }, []);
  const set = (f: (s: S) => S) => void update(f);
  const text = (d: Def) => `${t(`settings.${d.id}` as MessageKey)} ${t(`settings.${d.id}.help` as MessageKey)}`.toLowerCase();
  const q = query.trim().toLowerCase();
  const visible = useMemo(() => DEFS.filter((d) => !q || text(d).includes(q)), [q]); // eslint-disable-line react-hooks/exhaustive-deps
  const resetSection = (sec: Section) =>
    set((s) => {
      if (sec === 'display') return { ...s, display: DEFAULTS.display };
      if (sec === 'training') return { ...s, training: DEFAULTS.training };
      if (sec === 'coaching') return { ...s, coaching: DEFAULTS.coaching };
      if (sec === 'game') return { ...s, game: DEFAULTS.game };
      if (sec === 'solver') return { ...s, solver: DEFAULTS.solver };
      return s;
    });

  const row = (d: Def) => (
    <div key={d.id} className="space-y-1.5" data-testid={`setting-${d.id}`}>
      {d.render(settings, set)}
      <p className="text-xs text-ink-muted">{t(`settings.${d.id}.help` as MessageKey)}</p>
    </div>
  );

  return (
    <div className="space-y-6" data-testid="settings">
      <section className="card space-y-4">
        <div className="relative">
          <label htmlFor={searchId} className="sr-only">
            {t('settings.search')}
          </label>
          <Icon name="search" size={18} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-muted" />
          <input id={searchId} className="field pl-10" placeholder={t('settings.search')} value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium">{t('settings.presets')}</span>
          {(['beginner', 'standard', 'advanced'] as Preset[]).map((p) => (
            <button
              key={p}
              type="button"
              className="btn-secondary"
              onClick={() => {
                set((s) => applyPreset(s, p));
                toast(t('settings.presetApplied', { preset: t(`settings.preset.${p}` as MessageKey) }));
              }}
            >
              {t(`settings.preset.${p}` as MessageKey)}
            </button>
          ))}
        </div>
        <p className="text-xs text-ink-muted">{t('settings.presetsNote')}</p>
      </section>

      {SECTIONS.map((sec) => {
        const defs = visible.filter((d) => d.section === sec);
        const showData = sec === 'data' && (!q || t('settings.section.data').toLowerCase().includes(q) || 'export import reset backup storage'.includes(q));
        const showThresholds = sec === 'training' && (!q || t('review.settings').toLowerCase().includes(q) || 'grading thresholds'.includes(q));
        if (!defs.length && !showData && !showThresholds) return null;
        const simple = defs.filter((d) => !d.advanced);
        const advanced = defs.filter((d) => d.advanced);
        return (
          <section key={sec} className="card space-y-5" aria-labelledby={`sec-${sec}`} data-testid={`settings-${sec}`}>
            <div className="flex items-center justify-between gap-3">
              <h2 id={`sec-${sec}`} className="text-lg font-semibold">
                {t(`settings.section.${sec}` as MessageKey)}
              </h2>
              {sec !== 'data' && (
                <button type="button" className="btn-quiet" onClick={() => resetSection(sec)}>
                  {t('settings.resetSection')}
                </button>
              )}
            </div>
            {sec === 'game' && <p className="text-xs text-ink-muted">{t('settings.gameNote')}</p>}
            {simple.map(row)}
            {advanced.length > 0 && (
              <Accordion title={t('settings.advanced')} defaultOpen={settings.mode === 'expert' || !!q}>
                {advanced.map(row)}
                {sec === 'solver' && <MemoryEstimate s={settings} />}
              </Accordion>
            )}
            {showThresholds && (
              <Accordion title={t('review.settings')} defaultOpen={!!q}>
                <ThresholdSettings
                  key={JSON.stringify(trainer)}
                  settings={trainer}
                  onSave={async (s) => {
                    await trainerStore().putSettings(s);
                    setTrainer(s);
                  }}
                />
              </Accordion>
            )}
            {showData && <DataSettings />}
          </section>
        );
      })}
    </div>
  );
}
