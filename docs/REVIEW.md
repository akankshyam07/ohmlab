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

## Second pass (2026-10-25)

**Method:** Same as the first pass. I used headless Chromium against the running dev server (port 4794) at 1280×800 (also 1440×900, 1280×720 and 1024×768), 375×812 and 320×640, with touch emulation on phones. I walked Day 1 fully as a beginner on desktop and phone and took both quizzes with deliberate mistakes. I worked through Day 8 as an experienced learner, spot-checked Days 2, 5, 6 and 7, and repeated the keyboard and reduced-motion passes. Screenshots are in `/private/tmp/claude-501/-Users-smohanty-Desktop-Electronics/e636e1fe-371e-4e39-9b18-7a45d3e7cb5d/scratchpad/review/p2/` (named below without the folder).

### Status of first-pass issues

| # | Status | Evidence |
|---|---|---|
| 1 Quiz answer always first | **Fixed** | Day 1 Q1 order was C/B/D/A on the first attempt and C/D/A/B on retry, so options reshuffle each attempt. |
| 2 Reverse LED on 9 V shown as safe | **Fixed** | D1 at −9.0 V reads "reverse voltage too high" with a banner, and the flip challenge now requires staying within 5 V (`d8-9v-flip.png`). |
| 3 Walkthrough text fragmented | **Fixed** | A step with bold words renders as one paragraph, 77 px tall (`d1-walk3.png`). |
| 4 Meters below the fold on desktop | **Partly fixed** | Day 1 meters now sit at y=722 of 800 (`d1-s1-fold.png`). But the stage now fits its content by shrinking the schematic. Day 5 and Day 8 schematics are drawn 158 px tall with 6–8 px labels at 1280×800 (`d8-9v-flip.png`). Day 2 meters start at y=828 before you scroll. See N1. |
| 5 Phone: circuit far from the text | **Partly fixed** | The sticky mini-stage (365 px at 375 wide, 288 px at 320) keeps Day 1's circuit, meters and highlights visible (`ph375-walk2.png`). Labels are 13–15 px and tap targets are at least 43 px. New problems in N2 and N3. |
| 6 Resistor click cycle burns the LED | **Fixed** | Clicking cycles 10 kΩ → 220 Ω → 1 kΩ; 0 Ω is never in the cycle. |
| 7 Completion criteria invisible | **Fixed** | The header shows checklist chips, and after a 6/6 quiz the result says "complete the lab challenges: 0 / 4" (`header-complete.png`). |
| 8 LED "ok" up to 25 mA | **Fixed** | 21.2 mA (330 Ω on 9 V, Days 2 and 8) shows "too much current" plus a banner. |
| 9 Stiff-divider band contradicts the rule | **Fixed** | The band is now 2.35–2.65 V and the check uses the 10× rule; 1 kΩ / 1 kΩ (2.38 V) qualifies. |
| 10 Burnt LED keeps conducting | **Partly fixed** | The banner now explains that the meters show the instant of failure and that a real LED goes open. But the current dots keep animating (7 running animations measured) and the meter still reads 730 mA (`d1-burn.png`). |
| 11 No prediction mechanism | **Fixed** | 13 predict cards across the lessons; "Lock in my guess" reveals the answer and a "Try it in the lab" step (`d1-predict-locked.png`). See N7. |
| 12 Text-only builds, missing primers | **Partly fixed** | Inline breadboard and multimeter primers were added (Days 1 and 6). There is still no breadboard diagram: the only graphic on the Build step is the 660×163 schematic. |
| 13 Model limitations hidden | **Fixed** | An "About this simulator" list (steady DC, ideal battery, burnt behaviour, reverse breakdown, brightness), linked from every banner. |
| 14 "0.005 nA" readings | **Fixed** | A flipped LED reads "0 A" and "−5 V". |
| 15 Double period, "Right." after a wrong answer | **Fixed** | Both corrected in the Q1 feedback. |
| 16 Stale verdict next to "Type a number" | **Fixed** | Only the note shows. |
| 17 Quiz reset on navigation | **Fixed** | Left at Q2, came back to Q2. The lesson **Next** is still visible during the quiz (N9). |
| 18 Failed quiz gives no review | **Partly fixed** | A ✓/✗ list of questions now appears (`quiz-result.png`), but with no links to the sections that teach them. |
| 19 Toast pile-up | **Partly fixed** | Unlocks are grouped ("3 more…"), but two toasts still cover the lesson **Next** and part of **Retry** at 1280×800 for about 6 s (`complete-moment.png`). |
| 20 Tab order | **Fixed** | The lesson content and **Next** now come before the lab (tab stops 6–14). |
| 21 Label vocabulary | **Fixed on desktop** | Labels now read "V1 · 5 V", "D1 (LED)" and "S1 (load switch)", and Day 8 says "Closed (D2 skipped)". Labels collide on phones (N2). |
| 22 Hero "None" | **Fixed** | Resistor power shows "—" (`hero-none.png`). |
| 23 Phone tables | **Not fixed** | The Day 6 table is 448 px wide in a 307 px container, with its last column wrapping "about 5 / %" (`ph375-d6-table.png`). |
| 24 Floating-node voltage | **Not fixed** | With D1 reversed, D2 still reads 942 mV at 0 A. |
| 25 No near-limit cue | **Fixed** | At 245 mW (330 Ω on 9 V) the resistor shows a WARM tag (`d7-330-9v.png`). |
| 26 "Divider current" label | **Fixed** | Now "Current from the supply (through R1)". |
| 27 Lumpy controls | **Fixed** | Pill rows throughout. |
| 28 No plain diode in Day 8 | **Fixed** | A 1N4007 (D3) was added: 0.70 V at 10.7 mA, against a hand calculation of 10.45 mA. |
| 29 No magnitude cue under reduced motion | **Not re-checked** | No animations run under reduced motion (0 measured); I didn't verify whether there is now a magnitude cue. |

### New issues introduced by the fixes

| # | Sev | Where / repro | What happens | Fix |
|---|---|---|---|---|
| N1 | S2 | Desktop 1280×800. Open Day 8 or Day 5. Or open Day 1, choose "No resistor", then expand the challenge tray. | The stage fits everything into 704 px by shrinking the schematic to 158 px tall. Labels drop to 6–8 px, and the BURNT and REVERSE tags can't be read. In Day 1 the circuit shrinks from 250 to 158 px exactly when the burn happens. | Give the schematic a minimum height (about 260 px, with labels ≥ 11 px). Let the tray and banners scroll beneath it, or overlay banners on the schematic instead of stacking them. |
| N2 | S2 | 375×812 and 320×640, Day 6 or Day 8. Scroll into the lesson text. | In the mini-stage, labels collide ("S2 · closed" on "D2 · red", "R1 · 10 kΩ" under "S1 (load switch)"), and "Reset circuit" sits on the drawing. Meters 4–5 are cut off at the right edge with no cue. At 320, both voltage meters truncate to "Voltage…" and can't be told apart (`ph375-diodes-leds-stage.png`, `ph320-voltage-divider-stage.png`). | Use per-lesson phone layouts, or hide secondary labels below 400 px. Wrap the meters in 2 rows, or pick the 2–3 key meters for the mini-stage. Never truncate meter names. Move Reset into the header row. |
| N3 | S2 | 375×812, Day 1 "Why an LED needs a resistor". Scroll into the text, then tap 220 Ω or Flip in the mini-stage. | The challenge tray and its success text sit below the mini-stage's internal fold. Completing a challenge shows nothing there; only the first unlock produces a toast (`ph375-220-scrolled.png`). | Show a brief success chip in the mini-stage ("✓ Flip it, 2/4") that expands to the explanation. |
| N4 | S3 | Phone mini-stage | Controls sit in a sideways swipe strip with no affordance. LED colour, Flip and No-resistor start off-screen (the colour group starts at x=640). | Add edge fades or arrows, or wrap the controls into 2 rows. |
| N5 | S3 | Day 8, S2 closed | D3 is labelled "Diode D3, blocking" while it is bypassed and has 0 V across it. | Report "bypassed (no current)". |
| N6 | S3 | Day 1 after completion | The header says "Lesson complete" while the mastery ring shows 79 %. | Explain the ring ("steps read 2/6") or drop step-seen from mastery once the lesson is complete. |
| N7 | S3 | Predict cards | The answer is revealed before the learner tests it in the lab. The guess isn't kept after a reload. The premise "the lab starts with 1 kΩ" goes stale if the lab was already changed. | Reveal only after the lab reaches the tested state (or offer "Show me"). Persist the guess. Phrase the premise as an instruction ("Set R1 to 1 kΩ…"). |
| N8 | S3 | Day 1, choose "No resistor" before the challenge unlocks | The burn doesn't count, and nothing explains why. The learner must burn it again later. | Show "Nice, but finish *Light it safely* first", or count it when the challenge unlocks. |
| N9 | S3 | Quiz | The lesson-level **Next** remains active mid-quiz. | Hide or disable it until the quiz is finished. |

### Updated verdict

The fixes solved most of the real learning problems. The quiz can't be gamed, the simulator and the lessons now agree on 20 mA and 5 V reverse, completion is explicit, and predict cards turn the labs into experiments. Day 1 on a 1280×800 desktop and on a 375 px phone is now a good beginner experience.

The cost is the layout: fitting everything into a fixed height shrinks the schematic until it can't be read on the busier labs (Days 5 and 8 on desktop, Days 6 and 8 on phones). The bridge to real hardware is still text only.

Ohmlab clearly beats the reference on teaching. It doesn't yet beat it on delight, which needs a schematic that is always legible plus one illustrated breadboard view per build. The current S2 work is N1–N3.

## Third pass (2026-10-25)

**Method:** Same as before: headless Chromium against port 4794, at 1280×800, 375×812 and 320×640 (touch). I opened the Build step of all six lessons, inline and full-screen, and checked step → part highlighting. I traced every breadboard net by hand against the lab circuit. Then I ran a full Day 1 and Day 8 regression on desktop and phone, with zero console errors. Screenshots are in `/private/tmp/claude-501/-Users-smohanty-Desktop-Electronics/e636e1fe-371e-4e39-9b18-7a45d3e7cb5d/scratchpad/review/p3/`.

### Re-check of open items

| Item | Status | Evidence |
|---|---|---|
| N1 / #4 schematic squeezed on desktop | **Fixed** | At 1280×800 every lab's schematic is now 336–409 px tall with 14–21 px labels. Once the stage sticks, the meters sit at y≈522–595. In Day 1's burnt state the schematic is still 336 px. |
| N2 / #5 / #21 phone labels and meters | **Partly fixed** | Meters now use short names ("V across LED", "I from supply"), Reset is an icon, and Day 8 has no label collisions. Day 6 still has "R1 · 10 kΩ" on top of the Vin probe and "S1 (load switch)" on top of "R2 · 1 kΩ" (`ph375-voltage-divider-stage.png`). Meters 4–5 sit behind a fade, which is acceptable. |
| N3 phone challenge feedback | **Fixed** | A "✓ Challenge done … Next: …" overlay appears in the mini-stage for about 6 s (`ph375-n3-220.png`). New S3: it covers R1 and its label while it shows. |
| N4 swipe strip without affordance | **Fixed** | The edge fade mask is in place. |
| N5 bypassed D3 "blocking" | **Fixed** | Now reads "Diode D3, no current". |
| N6 "Complete" vs 79 % | **Fixed** | The ring is labelled "steps read 3 / 6". |
| N7 predict reveals too early | **Fixed** | Now "Guess locked in. Now test it", then "Show the answer". The guess survives a reload, and the premise is phrased "(where the lab starts)". |
| N8 early burn gives no message | **Fixed** | "That's a later challenge … Finish this one first: …". |
| N9 lesson Next during quiz | **Fixed** | Hidden until the quiz ends. |
| #10 burnt LED conducts | **Fixed** | The current dots stop, the wires dim, and the part is tagged "circuit open after failure" (`d1-burnt-desktop2.png`). Leftover S3: the meter still reads 730 mA. |
| #12 builds text only | **Fixed** | An illustrated breadboard is on every Build step (see below). |
| #18 quiz review | **Fixed** | Each missed question has a "Review: <section>" link. |
| #19 toasts | **Fixed** | One compact toast, top right ("Unlocked: First Light +3 more"). It no longer covers Next or Retry. |
| #23 phone tables | **Fixed** | The table stacks into cards (309 px in a 309 px container, `ph-table.png`). |
| #24 floating node | **Partly fixed** | Still reads 862 mV at 0 A, but the challenge text now explains why it means nothing. |
| #29 magnitude under reduced motion | **Fixed** | Chevron opacity scales with current: 0.38 at 10 kΩ, 0.47 at 1 kΩ, 0.53 at 220 Ω. |

### Illustrated breadboards (all 6 Build steps)

- **Electrically correct in all six.** Each breadboard is wired correctly against its lab circuit.
  - Day 1/2: 5V → + rail → a8, R1 c8–c12, LED anode e12 / cathode e13, a13 → − rail.
  - Day 5/6: R1 b4–b8, R2 c8–c12, the yellow S1 jumper d8→d15, R3/RL c15–c19, both returns to the − rail.
  - Day 7: R1 c5–c9 across the rails.
  - Day 8: R1 b3–b7, D1 c7→c9, D2 d9→d11, S1 a9–a11 across D2, D3 b11→b15 (band at 15), S2 c11–c15 across D3, a15 → − rail.
  - The step text gives every hole, so a beginner can wire hole for hole.
- **It looks like a real breadboard** (`fs-first-led.png`): rails with red and blue stripes, a centre channel, a–j and 1–30 printed, 3D LEDs, banded resistors and a 1N4007 with its band. It's accessible: every part has a name such as "LED D1 (red), anode (long leg) in e12, cathode (flat side) in e13".
- **The full-screen dialog** works on desktop: Esc closes it and focus returns to "Full screen". At 375 px it pans sideways and opens with the Uno off-screen.

### Remaining and new issues

| # | Sev | Repro | What happens | Fix |
|---|---|---|---|---|
| T1 | **S2** | Desktop 1280×800, `#/lesson/first-led/build`. Click step 7 ("Put the 220 Ω resistor R1…"). Same on 375 px. | The sticky panel still shows the simulator lab (on 1 kΩ, unrelated to the build), while the wiring diagram is at the top of the page. After the click, the highlighted R1 sits 829 px above the viewport (1,340 px on Day 8), so the highlight is never seen next to its step. On a phone the 365 px mini-stage also covers the diagram. Highlighting also misses most of the core wiring: in Day 1 only steps 7 and 9 highlight anything. The LED step (6), the rail jumpers (5, 8) and the Uno power wires match no part id. | On the Build step, replace the sticky lab with the breadboard, or make the figure sticky. Highlight by an explicit `parts:` list per step rather than matching ids in the text. Include the step list in the full-screen dialog. |
| T2 | S3 | Quiz with mixed results | The ✓ for right answers is the same red (rgb 255,107,125) as the ✗ (`quiz-mixed.png`). | Use the success green. |
| T3 | S3 | Quiz review links | "You move the resistor to the other side…" links to "Why an LED needs a resistor". The idea is taught in "A circuit is a closed loop". | Map links per question. |
| T4 | S3 | Day 1 burnt, 1280×800 | The "▾ more controls" hint overlaps the Flip button text. The LED-colour row (needed next, for "Switch to a blue LED") sits under the tray until you scroll the 100 px dock (`dt-burnt-stage.png`). | Make the hint a real button placed clear of Flip, or give the dock its full height. |
| T5 | S3 | Any challenge completion | The "Challenge done" overlay covers R1 and its label for about 6 s, on desktop and phone. | Dock it below the schematic or at the bottom edge. |
| T6 | S3 | Day 1 burnt | The schematic says "circuit open after failure" while the meter still reads 730 mA. | Label it "730 mA (peak, at failure)", or show 0 A with the peak noted. |
| T7 | S3 | Day 6 phone mini-stage | Label collisions (see N2). | Per-lesson phone label offsets. |
| T8 | S3 | All breadboards | Resistors are drawn with 4 bands (red-red-brown-gold), but the Elegoo kit uses 5-band parts (red-red-black-black-brown), as Day 2 itself teaches. | Draw 5 bands. |
| T9 | S3 | All LEDs in the drawings | Polarity is shown only by a slight kink in the anode leg. There's no flat rim and no +. | Draw the longer anode leg, the flat side, and a small "+" tag. |
| T10 | S3 | Uno drawing | The Uno is a two-column pin list, not the real board layout (power header on the bottom edge, digital pins on the top). | Use a simplified but true-to-layout Uno outline. |
| T11 | S3 | Day 5 / Day 8 boards | Labels and wires cover the column numbers ("12/13", "15", "4", "19"). On Day 8 the two LED bodies overlap, the D2 badge sits on the S1 jumper, and D1's cathode and S2's holes look like D2's legs (`z2-diodes-leds.png`). | Lift badges off the holes, route wires clear of the number row, and stagger the LEDs. |
| T12 | S3 | Day 5 / Day 6 | The drawing shows the final step (load and S1 in place) with no caption saying so. Building "as drawn" at step 5 adds the load and gives 3.13 V instead of the expected 3.33 V. | Caption "Drawing shows step 8", or per-step diagram states. |
| T13 | S3 | Breadboard accessible names | Internal ids leak into names ("Red wire w-5v", "w-plus"). | Use plain names ("red jumper from 5V"). |
| T14 | S3 | Toast | The compact toast covers the top-right nav (Settings) for about 6 s on desktop and phone. | Bottom-left on desktop. |
| T15 | S3 | Phone header | The "39 % steps read 1 / 6" ring label wraps onto 3 lines. | Put the label beside the ring or shorten it. |

There are no S1s. The only S2 is T1. There are 14 S3s (T2–T15), and T7 also covers the Day 6 part of N2 and the #21 phone-label item.

### Delight verdict versus the reference

Ohmlab is now level with the reference on visual delight for the hardware bridge: the breadboard is as polished as the reference's, and more trustworthy because every hole is specified and the wiring is electrically correct. On top of that it still has a real solver, predictions, checked challenges and graded quizzes. It doesn't beat the reference yet, because the two halves never share the screen. The reference shows the board and its callouts together. Ohmlab pins the simulator while you build and scrolls the breadboard away when you pick a step (T1). Make the Build step's sticky panel the breadboard, with step-driven highlights. Then Ohmlab beats the reference on both delight and teaching.

## Final pass (2026-10-25)

**Scope:** T1–T15; a re-trace of Day 8's new breadboard layout; a home → Day 1 lab → quiz regression at 1280×800 and 375×812. Console errors: none. Screenshots are in `/private/tmp/claude-501/-Users-smohanty-Desktop-Electronics/e636e1fe-371e-4e39-9b18-7a45d3e7cb5d/scratchpad/review/p4/`.

### T1–T15

| # | Status | Evidence |
|---|---|---|
| T1 Build highlighting off-screen | **Fixed** | On the Build step the sticky stage now has Wiring and Simulator tabs and opens on Wiring, both on desktop (704 px) and at 375 px (365 px). Every wiring step highlights its parts, and the highlighted parts stay in view after the click. In Day 1, steps 2 and 5–11 highlight something; steps 1, 3 and 4 have no parts, which is correct. In Day 8, steps 2–3 and 6–15 highlight something. A "Step 6 of 11" caption under the board repeats the active step (`dt-first-led-step6.png`, `ph-diodes-leds-step8.png`). |
| T2 Red ✓ marks | **Fixed** | ✓ is green (94,242,160) and ✗ is red. |
| T3 Review link mapping | **Fixed** | The resistor-position question now links to "A circuit is a closed loop". |
| T4 "More controls" overlap | **Fixed** | No hint text remains, and in the burnt state the LED colour row is visible and clickable (`burnt-stage.png`). |
| T5 Overlay covers R1 | **Fixed** | "Challenge done" now docks below the schematic. |
| T6 730 mA vs open circuit | **Fixed** | The meter reads "730 mA, peak at failure" and the banner says "the circuit is now open (0 A)". |
| T7 Day 6 phone labels | **Fixed** | No overlapping labels measured, and none visible (`ph-d6-stage2.png`). |
| T8 4-band resistors | **Fixed** | 5 bands on a blue metal-film body, like the Elegoo kit. |
| T9 LED polarity | **Fixed** | The longer, bent anode leg is marked +, the cathode is marked −, and the flat rim is drawn (`z-led.png`). |
| T10 Uno outline | **Fixed** | A true-to-layout Uno: digital header along the top, power and analog headers along the bottom, USB and barrel jack. |
| T11 Day 5/8 clutter | **Fixed** | No badge overlaps another badge or a column number. The LEDs are staggered (`bb-diodes-leds.png`). |
| T12 Drawing state | **Fixed** | Day 5 and Day 6 say "About the diagram: it shows the finished circuit after step 12 / step 10". |
| T13 Internal ids in names | **Fixed** | Names now read like "Red jumper wire from Uno 5V to the top + rail". |
| T14 Toast placement | **Fixed** | Bottom-left, 380×64 px. |
| T15 Phone ring label | **Fixed** | "steps read 1 / 6" fits on one line beside the ring (`ph-d1.png`). |

### Day 8 breadboard re-trace

The board is wired as follows:
- **Supply and resistor:** + rail → a3; R1 runs b3–b7 (column 3 to column 7).
- **D1:** anode d7, cathode d10.
- **Column 10:** D1's cathode, D2's anode (e10) and one end of S1 (a10).
- **Column 14:** D2's cathode (e14), the other end of S1 (a14), D3's anode (b14) and one end of S2 (d14).
- **Column 18:** D3's cathode (b18, band side), the other end of S2 (d18) and the a18 → − rail jumper.

So S1 bypasses D2 and S2 bypasses D3, exactly like the lab's switches. Every hole matches the step text. The LED legs spread 3–4 holes, which works in practice.

### Regression sweep

| Path | Result |
|---|---|
| Home → Day 1 → lab challenges → quiz, desktop | All 4 challenges complete. The quiz passes and the header shows "Lesson complete". |
| Same path at 375 px | Same result; no horizontal scroll (scrollWidth 375). Choice feedback renders. |
| Day 8 lab, desktop and phone | All 4 challenges complete. The −9 V reverse warning still works. |

### Remaining issues (all S3)

1. At 1280×800 the bottom-left toast covers the lab's challenge tray for about 6 s.
2. On a phone, the "Full screen" pill on the Wiring stage sits over rows g–j of the board. No parts are covered.
3. Mouse-wheel scrolling over the phone mini-stage scrolls its inside instead of the page, which can push the schematic out of view until it's scrolled back (seen with a wheel; not tried with touch).
4. The floating-node reading (Day 8, D2 at 862 mV with 0 A) is still shown, though the challenge text explains it.

### Final verdict against the reference

No S1 or S2 issues remain. Ohmlab now beats the reference:
- **Teaching:** a real solver, prediction, checked challenges, graded quizzes with review links, and statuses that agree with the lessons.
- **Delight:** the Build step is now a polished, accurate breadboard with a true-to-layout Uno, kit-faithful 5-band resistors and step-by-step highlighting, sharing the screen with the instructions. On a phone it's usable hole for hole.

The reference's one remaining edge is its single-screen 3D presentation of the board, which is charm rather than learning value.
