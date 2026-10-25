# Curriculum and Learning Design

**Owner:** Content Developer + Learning Experience Designer. Source roadmap: `/CURRICULUM.md` (100 days, 7 phases). Content lives in `src/content/` and is checked by `src/content/lessons.test.ts`.

## Who we teach

Complete beginners: no physics, no code. They usually own (or will buy) an Elegoo Uno starter kit. Every lesson assumes only the lessons before it.

## Teaching method: predict → try → explain → check → build

Every lesson runs the same loop.

1. **Predict.** Before any change in the lab, the learner guesses what will happen ("brighter or dimmer?", "what will the probe read?"). Lab intros and challenge prompts ask for a prediction first.
2. **Try it in the lab.** Change one thing on a live circuit that the real DC solver re-solves on every change. The simulator is the safe place to break things on purpose: Day 1 asks the learner to burn an LED, and Day 7 to overheat a resistor.
3. **Explain.** Short sections give the idea, the formula and a **walkthrough** that does the analysis step by step while highlighting the parts in the lab. Each analogy comes with an honest note on where it breaks.
4. **Check with the quiz.** 5–7 questions mix concept choices (every option explains why it is right or wrong) with numeric problems (with a hint and a worked explanation).
5. **Build it for real.** A kit guide uses only common Elegoo Uno starter-kit parts, with numbered steps and safety notes. The real build repeats the lab's key experiment, so the learner sees the same numbers on the bench (with a multimeter from Day 4).

## Lesson anatomy

| Part | Contents | Rules |
|---|---|---|
| Header | Title, tagline, minutes (35–45), objectives | Objectives are observable ("calculate", "explain", "choose") |
| Sections (3–5) | Text, callouts (tip / warn / info), formulas, tables, walkthroughs | Second person, short sentences, every term defined on first use. Only `**bold**`, `*em*` and `` `code` `` |
| Walkthrough (≥ 1) | Step-by-step circuit analysis | Steps `highlight` lab component ids; maths in `math` |
| Lab | Circuit + grid layout, controls, click-to-change parts, readouts, 2–4 challenges | Every challenge fails in the starting circuit and passes for at least one reachable setting (brute-force tested) |
| Quiz (5–7) | `choice` (exactly one correct, every option has a `why`) and `numeric` (answer in its stated unit, tolerance, hint, explanation) | Every numeric answer is re-derived with plain arithmetic in the tests |
| Build it for real | Parts, steps, safety | Kit parts only: resistors 10 Ω–1 MΩ, red/yellow/green/blue/white LEDs, 1N4007, buttons, breadboard, Uno 5 V/GND, 9 V battery + snap |

### Numbers in text

Hand calculations use round values: red LED Vf ≈ 2 V, blue/white ≈ 3.1 V (3 V in some quiz questions, where it's stated). The solver uses a realistic Shockley model, so its meters differ slightly; the text says so where it quotes them (for example a red LED with 220 Ω on 5 V: 13.6 mA by hand, **about 14 mA** in the simulator). Those quoted simulator values are asserted against `solveDC` in the tests.

## Mastery and completion

- **Mastery** (0–100 %) = 30 % steps seen + 30 % lab challenges done + 40 % best quiz score.
- **Complete** = best quiz score **≥ 80 %** *and* **every** lab challenge done. In practice that means 5 of 6 or 6 of 7 questions right on the first attempt.
- The quiz can be retried at any time; only the best score counts. A wrong numeric answer gets the hint and one more try (not counted for the score).

## MVP lessons (interactive in v1)

### Day 1 — Voltage, current, resistance; your first LED (`first-led`)
- Explain voltage, current and resistance in your own words, with their units.
- Trace a circuit as a closed loop from the + side of a supply back to ground.
- Use Ohm's law to work out the current through an LED and its resistor.
- Explain why an LED needs a resistor, and what happens when it is put in backwards.

Lab: 5 V → R1 → LED. Resistor choice No resistor (0 Ω, sim only) / 220 Ω / 1 kΩ / 10 kΩ, LED flip, LED colour. Challenges: light it at 5–20 mA, flip it, burn it ("it's a simulator — break it!"), light a blue LED safely.

### Day 2 — Ohm's law in practice (`ohms-law`)
- Use Ohm's law in all three forms.
- Calculate the resistor an LED needs for a target current on 5 V and 9 V.
- Round a calculated value to a real kit value, in the safe direction.
- Read 4-band and 5-band resistor colour codes.

Lab: supply slider 0–9 V, kit resistor choice, red LED. Challenges: about 10 mA on 5 V (330 Ω), safe on 9 V (1 kΩ), LED dark below its forward voltage.

### Day 5 — Series and parallel resistors (`series-parallel`)
- Recognise series and parallel connections.
- Calculate total resistance in series and in parallel.
- Predict how current splits and how voltage shares.
- State the current rule and the voltage rule (Kirchhoff's laws, named but not formalised).

Lab: R1 in series with R2; switch S1 adds R3 in parallel with R2; probe at the junction. Challenges: 3 kΩ in series, equal split, two resistors acting as 500 Ω.

### Day 6 — Voltage dividers (`voltage-divider`)
- Explain how two series resistors split a voltage.
- Calculate Vout = Vin × R2 ÷ (R1 + R2).
- Choose kit resistors for a target voltage (3.3 V from 5 V).
- Explain loading and how to keep a divider stiff.

Lab: R1/R2 divider with a probe at the midpoint, plus a switchable 10 kΩ load. Challenges: 2.5 V, 3.3 V ± 3 % (1 kΩ/2 kΩ or 5.1 kΩ/10 kΩ), and 2.4–2.6 V with the load attached.

### Day 7 — Power, heat and ratings (`power`)
- Explain power as energy per second, in watts.
- Calculate power with P = V × I, I² × R and V² ÷ R.
- Check a resistor against its rating and apply the half-rating rule.
- Recognise and prevent overheating.

Lab: 5 V or 9 V across one 0.25 W resistor (10 Ω–1 kΩ). Challenges: overheat it, smallest safe resistor on 9 V (330 Ω), 50–125 mW on 5 V.

### Day 8 — Diodes and LEDs (`diodes-leds`)
- Identify anode and cathode on diodes and LEDs.
- Relate forward voltage to LED colour and calculate a resistor for each.
- Calculate current for LEDs in series and spot when the supply is too low.
- Explain why parallel LEDs each need their own resistor.

Lab: 5 V / 9 V → R1 → D1 → D2, with a jumper S1 that skips D2; colour choice on both LEDs; flip D1. Challenges: an LED that takes over 2.7 V, two reds in series, two blues in series (needs 9 V), reverse blocking.

## The 100 days in v1

All 100 days appear on the curriculum map (`src/content/curriculum.ts`), grouped into 7 phases. Days with an interactive lesson link to it; every other day is shown as "Coming soon", never as a dead link.

| Phase | Days | Theme | Interactive in v1 |
|---|---|---|---|
| 1 | 1–12 | How electricity works | 1, 2, 5, 6, 7, 8 |
| 2 | 13–28 | Arduino and code | — |
| 3 | 29–40 | Driving real loads | — |
| 4 | 41–56 | Sensors, displays, communication | — |
| 5 | 57–70 | Circuits without a microcontroller | — |
| 6 | 71–82 | Wireless and bigger chips | — |
| 7 | 83–100 | Make it permanent (93–100: Capstone) | — |

Days 3 (breadboards) and 4 (multimeter) are hands-on skills with nothing to simulate on a DC solver, so they wait for a future "bench" lesson type. Days 9–12 need a switch-focused lab (possible now) and capacitors/transients (not in the v1 solver; see ROADMAP.md). The capstone (days 93–100) is split into requirements, block diagram, breadboard prototype, firmware, KiCad, assembly, enclosure and documentation.

## Adding a lesson

1. Create `src/content/lessons/dayNN.ts` with a default-exported `Lesson`.
2. Add it to `src/content/index.ts` and set `lessonId` on its day in `curriculum.ts`.
3. Add every numeric quiz answer's hand calculation to `expectedAnswers` in `lessons.test.ts`.
4. Run `npx vitest run src/content`. The tests check ids, layout ↔ circuit consistency, wire current directions (KCL on the drawing), and that every challenge is reachable and not already solved.
