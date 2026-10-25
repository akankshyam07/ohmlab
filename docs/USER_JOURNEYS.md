# User Journeys

Personas and step-by-step journeys for Ohmlab v1. Each journey ends with **success criteria** that QA tests. Element names follow the accessible-name contract in `AGENT_TASKS.md`.

## Personas

### Maya, the total beginner with a kit
- 24, works in retail, bought an Elegoo Uno starter kit after seeing a project video. Has never studied physics; doesn't know what a volt is.
- **Goal:** understand what she's building instead of copying wiring diagrams.
- **Fears:** breaking parts, feeling stupid, walls of jargon.
- **Needs:** every term defined, a safe place to break things, the confidence to go to the breadboard.

### Raj, the rusty tinkerer
- 38, software developer. Blinked LEDs years ago and still guesses resistor values ("220 Ω is the LED one, right?"). Can't debug when a circuit doesn't work.
- **Goal:** the fundamentals done properly and quickly: Ohm's law, dividers, power ratings.
- **Behaviour:** skims text, jumps straight to the lab and quiz, and wants to skip what he already knows.

### Lena, the parent helping a teen
- 45, helping her son Theo (14) with a school electronics club. She has no electronics background either.
- **Goal:** lessons she and Theo can do together in about 40 minutes, with clear safety rules for the real build.
- **Needs:** obvious progress, short sessions, explanations good enough that she can answer Theo's "why?".

## Journey 1: First visit → Day 1 complete (Maya)

1. Maya opens Ohmlab. The home page shows the heading **Ohmlab**, a continue card **"Start: Day 1 — Voltage, current, resistance; your first LED"**, and the 100-day map in 7 phases. Days without lessons say "Coming soon".
2. She selects the start link. The lesson page `h1` is the lesson title, and the step navigation ("Lesson steps") lists the sections, then Quiz and Build.
3. **Three numbers** section: she reads the V / I / R table and the "where the water picture breaks" note, then presses **Next**.
4. **Closed loop** section: the walkthrough highlights V1, then R1, then D1 in the **Circuit lab** as she steps through it.
5. **Ohm's law** section: a **Predict first** card asks what swapping 1 kΩ for 10 kΩ does. She locks in a guess, reads why, and the card tells her to set **Resistor R1** to **10 kΩ**. In the lab (starting at 1 kΩ, about 3 mA, dim) she checks: about 0.33 mA. Clicking the resistor cycles 1 kΩ → 10 kΩ → 220 Ω; it never lands on No resistor. At 220 Ω the meter shows about 14 mA, and the first challenge, **"Light the LED brightly but safely"**, completes with its success text.
6. A second predict card asks what the meter shows with the LED backwards. She guesses, then clicks the LED to flip it: dark, 0 mA. **"Flip it"** completes. She flips it back.
7. Only now does **"Break it!"** unlock. She deliberately picks **No resistor (0 Ω, sim only)** from the list. The LED is shown as burnt, with an explanatory alert, and the challenge completes. She resets with **Reset circuit**.
8. She chooses a blue LED and 220 Ω (about 9 mA). **"Blue LED"** completes. All four challenges are done.
9. Quiz: she answers 6 questions. Each choice shows its explanation immediately. On the numeric question she types "3 mA" and it's accepted. She sees **"You scored 5 / 6"** or better.
10. Build: the steps open with a short "Before you build" primer (how breadboard rows and rails connect, which way the LED goes, and "Multimeter: not needed today"), then an illustrated breadboard to copy hole for hole, kit steps that name the holes ("R1 from **c8** to **c12**"), and the safety notes (never an LED without a resistor; never 5V to GND).
11. Back on home, Day 1 shows as complete and the continue card points to Day 2.

**Success criteria**
- Every step is reachable by keyboard and mouse; **Next** and **Back** work, and each step is deep-linkable (`#/lesson/first-led/<step>`).
- The 220 Ω choice completes the safe-LED challenge at once; the meter reads 13.5–14.5 mA.
- Clicking R1 never selects No resistor, and nothing burnt before step 7 counts towards "Break it!" (challenges unlock in order).
- "No resistor" shows the LED as burnt (a text tag, not only colour) and an alert, and completes the burn challenge. **Reset circuit** restores 1 kΩ, red, not flipped.
- A quiz score ≥ 80 % (5/6) plus all 4 challenges marks Day 1 complete; mastery shows 100 % once every step has been seen.
- Day 1 completion, challenges and best score survive a reload.

## Journey 2: Returning learner continuing (Raj)

1. Raj finished Day 1 and Day 2 last week. He opens Ohmlab; the continue card reads **"Continue: Day 5 — Series and parallel resistors"** (the next available lesson after his last one). The map shows Days 1 and 2 complete; Days 3 and 4 are "Coming soon".
2. He skims the series section and jumps to the lab via the step navigation.
3. He completes **3 kΩ in series** (1 kΩ + 2 kΩ, about 1.67 mA), closes S1 and completes **equal split**, then sets R2 = R3 = 1 kΩ for **500 Ω**.
4. He goes straight to the quiz and scores 6 / 6. Day 5 is complete.
5. At the end, **Next** takes him to Day 6 (the next available lesson), not to the unavailable Day 9.
6. On Day 6 he does 2.5 V, then the 3.3 V challenge: 1 kΩ over 2 kΩ gives 3.33 V on the probe and it completes. For the stiff divider he applies the lesson's 10× rule (1 kΩ / 1 kΩ with the 10 kΩ load): 2.38 V, inside 2.35–2.65 V, and it completes, as the loading table and hint said it would. He stops for the day; tomorrow the continue card points to Day 6.

**Success criteria**
- The continue card reflects `lastLessonId` and next-available-lesson logic, and skips days without lessons.
- Jumping straight to the lab or quiz step works, and challenges count without reading every section (mastery is lower because fewer steps were seen, but completion only needs quiz ≥ 80 % + challenges).
- Lesson-end **Next** goes to the next lesson that exists.
- The streak counts consecutive local days with activity.

## Journey 3: Learner who fails a quiz (Lena and Theo, Day 7)

1. Lena and Theo do Day 7 (Power). They answer the two predict cards (they guess 220 Ω on 9 V makes *less* heat, and the card explains why not). In the lab, Theo works down from 1 kΩ and finds 330 Ω as the smallest safe value on 9 V; then the next challenge lets him cook the resistor on purpose (9 V, 220 Ω → overpower); then 220 Ω on 5 V for the half rule. All 3 challenges are done.
2. Quiz: they rush. They get the 100 Ω power question wrong ("0.05"). The hint appears ("use P = V² ÷ R") and they get one retry: "0.25 W" is now marked right, but the first attempt counts for the score. They get two more wrong.
3. Result: **"You scored 3 / 6"** (50 %). The lesson is not complete: the challenges are done but the quiz is below 80 %. Mastery shows partial progress.
4. Each wrong choice showed its own explanation and the correct option's explanation, and Lena reads them aloud to Theo.
5. They press **Retry quiz**, take it more slowly, and score 6 / 6. The best score is now 100 %, and Day 7 shows as complete.

**Success criteria**
- A score below 80 % never marks the lesson complete, even with every challenge done.
- A wrong numeric answer shows the hint and allows exactly one retry; the score counts first attempts only.
- A wrong choice answer shows the chosen option's `why` and the correct option's `why`.
- **Retry quiz** resets the questions. The best score is kept (a worse retry never lowers it) and persists across reloads.
- Completion flips to true as soon as the best score reaches ≥ 80 % with all challenges done.
