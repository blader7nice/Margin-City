# PRODUCTION GATE -- from advice to a playable browser game

## Gate A -- technology selection

The owner approves one engine, renderer, source-reuse strategy, first target device/browser, and near-term scope. Technical advisor documents why it is suitable. Do not require every story detail to be finalized before implementation.

## Gate B -- technical spike

Make a single 2.5D room with depth layers, simple character movement, one hiding place, one MM-01 perception sensor, one authored light setup and one cinematic transition. It must actually launch in a browser and be instrumented for FPS/frame pacing, loading and console errors. Test representative weak hardware if available. If blocked by the environment, provide exact commands and evidence; mark tests unverified.

## Gate C -- 3-5 minute gameplay slice

A playable path based on the 'The Last Shift' sequence: approach -> hide from MM-01 -> choose among 2-3 routes, one nonobvious -> trigger clearly forecast alarm -> short chase -> escape checkpoint. One new mechanic is introduced naturally; UI remains limited. No full market replay or six-chapter map yet. Keep controls responsive and camera legible. External playtests before art-heavy polish.

## Gate D -- quality and first-chapter build

Once mechanics and browser performance work, enhance visual lighting/character readability and then build library prologue 'The Third Way' and the full mission 'The Last Shift' with terminal B-12. Full market replay gets a separate tested milestone. Verify no lookahead leakage, real-data licenses, and correct story canon.

## Ownership and implementation protocol

- Separate 'APPROVED CANON', 'PROPOSED CHANGE' and 'VERIFIED TECHNICAL FACT' in each report.
- Use version control and short PRs/commits with test proof. Keep old source intact until owner accepts migration.
- In every milestone show: playable result, what was tested, limitations and the next 1-2 recommended improvements.
- Critical decisions return to owner; implementation details can be autonomous once their milestone is approved.
- Never claim success from code written but not executed.
