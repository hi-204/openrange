// Hand-history import (D-078): PokerStars and GGPoker hold'em text into a normalized hand,
// for post-session review only. Amounts are converted to big blinds. Parsing is tolerant:
// lines it doesn't understand are skipped, and a hand that can't be read is reported with a
// reason instead of being guessed.

export type Site = 'PokerStars' | 'GGPoker' | 'OpenRange';
export type Street = 'preflop' | 'flop' | 'turn' | 'river';
export type ActionKind = 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'post';

export type HandAction = {
  street: Street;
  player: string;
  kind: ActionKind;
  /** bb added to the pot by this action (for raises: the extra put in). */
  amount: number;
  /** Raises: total bet size after the raise, in bb. */
  to?: number;
  allIn: boolean;
};

export type Seat = { seat: number; name: string; stack: number; position: string };

export type Hand = {
  site: Site;
  id: string;
  bigBlind: number;
  /** Currency or chip unit as printed (e.g. "$"), for display only. */
  unit: string;
  maxPlayers: number;
  buttonSeat: number;
  seats: Seat[];
  hero: string | null;
  heroCards: string[];
  board: string[];
  actions: HandAction[];
  /** Amount collected by each winner, in bb. */
  collected: Record<string, number>;
  shown: Record<string, string[]>;
};

export type ParseResult = { hands: Hand[]; errors: { index: number; reason: string }[] };

const NUM = String.raw`[$€£]?([\d,]+(?:\.\d+)?)`;
const num = (s: string) => Number(s.replace(/,/g, ''));
const cardList = (s: string) => s.trim().split(/\s+/).filter((c) => /^[2-9TJQKA][cdhs]$/.test(c));

/** Split a text file into hand blocks (each starts with a site header). */
export function splitHands(text: string): string[] {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const blocks: string[][] = [];
  for (const line of lines) {
    if (/^(PokerStars (Hand|Zoom Hand|Game) #|Poker Hand #)/.test(line.trim())) blocks.push([]);
    if (blocks.length) blocks[blocks.length - 1]!.push(line);
  }
  return blocks.map((b) => b.join('\n').trim()).filter(Boolean);
}

/** Positions for a table, clockwise from the button: BTN, SB, BB, then early to late. */
export function positions(seatsInOrder: number[], buttonSeat: number): Map<number, string> {
  const n = seatsInOrder.length;
  const sorted = [...seatsInOrder].sort((a, b) => a - b);
  const start = sorted.findIndex((s) => s >= buttonSeat);
  const fromButton = [...sorted.slice(start < 0 ? 0 : start), ...sorted.slice(0, start < 0 ? 0 : start)];
  const names: Record<number, string[]> = {
    2: ['BTN', 'BB'],
    3: ['BTN', 'SB', 'BB'],
    4: ['BTN', 'SB', 'BB', 'CO'],
    5: ['BTN', 'SB', 'BB', 'UTG', 'CO'],
    6: ['BTN', 'SB', 'BB', 'UTG', 'HJ', 'CO'],
    7: ['BTN', 'SB', 'BB', 'UTG', 'MP', 'HJ', 'CO'],
    8: ['BTN', 'SB', 'BB', 'UTG', 'UTG+1', 'MP', 'HJ', 'CO'],
    9: ['BTN', 'SB', 'BB', 'UTG', 'UTG+1', 'UTG+2', 'MP', 'HJ', 'CO'],
    10: ['BTN', 'SB', 'BB', 'UTG', 'UTG+1', 'UTG+2', 'MP', 'MP+1', 'HJ', 'CO'],
  };
  const list = names[n] ?? fromButton.map((_, i) => `S${i}`);
  return new Map(fromButton.map((s, i) => [s, list[i]!]));
}

export function parseHand(block: string): Hand {
  const lines = block.split('\n').map((l) => l.trim());
  const head = lines[0] ?? '';
  const site: Site = head.startsWith('Poker Hand #') ? 'GGPoker' : 'PokerStars';
  const id = /#\s*([A-Za-z0-9-]+)/.exec(head)?.[1] ?? '?';
  if (!/Hold'em No Limit/i.test(head)) throw new Error("only No-Limit Hold'em hands are supported");
  const stakes = new RegExp(String.raw`\(([$€£]?)([\d,.]+)\/[$€£]?([\d,.]+)`).exec(head);
  if (!stakes) throw new Error('no blinds in the header');
  const unit = stakes[1] ?? '';
  const bb = num(stakes[3]!);
  if (!(bb > 0)) throw new Error('bad big blind');
  const table = lines.find((l) => l.startsWith('Table '));
  const maxPlayers = Number(/(\d+)-max/.exec(table ?? '')?.[1] ?? 9);
  const buttonSeat = Number(/Seat #(\d+) is the button/.exec(table ?? '')?.[1] ?? NaN);
  if (!Number.isFinite(buttonSeat)) throw new Error('no button seat');

  const seats: { seat: number; name: string; stack: number }[] = [];
  const seatRe = new RegExp(String.raw`^Seat (\d+): (.+?) \(${NUM} in chips`);
  let i = 1;
  for (; i < lines.length; i++) {
    const m = seatRe.exec(lines[i]!);
    if (m) seats.push({ seat: Number(m[1]), name: m[2]!, stack: num(m[3]!) / bb });
    else if (seats.length && !lines[i]!.startsWith('Seat ')) break;
  }
  if (seats.length < 2) throw new Error('fewer than two players');
  const pos = positions(
    seats.map((s) => s.seat),
    buttonSeat,
  );
  const names = seats.map((s) => s.name).sort((a, b) => b.length - a.length);
  /** The player a line starts with ("name: ..."); names may contain spaces and colons. */
  const who = (line: string) => names.find((n) => line.startsWith(`${n}: `)) ?? null;

  const hand: Hand = {
    site,
    id,
    bigBlind: bb,
    unit,
    maxPlayers,
    buttonSeat,
    seats: seats.map((s) => ({ ...s, position: pos.get(s.seat) ?? '?' })),
    hero: null,
    heroCards: [],
    board: [],
    actions: [],
    collected: {},
    shown: {},
  };
  let street: Street = 'preflop';
  // Chips each player has in front of them this street (bb), to turn "raises X to Y" into amounts.
  let front = new Map<string, number>();
  const put = (p: string, total: number) => {
    const before = front.get(p) ?? 0;
    front.set(p, total);
    return total - before;
  };
  for (; i < lines.length; i++) {
    const line = lines[i]!;
    const st = /^\*\*\* (HOLE CARDS|FLOP|TURN|RIVER|SHOW ?DOWN|SUMMARY|FIRST FLOP|SECOND FLOP)/.exec(line);
    if (st) {
      const s = st[1]!;
      if (s === 'SUMMARY') break;
      if (s === 'FLOP' || s === 'TURN' || s === 'RIVER') {
        street = s.toLowerCase() as Street;
        front = new Map();
        const cards = [...line.matchAll(/\[([^\]]+)\]/g)].map((m) => cardList(m[1]!)).flat();
        hand.board = cards.length > hand.board.length ? cards : hand.board;
      }
      continue;
    }
    const dealt = /^Dealt to (.+?) \[([^\]]+)\]/.exec(line);
    if (dealt) {
      const cards = cardList(dealt[2]!);
      if (cards.length === 2 && !hand.hero) {
        hand.hero = dealt[1]!;
        hand.heroCards = cards;
      }
      continue;
    }
    const returned = new RegExp(String.raw`^Uncalled bet \(${NUM}\) returned to (.+)$`).exec(line);
    if (returned) {
      const p = returned[2]!;
      const back = num(returned[1]!) / bb;
      // The uncalled part didn't go into the pot: take it off the last aggressive action.
      for (let k = hand.actions.length - 1; k >= 0; k--) {
        const a = hand.actions[k]!;
        if (a.player === p && (a.kind === 'bet' || a.kind === 'raise' || a.kind === 'post')) {
          a.amount = Math.max(0, a.amount - back);
          break;
        }
      }
      continue;
    }
    const p = who(line);
    if (!p) continue;
    const rest = line.slice(p.length + 2);
    const allIn = /all-in/.test(rest);
    let m: RegExpExecArray | null;
    if ((m = new RegExp(String.raw`^posts (?:small blind|big blind|small & big blinds|the ante|ante|straddle) ${NUM}`).exec(rest))) {
      const amt = num(m[1]!) / bb;
      // Antes go to the pot but don't count towards the blinds in front.
      if (/ante/.test(rest)) hand.actions.push({ street, player: p, kind: 'post', amount: amt, allIn });
      else hand.actions.push({ street, player: p, kind: 'post', amount: put(p, (front.get(p) ?? 0) + amt), allIn });
    } else if (/^folds/.test(rest)) hand.actions.push({ street, player: p, kind: 'fold', amount: 0, allIn: false });
    else if (/^checks/.test(rest)) hand.actions.push({ street, player: p, kind: 'check', amount: 0, allIn: false });
    else if ((m = new RegExp(String.raw`^calls ${NUM}`).exec(rest))) {
      const amt = num(m[1]!) / bb;
      put(p, (front.get(p) ?? 0) + amt);
      hand.actions.push({ street, player: p, kind: 'call', amount: amt, allIn });
    } else if ((m = new RegExp(String.raw`^bets ${NUM}`).exec(rest))) {
      const amt = num(m[1]!) / bb;
      put(p, (front.get(p) ?? 0) + amt);
      hand.actions.push({ street, player: p, kind: 'bet', amount: amt, to: amt, allIn });
    } else if ((m = new RegExp(String.raw`^raises ${NUM} to ${NUM}`).exec(rest))) {
      const to = num(m[2]!) / bb;
      hand.actions.push({ street, player: p, kind: 'raise', amount: put(p, to), to, allIn });
    } else if ((m = new RegExp(String.raw`^collected ${NUM}`).exec(rest))) {
      hand.collected[p] = (hand.collected[p] ?? 0) + num(m[1]!) / bb;
    } else if ((m = /^shows \[([^\]]+)\]/.exec(rest))) {
      hand.shown[p] = cardList(m[1]!);
    }
  }
  // GGPoker and Stars both list winners in the summary too; read "collected" from there if absent.
  for (const line of lines.slice(i)) {
    const m = new RegExp(String.raw`^Seat \d+: (.+?) (?:\(.+?\) )*(?:showed \[[^\]]+\] and )?(?:won|collected) \(${NUM}\)`).exec(line);
    if (m && hand.collected[m[1]!] === undefined) hand.collected[m[1]!] = num(m[2]!) / bb;
    const b = /^Board \[([^\]]+)\]/.exec(line);
    if (b && !hand.board.length) hand.board = cardList(b[1]!);
  }
  if (!hand.actions.some((a) => a.kind !== 'post')) throw new Error('no actions');
  return hand;
}

/** Parse a whole file: every hand that can be read, and why the others couldn't. */
export function parseFile(text: string): ParseResult {
  const out: ParseResult = { hands: [], errors: [] };
  splitHands(text).forEach((block, index) => {
    try {
      out.hands.push(parseHand(block));
    } catch (e) {
      out.errors.push({ index, reason: (e as Error).message });
    }
  });
  return out;
}
