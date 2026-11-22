// Session journal (D-092): a process goal and check-in before playing, a short reflection after.
// Private: stored only in this browser and in backups.

import { useEffect, useId, useState } from 'react';
import { t, type MessageKey } from '../../lib/i18n';
import { trainerStore, type JournalEntry } from '../trainer/store';

const MOODS = [1, 2, 3, 4, 5];
const TILT = [0, 1, 2, 3];

function GoalForm({ lastFocus, onSave }: { lastFocus: string; onSave: (e: JournalEntry) => void }) {
  const [goal, setGoal] = useState(lastFocus);
  const [rested, setRested] = useState(false);
  const [stopRule, setStopRule] = useState(false);
  const id = useId();
  useEffect(() => setGoal(lastFocus), [lastFocus]);
  return (
    <form
      className="card space-y-3"
      data-testid="journal-goal"
      onSubmit={(e) => {
        e.preventDefault();
        onSave({ at: Date.now(), kind: 'goal', goal: goal.trim(), rested, stopRule });
      }}
    >
      <h2 className="text-base font-semibold">{t('journal.before')}</h2>
      <label htmlFor={id} className="block text-sm font-medium">
        {t('journal.goal')}
      </label>
      <input id={id} className="field w-full" value={goal} placeholder={t('journal.goalHint')} onChange={(e) => setGoal(e.target.value)} />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={rested} onChange={(e) => setRested(e.target.checked)} />
        {t('journal.rested')}
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={stopRule} onChange={(e) => setStopRule(e.target.checked)} />
        {t('journal.stopRule')}
      </label>
      {!rested && <p className="text-xs text-ink-muted">{t('journal.notRested')}</p>}
      <button type="submit" className="btn-primary" disabled={!goal.trim()}>
        {t('journal.saveGoal')}
      </button>
    </form>
  );
}

function ReflectionForm({ onSave }: { onSave: (e: JournalEntry) => void }) {
  const [mood, setMood] = useState(3);
  const [tilt, setTilt] = useState(0);
  const [wentWell, setWentWell] = useState('');
  const [toImprove, setToImprove] = useState('');
  const [nextFocus, setNextFocus] = useState('');
  const ids = { well: useId(), improve: useId(), next: useId() };
  return (
    <form
      className="card space-y-3"
      data-testid="journal-reflection"
      onSubmit={(e) => {
        e.preventDefault();
        onSave({ at: Date.now(), kind: 'reflection', mood, tilt, wentWell: wentWell.trim(), toImprove: toImprove.trim(), nextFocus: nextFocus.trim() });
        setWentWell('');
        setToImprove('');
        setNextFocus('');
      }}
    >
      <h2 className="text-base font-semibold">{t('journal.after')}</h2>
      <fieldset>
        <legend className="mb-1 text-sm font-medium">{t('journal.mood')}</legend>
        <div className="flex flex-wrap gap-3 text-sm">
          {MOODS.map((m) => (
            <label key={m} className="flex items-center gap-1">
              <input type="radio" name="mood" checked={mood === m} onChange={() => setMood(m)} />
              {t(`journal.mood.${m}` as MessageKey)}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-1 text-sm font-medium">{t('journal.tilt')}</legend>
        <div className="flex flex-wrap gap-3 text-sm">
          {TILT.map((x) => (
            <label key={x} className="flex items-center gap-1">
              <input type="radio" name="tilt" checked={tilt === x} onChange={() => setTilt(x)} />
              {t(`journal.tilt.${x}` as MessageKey)}
            </label>
          ))}
        </div>
      </fieldset>
      {(
        [
          [ids.well, 'journal.wentWell', wentWell, setWentWell],
          [ids.improve, 'journal.toImprove', toImprove, setToImprove],
          [ids.next, 'journal.nextFocus', nextFocus, setNextFocus],
        ] as const
      ).map(([id, key, value, set]) => (
        <div key={id}>
          <label htmlFor={id} className="mb-1 block text-sm font-medium">
            {t(key)}
          </label>
          <textarea id={id} className="field h-16 w-full text-sm" value={value} onChange={(e) => set(e.target.value)} />
        </div>
      ))}
      <button type="submit" className="btn-primary">
        {t('journal.saveReflection')}
      </button>
    </form>
  );
}

export function JournalPage() {
  const [entries, setEntries] = useState<JournalEntry[] | null>(null);
  const [saved, setSaved] = useState(false);
  const load = () =>
    trainerStore()
      .journal()
      .then(setEntries)
      .catch(() => setEntries([]));
  useEffect(() => {
    void load();
  }, []);
  const save = async (e: JournalEntry) => {
    await trainerStore().addJournal(e);
    setSaved(true);
    await load();
  };
  const lastFocus = [...(entries ?? [])].reverse().find((e) => e.kind === 'reflection' && e.nextFocus)?.nextFocus ?? '';
  return (
    <div className="space-y-4" data-testid="journal">
      <p className="max-w-prose text-sm text-ink-muted">{t('journal.intro')}</p>
      <div className="grid gap-4 lg:grid-cols-2">
        <GoalForm lastFocus={lastFocus} onSave={(e) => void save(e)} />
        <ReflectionForm onSave={(e) => void save(e)} />
      </div>
      {saved && (
        <p className="text-sm" role="status">
          {t('journal.saved')}
        </p>
      )}
      <section className="space-y-2" data-testid="journal-entries">
        <h2 className="text-base font-semibold">{t('journal.entries')}</h2>
        {!entries?.length ? (
          <p className="text-sm text-ink-muted">{t('journal.none')}</p>
        ) : (
          <ul className="space-y-2">
            {[...entries].reverse().map((e) => (
              <li key={e.id} className="card space-y-1 text-sm">
                <p className="text-xs text-ink-muted">
                  {new Date(e.at).toLocaleString()} · {t(e.kind === 'goal' ? 'journal.kind.goal' : 'journal.kind.reflection')}
                </p>
                {e.kind === 'goal' ? (
                  <p>{t('journal.entryGoal', { goal: e.goal ?? '', rested: t(e.rested ? 'journal.yes' : 'journal.no'), stop: t(e.stopRule ? 'journal.yes' : 'journal.no') })}</p>
                ) : (
                  <>
                    <p>{t('journal.entryMood', { mood: t(`journal.mood.${e.mood ?? 3}` as MessageKey), tilt: t(`journal.tilt.${e.tilt ?? 0}` as MessageKey) })}</p>
                    {e.wentWell && <p>{t('journal.entryWell', { text: e.wentWell })}</p>}
                    {e.toImprove && <p>{t('journal.entryImprove', { text: e.toImprove })}</p>}
                    {e.nextFocus && <p className="font-medium">{t('journal.entryNext', { text: e.nextFocus })}</p>}
                  </>
                )}
                <button
                  type="button"
                  className="btn-quiet"
                  onClick={() =>
                    void trainerStore()
                      .deleteJournal(e.id!)
                      .then(load)
                  }
                >
                  {t('journal.delete')}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <p className="text-xs text-ink-muted">{t('journal.privacy')}</p>
    </div>
  );
}
