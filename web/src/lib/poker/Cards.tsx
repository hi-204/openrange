// Cards as text with a four-colour deck; screen readers get the card names.

const SUIT: Record<string, { symbol: string; name: string; className: string }> = {
  s: { symbol: '♠', name: 'spades', className: 'text-slate-900 dark:text-slate-100' },
  h: { symbol: '♥', name: 'hearts', className: 'text-red-700 dark:text-red-400' },
  d: { symbol: '♦', name: 'diamonds', className: 'text-blue-700 dark:text-blue-400' },
  c: { symbol: '♣', name: 'clubs', className: 'text-green-700 dark:text-green-400' },
};
const RANK: Record<string, string> = { A: 'ace', K: 'king', Q: 'queen', J: 'jack', T: 'ten', '9': 'nine', '8': 'eight', '7': 'seven', '6': 'six', '5': 'five', '4': 'four', '3': 'three', '2': 'two' };

/** "AhKd" or ["Ah", "Kd"] → spaced cards. */
export function splitCards(cards: string | string[]): string[] {
  if (Array.isArray(cards)) return cards;
  return cards.replace(/\s+/g, '').match(/.{2}/g) ?? [];
}

export function cardName(card: string): string {
  return `${RANK[card[0]!.toUpperCase()] ?? card[0]} of ${SUIT[card[1]!]?.name ?? card[1]}`;
}

export function Cards({ cards, size = 'base' }: { cards: string | string[]; size?: 'base' | 'xl' }) {
  const list = splitCards(cards);
  return (
    <span className={`inline-flex gap-1 font-mono font-semibold ${size === 'xl' ? 'text-3xl' : ''}`} aria-label={list.map(cardName).join(', ')} role="img">
      {list.map((c, i) => {
        const s = SUIT[c[1]!];
        return (
          <span key={i} aria-hidden className={`rounded border border-slate-300 bg-white px-1 dark:border-slate-600 dark:bg-slate-950 ${s?.className ?? ''}`}>
            {c[0]!.toUpperCase()}
            {s?.symbol ?? c[1]}
          </span>
        );
      })}
    </span>
  );
}
