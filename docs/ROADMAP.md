# Roadmap

## v1.0 — MVP (done, pending deployment)
Six interactive Phase 1 lessons (Days 1, 2, 5, 6, 7, 8), a real DC solver, the live schematic lab, predict cards, quizzes, progress and achievements, illustrated breadboard wiring for every build, the 100-day map, and GitHub Pages. See PRD.md.

## v1.1 — Complete Phase 1 (next)
Priority order:
1. **Transient simulation** (backward-Euler capacitor model), which unlocks Days 10–11 (capacitors, RC timing) with live voltage-vs-time charts.
2. **Day 3 Breadboard explorer:** builds on the shipped BreadboardView (hover already lights connected strips): add a "place the part" exercise checked with `breadboardNets`.
3. **Day 4 Virtual multimeter:** probe any two nodes (V), break a wire to measure I, and see why measuring amps across a part is a short.
4. **Day 9 Switches**, and the **Day 12 project**.
5. A **light theme** (tokens already isolate colours).

## v1.2 — Free-build sandbox
Drag parts onto a grid, wire them, and the same solver runs. Share a circuit via URL hash. Troubleshooting challenges: "this circuit is broken — find why."

## v2.0 — Arduino (Phase 2)
Run real Arduino sketches in-browser (AVR emulation, e.g. avr8js, with precompiled lesson sketches) driving the same circuit view. Serial monitor driven by actual emulated output.

## Later
Phases 3–7 content, optional 3D bench view, accounts and sync (would need a backend), i18n, teacher mode.

## Known limitations of v1.0
- Simulator: DC only; ideal sources; no temperature effects; no reverse breakdown (warned, not modelled); LED brightness is perceptual, not photometric. A node behind a reversed LED shows a leakage-defined reading (~0.86 V on Day 8), explained in the lesson.
- Progress lives in one browser only.
- Open S3 polish from the final review: the desktop toast briefly covers the challenge tray; on phones the "Full screen" pill sits over breadboard rows g–j; mouse-wheel over the phone mini-stage scrolls its contents.
