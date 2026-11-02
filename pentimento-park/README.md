# Pentimento Park

The all-in-one skatepark builder for Quest: record fingerboard runs, sketch terrain around them, surface it,
and watch the runs ride the surface. Built from Pentimento XR (v2.20) with Party Lines recording brought inside.

Planned phases: record + sketch + surface (now) → SubD editing (smoothing, moving points, manual patching) →
panelization for fabrication (concrete and wood approaches) → export to Rhino and Blender.

## Changelog

- **v1.2** — Ride controls: hold A to record, trigger pops a flip, B refits the board (B again locks it), stick press goes back to Draw, with a small hint by the board. Boards are the full Party Lines fingerboard (kicked deck, plies, graphic, trucks, wheels). The menu now lies along the controller's button face, reaching forward from it.
- **v1.1** — Cage tools for cleaning up the SubD surface (Surface tab → Edit cage, or hold A for the dial while editing): Move (merge by dropping on a point), Soft (move a sphere of points with falloff), Smooth (sweep to relax bumps; creases and borders slide along themselves, corners stay), Crease (touch edges to sharpen or soften them), Patch (tap 3 or 4 points to add a face), Fill hole (touch a hole's edge) and Delete (sweep over faces). All undo with X / Y.
- **v1.0** — Ride tool (next to Draw): a fingerboard hangs under your controller, using your Party Lines board fit if
  you set one. Hold the trigger and ride it over your lines or surface to record a run; A, B or a stick press pops a
  random flip. Runs ride their paths on a loop, and recording, moving and deleting runs all go through Undo. Grip a
  run to move it (swing your hand to turn it); while holding it, A lays ties under it, B removes them, and a stick
  press deletes the run. Everything else is Pentimento XR v2.20: sketching, strict lines, the quad surface, Edit
  cage, the library (shared with Pentimento XR) and Edit in Subdeck.
