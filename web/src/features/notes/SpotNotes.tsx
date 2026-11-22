// Study notes attached to a spot (D-091): saved in this browser, included in backups.

import { useEffect, useId, useState } from 'react';
import { t } from '../../lib/i18n';
import { trainerStore } from '../trainer/store';

/** A stable key for a workbench spot: its JSON, hashed (FNV-1a). */
export function spotKey(spot: unknown): string {
  const text = JSON.stringify(spot);
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `spot:${h.toString(16)}`;
}

export function SpotNotes({ noteKey, label }: { noteKey: string; label?: string }) {
  const [text, setText] = useState('');
  const [saved, setSaved] = useState<'idle' | 'saved'>('idle');
  const id = useId();
  useEffect(() => {
    setSaved('idle');
    trainerStore()
      .notes()
      .then((all) => setText(all.find((n) => n.key === noteKey)?.text ?? ''))
      .catch(() => setText(''));
  }, [noteKey]);
  const save = async () => {
    const s = trainerStore();
    if (text.trim()) await s.putNote({ key: noteKey, text, updatedAt: Date.now() });
    else await s.deleteNote(noteKey);
    setSaved('saved');
  };
  return (
    <div className="space-y-1" data-testid="spot-notes">
      <label htmlFor={id} className="block text-sm font-medium">
        {label ?? t('notes.label')}
      </label>
      <textarea id={id} className="field h-20 w-full text-sm" value={text} placeholder={t('notes.placeholder')} onChange={(e) => (setText(e.target.value), setSaved('idle'))} />
      <div className="flex items-center gap-2">
        <button type="button" className="btn-quiet" onClick={() => void save()}>
          {t('notes.save')}
        </button>
        {saved === 'saved' && (
          <span className="text-xs text-ink-muted" role="status">
            {t('notes.saved')}
          </span>
        )}
      </div>
    </div>
  );
}
