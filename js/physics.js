/**
 * @file physics.js
 * @description Relativistic physics engine for STL journey calculations.
 * @module physics
 * Last Modified: 2026-06-28
 *
 * ── Unit System (LY / Year) ──────────────────────────────────────
 *   c = 1.0 LY/Year          (speed of light)
 *   1G = 1.03 LY/Year²       (proper acceleration under 1G)
 *
 * ── Relativistic Kinematics (constant proper acceleration, c=1) ──
 *   For a ship accelerating at proper acceleration `a` from rest to
 *   velocity v (as a fraction of c):
 *
 *   Proper time to reach v:       τ_acc = atanh(v) / a
 *   Coordinate time to reach v:   t_acc = v·γ / a
 *   Coordinate distance covered:  d_acc = (γ - 1) / a
 *
 *   where γ = 1 / √(1 - v²)  (Lorentz factor)
 *
 * ── Turnover Catch ───────────────────────────────────────────────
 *   If 2·d_acc ≥ total distance, the ship cannot reach cruise speed.
 *   It accelerates to a peak velocity at the midpoint, then decelerates.
 *   Peak γ = 1 + a·(d/2)   →   v_peak = √(1 - 1/γ_peak²)
 */

/** Speed of light in LY/Year (dimensionless 1 in our unit system). */
const C = 1.0;

/** Proper acceleration of 1G expressed in LY/Year². */
export const G_IN_LY_PER_Y2 = 1.03;

/** Absolute hard cap on velocity as a fraction of c. */
export const V_MAX_ABS = 0.9999999;

// ─── Helper ─────────────────────────────────────────────────────

/**
 * Computes the Lorentz factor γ = 1/√(1−v²) for velocity v (fraction of c).
 * @param {number} v - Velocity as fraction of c.
 * @returns {number} Lorentz factor.
 */
function lorentzGamma(v) {
    return 1 / Math.sqrt(1 - v * v);
}

// ─── Public API ──────────────────────────────────────────────────

/**
 * Calculates the 3D Euclidean distance between two coordinate objects.
 * @param {{ x:number, y:number, z:number }} a
 * @param {{ x:number, y:number, z:number }} b
 * @returns {number} Distance in light-years.
 */
export function calculateDistance(a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dz = b.z - a.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * @typedef {Object} Phase
 * @property {'acc'|'cruise'|'dec'} type - Flight phase type.
 * @property {number} fraction - Fraction of leg distance covered by this phase (0–1).
 */

/**
 * @typedef {Object} LegResult
 * @property {number}   tObj          - Coordinate (objective) time in years.
 * @property {number}   tSubj         - Proper (subjective) time in years.
 * @property {Phase[]}  phases         - Phase breakdown for route-line rendering.
 * @property {number}   legDistance    - Distance of this leg in light-years.
 * @property {number}   peakVelocity   - Peak velocity reached (fraction of c).
 * @property {boolean}  hasCruise      - Whether a cruise phase was achieved.
 */

/**
 * Calculates relativistic travel times for a single rest-to-rest leg.
 * Implements the "Turnover Catch" for short journeys where cruise is skipped.
 *
 * @param {number} gForce           - Drive output in Gs (clamped 0.1–100).
 * @param {number} cruiseFraction   - Max cruise velocity as fraction of c (0–V_MAX_ABS).
 * @param {number} distanceLY       - Leg distance in light-years. Must be > 0.
 * @returns {LegResult}
 */
export function calculateLeg(gForce, cruiseFraction, distanceLY) {
    const a = Math.max(0.1, Math.min(100, gForce)) * G_IN_LY_PER_Y2;
    const v_cruise = Math.max(0.001, Math.min(V_MAX_ABS, cruiseFraction));
    const γ_cruise = lorentzGamma(v_cruise);

    // Coordinate distance required to accelerate from rest to v_cruise
    const d_acc = (γ_cruise - 1) / a;

    if (2 * d_acc >= distanceLY) {
        // ── TURNOVER CASE: too short for cruise phase ──────────────
        // Find the peak velocity achievable at the midpoint.
        const γ_peak = 1 + a * (distanceLY / 2);
        const v_peak = Math.sqrt(1 - 1 / (γ_peak * γ_peak));

        const t_coord_half = (v_peak * γ_peak) / a;
        const t_proper_half = Math.atanh(v_peak) / a;

        return {
            tObj:        2 * t_coord_half,
            tSubj:       2 * t_proper_half,
            phases:      [{ type: 'acc', fraction: 0.5 }, { type: 'dec', fraction: 0.5 }],
            legDistance: distanceLY,
            peakVelocity: v_peak,
            hasCruise:   false,
        };
    }

    // ── NORMAL CASE: acceleration + cruise + deceleration ─────────
    const d_cruise = distanceLY - 2 * d_acc;

    // Acceleration / deceleration phase
    const t_coord_acc  = (v_cruise * γ_cruise) / a;
    const t_proper_acc = Math.atanh(v_cruise) / a;

    // Cruise phase (time-dilated by γ_cruise)
    const t_coord_cruise  = d_cruise / v_cruise;
    const t_proper_cruise = d_cruise / (v_cruise * γ_cruise);

    const acc_frac    = d_acc    / distanceLY;
    const cruise_frac = d_cruise / distanceLY;

    return {
        tObj:        2 * t_coord_acc + t_coord_cruise,
        tSubj:       2 * t_proper_acc + t_proper_cruise,
        phases: [
            { type: 'acc',    fraction: acc_frac    },
            { type: 'cruise', fraction: cruise_frac },
            { type: 'dec',    fraction: acc_frac    },
        ],
        legDistance:  distanceLY,
        peakVelocity: v_cruise,
        hasCruise:    true,
    };
}

/**
 * @typedef {Object} RouteResult
 * @property {number}      totalObj       - Total objective time (years).
 * @property {number}      totalSubj      - Total subjective time (years).
 * @property {number}      totalDistance  - Total distance (light-years).
 * @property {LegResult[]} legs           - Per-leg breakdown.
 */

/**
 * Calculates the full relativistic journey across multiple waypoints.
 * Each leg is treated as an independent rest-to-rest sequence.
 * Layover time (ship at rest) accrues equally in both frames.
 *
 * @param {import('./dataLoader.js').System[]} waypoints   - Ordered stops, minimum 2.
 * @param {number} gForce          - Drive output in Gs.
 * @param {number} maxCruisePercent - Max cruise velocity as a percentage of c.
 * @param {number} layoverDays     - Layover days at each intermediate stop.
 * @returns {RouteResult}
 */
export function calculateRoute(waypoints, gForce, maxCruisePercent, layoverDays) {
    const clampedG       = Math.max(0.1, Math.min(100, gForce));
    const cruiseFraction = Math.max(0.001, Math.min(V_MAX_ABS, maxCruisePercent / 100));
    const layoverYears   = Math.max(0, layoverDays) / 365.25;

    let totalObj = 0;
    let totalSubj = 0;
    let totalDistance = 0;
    const legs = [];

    for (let i = 0; i < waypoints.length - 1; i++) {
        const from = waypoints[i];
        const to   = waypoints[i + 1];
        const dist = calculateDistance(from.coordinates, to.coordinates);

        const leg = calculateLeg(clampedG, cruiseFraction, dist);
        legs.push({ ...leg, from, to });

        totalObj      += leg.tObj;
        totalSubj     += leg.tSubj;
        totalDistance += dist;

        // Add layover at all intermediate stops (not at the final destination)
        if (i < waypoints.length - 2) {
            totalObj  += layoverYears;
            totalSubj += layoverYears;
        }
    }

    return { totalObj, totalSubj, totalDistance, legs };
}

/**
 * Formats a time value in years into a human-readable value/unit pair.
 * @param {number} years - Time in years.
 * @returns {{ value: string, unit: string }}
 */
export function formatTime(years) {
    if (years < 1 / 365.25) {
        return { value: (years * 365.25 * 24).toFixed(1), unit: 'HRS' };
    }
    if (years < 1) {
        return { value: (years * 365.25).toFixed(1), unit: 'DAYS' };
    }
    if (years < 10000) {
        return { value: years.toFixed(2), unit: 'YRS' };
    }
    return { value: years.toExponential(2), unit: 'YRS' };
}
