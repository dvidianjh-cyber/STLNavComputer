# Nav-Computer — Ondari Empire STL Navigation System

A browser-based, 3D interactive stellar navigation and relativistic journey-planning application for the Ondari Empire.

## Features

- **3D Interactive Starmap** — Fully navigable WebGL rendering of the 40 LY stellar neighbourhood
- **Relativistic Journey Planner** — Calculates objective & subjective travel times with correct time dilation
- **Segmented Route Rendering** — Colour-coded acceleration / cruise / deceleration phases on the map
- **Hover & Pinned Info Cards** — Draggable glassmorphism data cards for any system
- **Turnover-Catch Physics** — Short legs automatically skip cruise phase and solve for mid-point turnover velocity

## Running Locally

Because the app uses `fetch()` to load `data/systems.json`, it **must** be served over HTTP. It will not work when opened directly as a `file://` URL.

```powershell
npm run dev
```

Then open **http://localhost:8080** in your browser.

## Project Structure

```
STLNavComputer/
├── index.html          # Full-screen canvas + UI overlay
├── style.css           # Glassmorphism HUD theme
├── data/
│   └── systems.json    # 'ONDARI EMPIRE' Dataset
├── js/
│   ├── app.js          # Orchestrator & state manager
│   ├── dataLoader.js   # Fetch API data loader
│   ├── physics.js      # Relativistic physics engine
│   ├── renderer.js     # Three.js scene, stars, route lines
│   ├── interaction.js  # Raycasting, hover, click
│   └── ui.js           # DOM manipulation, form, cards, results
└── docs/
    └── ...
```

## Tech Stack

- **HTML5 / CSS3 / ES6 Modules** — Zero build step, static files
- **Three.js r165** — WebGL 3D rendering (via CDN importmap)
- **OrbitControls** — Camera pan / zoom / rotate
- **Line2** — Thick route-line rendering with proper WebGL linewidth

## Physics Notes

| Constant | Value |
|---|---|
| Speed of light `c` | 1.0 LY/Year |
| 1G proper acceleration | 1.03 LY/Year² |
| Absolute velocity cap | 0.9999999 c |

Travel times use the relativistic rapidity integral for constant proper acceleration.