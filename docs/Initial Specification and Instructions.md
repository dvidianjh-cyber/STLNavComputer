Here is the full specification for **Project Anti-Gravity (Nav-Computer)**, perfectly mapped into your new template. It captures all the requirements, tech stack details, and logic we've discussed so you can drop it directly into your GitHub repository.

---

# Coding Agent Instructions

## 1. Professional Persona

* **Role:** Senior Frontend Architect. You favor robust, modular, and DRY (Don't Repeat Yourself) code.
* **Focus:** Privacy-first, performant, local-web architecture.

## 2. Versioning & Change Management

* **Changelog:** After every feature completion, update `CHANGELOG.md` with version (v0.x.x), date, and changes.
* **Headers:** Every modified file must have a "Last Modified" comment at the top.

## 3. Implementation Workflow (Plan-First)

* **The 'Think' Phase:** Before writing code, provide a "Plan of Action" for user approval.
* **Verification:** Explain how you verified the code against the Technical Guardrails in Doc 1.

## 4. Quality Guardrails

* **No Shortcuts:** Never use hard-coded pixel offsets for centering. Use Flex/Grid.
* **Modularity:** Separate DOM manipulation from business logic.
* **Cleanup:** Ensure all event listeners are named functions for proper cleanup.

## 5. Definition of Done (DoD)

*Before declaring a task finished, verify:*

1. [ ] No placeholder comments (e.g., `// logic here`) remain.
2. [ ] All new functions are documented with JSDoc.
3. [ ] `CHANGELOG.md` is updated.
4. [ ] The UI remains responsive and functional down to 320px width.

# Environment & Tech Stack

## 1. The Tech Stack

* **HTML/CSS/JS:** HTML5, CSS3 (Modern features only), Vanilla JavaScript utilizing ES6+ Modules.
* **Build Tools:** Direct browser execution (Static files) suitable for GitHub Pages deployment.

## 2. Persistence Layer

* **Primary Storage:** `Fetch API` for reading the static data layer. `LocalStorage` utilized for saving user-created routes or UI preferences.
* **Data Format:** Strict JSON for the data layer (`/data/systems.json`).
* **Backup:** Export/Download functionality for complex saved journey itineraries as JSON.

## 3. Data Communication Contract

* **Protocol:** Modular architecture. The logic is separated into distinct ES6 modules (`dataLoader.js`, `renderer.js`, `physics.js`, `ui.js`, `interaction.js`) that communicate via ES6 imports/exports and a centralized orchestrator (`app.js`).

## 4. Library White-list

* **Three.js (WebGL):** Core 3D rendering engine.
* **OrbitControls (Three.js add-on):** For camera manipulation (pan, zoom, rotate).

# Project Anti-Gravity (Nav-Computer) - Project Instance

## 1. Project Summary

* **Name:** Project Anti-Gravity (Nav-Computer)
* **Description:** A browser-based, 3D interactive stellar navigation and journey-planning application for the Ondari Empire. It visualizes the 40-light-year local stellar neighborhood and calculates relativistic travel times based on constant-acceleration continuous-burn drives.
* **Key Features:** * **3D Interactive Starmap:** Fully navigable 3D rendering of the 40-LY sphere with raycast interaction for querying stellar data.
* **Relativistic Journey Planner:** Dynamically calculates objective and subjective travel times across multi-waypoint routes, factoring in variable G-force drives and time dilation.
* **Segmented Route Rendering:** Visually generates 3D route lines between stars, color-coded to represent acceleration, cruise, and deceleration phases.



## 2. Feature Modules

* **Module A: Data Loader (`dataLoader.js`)** – Fetches and parses the external `systems.json` file securely asynchronously.
* **Module B: Renderer Engine (`renderer.js`)** – Manages the Three.js scene, camera, meshes, background sphere, and dynamically renders the 3D route lines and segments.
* **Module C: Physics Engine (`physics.js`)** – Handles the complex 3D math and relativistic algorithms (distance calculation, time dilation, phase duration).
* **Module D: Interaction Controller (`interaction.js`)** – Manages Three.js Raycasting for hover states, click events, and the logic required to drag pinned info cards around the viewport.
* **Module E: UI Controller (`ui.js`)** – Handles all DOM manipulation, journey planner form inputs, displaying outputs, and toggling the glassmorphism data cards.

## 3. User Stories

* **Story 1:** As a user, I want to freely rotate, pan, and zoom the 3D starmap, so that I can explore the spatial relationships of the empire visually.
* **Story 2:** As a user, I want to hover over a star to see a transient info card, and click it to pin the card so that I can reference its data while moving the map.
* **Story 3:** As a user, I want to select a start point, end point, and intermediate waypoints, so that I can plan a complex, multi-leg journey.
* **Story 4:** As a user, I want to input my drive's acceleration rate (in Gs), the maximum Cruise Speed (absolute upper limmit it 99.99999c) and any layover/pause times at waypoints, so that the calculator gives me precise Subjective and Objective travel times.
* **Story 5:** As a user, I want to see the calculated route drawn as a line on the 3D map, divided into distinct colors for acceleration, cruise, and deceleration, so that I understand the flight profile.

## 4. UI/UX Design

* **Theme & Styling:** "Futuristic Glassmorphism." The interface mimics an advanced holographic heads-up display.
* **Component Specifics:** * Backgrounds use semi-transparent dark colors with `backdrop-filter: blur(10px)`.
* Subtle glowing borders (e.g., cyan/blue glows) and crisp, minimalist sans-serif typography.
* Star meshes are color-coded based on type (e.g., Habitable Hub vs. Industrial).
* Dynamic route lines use distinct segment colors: Acceleration (Orange/Red), Cruise (Blue/Cyan), Deceleration (Orange/Red).


* **Page Layout:** Full-screen WebGL canvas with an absolutely positioned UI overlay. Pinned data cards are free-floating and draggable.

## 5. Technical Specifics & Guardrails

* **Layout & Positioning:** CSS Grid/Flexbox for internal UI panel alignment. Data cards must use calculated `transform: translate()` for dragging performance, avoiding expensive top/left repaints.
* **Data Integrity:** Waypoint inputs must be validated to ensure the system exists in the dataset before running physical calculations.
* **Performance:** Ensure Three.js animation loop only renders when the camera moves or when routes are actively being generated to save browser resources. Raycaster should throttle mousemove events to prevent lag.
* **State Management:** Route calculation state (current G-force, selected waypoints) must act as a single source of truth within `app.js` and push updates down to the UI and Renderer.

## 6. Boundary Conditions & Edge Cases

* **Short Journeys (The Turnover Catch):** If a distance is too short for the ship to reach 0.99c at the requested G-force, the physics engine must recognize this, skip the cruise phase, calculate a mid-point turnover, and instruct the renderer to only draw Acceleration and Deceleration line colors.
* **Empty States:** The Journey Planner UI must cleanly display "Awaiting Input..." or equivalent if no route is plotted.
* **Out of Bounds Drags:** Pinned data cards must be constrained within the `window.innerWidth` and `innerHeight` to prevent them from being lost off-screen.
* **Invalid G-Force:** Form inputs for Drive Output must be clamped (e.g., minimum 0.1G, maximum 100G) to prevent broken calculations or divide-by-zero errors.

## 7. Project-Specific Logic or Data Structures

* **Logic A: Relativistic Physics Engine**
* Calculates 3D distance: $d = \sqrt{(x_2-x_1)^2 + (y_2-y_1)^2 + (z_2-z_1)^2}$.
* Constants: $c = 1.0$, $vm_{absolute_max} = 0.9999999c$, $1G = 1.03 LY/Y^2$. Time Dilation ($\gamma$) at $0.99c \approx 7.09$.
* Calculates Phase Distances ($d_{acc}$, $d_{cruise}$, $d_{dec}$) and times ($t_{obj}$, $t_{subj}$). Passes exact distance ratios back to the Renderer to map texture/color segments accurately along the Three.js route line.
* For multi-waypoint journeys, calculates each leg as a "rest-to-rest" sequence, summing the outputs and adding user-defined Layover Time to the total.


* **Dataset A: `systems.json` Schema**
```json
[
  {
    "id": "sys_001",
    "name": "Aethelgard Prime",
    "coordinates": { "x": 0.0, "y": 0.0, "z": 0.0 },
    "type": "Habitable Hub",
    "colonyCount": 3,
    "stellarType": "G2V (Yellow Dwarf)",
    "description": "The Imperial Capital system."
  }
]

```