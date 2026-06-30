/**
 * @file dataLoader.js
 * @description Fetches and parses the stellar systems dataset via the Fetch API.
 * @module dataLoader
 * Last Modified: 2026-06-30 (v0.2.0)
 */

/**
 * @typedef {Object} Coordinates
 * @property {number} x
 * @property {number} y
 * @property {number} z
 */

/**
 * @typedef {Object} System
 * @property {string} id
 * @property {string} name
 * @property {Coordinates} coordinates
 * @property {string} type
 * @property {number} colonyCount
 * @property {string} stellarType
 * @property {string} description
 */

/**
 * @typedef {Object} MapData
 * @property {System[]} systems       - Array of stellar system objects.
 * @property {string}   mapName       - Display name of this star map (from `map_name`).
 * @property {string}   mapDescription - Short description of this map (from `map_description`).
 */

/**
 * Fetches and returns the stellar map data from the JSON data file.
 * Expects a root object with `map_name`, `map_description`, and `systems` keys.
 * Requires an HTTP context — will not work over the file:// protocol.
 *
 * @param {string} [url='./data/systems.json'] - Path to the systems JSON file.
 * @returns {Promise<MapData>} Resolves to a MapData object.
 * @throws {Error} If the fetch fails, returns a non-OK status, or yields invalid JSON.
 */
export async function loadSystems(url = './data/systems.json') {
    let response;
    try {
        response = await fetch(url);
    } catch (networkError) {
        throw new Error(
            `Network error loading systems data. ` +
            `Ensure the app is served via HTTP (run: npm run dev). ` +
            `Detail: ${networkError.message}`
        );
    }

    if (!response.ok) {
        throw new Error(
            `Failed to load systems data: HTTP ${response.status} ${response.statusText}`
        );
    }

    let data;
    try {
        data = await response.json();
    } catch (parseError) {
        throw new Error(`Invalid JSON in systems data file: ${parseError.message}`);
    }

    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        throw new Error('Systems data must be a JSON object with a "systems" array.');
    }

    if (!Array.isArray(data.systems)) {
        throw new Error('Systems data object must contain a "systems" array.');
    }

    return {
        systems:        data.systems,
        mapName:        typeof data.map_name        === 'string' ? data.map_name        : 'Unknown Map',
        mapDescription: typeof data.map_description === 'string' ? data.map_description : '',
    };
}

/**
 * Fetches the application version string from package.json.
 * Keeps the version number as a single source of truth — no duplicate constants.
 *
 * @param {string} [url='./package.json'] - Path to package.json.
 * @returns {Promise<string>} The `version` field value (e.g. "0.2.0").
 * @throws {Error} If the fetch fails or the version field is missing.
 */
export async function loadVersion(url = './package.json') {
    let response;
    try {
        response = await fetch(url);
    } catch (networkError) {
        throw new Error(`Network error loading package.json: ${networkError.message}`);
    }

    if (!response.ok) {
        throw new Error(`Failed to load package.json: HTTP ${response.status}`);
    }

    const pkg = await response.json();

    if (typeof pkg.version !== 'string') {
        throw new Error('package.json does not contain a valid "version" field.');
    }

    return pkg.version;
}
