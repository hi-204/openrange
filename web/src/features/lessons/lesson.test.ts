import { describe, expect, it } from 'vitest';
import { parseGlossary, parseLesson, renderLesson } from './lesson';
import { bareNumbers, lintLessons, type LintContext } from './lint';

const glossary = parseGlossary('pot odds: The price of a call as a share of the final pot.\nequity: Your share of the pot on average if all cards were dealt.\n');

const quiz = JSON.stringify([
  { q: 'Pot {{calc 10 | int}}, bet {{calc 5 | int}}: what do you need?', choices: ['{{calc 5 / 20 | pct}}', '{{calc 5 / 15 | pct}}'], answer: 0, explain: 'Call 5 to win 20.' },
  { q: 'Is equity the same as winning?', choices: ['Yes', 'No'], answer: 1, explain: 'Ties count half.' },
  { q: 'Do pot odds include future bets?', choices: ['Yes', 'No'], answer: 1, explain: 'Only the current price.' },
]);

const good = `---
id: "2.3"
level: 2
title: Pot odds
minutes: 7
prerequisites: ["2.1"]
drills: ["math:potodds"]
glossary: ["pot odds"]
objectives: ["Work out a price.", "Compare it with equity."]
recap: ["Price is call over final pot.", "Call when equity covers it."]
---
[[Pot odds]] compare the price with the pot: $\\dfrac{C}{P+C}$. Facing a half-pot bet you need {{calc 5 / (10 + 5 + 5) | pct | show}}.
Aces beat kings {{eq AhAs vs KdKc}} of the time. Blinds are 0.5/1.

$$
EV = \\sum_i p_i v_i
$$

\`\`\`widget potodds
{"pot": 10, "bet": 5}
\`\`\`

## Worked hand
You hold [[equity|your share]]…

## Common mistakes
Forgetting your own call.

## Check yourself
\`\`\`quiz
${quiz}
\`\`\`
`;

const pre = good.replace('id: "2.3"', 'id: "2.1"').replace('prerequisites: ["2.1"]', 'prerequisites: []').replace('title: Pot odds', 'title: Outs');
const ctx: LintContext = { glossary, charts: new Map([['pushfold-hu.json', new Set(['sb-shove-10'])]]), drills: new Set(['math:potodds']), spots: new Set(['river-qj742']) };

describe('lesson rendering', () => {
  it('renders math, computed numbers, glossary terms, widgets and quizzes', () => {
    const l = parseLesson(good, 'level-2/2-3.md');
    expect(l.meta).toMatchObject({ id: '2.3', level: 2, minutes: 7, prerequisites: ['2.1'] });
    const segs = renderLesson(l.body, glossary);
    const html = segs.filter((s) => s.kind === 'html').map((s) => (s.kind === 'html' ? s.html : '')).join('');
    expect(html).toContain('class="katex"');
    expect(html).toContain('katex-display');
    expect(html).toContain('5 ÷ (10 + 5 + 5) = 25%');
    expect(html).toContain('data-a="AhAs" data-b="KdKc"');
    expect(html).toContain('class="gloss"');
    expect(html).toContain('role="tooltip"');
    expect(segs.find((s) => s.kind === 'widget')).toEqual({ kind: 'widget', name: 'potodds', config: { pot: 10, bet: 5 } });
    expect(segs.find((s) => s.kind === 'quiz')).toMatchObject({ kind: 'quiz' });
  });

  it('reads an empty glossary file (only comments) as no terms', () => {
    expect(parseGlossary('# nothing yet\n').size).toBe(0);
    expect(() => parseGlossary('- a list\n')).toThrow(/map terms/);
  });

  it('never passes raw HTML through', () => {
    const segs = renderLesson('<script>alert(1)</script> and <b>bold</b>', glossary);
    const html = segs[0]!.kind === 'html' ? segs[0]!.html : '';
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });
});

describe('lesson lint', () => {
  it('accepts a lesson that follows the rules', () => {
    expect(lintLessons([parseLesson(pre, 'a.md'), parseLesson(good, 'b.md')], ctx)).toEqual([]);
  });

  it('flags typed numbers but allows computed ones and the blinds', () => {
    expect(bareNumbers('You need 25% here and {{calc 1/4 | pct}} there.')).toEqual(['25%']);
    expect(bareNumbers('A 0.75 ratio, $5, and 0.5/1 blinds; $\\frac{1}{4}$')).toEqual(['0.75', '$']);
    expect(bareNumbers('fifty per cent')).toEqual(['per cent']);
  });

  it('reports structural problems', () => {
    const broken = good
      .replace('minutes: 7', 'minutes: 25')
      .replace('prerequisites: ["2.1"]', 'prerequisites: ["9.9"]')
      .replace('## Common mistakes', '## Mistakes')
      .replace('{"pot": 10, "bet": 5}', '{"pot": "ten"}')
      .replace('[[Pot odds]]', '[[pot oddz]] about 30%');
    const problems = lintLessons([parseLesson(broken, 'bad.md')], ctx).join('\n');
    expect(problems).toContain('minutes must be 5–10');
    expect(problems).toContain('unknown prerequisite 9.9');
    expect(problems).toContain('missing section "## Common mistakes"');
    expect(problems).toContain('widget potodds: "pot" must be a number');
    expect(problems).toContain('glossary term "pot oddz" is not defined');
    expect(problems).toContain('typed number "30%"');
  });
});
