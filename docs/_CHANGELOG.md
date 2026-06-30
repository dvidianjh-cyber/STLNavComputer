# Changelog — Nav-Computer (Project Anti-Gravity)

All notable changes to this project are documented here.
Format: `[vX.X.X] — YYYY-MM-DD`

---

## [v0.2.0] — 2026-06-30

### Added
- **Current System Panel** — New top-centre HUD panel with a dropdown listing all 56 star systems. Selecting a system updates the global selected-system state and moves the highlight sphere to that system's 3D coordinates. A `⊕` Centre View button snaps the OrbitControls pivot to the selected system.
- **3D System Name Labels** — Each star node now displays a crisp CSS2D text label (via `CSS2DRenderer`) rendered directly in the 3D viewport. Labels are parented to their star mesh and automatically follow the camera during orbit, pan, and zoom.
- **Map Key Label Toggles** — Each system-type row in the Map Key now includes a checkbox. Toggling a checkbox shows/hides all CSS2D name labels belonging to that system type in real time.
- **Map Key Collapse** — The Map Key / Legend panel now has a `⌄` collapse toggle matching the Journey Planner behaviour. Collapses and expands with a smooth `max-height` animation.
- **Dynamic Map Grid** — The XZ-plane `GridHelper` now scales automatically based on the loaded dataset. The grid size is calculated as the maximum absolute X/Z coordinate across all systems, plus 10% padding. Previously hardcoded to 90 units.
- **`map_name` / `map_description` header binding** — The "STL NAVIGATION SYSTEM" subtitle and "X SYSTEMS CHARTED" badge are now populated from the `map_name` and `map_description` fields in `systems.json` instead of being hardcoded.
- **Unexplored system type** — Added rendering support for `"Unexplored"` system type: grey star colour (`#888899`), dedicated CSS dot and badge styles, and tooltip colour class.

### Changed
- **`systems.json` schema** — The data file is now a root object `{ "map_name", "map_description", "systems": [...] }` instead of a bare array. This is a breaking schema change; `dataLoader.js` updated accordingly.
- **Drive Output input → Slider** — The Drive Output field in the Journey Planner is now a `<input type="range">` slider (range: 0.1–10 G) with a live value readout, replacing the previous number input (which had an impractical 100 G ceiling).
- **Journey Planner layout** — Drive Output slider and Max Cruise Velocity input are now on a single flex row (70% / 30% split) to reduce vertical panel height.
- **Journey Planner default state** — Panel now initialises collapsed rather than expanded.
- **Selected-system highlight sphere** — The blue semi-transparent sphere no longer defaults to the world origin `(0,0,0)`. It binds to the "Current System" dropdown selection on load and on every change.

### Fixed
- **Pinned card flash bug** — Info cards briefly appeared at the left edge of the screen on creation before jumping to the correct pointer position. Fixed by injecting the card with `opacity: 0`, calculating and applying `transform: translate()` before the first paint, then fading in via `requestAnimationFrame`. The old `card-in` CSS keyframe animation has been removed.
- **Pinned card shows system `id`** — The raw `sys_XXX` identifier was visible in the card header. Removed from the card DOM.

---

## [v0.1.2] — 2026-06-29

### Added
- **Origin Tether Lines** — A dashed cyan SVG line links each pinned info card back to the star it describes. Uses closest-edge logic: the line anchors to the nearest point on the card's bounding rectangle rather than a fixed corner. Rendered on a dedicated full-screen SVG overlay (z=5, below UI panels, above the 3D canvas). Updates in real-time during card drag, map pan, and map zoom.
- **Flight Plan Leg Labels** — The subjective journey time for each individual leg is displayed directly on the 3D map, anchored to the midpoint of that leg's trajectory line. Implemented via Three.js `CSS2DRenderer` so labels project automatically through the camera on every pan/zoom. Zero-distance legs are skipped. Labels are cleared and redrawn on every recalculation.
- **Collapsible Journey Planner** — A `⌄` toggle button in the planner heading collapses the panel body with a smooth `max-height` animation, leaving only the title visible. The icon rotates 180° in the collapsed state.
- **Per-Waypoint Layover** — Each intermediate stop in the flight plan now has its own individual layover input (unit: years, precision 0.1). Replaces the previous single global "Layover at each stop" field.

### Changed
- **Layover unit** — Layover is now specified in **years** (not days). The `calculateRoute` physics API signature changed from `layoverDays: number` to `layoverYearsArray: number[]` (one entry per waypoint index).
- **Theme contrast** — Background darkened (`--col-bg`: `#000a1a` → `#00060f`; surfaces updated proportionally). Body text brightened (`--col-white`: `#e8f4ff` → `#f5faff`). Muted text opacity raised (`--col-muted`: 45% → 62% alpha). Matching updates applied to Three.js fog, clear color, and starfield canvas fill.

### Fixed
- **Pinned card close button unresponsive** — The `×` close button on pinned info cards was silently swallowed by the pointer-capture drag handler on the card header. Fixed by adding `e.stopPropagation()` on the close button's `pointerdown` event and an early-return guard in `_makeDraggable` that aborts drag initiation when the click target is `.card-close`.

---

## [v0.1.1] — 2026-06-28

### Added
- **Version badge** — small `v{version}` tag in the bottom-right corner of the UI. Version is fetched at runtime from `package.json` (single source of truth — no duplicate constants).

### Fixed
- **GitHub Pages hosting** — added `.nojekyll` to the repository root. This disables Jekyll processing, which was failing with a Liquid syntax error on `{{` characters in the implementation plan docs.

---

## [v0.1.0] — 2026-06-28

### Added
- **3D Starmap** — Three.js WebGL scene with 41 stellar systems rendered as colour-coded glowing spheres
  - Habitable Hub (blue), Industrial/Mining (amber), Scientific Anomaly (purple)
  - Procedurally generated starfield background (canvas-based, no external assets)
  - Subtle reference grid and exponential fog for depth
- **OrbitControls** — Full camera rotate / pan / zoom with damping inertia
- **Relativistic Physics Engine** (`physics.js`)
  - 3D Euclidean distance calculation
  - Constant proper-acceleration kinematics (c=1 LY/Yr, 1G = 1.03 LY/Yr²)
  - Turnover-Catch: automatically handles short legs where cruise speed is not achievable
  - Multi-waypoint route summation with per-leg breakdown
  - Layover time support (accrues equally in objective and subjective frames)
- **Journey Planner UI** — Glassmorphism HUD panel with:
  - Drive Output (G-force, clamped 0.1–100 G)
  - Max Cruise Velocity (%, clamped 0.1–99.99999% c)
  - Layover time at intermediate stops
  - Dynamic Flight Plan: add/remove intermediate waypoints
  - Validate-on-change: Calculate button disabled until all stops are selected
- **Segmented Route Lines** — Three.js Line2 with distinct colours per phase:
  - Acceleration → orange-red (`#ff6b35`)
  - Cruise        → cyan     (`#00d4ff`)
  - Deceleration  → orange-red (same as acc)
- **Results Strip** — Bottom HUD panel showing total distance, objective time, subjective time, average γ dilation
- **Hover Tooltip** — Transient system info card on star hover (viewport-bounded)
- **Pinned Info Cards** — Draggable, closeable glassmorphism cards on star click
  - Shows: name, ID, type badge, stellar type, description, coordinates, colony count
  - "Set Origin" / "Set Dest." buttons wire directly into the Flight Plan
  - Viewport-constrained dragging via `transform: translate()` (no top/left repaints)
- **Legend** — Star type and route phase colour guide
- **Loading Overlay** — Animated tri-ring spinner with status text
- **Error State** — Friendly fatal-error display if HTTP server not used
- **`npm run dev`** — `npx serve` dev server script added to `package.json`

### Architecture
- ES6 modules: `app.js` (orchestrator) → `dataLoader`, `physics`, `renderer`, `interaction`, `ui`
- Dirty-flag render loop — only renders when camera moves or scene changes
- `systems.json` moved to `data/systems.json`
- `sample_data.js` converted to `data/systems.json` (pure JSON, enriched schema with `id`, `coordinates`, `colonyCount`, `stellarType`, `description`)
