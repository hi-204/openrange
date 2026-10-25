// Card helpers for lesson widgets (display and counting only; evaluation is in Rust).

export const RANKS = 'AKQJT98765432';
export const SUITS = 'shdc';
export const DECK = [...RANKS].flatMap((r) => [...SUITS].map((s) => r + s));

/** "Ah Kd" / "AhKd" → ["Ah", "Kd"], normalised (rank upper case, suit lower case). */
export function splitCards(text: string): string[] {
  const s = text.replace(/[\s,]+/g, '');
  const out: string[] = [];
  for (let i = 0; i + 1 < s.length; i += 2) out.push(s[i]!.toUpperCase() + s[i + 1]!.toLowerCase());
  return out;
}

export function validCards(cards: string[]): boolean {
  return cards.every((c) => DECK.includes(c)) && new Set(cards).size === cards.length;
}

/** Every combo of a hand class or rank pair: "AKs" (4), "AKo" (12), "AK" (16), "QQ" (6). */
export function combosOf(hand: string): string[] {
  const h = hand.trim();
  const [a, b] = [h[0]?.toUpperCase(), h[1]?.toUpperCase()];
  const kind = h[2]?.toLowerCase();
  if (!a || !b || !RANKS.includes(a) || !RANKS.includes(b)) throw new Error(`"${hand}" is not a hand like AKs, AKo, AK or QQ`);
  const out: string[] = [];
  for (let i = 0; i < 4; i++)
    for (let j = 0; j < 4; j++) {
      if (a === b && j <= i) continue;
      const suited = i === j;
      if (a !== b && kind === 's' && !suited) continue;
      if (a !== b && kind === 'o' && suited) continue;
      out.push(a + SUITS[i]! + b + SUITS[j]!);
    }
  return out;
}

/** solver-core's card order: index = rank × 4 + suit (rank 0 = deuce, suits c d h s). */
const RANKS_UP = '23456789TJQKA';
const SUITS_UP = 'cdhs';
export const cardOfIndex = (i: number) => RANKS_UP[i >> 2]! + SUITS_UP[i & 3]!;

/** Combo strings in solver-core's combo index order (hi·(hi−1)/2 + lo), higher card first. */
export const COMBO_STRINGS: string[] = (() => {
  const out: string[] = [];
  for (let hi = 1; hi < 52; hi++) for (let lo = 0; lo < hi; lo++) out.push(cardOfIndex(hi) + cardOfIndex(lo));
  return out;
})();
