/**
 * 🗺️ TRACK MAP — Real-world Kollam→TVC 64.6 KM route event system
 * Every overpass, level crossing, station, bridge, and W/L board
 * placed at exact real-world kilometer positions.
 *
 * Conversion: 1 KM = 3000 world units (total route ≈ 193,800 units)
 */

export const KM_SCALE = 3000; // world units per kilometer

/**
 * Convert KM to world position
 */
export function kmToWorld(km) {
    return km * KM_SCALE;
}

/**
 * Master route event array — ordered by kilometer.
 * Types: station, overpass, level_crossing, bridge, wl_board, underpass, yard, signal_zone
 */
import routeData from '../data/route_kollam_varkala.json';

export const ROUTE_EVENTS = routeData;

/**
 * Extract just the stations from the route
 */
export function getStations() {
    return ROUTE_EVENTS.filter(e => e.type === 'station');
}

/**
 * Get all events within a world-unit range
 */
export function getEventsInRange(worldStart, worldEnd) {
    return ROUTE_EVENTS.filter(e => {
        const wx = kmToWorld(e.km);
        return wx >= worldStart && wx <= worldEnd;
    });
}

/**
 * Get events visible on screen relative to train position
 */
export function getVisibleEvents(worldDist, screenWidthInWorld, types = null) {
    const margin = 2000;
    const start = worldDist - margin;
    const end = worldDist + screenWidthInWorld + margin;
    return ROUTE_EVENTS.filter(e => {
        if (types && !types.includes(e.type)) return false;
        const wx = kmToWorld(e.km);
        return wx >= start && wx <= end;
    }).map(e => ({
        ...e,
        worldX: kmToWorld(e.km),
        screenX: kmToWorld(e.km) - worldDist,
    }));
}

/**
 * Get bridge zones as world-unit ranges
 */
export function getBridgeZones() {
    return ROUTE_EVENTS
        .filter(e => e.type === 'bridge')
        .map(e => ({
            start: kmToWorld(e.km),
            end: kmToWorld(e.km + (e.length || 0.5)),
            type: e.bridgeType,
            name: e.name,
        }));
}

/**
 * Weather zones based on KM ranges
 */
export const WEATHER_ZONES = [
    { startKM: 10, endKM: 18, weather: 'RAIN' },    // Coastal lake region
    { startKM: 42, endKM: 48, weather: 'RAIN' },    // Murukkampuzha area
    { startKM: 55, endKM: 64, weather: 'CLEAR' },   // TVC approach — clear
];

/**
 * Speed limit zones based on KM ranges
 */
export const SPEED_LIMIT_ZONES = [
    { startKM: 0.0, endKM: 0.3, limit: 15, label: "Turnout – Kollam Jct yard exit" },
    { startKM: 0.3, endKM: 0.8, limit: 50, label: "Kollam Jct station limits" },
    { startKM: 0.8, endKM: 2.0, limit: 75, label: "Caution zone – Kollam approach" },
    { startKM: 2.0, endKM: 2.1, limit: 110, label: "Open main line" },
    { startKM: 2.1, endKM: 3.5, limit: 30, label: "Speed Board 30 km/h restriction" },
    { startKM: 3.5, endKM: 4.3, limit: 110, label: "Open main line" },
    { startKM: 4.3, endKM: 4.8, limit: 75, label: "Turnout curve near Eravipuram" },
    { startKM: 4.8, endKM: 7.5, limit: 110, label: "Open main line" },
    { startKM: 7.5, endKM: 9.5, limit: 50, label: "Speed Board 50 km/h restriction" },
    { startKM: 9.5, endKM: 10.4, limit: 110, label: "Open main line" },
    { startKM: 10.4, endKM: 12.3, limit: 75, label: "Paravur Lake Bridge crossing" },
    { startKM: 12.3, endKM: 12.8, limit: 50, label: "Paravur station limits" },
    { startKM: 12.8, endKM: 16.5, limit: 110, label: "Open main line" },
    { startKM: 16.5, endKM: 17.5, limit: 75, label: "Kappil station approach" },
    { startKM: 17.5, endKM: 18.5, limit: 110, label: "Open main line" },
    { startKM: 18.5, endKM: 20.5, limit: 30, label: "Speed Board 30 km/h restriction" },
    { startKM: 20.5, endKM: 22.5, limit: 110, label: "Open main line" },
    { startKM: 22.5, endKM: 23.5, limit: 75, label: "Approach caution – Varkala" },
    { startKM: 23.5, endKM: 24.0, limit: 50, label: "Varkala Sivagiri station limits" },
    { startKM: 24.0, endKM: 27.5, limit: 110, label: "Open main line" },
    { startKM: 27.5, endKM: 28.8, limit: 75, label: "Akathumuri Bridge and curve" },
    { startKM: 28.8, endKM: 29.3, limit: 110, label: "Open main line" },
    { startKM: 29.3, endKM: 31.0, limit: 50, label: "Speed Board 50 km/h restriction" },
    { startKM: 31.0, endKM: 32.3, limit: 110, label: "Open main line" },
    { startKM: 32.3, endKM: 33.2, limit: 50, label: "Kadakkavur station limits" },
    { startKM: 33.2, endKM: 35.4, limit: 110, label: "Open main line" },
    { startKM: 35.4, endKM: 36.4, limit: 50, label: "Chirayinkeezhu station limits" },
    { startKM: 36.4, endKM: 39.5, limit: 110, label: "Open main line" },
    { startKM: 39.5, endKM: 40.5, limit: 50, label: "Perunguzhi station limits" },
    { startKM: 40.5, endKM: 41.5, limit: 110, label: "Open main line" },
    { startKM: 41.5, endKM: 42.6, limit: 75, label: "Murukkampuzha Bridge and approach" },
    { startKM: 42.6, endKM: 43.6, limit: 50, label: "Murukkampuzha station limits" },
    { startKM: 43.6, endKM: 44.5, limit: 110, label: "Open main line" },
    { startKM: 44.5, endKM: 46.5, limit: 30, label: "Speed Board 30 km/h restriction" },
    { startKM: 46.5, endKM: 46.8, limit: 110, label: "Open main line" },
    { startKM: 46.8, endKM: 47.6, limit: 50, label: "Kaniyapuram station limits" },
    { startKM: 47.6, endKM: 50.8, limit: 110, label: "Open main line" },
    { startKM: 50.8, endKM: 51.8, limit: 50, label: "Kazhakkuttam station limits" },
    { startKM: 51.8, endKM: 54.8, limit: 110, label: "Open main line" },
    { startKM: 54.8, endKM: 56.8, limit: 75, label: "Veli Creek Bridge and Veli station" },
    { startKM: 56.8, endKM: 58.0, limit: 50, label: "Thiruvananthapuram North yard limits" },
    { startKM: 58.0, endKM: 61.6, limit: 110, label: "Open main line" },
    { startKM: 61.6, endKM: 62.6, limit: 50, label: "TVM Pettah station limits" },
    { startKM: 62.6, endKM: 63.8, limit: 75, label: "Approach caution – TVC Central" },
    { startKM: 63.8, endKM: 64.3, limit: 30, label: "Turnout – TVC yard entrance" },
    { startKM: 64.3, endKM: 64.6, limit: 15, label: "Trivandrum Central terminal limits" }
];

export function getSpeedLimitAt(worldX) {
    const km = worldX / KM_SCALE;
    let minSpeed = 110.0;
    SPEED_LIMIT_ZONES.forEach(z => {
        if (km >= z.startKM && km <= z.endKM) {
            if (z.limit < minSpeed) minSpeed = z.limit;
        }
    });
    return minSpeed;
}

/**
 * Gradient zones based on KM ranges
 */
export const GRADIENT_ZONES = [
    { startKM: 12.0, endKM: 15.0, slope: 0.0067, label: "UP 1:150" },
    { startKM: 18.0, endKM: 22.0, slope: -0.005, label: "DN 1:200" },
    { startKM: 22.0, endKM: 25.0, slope: 0.010, label: "UP 1:100" },
    { startKM: 30.0, endKM: 35.0, slope: -0.0067, label: "DN 1:150" },
    { startKM: 35.0, endKM: 45.0, slope: 0.004, label: "UP 1:250" },
    { startKM: 52.0, endKM: 58.0, slope: -0.0083, label: "DN 1:120" }
];

export function getGradientAt(worldX) {
    const km = worldX / KM_SCALE;
    const zone = GRADIENT_ZONES.find(g => km >= g.startKM && km <= g.endKM);
    return zone || { slope: 0, label: "LEVEL" };
}

// ─── 2.5D ELEVATION PROFILING SYSTEM ───
export const ELEVATION_SCALE = 1.5;

const sortedGradients = [...GRADIENT_ZONES].sort((a, b) => a.startKM - b.startKM);
const segments = [];
let currentKm = 0;
sortedGradients.forEach(z => {
    if (z.startKM > currentKm) {
        segments.push({ startKM: currentKm, endKM: z.startKM, slope: 0, label: "LEVEL" });
    }
    segments.push(z);
    currentKm = z.endKM;
});
if (currentKm < 65.0) {
    segments.push({ startKM: currentKm, endKM: 65.0, slope: 0, label: "LEVEL" });
}

let currentElev = 0;
const segmentsWithElev = segments.map(seg => {
    const startElev = currentElev;
    const lengthKm = seg.endKM - seg.startKM;
    const heightChange = seg.slope * lengthKm * KM_SCALE;
    currentElev += heightChange;
    return {
        ...seg,
        startElev,
        endElev: currentElev
    };
});

export function getElevationAt(worldX) {
    const km = worldX / KM_SCALE;
    const seg = segmentsWithElev.find(s => km >= s.startKM && km <= s.endKM);
    if (!seg) {
        if (km < 0) return 0;
        return segmentsWithElev[segmentsWithElev.length - 1]?.endElev || 0;
    }
    const ratio = (km - seg.startKM) / (seg.endKM - seg.startKM);
    return seg.startElev + ratio * (seg.endElev - seg.startElev);
}
