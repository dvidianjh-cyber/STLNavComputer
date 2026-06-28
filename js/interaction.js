/**
 * @file interaction.js
 * @description Three.js raycasting for star hover/click events, plus draggable card logic.
 * @module interaction
 * Last Modified: 2026-06-28
 */

import * as THREE from 'three';
import { getCamera, getRendererInstance, setHoveredStar, markDirty } from './renderer.js';

// ─── Module State ────────────────────────────────────────────────

const raycaster = new THREE.Raycaster();
const mouse     = new THREE.Vector2();

/** @type {Array<{mesh: THREE.Mesh, system: object}>} */
let _starMeshes = [];

/** @type {{ onHover: Function, onHoverClear: Function, onClick: Function }} */
let _callbacks  = {};

/** Throttle gate — prevents redundant raycast calls on every pixel. */
let _throttleTimer = null;
const THROTTLE_MS  = 16;

/** Tracks the currently hovered mesh to avoid redundant callbacks. */
let _currentHovered = null;

// ─── Public API ──────────────────────────────────────────────────

/**
 * Initialises the interaction controller and attaches DOM event listeners.
 * @param {Array<{mesh: THREE.Mesh, system: object}>} starMeshes - From renderer.loadStars().
 * @param {{
 *   onHover:      (system: object, screenPos: {x:number, y:number}) => void,
 *   onHoverClear: () => void,
 *   onClick:      (system: object, screenPos: {x:number, y:number}) => void
 * }} callbacks
 */
export function init(starMeshes, callbacks) {
    _starMeshes = starMeshes;
    _callbacks  = callbacks;

    const canvas = getRendererInstance().domElement;
    canvas.addEventListener('mousemove', _onMouseMove);
    canvas.addEventListener('click',     _onMouseClick);
}

/**
 * Replaces the star mesh array (called if the dataset is reloaded).
 * @param {Array<{mesh: THREE.Mesh, system: object}>} starMeshes
 */
export function updateMeshes(starMeshes) {
    _starMeshes = starMeshes;
}

// ─── Private Handlers ─────────────────────────────────────────────

/**
 * Throttled mousemove handler — performs a raycast and fires hover callbacks.
 * @param {MouseEvent} event
 */
function _onMouseMove(event) {
    if (_throttleTimer) return;
    _throttleTimer = setTimeout(() => { _throttleTimer = null; }, THROTTLE_MS);

    _updateMouse(event);
    const hit = _getIntersectedStar();

    if (hit) {
        if (hit.mesh !== _currentHovered) {
            _currentHovered = hit.mesh;
            setHoveredStar(hit.mesh);
            _callbacks.onHover?.(hit.system, _toScreenPos(hit.mesh.position));
        }
        document.body.style.cursor = 'pointer';
    } else {
        if (_currentHovered !== null) {
            _currentHovered = null;
            setHoveredStar(null);
            _callbacks.onHoverClear?.();
        }
        document.body.style.cursor = 'default';
    }
}

/**
 * Click handler — pins a system info card for the clicked star.
 * @param {MouseEvent} event
 */
function _onMouseClick(event) {
    _updateMouse(event);
    const hit = _getIntersectedStar();
    if (hit) {
        _callbacks.onClick?.(hit.system, _toScreenPos(hit.mesh.position));
    }
}

// ─── Private Helpers ─────────────────────────────────────────────

/**
 * Updates the normalised device coordinates of the mouse.
 * @param {MouseEvent} event
 */
function _updateMouse(event) {
    mouse.x =  (event.clientX / window.innerWidth)  * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
}

/**
 * Performs a raycast against all star meshes (ignoring child glow halos).
 * @returns {{ mesh: THREE.Mesh, system: object } | null}
 */
function _getIntersectedStar() {
    raycaster.setFromCamera(mouse, getCamera());
    const coreMeshes = _starMeshes.map(s => s.mesh);
    const hits       = raycaster.intersectObjects(coreMeshes, false);
    if (hits.length === 0) return null;
    const hitMesh = hits[0].object;
    return _starMeshes.find(s => s.mesh === hitMesh) ?? null;
}

/**
 * Projects a Three.js world-space position into 2D screen coordinates.
 * @param {THREE.Vector3} worldPos
 * @returns {{ x: number, y: number }}
 */
function _toScreenPos(worldPos) {
    const projected = worldPos.clone().project(getCamera());
    return {
        x: Math.round((projected.x + 1) / 2 * window.innerWidth),
        y: Math.round((-projected.y + 1) / 2 * window.innerHeight),
    };
}
