# WEB-FIRST TECHNICAL DECISION -- REQUEST TO CLAUDE CODE

## Decision problem

We want a beautiful, cinematic, original 2.5D browser adventure in an oversized 3D-looking world. We are solo and rely on Claude Code for code generation. Browser distribution FIRST, eventual iPhone/mobile path SECOND. A Godot/GDScript greybox is included. Decide empirically rather than defend the prior stack.

## Compare at least these realistic candidates

A. Godot 4.x + GDScript + Compatibility/WebGL 2.0 + baked/stylized lighting.
B. PlayCanvas or a comparable mature web-first 3D engine.
C. Three.js or Babylon.js + physics/gameplay stack, with concrete maintenance and toolchain costs.
D. Any clearly superior candidate, but only if you can defend browser performance, authoring complexity, asset animation/camera and mobile path; Unity or other toolkits may be discussed, not presumed.

Use a weighted rubric you justify: cinematic visual potential with web constraints; 2.5D platformer control and stealth AI; production speed for solo AI-assisted dev; mobile/iPhone portability; startup download/memory/frame pacing; debugging/build/deployment; project maintainability; cost/licensing; compatibility with existing source. Name the winner AND the runner-up, the main reasons to reject alternatives, and a switch/no-switch recommendation. Always separate verified constraints from estimates.

## Research and proof

- Consult current official technical documentation (engine export docs, web browser requirements, iOS path). State exact versions and source links. Prefer stable-release evidence over latest/unstable docs.
- Examine included source at `reference_legacy_godot/` and report what exists. If Godot executable is available, run/import/test; if not, mark unverified and provide reproducible user commands. Do not say repo is empty when this reference exists.
- Recommend an affordable visual pipeline: stylized geometry and silhouettes, foreground/background layer separation, authored lightmaps and atmospherics, high-quality materials, animation strategy and reusable assets.
- If visual quality is unclear, build or propose a narrow A/B graphics spike: same short scene and camera in the most plausible two stacks, keeping scope tiny. Do not reimplement the campaign twice.
- Include how to host and update the web build, optimize startup download, lazy-load scenes/assets, save state, handle controller/keyboard, and later responsive/touch UI.
- Browser tests should include Chrome/Firefox and Safari/iOS feasibility. Test on actual devices when possible; don't invent measurements.
- Describe iPhone native export constraints vs browser-on-iPhone delivery. If Godot native iOS is recommended, note the requirement of macOS and Xcode.

## Signature gameplay and adaptation of references

- Unravel Two: emotional cinematic side-view and layered scale, environmental puzzles and physical-feeling interaction.
- It Takes Two: mechanics variety, memorable surprises, cinematic chase choreography and playful moments.
- These games are co-op; we are single-player. Never implement copies of their unique characters, rope/tether, scripted levels, plot, asset art, voices, UI or music. Build original analogous categories of mechanics.
- Proposed 'Prediction/Third Way' system is NOT canon yet. Prototype one static forecast hotspot and one decision, measure whether players find it understandable; do not over-engineer ML from scratch.

## Response format -- max ~2-4 pages first pass

1. Clear verdict (recommended engine/stack, confidence, assumptions).
2. Comparison table (scores justified, risks).
3. What the existing Godot source proves and what it does not.
4. Architecture and visual pipeline (renderer, camera, physics, assets, build, delivery, iPhone path).
5. Short benchmark/spike with concrete pass/fail criteria and test commands.
6. The first implementation milestone: exact scenes, scripts, acceptance tests and minimal assets.
7. 3-5 decisions needed from the owner, then STOP for an engine/production approval.

After owner approval, code the first milestone, run tests, and share a playable web artifact if it really runs.
