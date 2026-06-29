/**
 * @file ui.js
 * @description All DOM manipulation: journey planner, results, hover tooltips, pinned cards.
 * @module ui
 * Last Modified: 2026-06-28
 */

import { formatTime } from './physics.js';

// ─── Module State ────────────────────────────────────────────────

/** @type {import('./dataLoader.js').System[]} */
let _systems = [];

/** @type {{ onCalculate: Function, onClearRoute: Function }} */
let _callbacks = {};

/**
 * Each entry tracks one stop in the flight plan.
 * @type {Array<{ stopId: string, systemId: string, layoverYears: number }>}
 */
let _stops = [];

let _stopCounter = 0;

/** Tracks pinned cards: systemId → HTMLElement */
const _pinnedCards = new Map();

let _topZIndex = 100;

// ─── Tether State ─────────────────────────────────────────────
/** Tracks active tether lines: systemId → { line: SVGLineElement, coords: {x,y,z} } */
const _tethers = new Map();
/** Coordinate projection function injected from app.js via refreshTethers() */
let _projectFn = null;

// ─── DOM Accessors ───────────────────────────────────────────────
// Use functions so they're always fresh (elements created after DOMContentLoaded).

const $id      = id  => document.getElementById(id);
const $overlay = ()  => $id('loading-overlay');
const $count   = ()  => $id('system-count');
const $stops   = ()  => $id('stops-list');
const $gForce  = ()  => $id('g-force-input');
const $cruise  = ()  => $id('cruise-speed-input');
const $calcBtn = ()  => $id('btn-calculate');
const $clearBtn= ()  => $id('btn-clear-route');
const $tooltip = ()  => $id('hover-tooltip');
const $cards   = ()  => $id('cards-container');
const $tether  = ()  => $id('tether-layer');

// ─── Public API ──────────────────────────────────────────────────

/**
 * Initialises the UI with loaded systems and wires up all event listeners.
 * @param {import('./dataLoader.js').System[]} systems
 * @param {{
 *   onCalculate:  (params: object) => void,
 *   onClearRoute: () => void
 * }} callbacks
 */
export function init(systems, callbacks) {
    _systems   = systems;
    _callbacks = callbacks;

    // Populate <datalist> for reference (future use)
    const dl = $id('systems-datalist');
    systems.forEach(sys => {
        const opt      = document.createElement('option');
        opt.value      = sys.name;
        opt.dataset.id = sys.id;
        dl.appendChild(opt);
    });

    // Build initial two stops (Origin + Destination)
    _appendStop('ORIGIN',      false);
    _appendStop('DESTINATION', false);

    // Wire up buttons
    $id('btn-add-stop').addEventListener('click', _addIntermediateStop);
    $calcBtn().addEventListener('click', _handleCalculate);
    $clearBtn().addEventListener('click', _handleClear);

    // Wire collapse toggle
    const collapseBtn = $id('btn-collapse-planner');
    const planner     = $id('panel-planner');
    if (collapseBtn && planner) {
        collapseBtn.addEventListener('click', () => {
            const collapsed = planner.classList.toggle('is-collapsed');
            collapseBtn.setAttribute('aria-expanded', String(!collapsed));
        });
    }

    // Clamp G-force input on blur/change
    $gForce().addEventListener('change', () => {
        const v = parseFloat($gForce().value);
        $gForce().value = Math.max(0.1, Math.min(100, isNaN(v) ? 1.0 : v)).toFixed(1);
    });

    // Clamp cruise input on blur/change
    $cruise().addEventListener('change', () => {
        const v = parseFloat($cruise().value);
        $cruise().value = Math.max(0.1, Math.min(99.99999, isNaN(v) ? 99.0 : v)).toFixed(3);
    });

    setSystemCount(systems.length);
}

/**
 * Updates the charted-system count badge in the header.
 * @param {number} n
 */
export function setSystemCount(n) {
    const el = $count();
    if (el) el.textContent = n;
}

/**
 * Sets the version badge text in the bottom-right corner.
 * Version is read from package.json at runtime — no duplicate constants.
 * @param {string} version - e.g. "0.1.1"
 */
export function setVersion(version) {
    const el = $id('version-badge');
    if (el) el.textContent = `v${version}`;
}

/**
 * Shows or hides the loading overlay.
 * @param {boolean} visible
 */
export function setLoading(visible) {
    const overlay = $overlay();
    if (!overlay) return;
    if (visible) {
        overlay.style.opacity        = '1';
        overlay.style.pointerEvents  = 'all';
    } else {
        overlay.style.opacity        = '0';
        overlay.style.pointerEvents  = 'none';
    }
}

// ─── Stops List ─────────────────────────────────────────────────

/**
 * Appends a new stop row to the end of the stops list.
 * @param {string}  label     - Display label ('ORIGIN', 'DESTINATION', or 'STOP N').
 * @param {boolean} removable - Whether to render a remove button.
 * @returns {string} The unique stopId created.
 */
function _appendStop(label, removable) {
    const stopId = `stop-${_stopCounter++}`;
    _stops.push({ stopId, systemId: '', layoverYears: 0 });
    const el = _buildStopElement(stopId, label, removable);
    $stops().appendChild(el);
    return stopId;
}

/**
 * Inserts an intermediate stop row before the destination (last stop).
 */
function _addIntermediateStop() {
    const stopId = `stop-${_stopCounter++}`;
    // Insert into state array before last entry
    _stops.splice(_stops.length - 1, 0, { stopId, systemId: '', layoverYears: 0 });

    const stopNumber = _stops.length - 2;
    const el         = _buildStopElement(stopId, `STOP ${stopNumber}`, true);

    const destEl = $stops().lastElementChild;
    $stops().insertBefore(el, destEl);
    _renumberIntermediateStops();
}

/**
 * Builds a stop row DOM element.
 * @param {string}  stopId
 * @param {string}  label
 * @param {boolean} removable
 * @returns {HTMLDivElement}
 */
function _buildStopElement(stopId, label, removable) {
    const div = document.createElement('div');
    div.className       = `stop-item${removable ? ' stop-intermediate' : ''}`;
    div.dataset.stopId  = stopId;
    div.setAttribute('role', 'listitem');

    // Label
    const labelEl = document.createElement('span');
    labelEl.className   = 'stop-label';
    labelEl.textContent = label;
    div.appendChild(labelEl);

    // Select
    const select = document.createElement('select');
    select.className    = 'stop-select';
    select.id           = `${stopId}-select`;
    select.setAttribute('aria-label', `${label} system`);

    const defaultOpt    = document.createElement('option');
    defaultOpt.value    = '';
    defaultOpt.textContent = '— SELECT —';
    select.appendChild(defaultOpt);

    _systems.forEach(sys => {
        const opt       = document.createElement('option');
        opt.value       = sys.id;
        opt.textContent = sys.name;
        select.appendChild(opt);
    });

    select.addEventListener('change', () => {
        const entry = _stops.find(s => s.stopId === stopId);
        if (entry) entry.systemId = select.value;
        _validateForm();
    });
    div.appendChild(select);

    // Remove button (intermediate only) + per-waypoint layover input
    if (removable) {
        const removeBtn       = document.createElement('button');
        removeBtn.className   = 'btn-remove-stop';
        removeBtn.title       = 'Remove this stop';
        removeBtn.textContent = '×';
        removeBtn.setAttribute('aria-label', 'Remove stop');
        // Stop propagation so the drag handler on the parent card cannot capture this click
        removeBtn.addEventListener('pointerdown', e => e.stopPropagation());
        removeBtn.addEventListener('click', () => _removeStop(stopId, div));
        div.appendChild(removeBtn);

        // ── Layover sub-row (spans all grid columns) ──
        const layoverRow = document.createElement('div');
        layoverRow.className = 'stop-layover-row';

        const layoverLabel       = document.createElement('span');
        layoverLabel.className   = 'stop-layover-label';
        layoverLabel.textContent = 'LAYOVER';
        layoverRow.appendChild(layoverLabel);

        const layoverInput         = document.createElement('input');
        layoverInput.type          = 'number';
        layoverInput.className     = 'stop-layover-input';
        layoverInput.min           = '0';
        layoverInput.step          = '0.1';
        layoverInput.value         = '0';
        layoverInput.setAttribute('aria-label', 'Layover time in years at this stop');
        layoverInput.addEventListener('change', () => {
            const entry = _stops.find(s => s.stopId === stopId);
            if (entry) entry.layoverYears = Math.max(0, parseFloat(layoverInput.value) || 0);
        });
        layoverRow.appendChild(layoverInput);

        const layoverUnit       = document.createElement('span');
        layoverUnit.className   = 'stop-layover-unit';
        layoverUnit.textContent = 'YRS';
        layoverRow.appendChild(layoverUnit);

        div.appendChild(layoverRow);
    }

    return div;
}

/**
 * Removes an intermediate stop from state and the DOM.
 * @param {string}      stopId
 * @param {HTMLElement} el
 */
function _removeStop(stopId, el) {
    _stops = _stops.filter(s => s.stopId !== stopId);
    el.remove();
    _renumberIntermediateStops();
    _validateForm();
}

/**
 * Renumbers intermediate stop labels after an add or remove.
 */
function _renumberIntermediateStops() {
    const intermediates = $stops().querySelectorAll('.stop-intermediate .stop-label');
    intermediates.forEach((el, idx) => { el.textContent = `STOP ${idx + 1}`; });
}

/**
 * Enables or disables the Calculate button based on form completeness.
 */
function _validateForm() {
    const allSet = _stops.length >= 2 && _stops.every(s => s.systemId !== '');
    $calcBtn().disabled = !allSet;
}

/**
 * Programmatically sets the selected system for a given stop index.
 * Index 0 = Origin, -1 = Destination, positive integers = intermediate stops.
 * Called from pinned card buttons.
 *
 * @param {number} stopIndex
 * @param {string} systemId
 */
export function setStopSystem(stopIndex, systemId) {
    const resolvedIndex = stopIndex === -1 ? _stops.length - 1 : stopIndex;
    if (resolvedIndex < 0 || resolvedIndex >= _stops.length) return;

    _stops[resolvedIndex].systemId = systemId;
    const { stopId } = _stops[resolvedIndex];
    const select     = $id(`${stopId}-select`);
    if (select) select.value = systemId;
    _validateForm();
}

// ─── Button Handlers ─────────────────────────────────────────────

/**
 * Reads form values, resolves system objects, and fires the onCalculate callback.
 */
function _handleCalculate() {
    // Resolve each stop to its system, preserving layover values in parallel
    const resolved = _stops
        .map(s => ({ sys: _systems.find(sys => sys.id === s.systemId), layover: s.layoverYears ?? 0 }))
        .filter(r => r.sys);

    if (resolved.length < 2) return;

    const waypointSystems  = resolved.map(r => r.sys);
    const layoverYearsArray = resolved.map(r => r.layover);
    const gForce    = parseFloat($gForce().value) || 1.0;
    const maxCruise = parseFloat($cruise().value) || 99.0;

    _callbacks.onCalculate?.({ waypoints: waypointSystems, gForce, maxCruise, layoverYearsArray });
}

/**
 * Clears the route and resets the results panel.
 */
function _handleClear() {
    $clearBtn().style.display = 'none';
    resetResults();
    _callbacks.onClearRoute?.();
}

// ─── Hover Tooltip ───────────────────────────────────────────────

/**
 * Shows the transient hover tooltip near a star.
 * @param {import('./dataLoader.js').System} system
 * @param {{ x: number, y: number }} screenPos
 */
export function showHoverCard(system, screenPos) {
    const tooltip = $tooltip();

    const typeClass = _typeClass(system.type);
    tooltip.innerHTML = `
        <div class="tooltip-name">${system.name}</div>
        <div class="tooltip-type ${typeClass}">${system.type}</div>
        <div class="tooltip-stellar">${system.stellarType}</div>
        <div class="tooltip-coords">
            <span>X: ${system.coordinates.x.toFixed(1)}</span>
            <span>Y: ${system.coordinates.y.toFixed(1)}</span>
            <span>Z: ${system.coordinates.z.toFixed(1)}</span>
        </div>
        <div class="tooltip-hint">Click to pin ▸</div>
    `;

    // Temporarily reveal to measure, then position
    tooltip.style.display    = 'block';
    tooltip.style.visibility = 'hidden';
    const tw = tooltip.offsetWidth;
    const th = tooltip.offsetHeight;
    tooltip.style.visibility = 'visible';

    const OFFSET = 16;
    let x = screenPos.x + OFFSET;
    let y = screenPos.y + OFFSET;
    if (x + tw > window.innerWidth  - 8) x = screenPos.x - tw - OFFSET;
    if (y + th > window.innerHeight - 8) y = screenPos.y - th - OFFSET;
    x = Math.max(4, x);
    y = Math.max(4, y);

    tooltip.style.left = `${x}px`;
    tooltip.style.top  = `${y}px`;
}

/**
 * Hides the hover tooltip.
 */
export function hideHoverCard() {
    $tooltip().style.display = 'none';
}

// ─── Pinned Cards ────────────────────────────────────────────────

/**
 * Creates and displays a draggable, pinned system info card.
 * If the system is already pinned, brings the existing card to the front.
 *
 * @param {import('./dataLoader.js').System} system
 * @param {{ x: number, y: number }} screenPos
 */
export function pinCard(system, screenPos) {
    // Bring existing card to front if already pinned
    if (_pinnedCards.has(system.id)) {
        _pinnedCards.get(system.id).style.zIndex = ++_topZIndex;
        return;
    }

    const card      = document.createElement('div');
    card.className  = 'pinned-card';
    card.dataset.systemId = system.id;
    card.style.zIndex     = ++_topZIndex;

    const typeClass  = _typeClass(system.type);
    const colonyWord = system.colonyCount === 1 ? 'COLONY' : 'COLONIES';

    // Build card DOM
    const header = document.createElement('div');
    header.className = 'card-header';
    header.innerHTML = `
        <div class="card-title-group">
            <span class="card-name">${system.name}</span>
            <span class="card-id">${system.id}</span>
        </div>
        <button class="card-close" title="Close card" aria-label="Close">×</button>
    `;

    const body = document.createElement('div');
    body.className = 'card-body';
    body.innerHTML = `
        <span class="card-type-badge ${typeClass}">${system.type}</span>
        <div class="card-stellar">${system.stellarType}</div>
        <div class="card-desc">${system.description}</div>
        <div class="card-meta">
            <div class="card-coords">
                <span>X ${system.coordinates.x.toFixed(1)} LY</span>
                <span>Y ${system.coordinates.y.toFixed(1)} LY</span>
                <span>Z ${system.coordinates.z.toFixed(1)} LY</span>
            </div>
            <div class="card-colonies">⬡ ${system.colonyCount} ${colonyWord}</div>
        </div>
    `;

    const actions = document.createElement('div');
    actions.className = 'card-actions';

    const btnOrigin  = document.createElement('button');
    btnOrigin.className   = 'card-btn btn-set-origin';
    btnOrigin.textContent = 'SET ORIGIN';
    btnOrigin.setAttribute('aria-label', `Set ${system.name} as origin`);
    btnOrigin.addEventListener('click', () => setStopSystem(0, system.id));

    const btnDest   = document.createElement('button');
    btnDest.className    = 'card-btn btn-add-dest';
    btnDest.textContent  = 'SET DEST.';
    btnDest.setAttribute('aria-label', `Set ${system.name} as destination`);
    btnDest.addEventListener('click', () => setStopSystem(-1, system.id));

    actions.append(btnOrigin, btnDest);
    card.append(header, body, actions);

    // Initial position — constrained to viewport
    const CARD_W = 248;
    const CARD_H = 320;
    const x      = Math.max(0, Math.min(screenPos.x + 20, window.innerWidth  - CARD_W));
    const y      = Math.max(0, Math.min(screenPos.y,       window.innerHeight - CARD_H));
    card.style.transform = `translate(${x}px, ${y}px)`;

    // Close
    const closeBtn = header.querySelector('.card-close');
    closeBtn.addEventListener('pointerdown', e => e.stopPropagation()); // Bug fix: prevent drag capture
    closeBtn.addEventListener('click', () => {
        _destroyTether(system.id);
        card.remove();
        _pinnedCards.delete(system.id);
    });

    // Drag from header
    _makeDraggable(card, header, system.id);

    $cards().appendChild(card);
    _pinnedCards.set(system.id, card);

    // Create tether line linking the card to the star
    _createTether(system.id, system);
}

/**
 * Attaches pointer-based drag behaviour to a card, constrained to the viewport.
 * Uses transform: translate() exclusively to avoid expensive top/left repaints.
 *
 * @param {HTMLElement} card    - The card element to move.
 * @param {HTMLElement} handle  - The element that initiates the drag.
 */
function _makeDraggable(card, handle, systemId = null) {
    let dragging = false;
    let startPointerX, startPointerY, startTX, startTY;

    /** Parses current translateX/Y from the card's inline transform. */
    function _getCurrentTranslate() {
        const t     = card.style.transform;
        const match = t.match(/translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)/);
        return match
            ? { tx: parseFloat(match[1]), ty: parseFloat(match[2]) }
            : { tx: 0, ty: 0 };
    }

    handle.addEventListener('pointerdown', e => {
        // Don't initiate drag on close-button clicks
        if (e.target.closest('.card-close')) return;
        dragging     = true;
        startPointerX = e.clientX;
        startPointerY = e.clientY;
        const { tx, ty } = _getCurrentTranslate();
        startTX = tx;
        startTY = ty;
        card.style.zIndex = ++_topZIndex;
        card.setPointerCapture(e.pointerId);
        e.preventDefault();
    });

    card.addEventListener('pointermove', e => {
        if (!dragging) return;
        const dx   = e.clientX - startPointerX;
        const dy   = e.clientY - startPointerY;
        const cardW = card.offsetWidth;
        const cardH = card.offsetHeight;
        const newTX = Math.max(0, Math.min(window.innerWidth  - cardW, startTX + dx));
        const newTY = Math.max(0, Math.min(window.innerHeight - cardH, startTY + dy));
        card.style.transform = `translate(${newTX}px, ${newTY}px)`;
        // Update tether card-endpoint in real time
        if (systemId) _updateTetherLine(systemId);
    });

    card.addEventListener('pointerup',     () => { dragging = false; });
    card.addEventListener('pointercancel', () => { dragging = false; });
}

// ─── Results Display ─────────────────────────────────────────────

/**
 * Populates the bottom results strip with route calculation output.
 * @param {import('./physics.js').RouteResult} routeResult
 */
export function displayResults(routeResult) {
    const { totalObj, totalSubj, totalDistance } = routeResult;

    const objTime  = formatTime(totalObj);
    const subjTime = formatTime(totalSubj);
    const avgDilation = totalSubj > 0
        ? (totalObj / totalSubj).toFixed(2)
        : '1.00';

    $id('result-distance').textContent  = totalDistance.toFixed(2);
    $id('result-obj-time').textContent  = objTime.value;
    $id('result-obj-unit').textContent  = objTime.unit;
    $id('result-subj-time').textContent = subjTime.value;
    $id('result-subj-unit').textContent = subjTime.unit;
    $id('result-dilation').textContent  = `${avgDilation}×`;

    $clearBtn().style.display = 'block';
}

/**
 * Resets the results strip to its default "awaiting input" state.
 */
export function resetResults() {
    $id('result-distance').textContent  = '—';
    $id('result-obj-time').textContent  = 'AWAITING INPUT';
    $id('result-obj-unit').textContent  = '';
    $id('result-subj-time').textContent = '—';
    $id('result-subj-unit').textContent = '';
    $id('result-dilation').textContent  = '—';
}

// ─── Private Helpers ─────────────────────────────────────────────

/**
 * Maps a system type string to a CSS class name used for colour-coding.
 * @param {string} type
 * @returns {string}
 */
function _typeClass(type) {
    return `tooltip-type-${type.toLowerCase().replace(/[^a-z]+/g, '-')}`;
}

// ─── Tether System ─────────────────────────────────────────────

/**
 * Creates an SVG tether line between a pinned card and its origin star.
 * @param {string} systemId
 * @param {import('./dataLoader.js').System} system
 */
function _createTether(systemId, system) {
    const svg = $tether();
    if (!svg) return;
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('class', 'tether-line');
    svg.appendChild(line);
    _tethers.set(systemId, { line, coords: system.coordinates });
    _updateTetherLine(systemId);
}

/**
 * Removes the SVG tether line for a given system.
 * @param {string} systemId
 */
function _destroyTether(systemId) {
    const t = _tethers.get(systemId);
    if (t) {
        t.line.remove();
        _tethers.delete(systemId);
    }
}

/**
 * Returns the closest point on the card's bounding rectangle to (starX, starY).
 * This gives a clean closest-edge anchor for the tether line.
 * @param {HTMLElement} card
 * @param {number} starX
 * @param {number} starY
 * @returns {{ x: number, y: number }}
 */
function _getCardEdgePoint(card, starX, starY) {
    const t     = card.style.transform;
    const match = t.match(/translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)/);
    if (!match) return { x: starX, y: starY };
    const cardX  = parseFloat(match[1]);
    const cardY  = parseFloat(match[2]);
    const cardW  = card.offsetWidth  || 248;
    const cardH  = card.offsetHeight || 320;
    // Clamp the star position to the card rect — gives the nearest edge point
    const cx = Math.max(cardX, Math.min(cardX + cardW, starX));
    const cy = Math.max(cardY, Math.min(cardY + cardH, starY));
    return { x: cx, y: cy };
}

/**
 * Redraws the tether line for a single system using the stored star coords
 * and the current card position.
 * @param {string} systemId
 */
function _updateTetherLine(systemId) {
    const tether = _tethers.get(systemId);
    const card   = _pinnedCards.get(systemId);
    if (!tether || !card || !_projectFn) return;

    const sp        = _projectFn(tether.coords);
    const edgePoint = _getCardEdgePoint(card, sp.x, sp.y);

    tether.line.setAttribute('x1', sp.x);
    tether.line.setAttribute('y1', sp.y);
    tether.line.setAttribute('x2', edgePoint.x);
    tether.line.setAttribute('y2', edgePoint.y);
}

/**
 * Sets the coordinate projection function and refreshes all active tether lines.
 * Called once at init (with projectFn) and on every orbit/resize event (no arg).
 * @param {((coords: {x:number,y:number,z:number}) => {x:number,y:number}) | undefined} projectFn
 */
export function refreshTethers(projectFn) {
    if (projectFn) _projectFn = projectFn;
    if (!_projectFn) return;
    _tethers.forEach((_, systemId) => _updateTetherLine(systemId));
}
