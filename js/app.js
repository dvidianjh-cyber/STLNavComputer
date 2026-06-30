/**
 * @file app.js
 * @description Central orchestrator. Manages application state and wires all modules.
 * @module app
 * Last Modified: 2026-06-30 (v0.2.0)
 */

import { loadSystems, loadVersion }   from './dataLoader.js';
import { calculateRoute }             from './physics.js';
import * as renderer                  from './renderer.js';
import { init as initInteraction }    from './interaction.js';
import * as ui                        from './ui.js';

// ─── Application State ───────────────────────────────────────────
// Single source of truth. Modules receive data; they do not hold state.

/**
 * @type {{
 *   systems:          import('./dataLoader.js').System[],
 *   mapName:          string,
 *   mapDescription:   string,
 *   selectedSystem:   import('./dataLoader.js').System | null,
 *   hiddenLabelTypes: Set<string>,
 *   currentRoute:     import('./physics.js').RouteResult | null
 * }}
 */
const state = {
    systems:          [],
    mapName:          '',
    mapDescription:   '',
    selectedSystem:   null,
    hiddenLabelTypes: new Set(),
    currentRoute:     null,
};

// ─── Bootstrap ───────────────────────────────────────────────────

/**
 * Boots the application: loads data, initialises all subsystems, hides loader.
 */
async function bootstrap() {
    ui.setLoading(true);

    try {
        // 1. Load stellar data and version in parallel
        const [mapData, version] = await Promise.all([
            loadSystems('./data/systems.json'),
            loadVersion('./package.json'),
        ]);

        state.systems        = mapData.systems;
        state.mapName        = mapData.mapName;
        state.mapDescription = mapData.mapDescription;
        state.selectedSystem = mapData.systems[0] ?? null;

        ui.setVersion(version);

        // 2. Initialise 3D scene
        const canvas = document.getElementById('starmap-canvas');
        renderer.initScene(canvas);

        // 3. Populate stars (also builds labels & dynamic grid)
        const starMeshes = renderer.loadStars(state.systems);

        // 4. Set initial highlight sphere position to first system
        if (state.selectedSystem) {
            renderer.setSelectedSystem(state.selectedSystem);
        }

        // 5. Attach interaction handlers
        initInteraction(starMeshes, {
            onHover:      _onStarHover,
            onHoverClear: _onStarHoverClear,
            onClick:      _onStarClick,
        });

        // 6. Initialise UI (form, cards, results, current-system panel, map key)
        ui.init(state.systems, {
            onCalculate:    _onCalculate,
            onClearRoute:   _onClearRoute,
            onSystemSelect: _onSystemSelect,
            onLabelToggle:  _onLabelToggle,
            onCenterView:   _onCenterView,
        }, state.selectedSystem);

        // 7. Push map metadata to header
        ui.setMapMeta(state.mapName, state.mapDescription);

        // 8. Set up tether projection and subscribe to view-change events
        ui.refreshTethers(renderer.worldToScreen);
        renderer.getControls().addEventListener('change', () => ui.refreshTethers());
        window.addEventListener('resize',               () => ui.refreshTethers());

        // Done
        ui.setLoading(false);

    } catch (error) {
        console.error('[Nav-Computer] Bootstrap failed:', error);
        _showFatalError(error.message);
    }
}

// ─── Interaction Callbacks ───────────────────────────────────────

/**
 * Star hover — shows the transient tooltip.
 * @param {import('./dataLoader.js').System} system
 * @param {{ x: number, y: number }} screenPos
 */
function _onStarHover(system, screenPos) {
    ui.showHoverCard(system, screenPos);
}

/**
 * Star hover clear — hides the tooltip.
 */
function _onStarHoverClear() {
    ui.hideHoverCard();
}

/**
 * Star click — pins a system info card.
 * @param {import('./dataLoader.js').System} system
 * @param {{ x: number, y: number }} screenPos
 */
function _onStarClick(system, screenPos) {
    ui.pinCard(system, screenPos);
}

// ─── Current System Callbacks ────────────────────────────────────

/**
 * System selected from dropdown — updates state and moves the highlight sphere.
 * @param {import('./dataLoader.js').System} system
 */
function _onSystemSelect(system) {
    state.selectedSystem = system;
    renderer.setSelectedSystem(system);
}

/**
 * Label type toggled in the Map Key — updates the hidden-types set and re-filters labels.
 * @param {string}  type    - System type string (e.g. "Unexplored").
 * @param {boolean} visible - Whether labels of this type should be shown.
 */
function _onLabelToggle(type, visible) {
    if (visible) {
        state.hiddenLabelTypes.delete(type);
    } else {
        state.hiddenLabelTypes.add(type);
    }
    renderer.setHiddenLabelTypes(state.hiddenLabelTypes);
}

/**
 * Center-view button — snaps OrbitControls target to the selected system's coordinates.
 */
function _onCenterView() {
    if (!state.selectedSystem) return;
    renderer.centerOnSystem(state.selectedSystem);
}

// ─── Route Callbacks ─────────────────────────────────────────────

/**
 * Calculate route — runs physics, renders the route, updates results.
 * @param {{
 *   waypoints:        import('./dataLoader.js').System[],
 *   gForce:           number,
 *   maxCruise:        number,
 *   layoverYearsArray: number[]
 * }} params
 */
function _onCalculate({ waypoints, gForce, maxCruise, layoverYearsArray }) {
    state.currentRoute = calculateRoute(waypoints, gForce, maxCruise, layoverYearsArray);

    renderer.drawRoute(state.currentRoute);
    renderer.highlightRouteSystems(waypoints.map(s => s.id));
    ui.displayResults(state.currentRoute);
}

/**
 * Clear route — removes 3D geometry and resets UI.
 */
function _onClearRoute() {
    state.currentRoute = null;
    renderer.clearRoute();
    renderer.clearRouteHighlights();
}

// ─── Error Display ───────────────────────────────────────────────

/**
 * Renders a fatal error message in the loading overlay.
 * @param {string} message
 */
function _showFatalError(message) {
    const overlay = document.getElementById('loading-overlay');
    if (!overlay) return;

    overlay.style.opacity       = '1';
    overlay.style.pointerEvents = 'all';

    overlay.innerHTML = `
        <div class="loading-content">
            <p class="loading-title" style="color: #ff6b35;">⚠ SYSTEM FAILURE</p>
            <p class="loading-subtext">${message}</p>
            <p class="loading-subtext" style="margin-top: 0.5rem; color: rgba(0,212,255,0.5);">
                Serve via HTTP: <strong>npm run dev</strong>
            </p>
        </div>
    `;
}

// ─── Entry Point ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', bootstrap);
