# Feature Spec — MVP v1.0

Each feature lists the acceptance criteria that QA tests. "AC" items are pass/fail.

## F1. Circuit solver
- AC1: Linear circuits match hand calculations within 0.1 %.
- AC2: Red LED: Vf between 1.8 and 2.2 V for 5–20 mA. Reversed LED current < 1 µA.
- AC3: Shorts, missing ground and invalid values return `ok:false` with a plain-English error; the solver never throws.
- AC4: KCL holds at every node to < 1 nA; the sum of powers ≈ 0.

## F2. Live schematic (CircuitView)
- AC1: Draws battery, resistor, LED, diode and switch with value labels (formatted SI).
- AC2: LED glow tracks the solved brightness; burnt and overloaded parts are visibly marked with a text tag (not colour alone).
- AC3: Current animation speed increases with |I|; it stops below 10 µA; direction follows the sign.
- AC4: With reduced motion or the setting off, there's no animation, and static direction chevrons are shown instead.
- AC5: Clickable parts are keyboard buttons with names like "Resistor R1, 220 Ω".

## F3. Lab
- AC1: Every control change re-solves and updates meters within one frame.
- AC2: Clicking a part advances its mapped control.
- AC3: A challenge completes the moment the live circuit satisfies it, persists, and shows its success text.
- AC4: Burnt parts or a short show an explanatory alert. "Reset circuit" restores the initial state.

## F4. Lesson flow
- AC1: Steps = sections → Quiz → Build. Each step is deep-linkable (`#/lesson/:id/:step`), and Back/Next work.
- AC2: Walkthrough steps highlight the referenced parts in the lab.
- AC3: Desktop shows the stage and steps side by side; on phones the stage is never covered.
- AC4: The last step's Next goes to the next available lesson (or home).

## F5. Quiz
- AC1: Choice questions show the chosen option's explanation immediately, plus the correct one's if wrong.
- AC2: Numeric answers accept SI prefixes and units ("0.33k", "330 Ω", "13.6 mA") within the stated tolerance. A wrong answer gets a hint and one retry.
- AC3: The score counts first attempts; the result reads "You scored X / Y"; the best score persists; retry is possible.

## F6. Progress, mastery, achievements
- AC1: Progress survives a reload and corrupted storage, which falls back to empty without crashing.
- AC2: Mastery = 30 % steps seen + 30 % challenges + 40 % best quiz. Complete = quiz ≥ 80 % and all challenges done.
- AC3: Streak counts consecutive active local days.
- AC4: ≥ 7 achievements; unlocking shows a toast once.

## F7. Home and curriculum map
- AC1: The continue card points to the last lesson, or Day 1 for new learners.
- AC2: All 100 days are shown in 7 phases; only days with lessons are links. The rest are labelled "Coming soon".
- AC3: Stats show lessons completed, average mastery and streak.

## F8. Settings
- AC1: "Animate current flow" persists.
- AC2: "Reset progress" requires confirmation, then clears progress.

## F10. Predict cards
- AC1: The learner must pick an option and press "Lock in my guess"; the card then sends them to the lab ("Try it in the lab").
- AC2: "Show the answer" reveals the why; the guess is remembered in this browser.

## F11. Breadboard wiring diagram
- AC1: Every build shows a half-size breadboard with the Uno header or a 9 V battery, colour-banded resistors, polarised LEDs and diodes.
- AC2: Its nets match the lab circuit in the stated build configuration (content test); no two legs share a hole; red wires on +, black on −.
- AC3: Selecting a build step highlights the parts it names; the diagram opens full screen in an accessible dialog.

## F9. Quality gates
- AC1: Usable at 320, 375, 768, 1024 and 1440 px wide with no horizontal scroll.
- AC2: Every control works by keyboard with a visible focus ring; text contrast is ≥ 4.5:1.
- AC3: Production build, unit tests and E2E all pass in CI. The site works under a `/<repo>/` base path.
