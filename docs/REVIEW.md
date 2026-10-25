# Ohmlab — Critical User / Product Review

**Reviewer:** Critical User / Product Reviewer · **Date:** 2026-10-25 · **Build:** local dev (`vite --port 4793`)
**Method:** I used the app in headless Chromium at 1280×800 and 375×812 (touch), read every screenshot and the page text, and deliberately answered quiz questions wrong. I went through Day 1 and Day 6 as a beginner, skimmed Days 2, 5, 7 and 8 as an experienced learner checking the meters against hand calculations, did one keyboard-only pass with reduced motion, and compared the app with the reference (learn-arduino-red.vercel.app). Screenshots are in `/private/tmp/claude-501/-Users-smohanty-Desktop-Electronics/e636e1fe-371e-4e39-9b18-7a45d3e7cb5d/scratchpad/review/`.

## Verdict

The core of Ohmlab is good. Every meter value I checked matched my own calculation to within rounding: 13.8 mA for the red LED on 220 Ω, the 2.38 V and 2.46 V loaded dividers, 368 mW in the Day 7 resistor, and 13.2 mA for two blue LEDs in series on 9 V. The explanations are clear and mostly correct. Nothing else in this space gives you a hand-built solver, live meters, checked challenges and graded quizzes together.

The learning experience falls short of the engine, for four reasons:

1. **You often can't see the circuit and its numbers while you read.** On desktop the meters sit below the fold of the stage. On a phone the circuit is about 2,000 px away from the text.
2. **The quiz can be passed without thinking.** The correct choice is always the first option.
3. **The simulator sometimes says "safe" when the lesson says "harmful".** A reversed LED on 9 V shows as fine, and LEDs at 21–25 mA show as fine.
4. **The step-by-step walkthroughs render broken.** Every bold word in a walkthrough step breaks onto its own line.

The app does teach more than the reference, which mostly explains. It isn't yet as delightful. The reference fits everything on one screen with an illustrated breadboard. Ohmlab is a long scrolling page with a text-only "Build it for real" step.

## Issues by severity

S1 = blocks learning or wrong physics · S2 = major friction or confusion · S3 = polish

### S1

| # | Where | What I did | What happened | Why it matters | Suggested fix |
|---|---|---|---|---|---|
| 1 | Quiz, all lessons | Answered choice questions; then checked the content files | All 22 choice questions put the correct answer first, and the options are never shuffled. By Day 2 a learner can score 100 % by always picking A. | The quiz is the gate for "complete" (≥ 80 %) and is 40 % of mastery. Both become meaningless, and so does the "Perfect Circuit" achievement. | Shuffle the options per attempt with a seeded random order (Quiz.tsx), and keep the per-option `why` text attached to its option. Add a content test that fails if more than half the correct answers are option 0. |
| 2 | Day 8 lab (`#/lesson/diodes-leds`) | Chose the 9 V battery and pressed **Flip D1** | D1 shows −8.06 V across it with status "off". There is no warning, and the challenge "Flip D1 backwards… blocks the current completely" passes. | The same lesson says "Most LEDs are rated for about 5 V in reverse… don't reverse an LED across bigger supplies." The simulator rewards the exact thing the text warns against, so a learner concludes it is safe. | When a reversed LED has more than about 5 V across it, set a `reverse-overstress` (or `overcurrent`) status with a banner. Make the flip challenge require 5 V, or require no overstress. List "no reverse breakdown" among the visible limitations (see #13). |

### S2

| # | Where | What I did | What happened | Why it matters | Suggested fix |
|---|---|---|---|---|---|
| 3 | Walkthroughs, every lesson (e.g. `#/lesson/first-led/closed-loop`) | Read and clicked the walkthrough steps | Any step text that contains **bold** breaks apart, one fragment per line ("Start at the / **+** / side of the 5 V supply, / **V1** / . This is the push."). It happens on desktop and phone. The cause is `.blk-walk-body { display:flex }`: each RichText fragment becomes its own flex item. | The walkthrough is the main way the app shows the reasoning step by step. In this state it reads like a ransom note, and Day 1's very first walkthrough is the worst case. | Wrap `<RichText>` in a single `<span>` or `<p>` inside `.blk-walk-body` (blocks.tsx), or stop using flex on that body. Add a visual or e2e check that a step with bold text renders as a single line box. |
| 4 | Lesson stage, desktop 1280×800 | Opened Day 1 and clicked R1 in the schematic | The stage is a sticky box 704 px tall holding 1,430 px of content. The meters start at y≈946 and the challenges at y≈1,056, so neither is visible unless you scroll inside the stage. Clicking a part changes only the glow and the dot speed. | "Change a part and watch the numbers respond" is the product's promise, and at the most common laptop size the numbers are hidden. The challenges ("between 5 and 20 mA") can't be judged without them. | Put a compact meter strip directly under (or overlaid on) the schematic, above the controls. Shrink the schematic's empty padding, which is about 40 % blank. Move the challenges into the step panel or a tab. Aim for the schematic, meters and controls to fit in 800 px. |
| 5 | Phone 375×812, any lesson | Opened Day 1 and Day 6 and stepped through the walkthroughs | The whole lab (about 1,900 px) comes before the lesson text, so Step 1 starts at y≈2,280. The stage isn't sticky: clicking walkthrough step 2 leaves you at scrollY 2,532 while the highlighted R1 is about 2,000 px above. Schematic labels render 6–8 px tall and can't be read. The R1 tap target is 47×31 px. | On a phone the walkthrough highlights are invisible, the schematic can't be read, and you have to scroll three screens to reach the first sentence. FEATURE_SPEC F4 AC3 intends the stage to stay usable on phones. | On narrow screens, put the step text first and add a sticky mini-stage (schematic plus 2–3 key meters, about 40 % of the viewport, collapsible), with the controls in a bottom sheet. Scale label font sizes up in the SVG at small widths (or draw labels in HTML). Give parts at least 44 px hit areas. |
| 6 | Day 1 lab, step 1 | Followed the intro: "Click the resistor to change its value" | Clicking cycles 1 kΩ → 10 kΩ → **0 Ω**. On the way to 220 Ω the LED burns, which ticks off "Break it!" and unlocks *Magic Smoke* and *First Light* before the learner has read anything. | The "aha" of burning the LED on purpose is spoiled by accident. Achievements unlock for nothing, and two toasts cover the text. | Leave the 0 Ω option out of the click cycle (it should be a deliberate radio choice), or cycle in a sensible order (1 kΩ → 220 Ω → 10 kΩ). Only count `burn-it` once the learner has reached that challenge, or after a "you're about to break it" confirmation. |
| 7 | Quiz result and lesson end | Passed the Day 1 quiz 6/6 in a session where the lab challenges weren't done | The result says "Nice work, that's a pass!", but the lesson isn't complete. Nothing on the lesson page says the 4 challenges are also required. Home shows "0 / 6 completed". | Learners will think the app is broken, or won't know what's left. Completion is the main progress signal. | On the quiz result and the Build step, show a checklist: "Quiz ✓ · Challenges 2/4: finish *Flip it* and *Blue LED*", with links back to the lab. |
| 8 | Day 2 lab; LED status thresholds (solver) | 330 Ω on the 9 V supply | 21.2 mA, LED "lit", no warning. The lesson text says the same setup is "over the 20 mA comfort limit". The solver marks an LED `ok` up to 25 mA, `overcurrent` up to 60 mA and `burnt` above that. Day 1 calls 20 mA "the LED's limit". | The simulator and the text disagree on the number the learner is being trained to respect. | Use one threshold everywhere: `ok` ≤ 20 mA, then a "hot / over typical rating" warning from 20–30 mA, then `overcurrent`. Mention the real datasheet figure (often 20 mA continuous, about 30 mA absolute maximum) in Day 8. |
| 9 | Day 6 lab, challenge "stiff" | Used the lesson's rule of thumb (load ≥ 10× R2) with 1 kΩ / 1 kΩ | 2.38 V, and the challenge (2.4–2.6 V) fails. Only 330/330 (2.46 V) and 220/220 pass. The lesson's own table lists 1 kΩ/1 kΩ → 2.38 V as the "stiffer" example. | A learner who applies the rule they were just taught is told they're wrong, with no explanation. | Widen the band to 2.35–2.65 V (±6 %), or reword the challenge to "within 5 % of 2.5 V" and say in the hint that 10× gives about 5 % sag. |
| 10 | Burnt parts (Day 1, home hero, Day 7) | Chose "No resistor" | The LED is tagged BURNT, yet animated current keeps flowing through it at 713–730 mA. The meters read 5 V across the LED and 730 µV across a resistor that isn't there. Day 7 calls a ¼ W resistor "dead" at 2× its rating. | In real life a burnt LED usually fails open (0 mA). The simulator presents an invented threshold and post-failure current as if they were measured behaviour, and the SIMULATION_SPEC limitations ("`burnt` is a label; the part keeps conducting") are never shown to learners. | When a part is burnt, freeze the readouts at the moment it failed ("peak 730 mA"), then open the circuit (0 mA, dark wire) and explain. Label the thresholds as rules of thumb. Add a "How the simulator works" note (see #13). |
| 11 | Every lab intro | Read "Predict what each change will do *before* you make it" | There's nowhere to make a prediction. The learner just clicks. | Without predicting first, the lab becomes a toy. Prediction is the step that builds a mental model, and the copy promises it. | Add one predict-then-reveal per lab (for example, "With 220 Ω, how many mA? ___", then make the change and compare against the meter). Reuse the quiz's numeric parser. |
| 12 | Build steps; curriculum map | Read the Day 1 and Day 6 builds | The builds are text only, with no breadboard picture. Day 6 asks for "Meter on DC volts", the "GND rail" and the V/A socket, but Day 3 (breadboards) and Day 4 (multimeter) are "Coming soon". | Beginners like Maya, who fear breaking parts, have to wire from prose alone, and they meet multimeter jargon that hasn't been taught. The reference product shows the actual breadboard wiring. | Add a breadboard diagram per build, even a static SVG with legs, rows and rails. Until Days 3–4 ship, put a short "How to use a breadboard / meter" primer inline in the Day 1 and Day 6 builds. |

### S3

| # | Where | What happened | Suggested fix |
|---|---|---|---|
| 13 | Whole app | The model's limitations (ideal supply, no reverse breakdown, made-up brightness, burnt still conducts, ideal 9 V battery delivering 90 mA) live only in docs/SIMULATION_SPEC.md. | Add a "How the simulator works" disclosure on each lab, a short list of limitations, and a link to it from every burnt or overcurrent banner. |
| 14 | Day 1 flipped LED | The meter shows **"0.005 nA"** and "10 nV" across R1, while the success text says "the meter reads 0". Day 8 shows "0 A" for the same situation. | In `formatSI`, clamp \|I\| < 1 nA and \|V\| < 1 mV to 0. |
| 15 | Quiz feedback after a wrong choice | "The right answer is **…each second.**. Right. Voltage is…" has a double period, and "Right." / "Correct." is said to someone who just got it wrong. | Strip trailing punctuation from the option text and drop the leading "Right./Correct./Exactly." from the correct option's `why` when it's shown as a correction. |
| 16 | Numeric quiz | Typing "abc" shows "Type a number" alongside a stale "Not quite. Have one more go." | Clear the old verdict when the note is shown. |
| 17 | Quiz navigation | The lesson-level **Next** sits right below the quiz's **Next question**. Clicking it mid-quiz and coming back resets the quiz to Q1. | Keep quiz state in the route or session, and hide or disable the lesson Next during the quiz, or make it ask for confirmation. |
| 18 | Failed quiz result | "You scored 2 / 6 … Skim the lesson again" gives no list of what was missed. | Show each question as ✓/✗ with a link to the section that teaches it. |
| 19 | Toasts | Finishing Day 1 stacks 4 achievement toasts, which cover the quiz result and the Back button (`d1-complete-moment.png`). | Collapse them into one "3 achievements unlocked" toast. Place it bottom-left on desktop and away from the actions. |
| 20 | Keyboard | Every step makes you tab through about 12 lab stops before reaching the text or Next. The Battery and Probe are focusable but do nothing. "Skip to content" lands on the lab. | Add a "Skip to lesson step" link. Take non-interactive parts (battery, probes) out of the tab order. Focus and visible focus rings otherwise work well. Enter and Space on parts, arrow keys on radios, and Enter to submit in the quiz all work. |
| 21 | Schematic labels | The text says V1 and D1, but the diagram says "5 V supply" and "LED". Day 6 shows "Load 10 kΩ · 10 kΩ". The "R2 (bottom)" label crosses the left wire. Day 8's toggle says "Out (D2 in series)" while the diagram says "Jumper S1 · open". | Label parts "R1 · 1 kΩ", "D1 · LED (red)", "V1 · 5 V". Avoid printing a value twice. Use one vocabulary per lesson. Nudge labels off the wires. |
| 22 | Home hero "None" | The diagram still draws a resistor zig-zag labelled "just wire", and "Resistor power 50.8 mW" is shown for a resistor that doesn't exist. | Draw a plain wire. Show "—" for resistor power. |
| 23 | Tables | The 5-column V/I/R table is cramped on desktop. On a phone its last column is clipped with no hint that it scrolls (Day 6 table). | Stack the table as cards under 640 px, or add a fade or scroll cue on the edge. |
| 24 | Day 8 reversed D1 | The floating D2 shows "942 mV" with zero current, which is a side effect of the solver's tiny stabilising leak (gmin). | Show "—" or 0 V for nodes with no defined current path, or explain that the reading is floating. |
| 25 | Day 7 | At 245 mW (330 Ω on 9 V) the resistor shows nothing, even though the text says "too hot to touch". | Add a "warm/near limit" tint above 50 % of the rating, which also teaches the half rule visually. |
| 26 | Day 6 meters | "Divider current (through R1)" includes the load current once the load is connected. | Rename it "Current from the supply (through R1)", or add a separate "through R2" meter. |
| 27 | Lab controls | The "Flip the LED" button is an oversized circle, the "No resistor" option takes a whole row, and the segmented controls wrap unevenly. | Use one row-height pill style and a fixed grid for the options. |
| 28 | Day 8 | A lesson about plain diodes has no plain diode in the lab. | Add a 1N4148/1N4007 swap or a "protection diode in series" option. |
| 29 | Reduced motion | It works well: no animations, and static chevrons show direction. But nothing conveys how large the current is. | Vary chevron density or wire thickness with \|I\|. |

### Missing capabilities an experienced learner (Raj) would expect

- Typing an arbitrary resistance or using a continuous slider. Today there are only 4–6 kit values.
- A movable multimeter probe that can measure between any two points.
- An I–V curve view for the LED and the diode.
- A 9 V battery with internal resistance, since a real one sags at 90 mA.
- Resistor tolerance (±5 %).
- A "test out" quiz to skip a lesson.
- A "show the maths" toggle next to each meter.

## Keyboard, motion and the reference

- **Keyboard:** everything is operable and focus is clearly visible: parts by Enter/Space, radios by arrow keys, the flip button, hints via `<summary>`, and the quiz by arrow keys and Enter, which then focuses Next question. The friction is the tab order (#20).
- **Reduced motion:** the current-flow animation stops and static chevrons replace it (`reduced-motion-svg.png`).
- **Reference comparison** (`ref-lesson2.png`): the reference is one non-scrolling screen with an illustrated 3D Uno and breadboard, callouts tied to parts, illustrated lesson cards and a code panel. Ohmlab is deeper: a real solver, meters, graded challenges and a quiz. It loses on first-glance delight and on bridging to real hardware. The hero bench on the home page is the most delightful part of Ohmlab, and the lesson pages should feel like it: compact, with everything visible at once.

## Top 5 improvements for the next iteration

1. **Keep the circuit and its numbers in view while reading (#4, #5).** Desktop: a meter strip under the schematic, with everything above 800 px. Phone: text first, plus a sticky collapsible mini-stage and bigger labels and tap targets.
2. **Make assessment honest (#1, #7, #18).** Shuffle choice options, show a completion checklist (quiz plus challenges), and list missed questions with links back to the lesson.
3. **Make the simulator agree with the lessons (#2, #8, #10, #13, #14).** Use one 20 mA LED limit, add a reverse-voltage warning, open the circuit when a part burns, clamp values that are effectively zero, and add a visible "How the simulator works" note.
4. **Add predict-then-check to every lab (#11)**, and fix the Day 1 click cycle so breaking the LED is deliberate (#6) and the Day 6 band so it matches the taught rule (#9).
5. **Bridge to the kit (#12).** Add a breadboard diagram for each build and inline breadboard and multimeter primers until Days 3–4 ship. Also land the quick wins first: fix the walkthrough rendering (#3, about one line in blocks.tsx) and the double-period quiz copy (#15).
