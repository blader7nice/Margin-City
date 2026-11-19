# MARGIN CITY: THE LAST SIGNAL -- Claude Code handoff v1.1

Updated: 2026-11-19. Owner language: Polish. Reply to the owner in Polish.

## Mission

Help the game creator make an original, premium-feeling **single-player cinematic 2.5D narrative adventure**, available in a desktop web browser first, with a feasible later smartphone/iPhone path. You are **co-creative game director + technical director + hands-on lead developer**, not just a coder. The project is solo/AI-assisted with almost no up-front budget. Prefer excellent short playable slices over huge untested plans.

## Files in reading order

1. `CLAUDE.md` -- collaboration rules and the immediate assignment.
2. `docs/design/MARGIN_CITY_MASTER_BIBLE_v1.1_PL.md` -- CURRENT, CANONICAL story and product brief. Read fully.
3. `docs/reviews/CREATIVE_REVIEW_01.md` -- Claude's previous critique; ideas here are **not yet approved**.
4. `docs/tech/WEB_FIRST_TECH_DECISION.md` -- main assignment: make an independent web-first technology recommendation.
5. `docs/tech/PRODUCTION_GATE.md` -- move from recommendations into executable work.
6. `reference_legacy_godot/` -- old Godot greybox source, provided for READ-ONLY AUDIT, not story authority.

## Quick start in Claude Code

Open THIS folder as the current working directory. Send:

    Read CLAUDE.md and all files listed in README_START_HERE.md. Give me your independent technology recommendation for Margin City, evaluate the existing greybox, and propose the best web-first implementation path. Respect canonical story; offer creative improvements. Once I approve the technical plan, implement the first playable browser slice in short tested increments.

## Important: old prototype vs GitHub repository

The previous Creative Review was made against a GitHub checkout reported empty. That is not evidence that a prototype does not exist. This handoff includes a separate prior greybox source under `reference_legacy_godot/` (`project.godot`, scenes, GDScript, synthetic market data). Verify it works rather than treating it as a blank repository. The source is a **legacy reference** and may have incorrect character names or gameplay assumptions. Never merge it blindly, delete it, or assume it is up-to-date.

If you work in a GitHub remote environment and cannot see the user local project, say so explicitly and give precise upload/sync steps. Do not claim local tests were run when you had no access to the game or Godot executable.

## Next deliverable (not another huge creative review)

1. Compact web-first technology decision with evidence, alternatives, risks and a recommended option.
2. Verified status of the provided old source and how much is reusable.
3. A small, falsifiable technical spike and a 3-5 minute playable first slice plan.
4. Explicit decisions the owner needs to make (few, not 20).
5. Once authorized, implement the spike and slice, run tests, present browser build/screenshot/video if actually produced, and commit in small reviewable steps.
