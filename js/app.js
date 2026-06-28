/**
 * @file app.js
 * @description Central orchestrator. Manages application state and wires all modules.
 * @module app
 * Last Modified: 2026-06-28
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
 *   systems:      import('./dataLoader.js').System[],
 *   currentRoute: import('./physics.js').RouteResult | null
 * }}
 */
const state = {
    systems:      [],
    currentRoute: null,
};

// ─── Bootstrap ───────────────────────────────────────────────────

/**
 * Boots the application: loads data, initialises all subsystems, hides loader.
 */
async function bootstrap() {
    ui.setLoading(true);

    try {
        // 1. Load stellar data and version in parallel
        const [systems, version] = await Promise.all([
            loadSystems('./data/systems.json'),
            loadVersion('./package.json'),
        ]);
        state.systems = systems;
        ui.setVersion(version);

        // 2. Initialise 3D scene
        const canvas = document.getElementById('starmap-canvas');
        renderer.initScene(canvas);

        // 3. Populate stars
        const starMeshes = renderer.loadStars(state.systems);

        // 4. Attach interaction handlers
        initInteraction(starMeshes, {
            onHover:      _onStarHover,
            onHoverClear: _onStarHoverClear,
            onClick:      _onStarClick,
        });

        // 5. Initialise UI (form, cards, results)
        ui.init(state.systems, {
            onCalculate:  _onCalculate,
            onClearRoute: _onClearRoute,
        });

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

// ─── Route Callbacks ─────────────────────────────────────────────

/**
 * Calculate route — runs physics, renders the route, updates results.
 * @param {{
 *   waypoints:   import('./dataLoader.js').System[],
 *   gForce:      number,
 *   maxCruise:   number,
 *   layoverDays: number
 * }} params
 */
function _onCalculate({ waypoints, gForce, maxCruise, layoverDays }) {
    state.currentRoute = calculateRoute(waypoints, gForce, maxCruise, layoverDays);

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
