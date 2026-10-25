# Simulation Spec

`solveDC(circuit: Circuit): SolveResult` in `src/sim/solver.ts` computes the DC operating point of a circuit. Every electrical number the app shows comes from it. It is pure, synchronous, deterministic and never throws; problems come back as `ok: false` with a beginner-readable `error`.

Tests: `src/sim/solver.test.ts` (`npx vitest run src/sim`).

## Units and sign conventions

SI throughout (V, A, Ω, W). Per component, as in `src/sim/types.ts`:

| Part | `current` positive when | `voltage` | `power` |
|---|---|---|---|
| resistor, switch | flowing a → b | V(a) − V(b) | V·I (≥ 0) |
| led, diode | flowing anode → cathode | V(anode) − V(cathode) | V·I |
| vsource | leaving `pos` into the circuit (delivering) | V(pos) − V(neg) | −V·I (negative when delivering) |

A source being pushed backwards by a stronger one has negative `current` and positive `power`.

`nodeVoltages` holds the ground node (exactly 0) and every named node with a conductive path to ground. That path can run through resistors, closed switches, sources and diode/LED junctions, but not open switches. A floating node (for example a probe behind an open switch) is left out, because its only "voltage" would be a gmin artefact; views show "—" for missing keys. Parts touching a floating node are still reported, with ~0 current. The solver's internal diode nodes are never exposed.

## Part models

### Voltage source
Ideal: no internal resistance, any current. `volts` must be finite and ≥ 0 (flip `pos`/`neg` for the opposite polarity).

### Resistor
Conductance G = 1/R. `ohms = 0` (lesson content uses it for "no resistor") is modelled as 1 mΩ. `ratedWatts` defaults to 0.25 W.

### Switch
Closed: a 1 mΩ resistor. Open: not in the equations at all, so `current` is exactly 0 and `voltage` is whatever the rest of the circuit puts across it.

### Diode and LED
A Shockley junction in series with a resistance Rs, joined by an internal node:

```
anode ──[Rs]── internal ──▶|── cathode        I = Is·(exp(Vj / (n·Vt)) − 1)
```

Vt = 25.85 mV (≈ 300 K). The reported `current` is the current through Rs; `voltage` is the full terminal voltage including the Rs drop.

For LEDs, Is is not hand-tuned: it is solved from the target forward voltage at 20 mA, `Is = 20 mA / expm1((Vf20 − 20 mA·Rs) / (n·Vt))`, so Vf(20 mA) hits the target exactly.

| Part | Vf at 20 mA (target) | n | Rs | Is (derived) | Vf at 5 mA (measured) |
|---|---|---|---|---|---|
| red LED | 2.00 V | 1.7 | 4 Ω | 2.12e-21 A | 1.879 V |
| yellow LED | 2.10 V | 1.7 | 4 Ω | 2.18e-22 A | 1.979 V |
| green LED | 2.20 V | 1.7 | 4 Ω | 2.24e-23 A | 2.079 V |
| blue LED | 3.10 V | 2.0 | 4 Ω | 8.55e-28 A | 2.969 V |
| white LED | 3.10 V | 2.0 | 4 Ω | 8.55e-28 A | 2.969 V |
| silicon diode (1N4148) | 0.698 V at 10 mA (measured) | 1.752 | 1 Ω | 2.52e-9 A | — |

Why Rs = 4 Ω and not the ~10 Ω of a real 5 mm LED: the product target is that Vf at 5 mA is 0.05–0.15 V below Vf at 20 mA. Rs alone contributes 15 mA·Rs to that gap and the junction adds n·Vt·ln 4 ≈ 0.06–0.07 V, so 10 Ω would give ≈ 0.22 V. 4 Ω lands the gap at 0.12 V (red/yellow/green) and 0.13 V (blue/white). Real LEDs vary by more than either choice.

Reverse breakdown is not modelled (see Limitations): a reversed part blocks any voltage. Exceeding the rated reverse voltage (LED 5 V; diode 75 V, as a 1N4148) is flagged as `overvoltage` but the part keeps blocking.

## Statuses

Checked in the order listed; the first match wins.

| Part | Status rules |
|---|---|
| resistor | P > 2 × rated → `burnt`; P > rated → `overpower`; \|I\| < 1 µA → `off`; else `ok` |
| switch | open → `off`; closed → `ok` |
| LED | V < −5 V → `overvoltage`; I < 50 µA → `off`; I ≤ 20 mA → `ok`; I ≤ 60 mA → `overcurrent`; else `burnt` |
| diode | V < −75 V → `overvoltage`; I < 1 µA → `off`; I > 1 A → `burnt`; I > 200 mA → `overcurrent`; else `ok` |
| vsource | \|I\| > 5 A → `burnt` and the whole result is `ok: false` (short circuit); else `ok` |

The LED thresholds match what the lessons teach: 20 mA is the safe continuous limit (exactly 20.0 mA is `ok`), and typical 5 mm LED datasheets give ~30 mA absolute maximum, so 20–60 mA is "too hot, shortening its life" and above 60 mA is "destroyed". They are rules of thumb, not a failure model. Reverse-biased parts within their rating stay `off`.

LED `brightness` = √(clamp(I / 20 mA, 0, 1)) when I ≥ 50 µA, else 0 (so `off` and `overvoltage` LEDs are dark). A `burnt` part still reports the current, power and brightness the circuit would push through it **at the moment of connection**; that number is the teaching point ("730 mA, far beyond 20 mA"). A real LED or diode then usually fails open and the current stops; the solver does not model that, and the view decides how to draw a burnt part.

Short circuit: when a source exceeds 5 A the result is `ok: false` with `error` like *"Short circuit: B1's + and − are joined with almost no resistance, so a huge current would flow."*, but `nodeVoltages` and every component are still filled in so the view can show what happened.

## Numerical method

1. **Validate** (see below). Any problem returns `ok: false` before any maths runs.
2. **Modified Nodal Analysis.** Unknowns: the voltage of every non-ground node (user nodes, then one internal node per diode/LED) and one branch current per voltage source. Resistors, closed switches and Rs are conductance stamps; each source adds a row V(pos) − V(neg) = volts.
3. **gmin.** 1e-12 S from every node to ground and across every junction. This keeps nodes that are only reached through an open switch or a reverse-biased diode well defined (they settle at the voltage of whatever they are attached to). It leaks at most a few pA in a 5–12 V circuit.
4. **Newton–Raphson.** Each junction is replaced by its tangent at the current guess Vj: conductance Gd = Is·exp(Vj/(n·Vt))/(n·Vt) plus a current source Id − Gd·Vj. The linear system is solved with dense Gaussian elimination and partial pivoting.
5. **Junction limiting.** The SPICE3 `pnjlim` rule: above Vcrit = n·Vt·ln(n·Vt/(√2·Is)), a new junction voltage that jumps more than 2·n·Vt is pulled back logarithmically. This stops exp() from running away. As a backstop, exp() is continued linearly beyond an argument of 100 so it cannot overflow.
6. **Convergence**, all of: every node voltage changed by less than 1 µV; no junction was limited this iteration; each junction's true Shockley current agrees with its linearised prediction to 1e-6 relative + 1 pA; each source current changed by less than 1e-6 relative + 1 pA. A circuit with no junctions is linear and is solved in one pass. The cap is 200 iterations.
7. **Source stepping.** If Newton does not converge, every source is ramped 5 %, 10 %, … 100 %, each step warm-started from the previous answer. If that fails too, the result is `ok: false`: *"The simulator couldn't settle on an answer for this circuit…"*.
8. **Results.** Currents, voltages, power and statuses are computed from the final solution. Failed solves return empty `nodeVoltages` and every readable component zeroed with status `off`, so callers can still index by id; callers must check `ok` before showing numbers.

Typical LED circuits converge in about 10 iterations. A 20-node resistor ladder with an LED solves in about 0.06 ms on an Apple-silicon laptop (Node 26); the test asserts < 2 ms.

## Validation errors

Every message names the part where it can and avoids jargon.

| Problem | Example message |
|---|---|
| not an object / no component array | This circuit couldn't be read. |
| empty | There are no parts in this circuit yet. |
| no `ground` field | This circuit has no ground (the 0 V reference point). |
| ground not touched by any part | Nothing is connected to ground (gnd), so there is no 0 V reference to measure voltages from. |
| entry isn't an object / no id / duplicate id | Part number 2 couldn't be read. · Two parts are both called R1; every part needs its own name. |
| unknown kind or LED colour | C1 is a kind of part ("capacitor") that the simulator doesn't know. |
| missing node | R1 has a leg that isn't connected anywhere. |
| NaN, infinite or negative volts/ohms; rating ≤ 0 | R1's resistance must be a number of 0 Ω or more. |
| switch `closed` not boolean | S1 must be either open or closed. |
| source + and − on the same node | Short circuit: B1's + and − are connected to the same point. |
| loop made only of sources (e.g. two batteries in parallel) | B2 is wired straight across another power source with no parts in between. That is a short circuit; add a resistor. |

Any unexpected internal exception is caught and reported as *"Something went wrong inside the simulator (…)"*.

## Tested accuracy

All asserted in `src/sim/solver.test.ts`:

- Linear circuits (single resistor, series, parallel, divider, two sources, 0 Ω resistor, closed switch) within 0.1 % of hand calculation; in practice they agree to ~1e-9 relative (gmin and the 1 mΩ stand-in are the only deviations).
- KCL holds at every node of a mixed 12-part circuit (two sources, three LEDs/diodes, two switches) to < 1 nA; power delivered equals power dissipated to 1e-9 relative.
- Red LED + 220 Ω on 5 V: 13.82 mA, Vf 1.959 V.
- LED Vf within 10 mV of target at 20 mA for every colour, and 0.05–0.15 V lower at 5 mA. Red stays within 1.8–2.2 V across 5–20 mA.
- 1N4148: 0.698 V at 10 mA.
- LED status thresholds at 19.9 / 20.1 / 59.9 / 60.1 mA. Reversed LED: `off` at 4.9 V, `overvoltage` at 5.1 V and 9 V, |I| < 1 µA either way; reversed diode `off` at 74 V, `overvoltage` at 76 V. Open switch: exactly 0 A.
- Source stepping recovers a two-LED circuit when plain Newton is capped below the iterations it needs.
- 14 kinds of malformed input return `ok: false` and never throw.

## Limitations

The beginner-facing version of this list is `SIM_LIMITATIONS` in `src/sim/limitations.ts`, shown in the Lab's "About this simulator" disclosure. Keep the two in step.


- **DC operating point only.** No capacitors, inductors, time, or transients; no AC analysis.
- **Ideal sources.** Batteries have no internal resistance and never sag or run down; only the 5 A short-circuit rule stands in for "real batteries can't do that".
- **No temperature effects.** Vt is fixed at 300 K; parts don't heat up, and Vf doesn't drift with temperature.
- **No reverse breakdown.** A reversed LED or diode blocks any voltage. Beyond the rated reverse voltage (LED 5 V, diode 75 V) the status is `overvoltage` as a warning, but no breakdown current flows.
- **Damage isn't modelled.** `burnt` is a label; the reported current is what would flow at the moment of connection. A real LED usually fails open, after which no current flows.
- **Floating nodes.** Nodes with no path to ground are left out of `nodeVoltages`. A node reached only *through a reverse-biased junction* still counts as connected (real leakage defines it), so it is reported, but its value is set by the tiny gmin leak and can look arbitrary (e.g. a dangling LED after a reversed one reading ~0.9 V with 0 A).
- **Switches are 1 mΩ when closed**, and 0 Ω resistors are 1 mΩ. That is negligible next to any real resistor but matters in deliberate shorts, where it sets the (huge) reported current.
- **LED brightness is a perceptual approximation** (square root of current, saturating at 20 mA), not a photometric model; colours don't differ in efficiency.
- **Typical-part parameters.** Real LEDs of the same colour vary by ±0.1–0.2 V; the numbers here are representative, not a specific datasheet.
