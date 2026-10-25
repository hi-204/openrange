---
id: "7.4"
level: 7
title: Multiway caveats
minutes: 6
prerequisites: ["2.4"]
drills: ["math:equity"]
glossary: ["multiway pot", "equity"]
objectives:
  - See how equity changes when more players see the flop.
  - Know why OpenRange's solver handles heads-up postflop spots only.
  - Adjust heads-up lessons for multiway pots.
recap:
  - Against more opponents every hand wins less often, even A-A, and the winning hand is stronger on average.
  - OpenRange solves postflop spots heads-up only; multiway pots need simpler reasoning.
  - In multiway pots, bluff less and value-bet stronger hands.
---

Most solver lessons are heads-up. Many real pots have three or more players: a
[[multiway pot]]. Equity and strategy both change.

## Equity with more players

```widget equity
{"ranges": ["AsAd", "22+, A2s+, K2s+, Q2s+, J2s+, T2s+, 92s+, 82s+, 72s+, 62s+, 52s+, 42s+, 32s, A2o+, K2o+, Q2o+, J2o+, T2o+, 92o+, 82o+, 72o+, 62o+, 52o+, 42o+, 32o", "22+, A2s+, K2s+, Q2s+, J2s+, T2s+, 92s+, 82s+, 72s+, 62s+, 52s+, 42s+, 32s, A2o+, K2o+, Q2o+, J2o+, T2o+, 92o+, 82o+, 72o+, 62o+, 52o+, 42o+, 32o"]}
```

Here A♠A♦ plays against two random hands. The same hand against one random hand:

```widget equity
{"ranges": ["AsAd", "22+, A2s+, K2s+, Q2s+, J2s+, T2s+, 92s+, 82s+, 72s+, 62s+, 52s+, 42s+, 32s, A2o+, K2o+, Q2o+, J2o+, T2o+, 92o+, 82o+, 72o+, 62o+, 52o+, 42o+, 32o"]}
```

A-A's [[equity]] drops a lot with the second opponent, though it stays far above a fair third.
Now type 8h7h instead of As Ad in both: it goes from a little under half heads-up to about a
fair third three-way. Every hand wins less often against more opponents, and whoever wins
usually needs a stronger hand to do it.

## Why OpenRange solves heads-up only

Equilibrium methods are well understood for two players; with three or more, an equilibrium
may not be unique and the methods give no guarantees (KNOWN_LIMITS). OpenRange's postflop
solver therefore handles heads-up spots only, and its multi-player preflop charts are marked as
approximate.

```callout key
With more players, someone is more likely to have a strong hand. Bluffs work less, and you need
a stronger hand to bet for value.
```

## Adjusting heads-up lessons

- **Bluff less.** Every extra player is another chance someone calls.
- **Value-bet tighter.** Medium hands are less often best.
- **Speculative hands** (suited connectors, small pairs) can still be worth playing: when they
  hit they're often the best hand in a big pot (implied odds, lesson 2.6), and when they miss
  they're easy to fold.

## Worked hand

Three players see a flop of K♠8♦3♣. You were the preflop raiser with Q♠Q♦.

1. **Heads-up** QQ often bets here: it's ahead of most of a caller's range.
2. **Three-way**, a king is more likely to be out there, and someone has to fold for a bluff
   to work.
3. **So:** bet smaller or check more often than heads-up, and be readier to fold to a lot of
   action.

## Common mistakes

- **Using heads-up bluffing frequencies multiway.** They're far too high.
- **Overvaluing one pair against several opponents.**
- **Expecting a solver answer for every multiway spot.** OpenRange doesn't solve them.

## Check yourself

```quiz
[
  {"q": "What happens to A-A's equity against two opponents instead of one?", "choices": ["It drops a lot but stays well above a fair share", "It rises", "It doesn't change"], "answer": 0, "explain": "More opponents means more chances one of them makes a better hand."},
  {"q": "Why does OpenRange solve postflop spots heads-up only?", "choices": ["Multiway equilibria have no guarantees and are much harder to compute", "Multiway poker isn't allowed", "Heads-up is more common"], "answer": 0, "explain": "With three or more players the methods give no guarantees."},
  {"q": "How should bluffing change in a multiway pot?", "choices": ["Bluff more", "Bluff less", "Bluff the same"], "answer": 1, "explain": "Each extra player is another chance of a call."}
]
```
