# MARGIN CITY — Greybox Prototype v0.1

**Single-player • cinematic 2.5D • stealth/chase • paper-only market replay**

This is a **small game prototype**, not a finished game and not a financial simulator. It uses only procedural primitive geometry and a **synthetic** OHLC fixture. No real securities prices, trading accounts, orders, wallets, APIs, paid assets, or backend services are included.

## Play immediately in the browser (zero installs)

Open `demo-web/index.html` in any modern desktop browser (or download the standalone `MarginCity_demo_play.html`). This is a **separate throwaway 2D canvas feel-test**, not the Godot build and not the final art style. It simulates movement, hide spots, Inspector states and the same candle replay on a single page without a server.

Run `node tools/check_web_demo.cjs` for its mock-canvas smoke-test if Node.js is installed.

## Run the canonical Godot project locally

1. Install the **Godot Engine 4.6 Standard (non-.NET)** editor: https://godotengine.org/download/
2. Unzip this project, open Godot, choose **Import**, select `project.godot`.
3. Run the main scene with **F6**, or the whole project with **F5**.
4. In the 3D level, reach the glowing terminal on the right while avoiding the Inspector.

### Keyboard

| Key | Action |
|---|---|
| `A`, `D` / arrows | Move left/right |
| `Shift` | Sprint; generates detectable noise |
| `Ctrl` or `C` | Crouch; hide when beside a green-marked alcove |
| `Space` | Jump |
| `E` | Open the terminal when nearby |
| `Esc` | Close the terminal (outside replay animation) |

Getting caught sends Elias back to the level start and resets the Inspector. Trading is a one-time optional choice: **LONG / SHORT / POMIN** (skip). The last eight candles are revealed sequentially. `POMIN` produces $0 PnL. There is no leverage or real money.

## What's implemented

- One procedural 3D greybox corridor and **single X/Y gameplay lane**.
- A blended 3D camera with three level-based cinematic shot presets.
- Player movement, sprint, jump and crouch/hide zones.
- One Inspector with PATROL → SUSPICIOUS → CHASE → SEARCH → RETURN states.
- Simplified sight range, facing, raycast LOS and running sound detection.
- Player capture / respawn loop.
- Terminal with 20 synthetic OHLC bars (12 visible initially); candle rendering and deterministic fee/slippage-aware PnL.
- End-of-mission summary after one replay.

## What is NOT implemented

- High-quality art, animations, music, real-time market data, historical market data, stock market licensing, NPC dialogue, saves, checkpoints, fully authored enemy navigation, scalable mission system, controls for touch screens, final web export or full game campaign.
- This AI is a *behavioural sketch*, not a production-ready intelligent adversary. Hiding is currently a proximity+crouch check, not real-world occlusion.
- PnL assumes entry/exit at designated closes, fixed fee/slippage; real execution, stop-loss, realistic fill simulation and trading pedagogy are later milestones.

## Folder map

```
project.godot             Godot editor project / Compatibility renderer
scenes/Main.tscn          Main bootstrap scene
scripts/main.gd           Creates greybox world, camera, HUD and mission
scripts/player.gd         CharacterBody3D controller
scripts/inspector_ai.gd   Enemy state machine and perception
scripts/trading_chart.gd  Candlestick rendering
scripts/replay_engine.gd  Deterministic paper PnL (separated from scene)
data/trading_synthetic.json   FICTIONAL test OHLC data
docs/GDD_v0.1_PL.md          Production-facing game design document
docs/ARCHITECTURE_PL.md      Technical roadmap, contracts and QA gates
docs/CLAUDE_CODE_START_PL.md First assignment for Claude Code
tools/validate_fixture.py   Deterministic fixture checks
demo-web/index.html         No-dependency browser feel-test
tools/check_web_demo.cjs     Offline JS smoke test
```

## Check the data fixture

`python tools/validate_fixture.py`

## Web delivery

Godot 4 web export uses **WebGL 2.0 / Compatibility** and requires browser-compatible resources. Native mobile exports and mobile web are separate performance targets. After opening in Godot install export templates, add a **Web** preset and export to `build/web/index.html`, then serve the output from an HTTP/HTTPS server (do not rely on double-clicking `index.html`). See https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_web.html.

**Verification status:** the Python fixture validator and Node mock-canvas browser smoke-test both passed in this environment. **Interactive browser graphics have not been visually tested** (headless Chromium did not complete in this environment). The Godot editor executable is not installed here, so scene import, script compilation, visual QA and browser export have **not** been verified. Run the checks in `docs/ARCHITECTURE_PL.md` after opening Godot; Claude Code should fix any importer/parser errors before adding functionality.

## License notes

Godot Engine is MIT-licensed. This repository does not embed the engine. Distribution of exported builds should contain the Godot MIT license/attribution required by Godot. No third-party graphics or trademarked character assets are included.
