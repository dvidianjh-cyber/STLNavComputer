/**
 * @file renderer.js
 * @description Three.js scene management — stars, background starfield, route lines.
 * @module renderer
 * Last Modified: 2026-06-28
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';

// ─── Constants ──────────────────────────────────────────────────

/** @type {Record<string, number>} Star mesh colour by system type. */
const STAR_COLORS = {
    'Habitable Hub':       0x4fc3f7,
    'Industrial/Mining':   0xffa726,
    'Scientific Anomaly':  0xce93d8,
};

/** @type {Record<string, number>} Route segment colour by flight phase. */
const PHASE_COLORS = {
    acc:    0xff6b35,
    cruise: 0x00d4ff,
    dec:    0xff6b35,
};

const STAR_BASE_RADIUS  = 0.28;
const CAPITAL_SYSTEM_ID = 'sys_001';
const HOVER_SCALE       = 1.9;
const ROUTE_SCALE       = 1.5;

// ─── Module-level State ─────────────────────────────────────────

/** @type {THREE.Scene} */
let scene;
/** @type {THREE.PerspectiveCamera} */
let camera;
/** @type {OrbitControls} */
let controls;
/** @type {THREE.Group} */
let starGroup;
/** @type {THREE.Group} */
let routeGroup;
/** @type {Array<{mesh: THREE.Mesh, system: object}>} */
let starMeshes = [];
/** @type {THREE.Object3D[]} */
let routeObjects = [];
/** @type {LineMaterial[]} */
let lineMaterials = [];
/** @type {boolean} */
let needsRender = true;
/** @type {THREE.WebGLRenderer} */
let _renderer;

// ─── Public API ──────────────────────────────────────────────────

/**
 * Signals that the scene should be re-rendered on the next animation frame.
 */
export function markDirty() {
    needsRender = true;
}

/**
 * Initialises the Three.js scene, camera, WebGL renderer, controls, and lighting.
 * @param {HTMLCanvasElement} canvas
 */
export function initScene(canvas) {
    // Scene
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x000a1a, 0.0045);

    // Camera
    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 600);
    camera.position.set(18, 28, 78);
    camera.lookAt(0, 0, 0);

    // Renderer
    _renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    _renderer.setSize(window.innerWidth, window.innerHeight);
    _renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    _renderer.setClearColor(0x000a1a, 1);

    // OrbitControls
    controls = new OrbitControls(camera, _renderer.domElement);
    controls.enableDamping  = true;
    controls.dampingFactor  = 0.055;
    controls.minDistance    = 4;
    controls.maxDistance    = 260;
    controls.addEventListener('change', markDirty);

    // Lighting
    scene.add(new THREE.AmbientLight(0x1a2a4a, 1.2));
    const keyLight = new THREE.PointLight(0x4488cc, 2.0, 150);
    keyLight.position.set(10, 20, 10);
    scene.add(keyLight);

    // Groups
    starGroup  = new THREE.Group();
    routeGroup = new THREE.Group();
    scene.add(starGroup);
    scene.add(routeGroup);

    // Background & grid
    scene.add(_buildStarfield());
    scene.add(_buildGrid());

    // Resize
    window.addEventListener('resize', _handleResize);

    // Render loop
    _startLoop();
}

/**
 * Returns the active Three.js camera.
 * @returns {THREE.PerspectiveCamera}
 */
export function getCamera() { return camera; }

/**
 * Returns the active Three.js WebGLRenderer.
 * @returns {THREE.WebGLRenderer}
 */
export function getRendererInstance() { return _renderer; }

/**
 * Creates star meshes for all systems and adds them to the scene.
 * @param {import('./dataLoader.js').System[]} systems
 * @returns {Array<{mesh: THREE.Mesh, system: object}>}
 */
export function loadStars(systems) {
    starGroup.clear();
    starMeshes = [];

    systems.forEach(system => {
        const color   = STAR_COLORS[system.type] ?? 0xffffff;
        const isCapital = system.id === CAPITAL_SYSTEM_ID;
        const radius  = isCapital ? STAR_BASE_RADIUS * 1.65 : STAR_BASE_RADIUS;

        // Core mesh
        const geo  = new THREE.SphereGeometry(radius, 16, 12);
        const mat  = new THREE.MeshBasicMaterial({ color });
        const mesh = new THREE.Mesh(geo, mat);

        const { x, y, z } = system.coordinates;
        mesh.position.set(x, y, z);
        mesh.userData.systemId = system.id;
        mesh.userData.system   = system;

        // Glow halo
        const glowGeo = new THREE.SphereGeometry(radius * 3.0, 16, 12);
        const glowMat = new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity:     isCapital ? 0.12 : 0.07,
            depthWrite:  false,
        });
        mesh.add(new THREE.Mesh(glowGeo, glowMat));

        starGroup.add(mesh);
        starMeshes.push({ mesh, system });
    });

    markDirty();
    return starMeshes;
}

/**
 * Returns the current list of star mesh-system pairs (for raycasting).
 * @returns {Array<{mesh: THREE.Mesh, system: object}>}
 */
export function getStarMeshes() { return starMeshes; }

/**
 * Applies hover highlight to a star mesh, clearing any previous highlight.
 * Pass null to clear without setting a new one.
 * @param {THREE.Mesh|null} mesh
 */
export function setHoveredStar(mesh) {
    // Clear previous
    starMeshes.forEach(({ mesh: m }) => {
        if (!m.userData.routeHighlighted) m.scale.setScalar(1);
    });

    if (mesh) {
        mesh.scale.setScalar(HOVER_SCALE);
    }
    markDirty();
}

/**
 * Scales up stars that are part of the active route.
 * @param {string[]} systemIds
 */
export function highlightRouteSystems(systemIds) {
    const idSet = new Set(systemIds);
    starMeshes.forEach(({ mesh }) => {
        const inRoute = idSet.has(mesh.userData.systemId);
        mesh.userData.routeHighlighted = inRoute;
        mesh.scale.setScalar(inRoute ? ROUTE_SCALE : 1);
    });
    markDirty();
}

/**
 * Removes all route highlights from star meshes.
 */
export function clearRouteHighlights() {
    starMeshes.forEach(({ mesh }) => {
        mesh.userData.routeHighlighted = false;
        mesh.scale.setScalar(1);
    });
    markDirty();
}

/**
 * Draws the calculated route on the 3D map with colour-coded phase segments.
 * @param {import('./physics.js').RouteResult} routeResult
 */
export function drawRoute(routeResult) {
    clearRoute();

    routeResult.legs.forEach(leg => {
        const start = new THREE.Vector3(
            leg.from.coordinates.x,
            leg.from.coordinates.y,
            leg.from.coordinates.z,
        );
        const end = new THREE.Vector3(
            leg.to.coordinates.x,
            leg.to.coordinates.y,
            leg.to.coordinates.z,
        );

        let fractionSoFar = 0;

        leg.phases.forEach(phase => {
            const endFraction = fractionSoFar + phase.fraction;
            const segStart    = start.clone().lerp(end, fractionSoFar);
            const segEnd      = start.clone().lerp(end, endFraction);

            const lineGeo = new LineGeometry();
            lineGeo.setPositions([
                segStart.x, segStart.y, segStart.z,
                segEnd.x,   segEnd.y,   segEnd.z,
            ]);

            const lineMat = new LineMaterial({
                color:     PHASE_COLORS[phase.type],
                linewidth: phase.type === 'cruise' ? 3.0 : 2.5,
                resolution: new THREE.Vector2(window.innerWidth, window.innerHeight),
            });

            const line = new Line2(lineGeo, lineMat);
            line.computeLineDistances();
            routeGroup.add(line);
            routeObjects.push(line);
            lineMaterials.push(lineMat);

            fractionSoFar = endFraction;
        });
    });

    markDirty();
}

/**
 * Removes all route geometry from the scene and disposes GPU resources.
 */
export function clearRoute() {
    routeObjects.forEach(obj => {
        routeGroup.remove(obj);
        if (obj.geometry) obj.geometry.dispose();
    });
    lineMaterials.forEach(m => m.dispose());
    routeObjects  = [];
    lineMaterials = [];
    markDirty();
}

// ─── Private Helpers ─────────────────────────────────────────────

/**
 * Builds a procedurally generated starfield on an inverted sphere.
 * No external assets required — entirely canvas-generated.
 * @returns {THREE.Mesh}
 */
function _buildStarfield() {
    const cvs = document.createElement('canvas');
    cvs.width  = 2048;
    cvs.height = 1024;
    const ctx = cvs.getContext('2d');

    ctx.fillStyle = '#000a1a';
    ctx.fillRect(0, 0, cvs.width, cvs.height);

    for (let i = 0; i < 7000; i++) {
        const x          = Math.random() * cvs.width;
        const y          = Math.random() * cvs.height;
        const r          = Math.random() * 1.3 + 0.2;
        const brightness = Math.floor(Math.random() * 140 + 115);
        const blue       = Math.floor(Math.random() * 40 + 215);
        const alpha      = (Math.random() * 0.55 + 0.45).toFixed(2);
        ctx.fillStyle = `rgba(${brightness},${brightness},${blue},${alpha})`;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
    }

    // A few larger bright stars for depth
    for (let i = 0; i < 40; i++) {
        const x = Math.random() * cvs.width;
        const y = Math.random() * cvs.height;
        ctx.fillStyle = `rgba(255,255,255,${(Math.random() * 0.4 + 0.5).toFixed(2)})`;
        ctx.beginPath();
        ctx.arc(x, y, Math.random() * 2 + 1.5, 0, Math.PI * 2);
        ctx.fill();
    }

    const texture = new THREE.CanvasTexture(cvs);
    const geo     = new THREE.SphereGeometry(500, 32, 18);
    geo.scale(-1, 1, 1); // Invert normals so the texture faces inward
    return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: texture, side: THREE.BackSide }));
}

/**
 * Builds a subtle reference grid centred on the origin.
 * @returns {THREE.GridHelper}
 */
function _buildGrid() {
    const grid = new THREE.GridHelper(90, 18, 0x08203f, 0x08203f);
    grid.position.y = -0.05;
    return grid;
}

/**
 * Handles window resize — updates projection matrix, renderer size, and line resolutions.
 */
function _handleResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    _renderer.setSize(w, h);
    lineMaterials.forEach(m => m.resolution.set(w, h));
    markDirty();
}

/**
 * Starts the render loop. Renders only when `needsRender` is true (dirty-flag pattern).
 * OrbitControls damping requires controls.update() every frame regardless.
 */
function _startLoop() {
    function animate() {
        requestAnimationFrame(animate);
        controls.update(); // Required for inertia/damping
        if (needsRender) {
            _renderer.render(scene, camera);
            needsRender = false;
        }
    }
    animate();
}
