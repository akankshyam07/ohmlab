---
name: isometric-hardware
description: Draw and animate Ohmlab's isometric hardware illustrations (Uno, breadboard, resistors, LEDs, wires) as layered SVG that responds to the real circuit solver. Use when building or changing any illustrated bench scene, component art, or hardware animation in this app.
---

# Isometric hardware illustrations

Ohmlab's illustrated "bench" shows real parts in a 2:1 isometric view, lit and animated by the solver. It is our own art in the night-lab palette: never trace, copy or recolour another product's assets.

## Projection

Model in millimetres with x (right-back), y (left-back) and z (up). Project with true isometric angles:

```ts
const C = Math.cos(Math.PI / 6), S = Math.sin(Math.PI / 6) // 0.866, 0.5
export const iso = (x: number, y: number, z = 0, k = 1) => ({ sx: (x - y) * C * k, sy: (x + y) * S * k - z * k })
```

- One `k` (px per mm) per scene. Real sizes keep it believable: Uno 68.6 × 53.4 × 1.6 mm PCB; half breadboard 82 × 55 × 8.5 mm with a 2.54 mm pitch; 5 mm LED (lens height 8.6 mm, anode leg 3 mm longer); 1/4 W resistor body 6.3 × 2.4 mm; jumper wire 0.6 mm core.
- Build every solid from boxes, cylinders and extruded outlines, each drawn as its three visible faces.
- Draw order follows the painter's algorithm: sort shapes by depth `x + y + z` (back first). Parts on a board sort by their hole coordinates, and wires are drawn last, above the parts they cross.

## Shading and line

- Three faces per solid: top = base colour, left = base darkened 18 %, right = base darkened 32 %. Compute these in code (one `shade(hex, amount)` helper); never hand-pick shades.
- Outline every face with a 1.25 px ink stroke (`--iso-ink`, a near-black blue) with round joins, and add a 0.75 px lighter highlight on the top face's front edges. This "inked" line is what makes the art read as illustrated rather than rendered.
- One soft contact shadow per object: an ellipse in multiply blend at 25 % under its footprint. No drop shadows on faces.
- Metal (pins, legs, USB shell) gets a two-stop linear gradient along its long axis. Plastic and PCB are flat colour.
- Use the palette tokens from `src/styles/tokens.css`. Add illustration tokens (`--iso-pcb`, `--iso-board`, `--iso-ink`, `--iso-metal`) to tokens.css rather than inlining hex values. Resistor bands and LED lens colours come from data (5-band codes from `resistorBands`).

## Labels

Callouts are HTML (or SVG text) placed at the projected anchor, with a 1 px leader line and a small node dot. Use the mono font, uppercase 11–12 px titles, a 2-line max description, and never cover a part. Run `placeLabels` from `src/viz/place.ts` for collision avoidance.

## Motion

All motion uses transform and opacity only, uses the motion tokens (`--dur-tween`, `--ease-spring`, `--dur-intro`, `--ease-out`), and is OFF under `prefers-reduced-motion` and when the "Animate current flow" setting is off. A JS loop jumps straight to its final state in that case.

- **Assembly intro (once per scene):** the board fades in, then parts drop from z + 12 mm with `--ease-spring`, staggered 70 ms in build order, then wires draw along their length (stroke-dashoffset). Total ≤ `--dur-intro` + 400 ms.
- **Live state from the solver:** LED glow is a radial gradient whose opacity and radius follow `brightness`, eased over `--dur-tween`. Current is shown as small bright pulses moving along each wire's path (offset-path or getPointAtLength), with spacing fixed and speed from `flowSpeed()` in `src/viz/describe.ts`. Pulses stop when no current flows or a part is burnt.
- **Interaction:** hovering a part lifts it 2 px (translateY) and deepens its shadow. Changing it (new resistor value, LED flip) plays a spring pop, or a 180° flip about its vertical axis done as a scaleX squash. Burnout: a white-hot flash, a short smoke puff, then dark.
- **Camera:** pan and zoom by tweening one group transform (never the viewBox per frame). Offer 4 preset views (front, left, right, top-down) that tween between projections in ≤ 600 ms. Free rotation is not needed.
- **Idle life:** a very slow ambient shimmer on the PCB traces (opacity 0.85 ↔ 1 over 6 s) is the only idle animation. Nothing else moves at rest.

## Performance

- Keep static layers static: render the board and parts once, and animate only small overlay groups (pulses, glow, the part being changed). Promote animated groups with `will-change: transform` sparingly.
- No SVG filters on large areas: glow comes from gradients, and blur only on elements under 64 px.
- Budget: 60 fps on a mid laptop. Measure with a rAF probe (p95 ≤ 17.5 ms, no frames over 33 ms while idle or changing a part), and with CDP `Performance.getMetrics` (idle main thread ≤ 5 %).

## Accessibility

The scene is one `<figure>` with a short caption. Each interactive part is a focusable button named like the schematic (`partLabel`), and callouts are readable text. Colour is never the only signal: states also get tags ("BURNT", "REVERSE V").

## Checklist before handing off

1. Every part is the right size relative to the others, legs land in real holes, and polarity is visible.
2. Light, shade and outline are consistent across all parts.
3. Intro, live glow, current pulses, part change and burnout all animate smoothly, and all are disabled under reduced motion.
4. Frame budget measured and met; screenshots at 1280×800 and 375×812 reviewed.
5. Nothing traced or copied from another product.
