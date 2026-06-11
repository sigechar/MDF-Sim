# MDF-SIM: "Pressed For Time"
## System Specification — Industrial Sanity Simulator v1.0

> **Document purpose:** This is the canonical, machine-parseable design specification for a
> browser-based, single-screen resource tycoon game set in a Medium-Density Fiberboard (MDF)
> manufacturing plant. A development model should be able to implement the complete simulation
> engine, UI, and content from this document alone.
>
> **Prime directive:** Comedy is not flavor. Every joke in this game is a number. Character
> dysfunction is implemented as mathematical constraints, risk coefficients, and disruption
> events inside the economic engine. If a satirical element cannot be expressed as a formula,
> a state transition, or an event payload, it does not ship.

---

## Table of Contents

1. [High Concept & Design Pillars](#1-high-concept--design-pillars)
2. [Simulation Architecture Overview](#2-simulation-architecture-overview)
3. [Global State Schema](#3-global-state-schema)
4. [The Tick Engine & Time Model](#4-the-tick-engine--time-model)
5. [Plant Model: Machines & Production Chain](#5-plant-model-machines--production-chain)
6. [Resource Economy & Formulas](#6-resource-economy--formulas)
7. [Spencer: The Blood Pressure System](#7-spencer-the-blood-pressure-system)
8. [Character Subsystems (NPC State Machines)](#8-character-subsystems-npc-state-machines)
   - 8.1 [Kevin — MDF Superintendent (Systemic Conflict Avoidance)](#81-kevin--mdf-superintendent)
   - 8.2 [Chris — Maintenance Superintendent (Confident Incompetence)](#82-chris--maintenance-superintendent)
   - 8.3 [Terry — Star Millwright (Finite Competence)](#83-terry--star-millwright)
   - 8.4 [Dave — Conspiracy Millwright (High-Variance Capability)](#84-dave--conspiracy-millwright)
   - 8.5 [Tod — Peer Shift Leader (Predatory Salesmanship)](#85-tod--peer-shift-leader)
9. [The Event Engine](#9-the-event-engine)
10. [Win / Loss Evaluation](#10-win--loss-evaluation)
11. [UI Specification: The HMI Dashboard](#11-ui-specification-the-hmi-dashboard)
12. [Radio Dispatch Ticker & Dialogue System](#12-radio-dispatch-ticker--dialogue-system)
13. [Balance Constants Reference](#13-balance-constants-reference)
14. [Content Library: Events & Dialogue Seeds](#14-content-library-events--dialogue-seeds)
15. [Implementation Notes & Acceptance Criteria](#15-implementation-notes--acceptance-criteria)

---

## 1. High Concept & Design Pillars

**Title:** *MDF-SIM: Pressed For Time*
**Genre:** Single-screen real-time resource tycoon / survival management
**Platform:** Browser (desktop-first, single HTML5 canvas or DOM-grid app, no scrolling)
**Session length:** One 12-hour in-game shift ≈ 24 real-time minutes (configurable)
**Player character:** **Spencer**, Shift Leader, D-Crew, 18:00–06:00 shift

### 1.1 The Fantasy

You are the only competent adult in a building full of hot presses, formaldehyde resin, and
men who should not be allowed near either. Corporate has set a production target that assumes
nothing breaks. Everything breaks. Your superintendent tells puns and hides. Your maintenance
superintendent makes things worse with total confidence. Your best millwright is mortal. Your
other millwright can prove the refiner bearings are fine and that birds aren't real, in that
order. A rival shift leader keeps trying to sell you wet fiber "at cost." Your blood pressure
is a resource.

### 1.2 Design Pillars (binding constraints on all features)

| # | Pillar | Engineering consequence |
|---|--------|------------------------|
| P1 | **Comedy is mechanics.** | Every character flaw maps to a named coefficient, state lock, or probability table in this spec. No purely cosmetic dialogue: every line is attached to a state delta (even if the delta is `BP +1`). |
| P2 | **One screen, total information, zero comfort.** | The full game state is visible at all times on an industrial HMI dashboard. Tension comes from watching six gauges degrade simultaneously, not from hidden information. |
| P3 | **The human is the bottleneck.** | The economic optimum is always gated by a human friction variable. The plant could run fine; the people prevent it. Spencer's Blood Pressure is a first-class resource alongside Cash. |
| P4 | **Failure is funnier than success, but success must be possible.** | Loss states are elaborate, specific, and satirical. A skilled player should win ~40–55% of runs at default difficulty. |
| P5 | **Determinism under seed.** | All RNG flows from a single seeded PRNG (`mulberry32` or equivalent) so runs are replayable/sharable by seed. |

---

## 2. Simulation Architecture Overview

The engine is a discrete-tick simulation with four cooperating subsystems, executed in a
fixed order each tick:

```
┌─────────────────────────────────────────────────────────────────┐
│                        GAME LOOP (per tick)                      │
│                                                                  │
│  1. CLOCK        advance shiftClock; fire scheduled timers       │
│  2. PRODUCTION   machines consume inputs → produce boards        │
│  3. DEGRADATION  wear, uptime decay, quality drift               │
│  4. NPC FSMs     advance Kevin/Chris/Terry/Dave/Tod machines     │
│  5. EVENT ENGINE roll spawn tables, resolve active events,       │
│                  process pending player choices                  │
│  6. ECONOMY      apply costs, revenues, trades                   │
│  7. SPENCER      compute BP delta from all stress sources        │
│  8. WIN/LOSS     evaluate terminal conditions                    │
│  9. RENDER       push state diff to HMI; append ticker lines     │
└─────────────────────────────────────────────────────────────────┘
```

**State management:** Single immutable-style state object (`GameState`) transformed by pure
reducer functions per subsystem. UI is a pure render of `GameState`. All player inputs are
queued as `PlayerAction` objects and consumed at step 5 of the next tick.

**Recommended stack:** TypeScript + a thin reactive layer (vanilla + signals, or Preact).
No backend required; state persists to `localStorage` for pause/resume. Seeded PRNG mandatory.

---

## 3. Global State Schema

All numeric ranges are inclusive. Types are given as TypeScript.

```ts
interface GameState {
  meta: {
    seed: number;
    tick: number;              // 1 tick = 1 in-game minute
    shiftClock: number;        // minutes elapsed, 0..720 (18:00 → 06:00)
    paused: boolean;
    difficulty: 'TRAINEE' | 'SHIFT_LEADER' | 'CORPORATE_TARGETS';
    gameOver: GameOverRecord | null;
  };

  resources: {
    cash: number;              // USD. Start 25_000. Bankruptcy threshold: see §10
    woodFiber: number;         // tonnes. Start 80. Cap 200 (silo capacity)
    resin: number;             // tonnes UF resin. Start 12. Cap 30 (tank capacity)
    boardsProduced: number;    // msf of saleable MDF this shift. WIN METRIC.
    boardsScrapped: number;    // msf rejected. Tracked for end-screen shaming.
  };

  plant: {
    uptime: number;            // 0..100 (%). Composite of machine states, see §5.4
    quality: number;           // 0..100. Board Quality index, see §6.3
    machines: Record<MachineId, Machine>;
    alarms: Alarm[];           // active alarm stack, severity-sorted
    gluePileup: number;        // 0..100. The Doom Meter. See §10.2 (LOSS_GLUED_SHUT)
  };

  spencer: {
    bp: number;                // Blood Pressure index, 60..240. Start 118.
    bpTrend: number;           // smoothed delta/min for UI arrow
    caffeine: number;          // 0..3 active coffees (see §7.4)
    breakdownWarnings: number; // count of times BP crossed 200 (UI escalation)
  };

  npcs: {
    kevin: KevinState;
    chris: ChrisState;
    terry: TerryState;
    dave:  DaveState;
    tod:   TodState;
  };

  events: {
    active: ActiveEvent[];     // currently-running events with timers
    pendingChoice: ChoiceEvent | null;  // modal blocking choice, max 1
    log: TickerLine[];         // radio dispatch history (ring buffer, 200)
    scheduled: ScheduledEvent[];
  };

  stats: ShiftStats;           // counters for end screen (puns endured, scams survived…)
}
```

### 3.1 Resource Summary Table

| Resource | Symbol | Range | Start | Primary sources | Primary sinks |
|----------|--------|-------|-------|-----------------|---------------|
| Cash | `$` | -∞..∞ | 25,000 | Board sales (auto, per msf) | Fiber/resin purchases, repairs, Tod trades, event fines |
| Wood Fiber | `FBR` | 0..200 t | 80 | Purchases, Tod trades | Refiner consumption, contamination dumps |
| Resin | `RSN` | 0..30 t | 12 | Purchases | Blender consumption, leak events |
| Plant Uptime | `UPT` | 0..100 % | 92 | Repairs, Terry | Breakdowns, Chris, neglect |
| Board Quality | `QLT` | 0..100 | 85 | Calibration, good resin ratio | Drift, contaminated fiber, Chris "tuning" |
| Production | `msf` | 0..∞ | 0 | Press output × quality gate | (none — monotonic) |
| Blood Pressure | `BP` | 60..240 | 118 | EVERY HUMAN IN THE BUILDING | Coffee, venting, quiet minutes, small victories |

**Design note (P3):** Cash, Fiber, and Resin are *logistics* problems. Uptime and Quality are
*machine* problems. BP is the *人* problem, and it is the only resource where the sinks are
scarce and the sources are people you cannot fire.

---

## 4. The Tick Engine & Time Model

- **1 tick = 1 in-game minute.** Shift = 720 ticks.
- **Real-time mapping:** default 2 ticks/second → 6 real minutes/in-game hour → 24-minute run.
  Speed controls: `1×` (2 t/s), `2×` (4 t/s), `PAUSE` (allowed, but see below).
- **Pause tax:** Pausing is free, but the HMI displays Kevin slowly approaching Spencer's
  office window during any pause longer than 10 real seconds (cosmetic-only; resuming
  triggers a guaranteed Kevin `PUN_AMBUSH` roll at +15% weight for the next 5 ticks —
  comedy as mechanics per P1: hiding from the game summons the game's worst part).
- **Hour boundaries** (`shiftClock % 60 === 0`) fire `HourMark` hooks: economy reconciliation,
  corporate production-pace check (see §10.3), and one guaranteed event-table roll.
- **Scheduled events** (`events.scheduled`) are min-heap sorted by `fireTick`.

---

## 5. Plant Model: Machines & Production Chain

The plant is a 6-station serial production chain. Boards only flow if **every** upstream
station is `RUNNING` or `DEGRADED`.

```
 FIBER SILO → [M1 REFINER] → [M2 DRYERS] → [M3 FORMING LINE] →
 → [M4 HOT PRESS] → [M5 BOARD COOLER] → [M6 SANDER/SAW] → SALEABLE msf
```

### 5.1 Machine Schema

```ts
type MachineId = 'REFINER' | 'BLENDER' | 'FORMER' | 'PRESS' | 'COOLER' | 'SANDER';

type MachineStatus =
  | 'RUNNING'      // nominal
  | 'DEGRADED'     // running at reduced rate, wear accelerating
  | 'DOWN'         // broken; chain stalls at this station
  | 'REPAIRING'    // an NPC is on it; eta ticking
  | 'CHRISED';     // special DOWN variant caused by Chris (see §8.2); repair cost ×1.5

interface Machine {
  id: MachineId;
  status: MachineStatus;
  health: number;        // 0..100; <40 → DEGRADED; 0 → DOWN
  wearRate: number;      // health lost / tick while RUNNING (see table)
  throughputMod: number; // 0..1 multiplier on chain rate while RUNNING/DEGRADED
  repairEta: number | null;
  assignedNpc: 'terry' | 'dave' | 'chris' | null;
  flavor: string;        // current ticker descriptor, e.g. "screaming slightly"
}
```

### 5.2 Machine Base Table

| Machine | Base wearRate/tick | Breakdown weight | DEGRADED throughput | Special |
|---------|-------------------|------------------|--------------------|---------|
| M1 REFINER | 0.030 | 20% | 0.65 | Dave's favorite sabotage-theory target |
| M2 DRYERS (id: BLENDER) | 0.025 | 15% | 0.70 | Resin leaks here; feeds `gluePileup` |
| M3 FORMER | 0.020 | 10% | 0.75 | Quality drift source |
| M4 HOT PRESS | 0.045 | **30%** | 0.55 | The diva. Highest wear, highest drama. Fire risk events |
| M5 COOLER | 0.015 | 10% | 0.80 | Cheap fixes; Chris is weirdly drawn to it |
| M6 SANDER | 0.025 | 15% | 0.70 | Contaminated fiber (Tod trades) detonates wear here, see §8.5 |

### 5.3 Breakdown Roll (per tick, per RUNNING/DEGRADED machine)

```
P(breakdown) = BASE_BREAKDOWN            // 0.0017 per tick (tuned v1.0; was 0.0006 pre-balance)
             × (2.0 - health/100)        // low health up to doubles it
             × statusMod                 // DEGRADED: ×2.5
             × chrisAuraMod              // Chris ON_SITE at this machine: ×1.8 (§8.2)
             × daveBoostMod              // active Dave boost: ×1.6 (§8.4, volatility cost)
             × difficultyMod             // TRAINEE 0.7 / SHIFT_LEADER 1.0 / CORPORATE 1.3
```

On breakdown: `status = DOWN`, `health = 0`, push `Alarm(severity: HIGH)`, ticker line from
machine flavor pool, **Spencer BP +8 instantly** (`STRESS_BREAKDOWN`, §7.2).

### 5.4 Plant Uptime (composite, recomputed per tick)

```
uptime = 100 × Σ(machineWeight_i × statusFactor_i)

statusFactor: RUNNING 1.0 | DEGRADED 0.6 | REPAIRING 0.25 | DOWN/CHRISED 0.0
machineWeight: REFINER .20, BLENDER .15, FORMER .15, PRESS .25, COOLER .10, SANDER .15
```

Uptime is **display + economy input**, not independently stored truth — it derives from
machine states so the HMI can never lie (P2).

---

## 6. Resource Economy & Formulas

### 6.1 Production Rate (msf of saleable board per tick)

```
chainAlive   = all machines status ∈ {RUNNING, DEGRADED}        // boolean gate
rawRate      = BASE_RATE × Π(throughputMod_i)                   // BASE_RATE = 0.55 msf/tick
fiberDraw    = rawRate × FIBER_PER_M3        // 0.72 t/msf
resinDraw    = rawRate × RESIN_PER_M3        // 0.085 t/msf

if (!chainAlive || woodFiber < fiberDraw || resin < resinDraw) → rawRate = 0
   (starvation also: BP +0.5/tick STRESS_STARVED, ticker warns "FORMER RUNNING ON FUMES")

qualityGate  = clamp(quality / 100, 0, 1)
saleable     = rawRate × qualityGate
scrapped     = rawRate × (1 - qualityGate)

boardsProduced += saleable
boardsScrapped += scrapped
cash           += saleable × BOARD_PRICE      // $310 / msf, paid instantly (corporate
                                              // "live invoicing pilot program" — the one
                                              // corporate initiative that accidentally works)
```

**Full-shift theoretical max** ≈ 0.55 × 720 = 396 msf. **Win target: 240 msf** (SHIFT_LEADER).
The 156 msf of slack is the entire human-dysfunction budget. Every Kevin pun, Terry break,
and Chris intervention spends it.

### 6.2 Procurement (player actions, instant, button-per-resource)

| Action | Amount | Cost | Constraint |
|--------|--------|------|------------|
| Buy Fiber | +25 t | $4,500 | Silo cap 200 t; price +10% per purchase after 4th ("spot market is feeling emotional") |
| Buy Resin | +6 t | $7,200 | Tank cap 30 t; if cash < cost AND resin < 2t, vendor-merch loss countdown arms (§10.2) |
| Rush Fiber | +25 t | $6,750 | Arrives instantly vs normal 5-tick delivery delay |

### 6.3 Board Quality dynamics

```
quality(t+1) = quality(t)
             + Σ activeQualityEffects          // events, Dave boosts, Chris "calibrations"
             - QUALITY_DRIFT                   // 0.04/tick natural entropy
             - contaminationPenalty            // active Tod bad-fiber: 0.35/tick until purged
             + calibrationBonus                // player CALIBRATE action: +12 instant,
                                               //   costs $800, 3-tick FORMER pause
clamp 0..100
```

### 6.4 The Glue Pileup (Doom Meter)

`gluePileup` models housekeeping neglect — resin spills, blowline crumbs, press squeeze-out
nobody scraped. **It only goes up unless actively cleaned.**

```
gluePileup += 0.020/tick baseline ("entropy, but sticky")
            + 0.15/tick while BLENDER is DOWN or CHRISED
            + 2.0 per resin-leak event
            + 0.5 per Chris intervention completed (he doesn't clean up; cleanup is
              "a culture problem," which he says while standing in the spill)

Player action CLEANUP CREW: -25 gluePileup, costs $1,200 and pauses SANDER 10 ticks.
At gluePileup ≥ 70: Alarm(MEDIUM), ticker escalation series begins (§14.4).
At gluePileup ≥ 100: LOSS_GLUED_SHUT fires (§10.2). The plant is now furniture.
```

---

## 7. Spencer: The Blood Pressure System

BP is the **human friction integrator**. All NPC dysfunction terminates here.

### 7.1 Core dynamics

```
bp(t+1) = clamp( bp(t) + Σ stressSources - Σ reliefSources - homeostasis , 60, 240 )

homeostasis = 0.05/tick when no HIGH alarms active and no pendingChoice
              (the body wants to live; the plant disagrees)
```

### 7.2 Stress source table (canonical IDs — engine must emit these for the stats screen)

| ID | Trigger | ΔBP | Notes |
|----|---------|-----|-------|
| `STRESS_BREAKDOWN` | machine → DOWN | +8 | +12 if it's the PRESS |
| `STRESS_PUN` | Kevin pun delivered | +4 | +6 if pun is wood-related (flagged in pun data) |
| `STRESS_KEVIN_HIDING` | per tick a crisis runs while Kevin is HIDING | +0.30 | the conflict-avoidance tax, see §8.1 |
| `STRESS_CHRIS_HELPING` | per tick Chris is ON_SITE | +0.20 | ambient dread |
| `STRESS_CHRISED` | Chris causes secondary failure | +10 | plus the repair bill |
| `STRESS_DAVE_LECTURE` | Dave dialogue choice opens | +3 | before you even answer |
| `STRESS_DAVE_AGREE` | player agrees with Dave | +6 | "you heard yourself say it" |
| `STRESS_TOD_PITCH` | Tod trade offer appears | +2 | his voice does this |
| `STRESS_TOD_BURNED` | hidden Tod defect detonates | +14 | the betrayal premium |
| `STRESS_STARVED` | per tick line starved of fiber/resin | +0.5 | |
| `STRESS_ALARM_AMBIENT` | per tick per active HIGH alarm | +0.15 | stacking |
| `STRESS_CORPORATE_PACE` | hourly pace check failed (§10.3) | +5 | email tone: "circling back" |

### 7.3 Relief source table

| ID | Trigger | ΔBP | Constraint |
|----|---------|-----|-----------|
| `RELIEF_COFFEE` | player action COFFEE | -10 instant | see §7.4 stacking penalty |
| `RELIEF_VENT` | player action SCREAM INTO LOCKER | -15 instant | 5-tick cooldown; ticker prints "[RADIO SILENCE]"; 20% chance Kevin hears and approaches with a supportive pun (+4 right back) |
| `RELIEF_QUIET_MINUTE` | 10 consecutive ticks, zero alarms | -3 | rare by design |
| `RELIEF_SMALL_VICTORY` | machine repaired to RUNNING | -4 | -8 if Terry did it (watching mastery is soothing) |
| `RELIEF_TOD_REFUSED` | declining a Tod trade | -2 | self-respect dividend |

### 7.4 Caffeine subsystem

`COFFEE` action: free, instant `-10 BP`, sets `caffeine += 1` (decays 1 per 90 ticks).
While `caffeine ≥ 3`: all incoming stress ×1.25 ("vibrating is not calm") and homeostasis
disabled. The third coffee is always a mistake and the system knows it.

### 7.5 BP zones (drive UI + mechanics)

| Zone | Range | HMI behavior | Mechanical effect |
|------|-------|--------------|-------------------|
| GREEN | 60–139 | calm gauge | none |
| AMBER | 140–169 | gauge pulses | player action buttons gain 0.5s artificial input lag ("hands shaking slightly") |
| RED | 170–199 | edge-of-screen vignette, gauge strobes | dialogue choice timers -25%; ticker text occasionally renders ALL CAPS |
| CRITICAL | 200–239 | full klaxon styling, heartbeat audio | each tick: 1.5% chance of involuntary `SCREAM_INTO_LOCKER` (auto-fires, relief applies, but Kevin-hears chance doubles) |
| **240** | — | — | **LOSS_BREAKDOWN** fires (§10.2) |

---

## 8. Character Subsystems (NPC State Machines)

Each NPC is a finite state machine advanced once per tick. They are not units to command
(except deployables Terry/Dave/Chris) — they are **weather systems with names**.

---

### 8.1 KEVIN — MDF Superintendent
**Archetype: Systemic Conflict Avoidance.** Kevin's function in the engine is to intercept
player progress with mandatory low-value interaction, and to be structurally absent during
every moment that requires authority.

```ts
type KevinStatus = 'ROAMING' | 'APPROACHING' | 'PUNNING' | 'HIDING' | 'MANDATORY_FUN';

interface KevinState {
  status: KevinStatus;
  punCooldown: number;       // ticks until next ambush eligible
  hidingSince: number | null;
  punsDeliveredThisShift: number;
}
```

#### State transitions

```
ROAMING ──[per-tick roll p=0.011, off cooldown]──▶ APPROACHING
APPROACHING ──[3 ticks; HMI shows Kevin icon physically traversing the
               plant map toward Spencer's office — dread telegraphing]──▶ PUNNING
PUNNING ──[delivers pun (modal toast, 4s, CANNOT be dismissed early — the
           un-skippable pun IS the mechanic); BP +4 (or +6 wood pun);
           punCooldown = 45..90 ticks]──▶ ROAMING

ANY ──[trigger: any HIGH-severity alarm OR safety event OR Tod-dispute
       event spawns]──▶ HIDING
HIDING ──[exit ONLY when zero HIGH alarms have been active for 12
          consecutive ticks. Not player-influenceable. There is no
          "summon Kevin" button. There will never be a summon Kevin
          button.]──▶ ROAMING

ROAMING ──[scheduled, once per shift, around tick 360 (midnight)]──▶ MANDATORY_FUN
MANDATORY_FUN: "Midnight Morale Pizza" event — see §14.2. 10 ticks. Production
  unaffected but all NPC deployment actions LOCKED ("everyone's in the break
  room"). Then → ROAMING.
```

#### The Hiding Tax (core satire-as-math)

While any crisis event tagged `requiresAuthority: true` is active AND Kevin is `HIDING`,
the event's penalties are redirected to the player at a markup:

```
effectivePenalty = basePenalty × KEVIN_ABSENTEE_MULT   // 1.5
plus STRESS_KEVIN_HIDING (+0.30 BP/tick)
ticker (once per crisis): "RADIO: Kevin? ... Kevin?? ... [Kevin's office light turns off]"
```

`requiresAuthority` events include: safety inspections, vendor disputes, the Tod
inter-shift fiber dispute, and the press fire. Kevin will be HIDING for 100% of them,
because entering HIDING is *triggered by them*. This is intentional. This is the joke.
This is also a load-bearing difficulty mechanic.

#### Pun payload format

```ts
interface Pun { text: string; isWoodRelated: boolean; }  // isWoodRelated → +6 instead of +4
// Library of ≥30 puns required, see §14.1 for seed set.
```

---

### 8.2 CHRIS — Maintenance Superintendent
**Archetype: Confident Incompetence.** Chris is the **free repair option that is never
free.** He costs $0 capital because the budget already paid for him, and that sunk-cost
framing is the trap the player must learn to refuse.

```ts
type ChrisStatus = 'AVAILABLE' | 'EN_ROUTE' | 'ON_SITE' | 'EXPLAINING';

interface ChrisState {
  status: ChrisStatus;
  target: MachineId | null;
  interventionTicksRemaining: number;
  confidenceLevel: number;   // 0..100, starts 95, ONLY GOES UP
}
```

#### Deployment (player action: assign Chris to a DOWN machine)

- **Cost: $0.** (UI must render the cost as `$0*` with footnote asterisk visible at all
  times. The asterisk is doing a lot of work.)
- **Repair duration:** `CHRIS_BASE_REPAIR (40 ticks) × (1 + roll(0..0.5))` — vs Terry's
  instant and Dave's 12. The line bleeds the whole time.
- **While ON_SITE:** ambient `STRESS_CHRIS_HELPING` +0.20 BP/tick; the target machine's
  neighbors (adjacent in the chain) suffer `chrisAuraMod ×1.8` breakdown probability (§5.3).
  He borrows their parts. He does not log this.

#### Resolution roll (when intervention completes)

| Outcome | Probability | Effect |
|---------|------------|--------|
| Actually fixed | 45% | machine → RUNNING at health 55 (not 100; "good enough is the enemy of done, and I've beaten them both") |
| Fixed-ish | 25% | machine → DEGRADED, health 35, throughputMod -0.05 permanently this shift ("she's got a new personality now") |
| **Secondary failure** | 22% | target → RUNNING health 50, BUT a random *adjacent* machine → `CHRISED` (DOWN, repair cost ×1.5, ticker: "in fairness, that valve was a design flaw waiting to happen"). `STRESS_CHRISED` +10. `gluePileup +0.5`. |
| Catastrofix | 8% | target → `CHRISED` itself, health 0, AND quality -8 instant. Chris → EXPLAINING for 6 ticks (cannot be redeployed; he is busy doing a whiteboard session about why this proves his original diagnosis). |

After ANY outcome: `confidenceLevel = min(100, confidenceLevel + 2)`. Outcomes do not
affect this. That is the entire characterization, expressed as a monotonic counter, and it
must be displayed on his HMI personnel card.

---

### 8.3 TERRY — Star Millwright
**Archetype: Finite Competence.** Terry is the resolve-anything button with a hard budget.
The strategic depth of the entire repair layer comes from rationing Terry.

```ts
type TerryStatus = 'AVAILABLE' | 'WORKING' | 'ON_BREAK' | 'CLOCKED_OUT';

interface TerryState {
  status: TerryStatus;
  stamina: number;          // 0..100, starts 100
  breakTicksRemaining: number;
  fixesThisShift: number;
}
```

#### Deployment

- **Cost: $600/deployment** (premium labor billing; cheap relative to downtime, which is
  the point — the constraint is never money, it's Terry's existence).
- **Repair: INSTANT.** Target machine → RUNNING, health 100, alarms for it cleared,
  `RELIEF_SMALL_VICTORY -8 BP`. Works on `CHRISED` machines too (he sighs; ticker notes
  the sigh; the sigh costs nothing but means everything).
- **Stamina cost: 22 per fix.** Also -0.03/tick passive (it's a 12-hour shift; he's human;
  this is the only NPC modeled with humanity, which is why losing him hurts).

#### The Break Rule (un-bypassable, by design and by union)

```
WHEN stamina ≤ 30  →  status = ON_BREAK, breakTicksRemaining = 45
  - Removed ENTIRELY from deployment pool. The button doesn't gray out —
    it is REPLACED by a label: "TERRY IS ON BREAK. (state law / federal law / Terry's law)"
  - No cash payment, BP sacrifice, or event can shorten it. Engine must contain
    NO code path that reduces breakTicksRemaining except the tick decrement.
    This is an acceptance-test requirement (§15).
  - During break: stamina regenerates to 75 (not 100; the shift takes its tithe).
AFTER 2nd break of the shift → next threshold triggers CLOCKED_OUT instead:
  "Terry has gone home. Terry said, quote, 'No.'" — gone for the rest of the run.
```

**Balance intent:** Terry can do ~4 fixes, break, ~3 fixes, break, ~2 fixes, gone.
≈9 perfect fixes per shift against an expected 12–16 breakdowns at SHIFT_LEADER
difficulty. The deficit must be covered by Dave (volatile), Chris (lol), or prevention.

---

### 8.4 DAVE — Conspiracy Millwright
**Archetype: High-Variance Capability.** Dave genuinely fixes things. The price is paid in
a different currency: you have to *talk to him*, and the conversation has a state vector.

```ts
type DaveStatus = 'AVAILABLE' | 'WORKING' | 'MONOLOGUING' | 'ON_STRIKE';

interface DaveState {
  status: DaveStatus;
  trustInSpencer: number;     // 0..100, starts 50
  strikeTicksRemaining: number;
  activeBoost: DaveBoost | null;
  theoriesEndorsedByManagement: number;  // tracked for end screen
}
```

#### Deployment

- **Cost: $400/deployment.**
- **Repair: 12 ticks**, target → RUNNING, health 85. Reliable. Genuinely good at this.
- **The catch:** On deployment completion, roll `p = 0.65`: Dave → `MONOLOGUING` and a
  **mandatory dialogue choice** (`ChoiceEvent`, blocks `pendingChoice` slot) opens.
  `STRESS_DAVE_LECTURE` +3 fires when the modal opens. The choice timer is 15 ticks;
  timeout counts as DISAGREE (silence is violence, per Dave).

#### The Dialogue Fork (core mechanic)

Each monologue presents a theory (see §14.3 library: birds aren't real and the pigeons
recharge on the power lines, Finland is open ocean "they" fenced off, the board of directors
are reptilian which is why corporate keeps it at sixty-eight degrees, etc.) with exactly two
responses:

**AGREE — "You know what Dave, that explains a lot."**
```
trustInSpencer +15
STRESS_DAVE_AGREE  +6 BP            // you heard yourself say it
grant DaveBoost (duration 60 ticks):
  throughput rawRate ×1.20          // he tightens things "they" loosened
  quality +0.05/tick
  BUT daveBoostMod = ×1.6 on ALL machine breakdown rolls (§5.3)
     // his improvements are real but his torque specs come from a forum
theoriesEndorsedByManagement += 1   // permanent record
```

**DISAGREE — "Dave, the bearings are just old."**
```
trustInSpencer -20
if trustInSpencer < 25 → DaveStatus = ON_STRIKE, strikeTicksRemaining = 90
  ticker: "RADIO: Dave has barricaded the tool crib 'until the perimeter is
  verified.' He has taken his personal multimeter. He does not trust the
  plant's multimeters. He has never trusted the plant's multimeters."
  - Removed from deployment pool for 90 ticks.
  - 30% chance per strike: he "secures" a random RUNNING machine on his way
    out (machine → DOWN, flavor: "protected from tampering").
else (trust ≥ 25): no strike, no boost, BP -1 (mild integrity dividend),
  Dave sulks (cosmetic flavor on his personnel card for 30 ticks).
```

**Design intent:** AGREE is the short-term-optimal, soul-eroding play. The engine tracks
`theoriesEndorsedByManagement` and reads it back at the end screen regardless of win/loss.
The number is the punchline; the player generates it themselves.

---

### 8.5 TOD — Peer Shift Leader (C-Crew)
**Archetype: Predatory Low-Tier Salesmanship.** Tod arrives over the radio with deals.
The deals are asymmetric. The asymmetry is hidden. The hiding is bad, because Tod is bad
at things, including hiding.

```ts
interface TodState {
  nextPitchTick: number;            // scheduled every 70..110 ticks
  pitchesMade: number;
  scamsExecuted: number;            // hidden defects that actually fired
  spencerOwes: boolean;             // see Dispute event
}
```

#### The Trade Offer (ChoiceEvent, 20-tick timer; timeout = DECLINE)

Generated from the trade table. Every offer shows the **headline** (real, immediate,
attractive) and conceals a **defect probability** (rolled at accept-time, detonates on a
delay so the causality is deniable — Tod's signature move).

| Trade (headline) | Immediate effect | Hidden defect | P(defect) | Detonation (15–40 ticks later) |
|---|---|---|---|---|
| "Surplus fiber, 20t, half price" | +20t fiber, -$1,800 | Wet/contaminated fiber | 55% | quality contaminationPenalty active until player buys a $1,500 PURGE; SANDER wear ×3 for 30 ticks; `STRESS_TOD_BURNED` +14 |
| "Resin tote, fell off a truck*" | +4t resin, -$2,000 | Off-spec resin | 50% | BLENDER → DOWN, gluePileup +6, ticker: "the tote did not fall off a truck. the tote was the truck's problem and now it is yours" |
| "I'll buy 15 msf off your count, cash now" | +$6,000, boardsProduced -15 | None — this one's real | 0% | The trap is that it's production volume, the WIN metric. Tod's only honest deal is the worst one. |
| "C-Crew will 'cover' your press for an hour" | PRESS wear paused 60 ticks | C-Crew "adjustments" | 40% | PRESS health -30 at handback; flavor: "the settings have been improved. by C-Crew. improved." |

**ACCEPT:** apply immediate effect; roll defect; if rolled, push `ScheduledEvent` with the
delayed payload. `STRESS_TOD_PITCH` +2 already applied at offer.
**DECLINE:** `RELIEF_TOD_REFUSED` -2 BP. Tod's next pitch arrives 15 ticks *sooner*
(rejection energizes him; this is load-bearing characterization).

#### The Dispute (once per shift, ~tick 500)

A `requiresAuthority: true` event: Tod claims D-Crew owes C-Crew 10t of fiber from "last
month, the thing, you remember." Kevin → HIDING (automatically; this event is exactly the
kind of thing Kevin is for, therefore he is gone). Player choices: pay 10t fiber, pay
$2,500 "make-it-go-away money," or refuse (BP +10, Tod's defect probabilities +10% for the
remainder of the shift — he remembers).

---

## 9. The Event Engine

### 9.1 Event taxonomy

```ts
type EventKind =
  | 'BREAKDOWN'        // from §5.3 rolls
  | 'PUN_AMBUSH'       // Kevin FSM output
  | 'CHOICE'           // Dave fork, Tod trade, Dispute — blocks pendingChoice slot
  | 'INCIDENT'         // resin leak, press fire, safety inspection, corporate email
  | 'SCHEDULED'        // delayed payloads (Tod defects, Mandatory Fun, pace checks)
  | 'AMBIENT';         // pure ticker flavor + micro BP deltas (≤±1)

interface ChoiceEvent {
  id: string;
  source: 'dave' | 'tod' | 'incident';
  prompt: string;
  options: [ChoiceOption, ChoiceOption];   // ALWAYS exactly two. Binary forks only.
  timerTicks: number;
  timeoutOption: 0 | 1;
  requiresAuthority: boolean;              // Kevin-hiding tax eligible
}
```

### 9.2 Spawn scheduling

- Per-tick incident roll: `p = 0.007 × difficultyMod × (1 + tick/720 × 0.6)` — the shift
  gets meaner as it ages (act structure: hours 1–3 tutorial-calm, 4–8 grind, 9–12 siege).
- Hourly guaranteed roll from the INCIDENT table (§14.2).
- **Only one `pendingChoice` at a time.** If a CHOICE spawns while one is open, it queues
  (max queue 2; overflow converts to its timeout outcome immediately, ticker: "you were
  busy. decisions were made in your absence. by physics.").

### 9.3 Resolution invariants

1. Every event resolution MUST emit ≥1 ticker line and ≥1 state delta. (P1: no inert jokes.)
2. Every BP delta MUST carry a canonical stress/relief ID (§7.2/7.3) for stat aggregation.
3. INCIDENT events tagged `requiresAuthority` MUST check Kevin status and apply §8.1 markup.
4. All randomness through the seeded PRNG. No `Math.random()` anywhere. CI greps for it.

---

## 10. Win / Loss Evaluation

Evaluated every tick, in this priority order (first match wins):

### 10.1 Victory — `WIN_SHIFT_SURVIVED`

```
shiftClock ≥ 720
AND boardsProduced ≥ TARGET            // TRAINEE 180 / SHIFT_LEADER 240 / CORPORATE 300 msf
AND cash > 0
```

End screen: dawn over the parking lot, Spencer's hands still vibrating slightly (caffeine
counter shown). Grade A–D computed from: BP integral over the shift, scrap ratio, Terry
fixes remaining unused (efficiency shame), `theoriesEndorsedByManagement`, and Tod scams
survived. Day-shift arrives and immediately complains about housekeeping; final
`gluePileup` value is read aloud in their complaint.

### 10.2 Defeat vectors (each with bespoke end screen + ticker epilogue)

| ID | Trigger | End screen copy (canonical) |
|----|---------|------------------------------|
| `LOSS_GLUED_SHUT` | `gluePileup ≥ 100` | "The plant has achieved structural unity. The doors, the press, and two forklifts are now a single object. Corporate has rebranded it 'vertical integration.' A plaque is being made. You are on the plaque. It is not a good plaque." |
| `LOSS_BANKRUPT_MERCH` | `cash ≤ -5_000` OR (resin purchase impossible for 60 consecutive ticks while resin < 2t) | "Accounts payable has begun offering the resin vendor 'payment in company merchandise.' The vendor has been mailed 400 lanyards and a polo. The vendor's lawyer has been mailed a kazoo. Chemical deliveries are suspended indefinitely. So are you." |
| `LOSS_BREAKDOWN` | `bp ≥ 240` | "Spencer set down the radio gently, which was somehow worse than throwing it. Security footage shows him walking directly into the tree line behind the wood yard, posture excellent, gone. Kevin emerged eleven minutes later and asked if anyone wanted to hear something hilarious about plywood." |
| `LOSS_CHAIN_NECROSIS` | uptime == 0 for 90 consecutive ticks | "Every machine is down. The plant is, legally speaking, a museum. Chris has scheduled a lessons-learned meeting and listed himself as both presenter and lesson." |

### 10.3 Corporate Pace Check (hourly soft-fail pressure)

At each HourMark: `expectedPace = TARGET × (shiftClock / 720)`. If
`boardsProduced < expectedPace × 0.8` → INCIDENT: corporate email (ticker renders subject
line only — subject lines escalate hourly: "Quick check-in" → "Following up" → "Circling
back" → "Per my last email" → "Adding Kevin's boss to the thread"), `STRESS_CORPORATE_PACE`
+5 BP. No direct resource penalty; the email IS the penalty. Five consecutive failed checks:
final email subject "no subject" — +15 BP, one time. Nothing further. The silence is worse.

---

## 11. UI Specification: The HMI Dashboard

**Aesthetic:** late-90s/2000s industrial SCADA/HMI. Dark charcoal `#1a1d21` panels, beveled
borders, dense monospaced telemetry (`IBM Plex Mono` or system mono), signal colors ONLY for
signal: green `#39d353`, amber `#ffb000`, red `#ff4d4d`, cyan accents `#4dd0e1` for player
actions. No gradients-as-decoration, no rounded corners over 2px, no whitespace luxury.
It should look like the screen has been mounted above a breaker panel since 2003 and one
pixel column is slightly burnt in (optional cosmetic shader, ship-if-cheap).

### 11.1 Fixed single-screen grid (1280×800 logical, scale to fit — NO scrolling, per P2)

```
┌────────────────────────────────────────────────────────────────────────────┐
│ A. HEADER BAR: shift clock (HH:MM, 18:00→06:00) · pace bar (msf vs target)  │
│    · cash · speed controls · seed display                                  │
├──────────────────────────────────┬─────────────────────────────────────────┤
│ B. PLANT SCHEMATIC (≈45% width)  │ C. SPENCER PANEL                        │
│  six machine blocks in chain     │   BP gauge (analog dial + digital)      │
│  layout, animated flow arrows,   │   zone-colored, trend arrow             │
│  per-machine: status lamp,       │   caffeine pips ●●○                     │
│  health bar, flavor word,        │   actions: COFFEE / SCREAM INTO LOCKER  │
│  assigned-NPC chip. Kevin icon   ├─────────────────────────────────────────┤
│  physically roams this map.      │ D. PERSONNEL BOARD                      │
│  gluePileup rendered as literal  │   5 cards: KEVIN CHRIS TERRY DAVE TOD   │
│  amber goo creeping up from the  │   each: status word, key stat           │
│  schematic floor as it rises.    │   (Terry stamina bar, Chris confidence  │
│                                  │   %, Dave trust, Kevin pun-count,       │
│                                  │   Tod next-pitch ETA), deploy buttons   │
├──────────────────────────────────┴─────────────────────────────────────────┤
│ E. RESOURCES STRIP: FIBER silo bar · RESIN tank bar · QUALITY dial ·       │
│    UPTIME % · buy/rush/calibrate/cleanup action buttons with live prices   │
├────────────────────────────────────────────────────────────────────────────┤
│ F. RADIO DISPATCH TICKER (full width, 4 visible lines, autoscroll,         │
│    timestamped "[23:41] RADIO:" prefix — see §12)                          │
└────────────────────────────────────────────────────────────────────────────┘
```

### 11.2 Escalation states (visual tension language)

- **Alarms:** HIGH alarms strobe the affected machine block at 2Hz and add a klaxon strip
  to the header. Multiple HIGH alarms desynchronize their strobe phases deliberately
  (visual cacophony = mechanical truth).
- **BP zones** drive panel C styling per §7.5 table, including the RED-zone vignette that
  bleeds onto neighboring panels (stress is not contained; neither is the CSS).
- **ChoiceEvents** render as a centered modal styled as a radio handset overlay with the
  countdown as a depleting squelch bar. The rest of the dashboard stays live behind it —
  the player watches the plant degrade WHILE Dave explains the parking lot.
- **Audio (optional tier):** 60Hz room hum baseline; hum pitch rises subtly with BP zone.
  Kevin's approach gets three escalating footstep clicks. The pun itself is silent. The
  silence after a pun lasts exactly 800ms and no UI element may animate during it.

---

## 12. Radio Dispatch Ticker & Dialogue System

The ticker is the game's narrator, comedian, and black box recorder.

```ts
interface TickerLine {
  tick: number;
  channel: 'RADIO' | 'ALARM' | 'EMAIL' | 'SYSTEM';
  speaker?: 'KEVIN' | 'CHRIS' | 'TERRY' | 'DAVE' | 'TOD' | 'SPENCER' | 'PLANT';
  text: string;
  severity: 'INFO' | 'WARN' | 'CRIT';
}
```

**Rules:**
1. Every state-changing system MUST write here (§9.3 invariant). The ticker is exhaustive;
   a player who reads only the ticker should be able to reconstruct the run.
2. Severity drives color, not size. CRIT lines persist 2× as long before scrolling.
3. Character voice constants: Kevin never uses periods, only exclamation points and
   ellipses. Chris speaks in passive voice when things break ("the coupling experienced a
   disassembly event"). Terry's lines are ≤6 words. Dave's lines contain at least one
   quoted "they". Tod opens every transmission with "heyyy". These are content-lint rules
   (§15) — enforce in the dialogue data layer, not at render time.
4. Spencer never speaks in the ticker except `[RADIO SILENCE]` entries. The player's voice
   is the button presses. This is a rule about loneliness and it is not negotiable.

---

## 13. Balance Constants Reference

Single source of truth: `src/balance.ts`. All values above, consolidated:

```ts
export const BALANCE = {
  TICKS_PER_SHIFT: 720, TICKS_PER_SECOND: 2,
  START: { cash: 25_000, fiber: 80, resin: 12, bp: 118, uptime: 92, quality: 85 },
  CAPS:  { fiber: 200, resin: 30, bp: 240, bpFloor: 60 },
  PRODUCTION: { BASE_RATE: 0.55, FIBER_PER_M3: 0.72, RESIN_PER_M3: 0.085,
                BOARD_PRICE: 310, QUALITY_DRIFT: 0.04 },
  TARGETS: { TRAINEE: 180, SHIFT_LEADER: 240, CORPORATE_TARGETS: 300 },
  BREAKDOWN: { BASE: 0.0017, DEGRADED_MOD: 2.5, CHRIS_AURA: 1.8, DAVE_BOOST: 1.6,
               DIFF: { TRAINEE: 0.7, SHIFT_LEADER: 1.0, CORPORATE_TARGETS: 1.3 } },
  KEVIN: { APPROACH_P: 0.011, PUN_BP: 4, WOOD_PUN_BP: 6, ABSENTEE_MULT: 1.5,
           HIDING_BP_PER_TICK: 0.30, HIDE_EXIT_CALM_TICKS: 12 },
  CHRIS: { COST: 0, BASE_REPAIR_TICKS: 40, AURA_BP: 0.20,
           OUTCOMES: { FIXED: 0.45, FIXEDISH: 0.25, SECONDARY: 0.22, CATASTROFIX: 0.08 },
           CHRISED_COST_MULT: 1.5 },
  TERRY: { COST: 600, STAMINA_PER_FIX: 22, PASSIVE_DRAIN: 0.03, BREAK_AT: 30,
           BREAK_TICKS: 45, BREAK_REGEN_TO: 75, BREAKS_BEFORE_CLOCKOUT: 2 },
  DAVE:  { COST: 400, REPAIR_TICKS: 12, MONOLOGUE_P: 0.65, TRUST_START: 50,
           AGREE_TRUST: +15, AGREE_BP: 6, BOOST_TICKS: 60, BOOST_RATE: 1.20,
           DISAGREE_TRUST: -20, STRIKE_BELOW_TRUST: 25, STRIKE_TICKS: 90,
           STRIKE_SABOTAGE_P: 0.30 },
  TOD:   { PITCH_INTERVAL: [70, 110], DECLINE_ACCEL: 15, GRUDGE_DEFECT_BONUS: 0.10 },
  GLUE:  { BASELINE: 0.020, BLENDER_DOWN: 0.15, CLEANUP_AMOUNT: 25, CLEANUP_COST: 1_200,
           WARN_AT: 70, DOOM_AT: 100 },
  BP_ZONES: { AMBER: 140, RED: 170, CRITICAL: 200, DEATH: 240 },
  ECONOMY:  { FIBER_BUY: { amount: 25, cost: 4_500 }, RESIN_BUY: { amount: 6, cost: 7_200 },
              CALIBRATE: { cost: 800, qualityGain: 12, formerPause: 3 },
              BANKRUPT_AT: -5_000 },
} as const;
```

Tuning targets (validate by Monte-Carlo headless sim, ≥1,000 seeded runs):
- SHIFT_LEADER bot-optimal win rate 40–55%; naive-bot ("always Chris, always agree,
  always trade") win rate < 5% and median loss `LOSS_GLUED_SHUT` or `LOSS_BREAKDOWN`.
- Median BP time-in-RED ≥ 18% of shift on winning runs (winning should still hurt).

---

## 14. Content Library: Events & Dialogue Seeds

Minimum shippable counts; data lives in `src/content/*.json`.

### 14.1 Kevin puns (need ≥30; seeds)

| text | isWoodRelated |
|---|---|
| "Spencer!! I told the day crew a joke about the press... it didn't land, but it sure did COMPRESS the room!!" | true |
| "You know why I love this job?? It's so... BOARDING!!" | true |
| "I'd tell you my sander joke but it needs some... polishing!!!" | true |
| "Did you see the new forklift guy?? Really LIFTS the team spirit!!" | false |
| "I'm not saying the night shift is long but... wood you believe it's only 9pm!!!" | true |

### 14.2 INCIDENT table (hourly roll; need ≥15; seeds)

- **Resin Leak** (`BLENDER`): resin -1.5t, gluePileup +2.0, Alarm MEDIUM. Choice: $900
  cleanup now or +0.05/tick gluePileup until cleaned.
- **Press Thermal Event** (`requiresAuthority: true` — Kevin vanishes mid-sentence,
  ticker confirms his office light): PRESS → DOWN, HIGH alarm; if unresolved 30 ticks,
  health floor drops to max 70 for rest of shift.
- **Safety Inspection** (`requiresAuthority: true`): inspector counts gluePileup directly
  into a fine: `$40 × gluePileup`, ×1.5 because Kevin is HIDING, which the inspector notes
  on a clipboard with visible joy.
- **Midnight Morale Pizza** (scheduled ~tick 360, Kevin's MANDATORY_FUN): deployments
  locked 10 ticks; all NPC BP-adjacent stats freeze; BP -2 (the pizza is fine. the pizza
  is the only fine thing.) then Kevin pun, +6, wood-related, guaranteed.
- **Corporate Pace Emails** (§10.3 subjects, escalating).

### 14.3 Dave monologue theories (need ≥12; seeds)

Real internet conspiracies, delivered by a man who can also genuinely fix your press. The
humor is in the conviction and the load-bearing tangents, not the topic. Voice rule: every
line quotes "they"/"them". Seeds:

- "Birds aren't real, Spencer. Every pigeon on that chip pile is a surveillance drone — that's
  why they sit on the power lines, they're CHARGING. 'They' swapped the real ones out between
  '59 and '71. Follow the money. It ends at a binocular company."
- "Finland is not a real country. There's no landmass there — it's open ocean 'they' fenced
  off so Japan could overfish in private. I've never seen Finland. Neither have you."
- "The board of directors are reptilian. Not a metaphor. 'They' wear human suits and that's
  WHY corporate keeps it at sixty-eight degrees — reptiles need it cool or the suit slips."

(Full set of 15 in `src/content/theories.js`: moon landing, Antarctic ice wall, the hollow
moon, chemtrails, Denver airport, the Mandela effect, phantom time, mattress-store money
laundering, Paul-is-dead, the CERN timeline shift, the dinosaur hoax.)

### 14.4 gluePileup escalation ticker series (auto at 70/80/90/95)

- 70: "RADIO: housekeeping note: the floor near the dryers is now 'tacky.' like a dance floor. a bad one."
- 80: "RADIO: a forklift is parked by the dryers. the forklift has been parked by the dryers for a while. the forklift may now BE part of the dryers."
- 90: "ALARM: the door to the resin room opens at a new angle. the angle is 'partially.'"
- 95: "ALARM: maintenance requests everyone stop describing the plant as 'one big board.' it is, at present, accurate, and morale-sensitive."

---

## 15. Implementation Notes & Acceptance Criteria

### 15.1 Module layout

```
src/
  engine/        tick.ts, production.ts, breakdown.ts, economy.ts, bp.ts, winloss.ts
  npc/           kevin.ts, chris.ts, terry.ts, dave.ts, tod.ts   (one FSM per file)
  events/        engine.ts, incidents.ts, scheduler.ts
  content/       puns.json, theories.json, incidents.json, trades.json, ticker.json
  ui/            hmi grid components per §11 panel letter (A–F)
  balance.ts     §13, single source of truth — no magic numbers elsewhere (lint rule)
  rng.ts         seeded PRNG; the ONLY randomness entry point
```

### 15.2 Acceptance tests (binding)

1. **Determinism:** two runs with identical seed + identical action log produce identical
   final `GameState` hash.
2. **Terry inviolability:** static check + runtime test that no code path mutates
   `breakTicksRemaining` except the per-tick decrement. (The break is sacred.)
3. **Kevin cowardice:** property test — for every `requiresAuthority` event spawned,
   Kevin's status is `HIDING` within 1 tick and the 1.5× markup is applied.
4. **No inert jokes (P1):** every entry in `content/*.json` declares ≥1 state delta;
   schema validation fails the build otherwise.
5. **Chris confidence monotonicity:** `confidenceLevel` is non-decreasing across any run.
6. **Single screen (P2):** at 1280×800 no scrollbars; all six resources + BP + all five
   personnel cards simultaneously visible in every game state including modals.
7. **Headless balance harness:** `npm run sim -- --runs 1000 --bot optimal|naive` outputs
   win-rate and loss-vector histogram; tuning targets in §13 enforced as CI thresholds
   (soft-fail with report).
8. **`Math.random` ban:** CI grep, zero tolerance, no appeals, Dave was right about this one.

### 15.3 Out of scope for v1.0 (do not build)

Multiplayer, meta-progression between shifts, additional crews, a "summon Kevin" button
(see §8.1; this is a design constraint, not a backlog item), and any mechanic that allows
the player to fire anyone. You cannot fire anyone. That is the game.

---

*End of specification. Build the plant. Mind the glue. Terry's break is not a bug.*
