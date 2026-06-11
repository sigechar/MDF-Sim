# MDF-SIM: *Pressed For Time*

A browser-based industrial sanity simulator. You are **Spencer**, shift leader at a
Medium-Density Fiberboard plant, trying to hit a corporate production target across one
12-hour night shift while your blood pressure — a tracked, losable resource — absorbs the
output of every other human in the building.

Built to the specification in [`claude.md`](./claude.md). The prime directive: **comedy is
mechanics.** Every character flaw in this game is a coefficient, a state lock, or a
probability table. Kevin's conflict avoidance is a 1.5× penalty multiplier. Chris's
confidence is a monotonically non-decreasing integer. Terry's break is un-bypassable by
acceptance test.

## Run it

No build step. No dependencies. Serve the directory and open it:

```bash
npm start          # python3 -m http.server 8000
# → http://localhost:8000
```

(Any static file server works; ES modules just need to be served over HTTP.)

## The cast (all of whom are load-bearing)

| Who | Role | What they cost you |
|-----|------|--------------------|
| **Kevin** | MDF Superintendent | Un-skippable puns (+4 BP, +6 if wood-related). Locks to `HIDING` during every crisis that needs him, passing penalties to you at ×1.5. |
| **Chris** | Maintenance Superintendent | $0* repairs. 22% chance the repair breaks a neighboring machine; 8% chance it breaks the thing he was fixing. Plays Candy Crush between (and during) repairs; his confidence and his level counter share one property: they only go up. |
| **Terry** | Star Millwright | $600, instant, perfect. ~9 fixes a shift before he's gone. Fixes extra things on the walk back, unbilled. The only coworker who lowers your blood pressure. His breaks cannot be shortened by any code path, on purpose. |
| **Dave** | Conspiracy Millwright | $400, 12 min, genuinely good. 65% chance you then have to discuss whether birds are real (they are not), whether Finland exists (it does not), or who lives under the Denver airport. Agree: +20% throughput, ×1.6 breakdown risk, permanent record. Disagree: maybe a strike. |
| **Tod** | Peer Shift Leader, C-Crew | Deals with real headlines and hidden 40–55% defect probabilities that detonate later. His only honest trade buys your win metric. |

## Lose conditions

The plant glues itself shut (housekeeping hits 100%). Accounts payable starts paying the
resin vendor in lanyards. Spencer walks into the tree line (BP 240). Every machine dies and
the plant becomes, legally speaking, a museum. Or — least funny, most common — 06:00 arrives
and the number doesn't.

## Verify

```bash
npm test                  # acceptance tests (spec §15.2): determinism, Terry
                          # inviolability, Kevin cowardice, content lint,
                          # Math.random ban, balance soft-targets
npm run sim               # headless Monte-Carlo harness (200 runs, optimal bot)
npm run sim -- --runs 300 --bot naive --verbose
node sim/ui-smoke.js      # full-shift render test (requires: npm i --no-save jsdom)
node sim/boot-smoke.js    # real boot/loop/pause test (requires jsdom)
```

Current balance (v1.0, `SHIFT_LEADER`): optimal-bot win rate ≈ 50–56%, naive-bot
("always Chris, always agree, always trade") win rate 0% with median loss
`LOSS_BREAKDOWN`. The time-in-RED soft target reads low under bot play because a bot
performs self-care with inhuman discipline; you will not have this problem.

## Layout

```
claude.md          the system specification (source of truth)
index.html         the HMI dashboard (spec §11)
styles.css         late-90s SCADA aesthetic
src/balance.js     every tunable number (no magic numbers elsewhere)
src/rng.js         the only randomness entry point (seeded mulberry32)
src/engine/        tick orchestrator, production, economy, BP, win/loss
src/npc/           one finite state machine per coworker
src/events/        incident table, scheduler, choice engine, player actions
src/content/       puns (≥30), theories (≥12), machine flavor
src/ui/            pure render of GameState
sim/               headless harness, acceptance tests, UI smoke tests
```

Terry's break is not a bug.
