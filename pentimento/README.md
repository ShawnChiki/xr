# Pentimento XR

Sketch skate terrain in VR or MR with as many loose, overlapping lines as you like. Mark the edges and the lines that matter, and one smooth quad surface is found through all of them.

Open in the Quest browser: https://shawnchiki.github.io/xr/pentimento/

## Versions

- **v1.5** — Strict lines are splines: control points appear as soon as you draw one (or press Make strict); grab a point with Draw or Bend and drag, and the line stays smooth through the points. Bend on a spline moves nearby points together. View tab: lighting presets (Studio, Low sun with shadows, Soft, Headlamp), Zebra stripes for checking smoothness, and Dark / Light / Sky backgrounds. Fixed: hovering with Bend no longer hides lines.
- **v1.4** — Loops: a line that goes round more than once (or scrubs back and forth) is cut into one piece per lap, when you draw it and again when the surface builds. Smooth paint: paint over lumpy surface to smooth it, live; the paint is kept with the sketch as its own layer so that area keeps building smoother (Erase bits removes it, Layers has Clear). Lines button and A button hide every drawn line (A cycles surface + lines, surface only, lines only). Tips in their own panel.
- **v1.3** — Flatten tool: sweep a sphere through your lines; it senses their average surface (a gentle curved patch, so bowls stay bowls) and smoothly eases the loose lines onto it. Strict and locked lines stay put and steer it. A disc shows the sensed surface; the buzz fades as lines settle. Surface building now trusts the bulk of your lines over ones that floated off or overshot. The sample sketch now looks like real VR sketching: lines float, drift in depth, cut corners and overshoot.
- **v1.2** — Erasing shows up instantly: rubbed-out bits and erased lines vanish the same frame, and the controller buzzes in proportion to how much you're erasing. Bend shows the line moving live. Version number on the splash card and the hand menu.
- **v1.1** — Five line types (Loose, Guide, Strict guide, Crease, Strict crease). Strict lines are used exactly as drawn and stay exact through subdivision. Layers tab with show and lock per type. Bend tool. Make strict turns averaged guides and creases into strict lines. Fewer folds on messy sketches.
- **v1.0** — First version: draw, mark and erase tools; averaged guides and creases; crease-aware quad retopology with Catmull-Clark subdivision; OBJ export.
