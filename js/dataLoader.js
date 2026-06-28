/**
 * @file dataLoader.js
 * @description Fetches and parses the stellar systems dataset via the Fetch API.
 * @module dataLoader
 * Last Modified: 2026-06-28
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
 * Fetches and returns the list of stellar systems from the JSON data file.
 * Requires an HTTP context — will not work over the file:// protocol.
 *
 * @param {string} [url='./data/systems.json'] - Path to the systems JSON file.
 * @returns {Promise<System[]>} Resolves to an array of system objects.
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

    if (!Array.isArray(data)) {
        throw new Error('Systems data must be a JSON array.');
    }

    return data;
}

/**
 * Fetches the application version string from package.json.
 * Keeps the version number as a single source of truth — no duplicate constants.
 *
 * @param {string} [url='./package.json'] - Path to package.json.
 * @returns {Promise<string>} The `version` field value (e.g. "0.1.1").
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
