# Changelog — Nav-Computer (Project Anti-Gravity)

All notable changes to this project are documented here.
Format: `[vX.X.X] — YYYY-MM-DD`

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
