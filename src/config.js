/**
 * 🚂 TRAIN SIMULATOR CONFIG — V2: Full spec with per-loco profiles
 * Single source of truth for the entire simulator.
 */
import { KM_SCALE, getStations, getBridgeZones } from './systems/TrackMap.js';

export { KM_SCALE };

// ═══════════════════════════════════════════════════════════════
// LOCOMOTIVE PROFILES — Per-loco mass/drag/physics (Davis Equation)
// F_drag = A + B*v + C*v² (Modified Davis)
// ═══════════════════════════════════════════════════════════════
export const LOCO_PROFILES = {
    'WAP-7': {
        id: 'WAP-7', name: 'WAP-7',
        type: 'Electric Passenger', color: '#c0392b',
        mass: 1200,  // tons (loco + LHB default)
        maxSpeed: 11.5, throttlePower: 0.006, brakeFactor: 0.008,
        dragA: 0.003, dragB: 0.001, dragC: 0.0001,
        description: 'High-speed electric passenger locomotive',
    },
    'WAP-4': {
        id: 'WAP-4', name: 'WAP-4',
        type: 'Electric Passenger', color: '#e74c3c',
        mass: 1400,
        maxSpeed: 10.5, throttlePower: 0.005, brakeFactor: 0.007,
        dragA: 0.004, dragB: 0.0012, dragC: 0.00015,
        description: 'Classic electric passenger workhorse',
    },
    'WAG-12': {
        id: 'WAG-12', name: 'WAG-12',
        type: 'Twin Freight Electric', color: '#2980b9',
        mass: 4500,
        maxSpeed: 7.5, throttlePower: 0.003, brakeFactor: 0.005,
        dragA: 0.006, dragB: 0.002, dragC: 0.0003,
        description: 'Heavy-haul twin-section freight locomotive',
    },
    'VANDE_BHARAT': {
        id: 'VANDE_BHARAT', name: 'Vande Bharat',
        type: 'Semi-High Speed EMU', color: '#3498db',
        mass: 850,
        maxSpeed: 13.0, throttlePower: 0.008, brakeFactor: 0.010,
        dragA: 0.002, dragB: 0.0008, dragC: 0.00008,
        description: 'India\'s fastest semi-high speed trainset',
    },
    'WAG-9': {
        id: 'WAG-9', name: 'WAG-9',
        type: 'Electric Freight', color: '#27ae60',
        mass: 3800,
        maxSpeed: 8.0, throttlePower: 0.0035, brakeFactor: 0.006,
        dragA: 0.005, dragB: 0.0018, dragC: 0.00025,
        description: 'Standard freight electric locomotive',
    },
    'WDM-3A': {
        id: 'WDM-3A', name: 'WDM-3A / WDP-4D',
        type: 'Diesel', color: '#e67e22',
        mass: 1600,
        maxSpeed: 9.5, throttlePower: 0.0045, brakeFactor: 0.007,
        dragA: 0.004, dragB: 0.0014, dragC: 0.0002,
        description: 'Classic diesel workhorse of Indian Railways',
    },
};

// ═══════════════════════════════════════════════════════════════
// RAKE PROFILES — Rolling stock types
// ═══════════════════════════════════════════════════════════════
export const RAKE_PROFILES = {
    'LHB': {
        id: 'LHB', name: 'LHB Coaches',
        style: 'Modern Red/Silver', coachCount: 4,
        massPerCoach: 50, dragMultiplier: 1.0,
        description: 'Modern Linke Hofmann Busch air-conditioned coaches',
    },
    'ICF': {
        id: 'ICF', name: 'ICF Coaches',
        style: 'Classic Blue', coachCount: 5,
        massPerCoach: 55, dragMultiplier: 1.15,
        description: 'Classic Integral Coach Factory blue passenger cars',
    },
    'TANKER': {
        id: 'TANKER', name: 'Fuel Tankers',
        style: 'Silver/Hazmat', coachCount: 6,
        massPerCoach: 80, dragMultiplier: 1.4,
        description: 'Flammable liquid tank wagons',
    },
    'BOXN': {
        id: 'BOXN', name: 'BOXN Wagons',
        style: 'Brown/Open-top', coachCount: 8,
        massPerCoach: 70, dragMultiplier: 1.6,
        description: 'Open-top coal/mineral freight wagons',
    },
};

// ═══════════════════════════════════════════════════════════════
// PHYSICS CONSTANTS (base values, modified by loco profile)
// ═══════════════════════════════════════════════════════════════
export const PHYSICS = {
    THROTTLE_NOTCHES: 8,
    BRAKE_NOTCHES: 5,
    SPEED_DISPLAY_MULT: 10,
    WHEEL_ROTATION_RATE: 0.45,
    SCROLLING_MULTIPLIER: 4.8,
    EMERGENCY_BRAKE_NOTCH: 5,
    COASTING_DECEL: 0.001,
};

// ═══════════════════════════════════════════════════════════════
// WEATHER & TRACTION MODIFIERS
// ═══════════════════════════════════════════════════════════════
export const WEATHER = {
    TRACTION_CLEAR: 1.0,
    TRACTION_RAIN: 0.65,
    TRACTION_STORM: 0.65,
    RAIN_ALPHA_FADE_IN: 0.01,
    RAIN_ALPHA_FADE_OUT: 0.01,
    RAIN_MAX_ALPHA: 0.6,
};

// ═══════════════════════════════════════════════════════════════
// AUTO-STOP DECELERATION CURVES
// ═══════════════════════════════════════════════════════════════
export const AUTO_STOP = {
    APPROACH_DISTANCE: 1500,
    GENTLE_BRAKE_DISTANCE: 1200,
    AGGRESSIVE_BRAKE_DISTANCE: 400,
    GENTLE_BRAKE_FACTOR: 0.97,
    AGGRESSIVE_BRAKE_FACTOR: 0.92,
    SNAP_STOP_DISTANCE: 150,
    SNAP_STOP_SPEED: 1.0,
};

// ═══════════════════════════════════════════════════════════════
// COACH SUSPENSION
// ═══════════════════════════════════════════════════════════════
export const COACH = {
    SWAY_BASE_PERIOD: 130,
    SWAY_PHASE_SHIFT: 15,
    SWAY_AMPLITUDE: 0.45,
};

// ═══════════════════════════════════════════════════════════════
// PARALLAX SCROLL RATES (5-layer system)
// ═══════════════════════════════════════════════════════════════
export const PARALLAX = {
    SKY: 0.0,              // Layer 0
    FAR_MOUNTAINS: 0.05,   // Layer 1 — distant backing
    MID_STRUCTURES: 0.30,  // Layer 2 — station platforms, yards
    CLOUDS: 0.15,
    TRACK: 1.0,            // Layer 3 — main rail alignment
    FOREGROUND: 1.40,      // Layer 4 — overbridges sweep IN FRONT
    FAR_TREES: 0.4,
    MID_TREES: 0.7,
    NEAR_TREES: 1.2,
    OHE_POLES: 1.0,
};

// ═══════════════════════════════════════════════════════════════
// SIGNAL SYSTEM
// ═══════════════════════════════════════════════════════════════
export const SIGNALS = {
    STORYBOARD: ['GREEN','GREEN','GREEN','YELLOW','GREEN','GREEN','DOUBLE_YELLOW','YELLOW','RED'],
    SPACING: 4000,
    FIRST_OFFSET: 1200,
    TOTAL_COUNT: 150,
    STARTER_TIMER_SECONDS: 7.0,
    STARTER_GREEN_LEAD: 2.0,
};

// ═══════════════════════════════════════════════════════════════
// GAME STATE ENUM
// ═══════════════════════════════════════════════════════════════
export const G_STATE = {
    RUNNING: 'RUNNING',
    APPROACHING: 'APPROACHING',
    STOPPED: 'STOPPED',
    BOARDING: 'BOARDING',
    READY: 'READY',
    DEPARTING: 'DEPARTING',
};

// ═══════════════════════════════════════════════════════════════
// BOARDING & DOOR CONSTANTS
// ═══════════════════════════════════════════════════════════════
export const BOARDING = {
    DOOR_OPEN_RATE: 0.02,
    DOOR_CLOSE_RATE: 0.02,
    DWELL_FRAMES: 400,
};

// ═══════════════════════════════════════════════════════════════
// AUDIO INTERVALS
// ═══════════════════════════════════════════════════════════════
export const AUDIO = {
    TRACK_JOINT_FAST_INTERVAL: 380,
    TRACK_JOINT_SLOW_INTERVAL: 750,
    TRACK_JOINT_SPEED_THRESHOLD: 5,
    CROWD_PROXIMITY: 4000,
    HUMMING_DURATION: 7.0,
    STATION_PROXIMITY: 1500,
};

// ═══════════════════════════════════════════════════════════════
// VISUAL / RENDERING
// ═══════════════════════════════════════════════════════════════
export const VISUAL = {
    TRAIN_FIXED_X_RATIO: 0.35,
    TRACK_Y_RATIO: 0.75,
    TRACK_Y_RATIO_MOBILE: 0.78,
    STATION_CLEARANCE: 3000,
    OPP_TRAIN_SPAWN_CHANCE: 0.003,
    OPP_TRAIN_SPEED: 18,
    SMOKE_SPAWN_CHANCE: 0.15,
    SPARK_SPAWN_CHANCE: 0.2,
};

// ═══════════════════════════════════════════════════════════════
// PIXEL ART SCALE
// ═══════════════════════════════════════════════════════════════
export const PIXEL = {
    BASE_TILE: 32,
    TRAIN_SCALE: 3,
    UI_SCALE: 2,
};

// ═══════════════════════════════════════════════════════════════
// UTILITY: Get structural type at world position (uses TrackMap)
// ═══════════════════════════════════════════════════════════════
export function getStructuralType(worldX) {
    const stations = getStations();
    const isStationZone = stations.some(s => Math.abs(worldX - s.km * KM_SCALE) < VISUAL.STATION_CLEARANCE);
    if (isStationZone) return { main: 'ground' };
    const bridges = getBridgeZones();
    const zone = bridges.find(z => worldX >= z.start && worldX <= z.end);
    return zone ? { main: 'bridge', sub: zone.type } : { main: 'ground' };
}
