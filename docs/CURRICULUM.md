# Curriculum and Learning Design

**Owner:** Content Developer + Learning Experience Designer. Source roadmap: `/CURRICULUM.md` (100 days, 7 phases). Content lives in `src/content/` and is checked by `src/content/lessons.test.ts`.

## Who we teach

Complete beginners: no physics, no code. They usually own (or will buy) an Elegoo Uno starter kit. Every lesson assumes only the lessons before it.

**Also:** learners who already know the theory (JEE prep, AP physics) and want the hands-on side: what parts look like, how to wire them for real, the ESP32, and topic-wise navigation. Lessons from Day 71 on are written for them: theory as one-line refreshers, the weight on wiring, pins, failure modes and the code. The **Parts** guide and **Topics** serve them on every day.

## Teaching method: predict → try → explain → check → build

Every lesson runs the same loop.

1. **Predict first.** Every lesson has at least two `predict` blocks, each placed just before the moment the learner tries that change in the lab (Day 1: "What happens to the LED if you swap 1 kΩ for 10 kΩ?"). The learner locks in one option, then sees that option's `why`, the right answer if they missed it, and a `tryIt` line that names the exact lab control to change (`**Resistor R1**` → `**10 kΩ**`). Exactly one option is correct, every option has a teaching `why` (wrong options name the misconception), and the correct option's position varies. Predictions are practice: they are not stored or scored, so a wrong guess costs nothing.
2. **Try it in the lab.** Change one thing on a live circuit that the real DC solver re-solves on every change. Challenges unlock **in order** (the Lab only checks the next unfinished one), so they are sequenced deliberately: the safe circuit first, then breaking it. The simulator is the safe place to break things on purpose (Day 1 burns an LED after lighting it safely; Day 7 overheats a resistor after finding the safe limit), but only by a deliberate choice: every "No resistor" or part-destroying option is `skipOnClick`, so clicking a part in the diagram never lands on it.
3. **Explain.** Short sections give the idea, the formula and a **walkthrough** that does the analysis step by step while highlighting the parts in the lab. Each analogy comes with an honest note on where it breaks.
4. **Check with the quiz.** 5–7 questions mix concept choices (every option explains why it is right or wrong) with numeric problems (with a hint and a worked explanation).
5. **Build it for real.** A kit guide uses only common Elegoo Uno starter-kit parts, with numbered steps and safety notes. The real build repeats the lab's key experiment, so the learner sees the same numbers on the bench. Until the Day 3 (breadboard) and Day 4 (multimeter) lessons exist, every build opens with a **"Before you build"** primer from `src/content/lessons/primer.ts`: how breadboard rows and rails connect, which way an LED (and diode) goes, a plain statement of whether a multimeter is needed today, and, where a step measures, how to measure volts (and ohms).

## Lesson anatomy

| Part | Contents | Rules |
|---|---|---|
| Header | Title, tagline, minutes (35–45), objectives | Objectives are observable ("calculate", "explain", "choose") |
| Sections (3–5) | Text, callouts (tip / warn / info), formulas, tables, walkthroughs | Second person, short sentences, every term defined on first use. Only `**bold**`, `*em*` and `` `code` `` |
| Walkthrough (≥ 1) | Step-by-step circuit analysis | Steps `highlight` lab component ids; maths in `math` |
| Predict (≥ 2) | A guess before a lab change | Unique id across all lessons; ≥ 3 options, exactly one correct, every option has a `why`; `tryIt` names a lab control by its exact label in bold; correct option not mostly first |
| Lab | Circuit + grid layout, controls, click-to-change parts, readouts, 2–4 challenges in teaching order | Every challenge fails in the starting circuit and passes for at least one reachable setting (brute-force tested). Any choice option that burns a part from the starting circuit is `skipOnClick`; the starting value never is. No LED challenge passes while an LED is warned about (except the deliberate burn). Diagram labels use the part ids the text uses (`V1`, `R1`, `D1 (LED)`); the diagram appends the value itself |
| Quiz (5–7) | `choice` (exactly one correct, every option has a `why`) and `numeric` (answer in its stated unit, tolerance, hint, explanation) | Every numeric answer is re-derived with plain arithmetic in the tests. Options are shuffled at runtime, but in the data at most half of a lesson's choice questions put the correct option first. The correct option's `why` never opens with "Right." / "Correct.", because the quiz also shows it as a correction |
| Build it for real | Parts, steps, `stepParts`, safety, breadboard drawing | Kit parts only: resistors 10 Ω–1 MΩ, red/yellow/green/blue/white LEDs, 1N4007, buttons, breadboard, Uno 5 V/GND, 9 V battery + snap. The ESP32 is the one exception: listed as “buy (~$6–10)”. Steps start with the breadboard primer and say whether a multimeter is needed. `stepParts` has one entry per step naming the breadboard parts it places or uses. When the drawing shows a later state than a step builds, a caption step says “it shows the board after step N” |

### Numbers in text

Hand calculations use round values: red LED Vf ≈ 2 V, blue/white ≈ 3.1 V (3 V in some quiz questions, where it's stated). The solver uses a realistic Shockley model, so its meters differ slightly; the text says so where it quotes them (for example a red LED with 220 Ω on 5 V: 13.6 mA by hand, **about 14 mA** in the simulator). Those quoted simulator values are asserted against `solveDC` in the tests.

### One set of limits

Every lesson uses the same numbers, and they match the simulator:

| | Rule in the text | Simulator |
|---|---|---|
| LED current | 5–20 mA is the safe zone. **20 mA** is the comfortable continuous rating; about **30 mA** is a typical absolute maximum | `ok` ≤ 20 mA, `overcurrent` (warning) 20–60 mA, `burnt` > 60 mA (a rule of thumb, said so in Day 1) |
| LED reverse voltage | About **5 V** | `overvoltage` (**REVERSE V** tag) beyond 5 V backwards |
| ¼ W resistor | Keep under 0.25 W, ideally under half (125 mW) | `overpower` > rating, `burnt` > 2 × rating |
| Divider loading | Load ≥ 10 × R2; at exactly 10× the output sags about 5 % | Day 6's stiff challenge accepts 2.35–2.65 V with R2 ≤ load ÷ 10 |

## Mastery and completion

- **Mastery** (0–100 %) = 30 % steps seen + 30 % lab challenges done + 40 % best quiz score. Predict blocks are practice and don't count.
- **Complete** = best quiz score **≥ 80 %** *and* **every** lab challenge done. In practice that means 5 of 6 or 6 of 7 questions right on the first attempt.
- Challenges are done in order, so "all challenges done" means the learner worked through the lab's sequence, including the safe circuit before the deliberate failure.
- Choice options are shuffled at runtime, so a score can't come from always picking the same letter.
- The quiz can be retried at any time; only the best score counts. A wrong numeric answer gets the hint and one more try (not counted for the score).

## MVP lessons (interactive in v1)

### Day 1 — Voltage, current, resistance; your first LED (`first-led`)
- Explain voltage, current and resistance in your own words, with their units.
- Trace a circuit as a closed loop from the + side of a supply back to ground.
- Use Ohm's law to work out the current through an LED and its resistor.
- Explain why an LED needs a resistor, and what happens when it is put in backwards.

Lab: V1 (5 V) → R1 → D1. Resistor choice 220 Ω / 1 kΩ / 10 kΩ / No resistor (0 Ω, sim only; skipped when clicking, so clicks cycle 1 kΩ → 10 kΩ → 220 Ω), LED flip, LED colour. Predicts: 1 kΩ → 10 kΩ; LED backwards. Challenges in order: light it at 5–20 mA, flip it, burn it (after the safe circuit: "now break it!"), light a blue LED safely.

### Day 2 — Ohm's law in practice (`ohms-law`)
- Use Ohm's law in all three forms.
- Calculate the resistor an LED needs for a target current on 5 V and 9 V.
- Round a calculated value to a real kit value, in the safe direction.
- Read 4-band and 5-band resistor colour codes.

Lab: supply slider 0–9 V, kit resistor choice, red LED. Predicts: supply down to 1.5 V; 330 Ω on 9 V (about 21 mA, over the rating). Challenges: about 10 mA on 5 V (330 Ω), safe on 9 V (1 kΩ), LED dark below its forward voltage.

### Day 5 — Series and parallel resistors (`series-parallel`)
- Recognise series and parallel connections.
- Calculate total resistance in series and in parallel.
- Predict how current splits and how voltage shares.
- State the current rule and the voltage rule (Kirchhoff's laws, named but not formalised).

Lab: R1 in series with R2; switch S1 adds R3 in parallel with R2; probe at the junction. Predicts: R2 → 2 kΩ (who takes the bigger share); closing S1 (total current to 3.33 mA). Challenges: 3 kΩ in series, equal split, two resistors acting as 500 Ω.

### Day 6 — Voltage dividers (`voltage-divider`)
- Explain how two series resistors split a voltage.
- Calculate Vout = Vin × R2 ÷ (R1 + R2).
- Choose kit resistors for a target voltage (3.3 V from 5 V).
- Explain loading and how to keep a divider stiff.

Lab: R1/R2 divider with a probe at the midpoint, plus a 10 kΩ load RL switched by S1. Predicts: Vout of the starting 10 kΩ / 1 kΩ divider (0.45 V); 1 kΩ / 1 kΩ under load (2.38 V, about 5 % sag). Challenges: 2.5 V, 3.3 V ± 3 % (1 kΩ/2 kΩ or 5.1 kΩ/10 kΩ), and a stiff divider under load: R2 ≤ 1 kΩ (the 10× rule) and 2.35–2.65 V, so 1 kΩ / 1 kΩ (2.38 V), 330 Ω / 330 Ω and 220 Ω / 220 Ω all pass. The loading table shows the same numbers and the sag for each.

### Day 7 — Power, heat and ratings (`power`)
- Explain power as energy per second, in watts.
- Calculate power with P = V × I, I² × R and V² ÷ R.
- Check a resistor against its rating and apply the half-rating rule.
- Recognise and prevent overheating.

Lab: 5 V or 9 V across one 0.25 W resistor (10 Ω–1 kΩ; 10 Ω and 100 Ω burn on 9 V, so they are `skipOnClick`). Predicts: 1 kΩ → 220 Ω on 9 V (0.37 W); 220 Ω from 9 V to 5 V (power goes with V²). Challenges in order: smallest safe resistor on 9 V (330 Ω), then overheat it, then 50–125 mW on 5 V.

### Day 8 — Diodes and LEDs (`diodes-leds`)
- Identify anode and cathode on diodes and LEDs.
- Relate forward voltage to LED colour and calculate a resistor for each.
- Calculate current for LEDs in series and spot when the supply is too low.
- Explain why parallel LEDs each need their own resistor.
- Read an LED's ratings: 20 mA continuous, about 30 mA maximum, about 5 V in reverse.

Lab: V1 (5 V / 9 V) → R1 → D1 → D2 → D3 (1N4007 protection diode), with jumper S1 that skips D2 and switch S2 that bypasses D3; colour choice on both LEDs; flip D1; 100 Ω is `skipOnClick`. Predicts: adding the protection diode (about 10.7 mA); two blue LEDs on 5 V; D1 backwards on 9 V (REVERSE V). Challenges: an LED that takes over 2.7 V, two reds in series, two blues in series (needs 9 V), then reverse blocking on **5 V** with D1 not over-stressed. Coming from the 9 V two-blue challenge, the learner usually flips D1 on 9 V first, sees REVERSE V, and the hint sends them back to 5 V.

### Day 71 — Meet the ESP32 (`esp32-intro`)
- Identify the DevKit V1’s parts and headers (pin labels as printed: D23, RX2, VP…), and power it from USB, VIN or 3V3 safely.
- Size an LED resistor for a 3.3 V pin and keep each pin under 20 mA.
- Avoid input-only (34–39), strapping (0, 2, 12, 15) and ADC2-with-WiFi pins.

Lab: V1 = GPIO23 (3.3 V; also Uno 5 V or LOW) → R1 → D1. Resistor 10 Ω (`skipOnClick`, burns) / 100 / 220 / 330 Ω / 1 kΩ; LED colour. Predicts: 1 kΩ moved from 5 V to 3.3 V (about 1.5 mA, under half); blue on 3.3 V with 100 Ω (about 3.6 mA). Challenges: red at 5–15 mA on 3.3 V, blue at ≥ 3 mA on 3.3 V, smallest safe resistor on the Uno’s 5 V (220 Ω).

### Day 72 — 3.3 V ↔ 5 V: level shifting (`level-shifting`)
- Explain why 5 V damages a 3.3 V input and when 3.3 V → 5 V works unaided.
- Design a divider that brings HC-SR04 ECHO to a safe, readable HIGH, and measure it before connecting the pin.

Lab: V1 = ECHO (5 V) → R1 (top) → R3 (trim, top) → R2 (bottom), probe D18. Starts wired straight (5 V on the pin). Challenges: the textbook 1 kΩ / 2 kΩ (3.33 V), 2.8–3.3 V with a trim, then the same window at ≤ 0.5 mA (5.1 kΩ + 220 Ω over 10 kΩ). The build tests the divider with VIN standing in for ECHO before D18 is connected.

### Day 73 — WiFi: a web page that controls an LED (`esp32-wifi-led`)
- Trace a tap to `digitalWrite`, read and adapt a `WebServer` sketch, find the IP and debug the usual failures.

Lab: Day 71’s circuit with GPIO23 as a LOW/HIGH choice standing in for the taps; the lesson says plainly that the simulator doesn’t run code. The sketch is a code/explanation table, one piece per row (the content model has no code block yet). Challenges: tap ON; 10–15 mA by changing only the resistor.

## Parts guide and topics

- `src/content/parts/` exports `parts: PartInfo[]` and `getPart(id)`: one entry per `PartId`, with a feature for every model anchor in `PART_ANCHORS`, real pinouts, step-by-step wiring, common mistakes, availability, topics and related parts. Tests check that the anchors are complete and every reference resolves.
- `src/content/topics.ts` exports seven topics (Basics, Arduino, Power & motors, Sensors & displays, Analog & logic, ESP32 & wireless, Make it permanent). Together they cover days 1–100 once each, in order. A topic’s parts are derived from the parts’ own `topicIds`, so the two never disagree, and every lesson is listed by the topic that owns its day.

## The 100 days in v1

All 100 days appear on the curriculum map (`src/content/curriculum.ts`), grouped into 7 phases. Days with an interactive lesson link to it; every other day is shown as "Coming soon", never as a dead link.

| Phase | Days | Theme | Interactive in v1 |
|---|---|---|---|
| 1 | 1–12 | How electricity works | 1, 2, 5, 6, 7, 8 |
| 2 | 13–28 | Arduino and code | — |
| 3 | 29–40 | Driving real loads | — |
| 4 | 41–56 | Sensors, displays, communication | — |
| 5 | 57–70 | Circuits without a microcontroller | — |
| 6 | 71–82 | Wireless and bigger chips | 71, 72, 73 |
| 7 | 83–100 | Make it permanent (93–100: Capstone) | — |

Days 3 (breadboards) and 4 (multimeter) are hands-on skills with nothing to simulate on a DC solver, so they wait for a future "bench" lesson type. Days 9–12 need a switch-focused lab (possible now) and capacitors/transients (not in the v1 solver; see ROADMAP.md). The capstone (days 93–100) is split into requirements, block diagram, breadboard prototype, firmware, KiCad, assembly, enclosure and documentation.

## Adding a lesson

1. Create `src/content/lessons/dayNN.ts` with a default-exported `Lesson`.
2. Add it to `src/content/index.ts` and set `lessonId` on its day in `curriculum.ts`.
3. Add every numeric quiz answer's hand calculation to `expectedAnswers` in `lessons.test.ts`, and its drawn configuration to `BUILD_CONFIG` (plus `SOURCE_PINS` when the lab's source is an ESP32 GPIO or a stand-in rather than the supply pin).
4. Add at least two `predict` blocks before the lab moments they set up, start `realBuild.steps` with the primers from `lessons/primer.ts`, and mark destructive choice options `skipOnClick`.
5. Run `npx vitest run src/content`. The tests check ids, layout ↔ circuit consistency, wire current directions (KCL on the drawing), that every challenge is reachable and not already solved, predict and quiz rules (one correct option, a `why` for each, correct option not mostly first), `skipOnClick` placement, the build primers, and that no LED challenge passes while the simulator warns about an LED.
