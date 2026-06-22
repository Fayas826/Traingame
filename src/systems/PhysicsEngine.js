import { PHYSICS, COACH, G_STATE, LOCO_PROFILES, RAKE_PROFILES } from '../config.js';
import { getGradientAt, getStations, getSpeedLimitAt } from './TrackMap.js';

export default class PhysicsEngine {
    constructor(locoId = 'WAP-7', rakeId = 'LHB', trainType = 'Passenger') {
        this.speed = 0;
        this.worldDistance = 0;
        this.throttleNotch = 0;
        this.brakeNotch = 0;
        this.wheelRotation = 0;
        this.tractionModifier = 1.0;
        this.isEmergencyActive = false;
        this.isWheelSlipActive = false;
        this.currentGradientLabel = 'LEVEL';
        this.currentGradientSlope = 0;

        // Load loco + rake profiles
        this.loco = LOCO_PROFILES[locoId] || LOCO_PROFILES['WAP-7'];
        this.rake = RAKE_PROFILES[rakeId] || RAKE_PROFILES['LHB'];

        // Compute total mass and effective physics
        this.totalMass = this.loco.mass + this.rake.coachCount * this.rake.massPerCoach;
        this.massRatio = 1200 / this.totalMass; // Normalized to WAP-7 + LHB baseline

        this.coachOffsets = new Array(this.rake.coachCount).fill(0);

        // 🔌 Hybrid C# Backend Bridge Config
        this.hybridActive = false;
        this.updatePending = false;
        this.sessionId = 'session_' + Math.random().toString(36).substring(2, 9);
        this.backendUrl = 'http://localhost:5000/api/physics';
        this.scene = null; // Set dynamically in GameScene
        this.trainType = trainType;
        
        this.signalCallout = "";
        this.speedLimitWarning = "";

        this.initHybridBackend(locoId, rakeId);
    }

    async initHybridBackend(locoId, rakeId) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1000); // 1 second timeout

        try {
            const response = await fetch(`${this.backendUrl}/init`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Session-ID': this.sessionId
                },
                body: JSON.stringify({ LocoId: locoId, RakeId: rakeId, TrainType: this.trainType }),
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            if (response.ok) {
                const data = await response.json();
                console.log(`🔌 Connected to C# Web API Backend. Session: ${data.sessionId}`);
                this.hybridActive = true;
            } else {
                console.warn("⚠️ C# Web API responded with error. Falling back to local JS physics.");
            }
        } catch (e) {
            clearTimeout(timeoutId);
            console.warn("🔌 C# Web API Backend not reached (or timed out). Falling back to local JS physics.");
        }
    }

    get displaySpeed() {
        return Math.round(this.speed * PHYSICS.SPEED_DISPLAY_MULT);
    }

    get bgX() {
        return this.worldDistance * PHYSICS.SCROLLING_MULTIPLIER;
    }

    get notchLabel() {
        if (this.brakeNotch > 0) return `B ${this.brakeNotch}`;
        return `N ${this.throttleNotch}`;
    }

    get coachCount() {
        return this.rake.coachCount;
    }

    notchUp(gameState, isWaitingForStarter) {
        if (isWaitingForStarter || gameState === G_STATE.BOARDING) return false;
        if (this.brakeNotch === PHYSICS.BRAKE_NOTCHES && this.speed === 0) {
            this.brakeNotch = 0;
            this.isEmergencyActive = false;
            return true;
        }
        if (this.brakeNotch > 0) { this.brakeNotch--; return true; }
        if (this.throttleNotch < PHYSICS.THROTTLE_NOTCHES) { this.throttleNotch++; return true; }
        return false;
    }

    notchDown() {
        if (this.throttleNotch > 0) { this.throttleNotch--; return true; }
        if (this.brakeNotch < PHYSICS.BRAKE_NOTCHES) { this.brakeNotch++; return true; }
        return false;
    }

    emergencyBrake() {
        this.isEmergencyActive = true;
        this.brakeNotch = PHYSICS.EMERGENCY_BRAKE_NOTCH;
        this.throttleNotch = 0;
    }

    applyEmergencyBrake() {
        this.emergencyBrake();
    }

    /**
     * Core physics step — Davis Equation drag with mass-dependent acceleration.
     * Integrates local JS prediction + async C# reconciliation.
     * @param {number} delta - ms since last frame
     */
    update(delta) {
        // --- 1. Local JS Prediction (Keeps Framerate Butter-Smooth at 60 FPS) ---
        const dt = delta / 16.667;

        // Davis equation drag: F_drag = A + B*v + C*v²
        const A = this.loco.dragA * this.rake.dragMultiplier;
        const B = this.loco.dragB * this.rake.dragMultiplier;
        const C = this.loco.dragC * this.rake.dragMultiplier;
        const friction = A + B * this.speed + C * this.speed * this.speed;

        // Tractive force & Wheel Slip Adhesion calculation
        const baseLimit = 0.035;
        const limit = this.tractionModifier * baseLimit * (1.0 + this.speed * 0.1);
        const TE = this.throttleNotch * this.loco.throttlePower * this.massRatio;
        
        // Slip triggers if tractive effort exceeds the dynamic adhesion limit
        const isWheelSlip = (this.throttleNotch > 0) && (TE > limit);
        this.isWheelSlipActive = isWheelSlip;

        // Tractive power collapses to 15% during wheel slip
        const power = isWheelSlip ? (TE * 0.15) : (TE * this.tractionModifier);
        const brakeForce = this.brakeNotch * this.loco.brakeFactor;

        // Grade resistance: F_grade = slope * 1.2 * massRatio
        const grad = getGradientAt(this.worldDistance);
        this.currentGradientLabel = grad.label;
        this.currentGradientSlope = grad.slope;
        const gradeForce = grad.slope * 1.2 * this.massRatio;

        this.speed += (power - brakeForce - friction - gradeForce) * dt;

        // Check if train is passing a turnout (200m before any station platform entry)
        const trainKm = this.worldDistance / 3000; // KM_SCALE = 3000
        let isOnTurnout = false;
        if (this.scene && this.scene.stationMgr) {
            this.scene.stationMgr.stations.forEach(st => {
                if (st.isStoppage) {
                    const switchKm = st.km - 0.2;
                    if (Math.abs(trainKm - switchKm) < 0.05) {
                        isOnTurnout = true;
                    }
                }
            });
        }

        // Speed limit / governor
        let currentLimit = getSpeedLimitAt(this.worldDistance);
        if (isOnTurnout && currentLimit > 30) {
            currentLimit = 30;
        }
        let maxSpd = currentLimit / PHYSICS.SPEED_DISPLAY_MULT; // convert km/h to engine units

        if (this.displaySpeed > currentLimit) {
            if (isOnTurnout && currentLimit === 30) {
                this.speedLimitWarning = "⚠️ OVERSPEEDING ON TURNOUT! LIMIT 30 KM/H";
            } else {
                this.speedLimitWarning = `⚠️ OVER SPEED LIMIT! ${currentLimit} KM/H MAX`;
            }
        } else {
            if (isOnTurnout && currentLimit === 30) {
                this.speedLimitWarning = "⚠️ 30 KM/H LIMIT ON TURNOUT";
            } else {
                this.speedLimitWarning = "";
            }
        }

        // Coasting decel
        if (this.throttleNotch === 0 && this.speed > 0) {
            this.speed -= PHYSICS.COASTING_DECEL * dt;
        }

        this.speed = Math.max(0, Math.min(this.speed, this.loco.maxSpeed));
        this.worldDistance += this.speed * dt;

        // If wheel slip is active, visual wheels spin wildly
        if (isWheelSlip) {
            this.wheelRotation += Math.max(2.0, this.speed) * 3.0 * PHYSICS.WHEEL_ROTATION_RATE * dt;
        } else {
            this.wheelRotation += this.speed * PHYSICS.WHEEL_ROTATION_RATE * dt;
        }

        // Coach suspension sway prediction
        const now = Date.now();
        for (let i = 0; i < this.coachOffsets.length; i++) {
            this.coachOffsets[i] = Math.sin(now / (COACH.SWAY_BASE_PERIOD + i * COACH.SWAY_PHASE_SHIFT))
                * (this.speed * COACH.SWAY_AMPLITUDE);
        }

        // --- 2. Asynchronous Server Reconciliation (C# Core Logic) ---
        if (this.hybridActive && !this.updatePending) {
            this.updatePending = true;

            const gameState = this.scene?.stationMgr?.gameState || 'RUNNING';
            const isWaitingForStarter = this.scene?.stationMgr?.isWaitingForStarter || false;
            let targetStationKm = -1;
            if (this.scene && this.scene.stationMgr) {
                const targetIdx = this.scene.stationMgr.targetStationIdx;
                const tStation = this.scene.stationMgr.stations[targetIdx];
                if (tStation) {
                    targetStationKm = tStation.km;
                }
            }

            fetch(`${this.backendUrl}/update`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Session-ID': this.sessionId
                },
                body: JSON.stringify({
                    DeltaTimeMs: delta,
                    ThrottleNotch: this.throttleNotch,
                    BrakeNotch: this.brakeNotch,
                    EmergencyBrake: this.isEmergencyActive,
                    TractionModifier: this.tractionModifier,
                    GameState: gameState,
                    IsWaitingForStarter: isWaitingForStarter,
                    TargetStationKm: targetStationKm
                })
            })
            .then(res => {
                if (res.ok) return res.json();
                throw new Error("API responded with error code");
            })
            .then(data => {
                this.updatePending = false;
                
                // Server reconciliation
                this.speed = data.speed;
                this.worldDistance = data.worldDistance;
                this.wheelRotation = data.wheelRotation;
                this.isEmergencyActive = data.isEmergencyActive;
                
                if (data.coachOffsets && data.coachOffsets.length === this.coachOffsets.length) {
                    this.coachOffsets = data.coachOffsets;
                }

                // Core logic feedback
                if (data.signalCallout) {
                    this.signalCallout = data.signalCallout;
                }
                if (data.speedLimitWarning) {
                    this.speedLimitWarning = data.speedLimitWarning;
                    const warnEl = document.getElementById("signal-callout");
                    if (warnEl && data.speedLimitWarning.includes("⚠️")) {
                        warnEl.innerHTML = `<span style="color: yellow; font-weight: bold">${data.speedLimitWarning}</span>`;
                    }
                }
            })
            .catch(e => {
                this.updatePending = false;
                // Graceful degradation: Local prediction takes over completely until C# recovers
            });
        }
    }

    applyAutoStop(distToStation, delta) {
        const dt = delta / 16.667;
        const absDist = Math.abs(distToStation);
        const { GENTLE_BRAKE_DISTANCE, AGGRESSIVE_BRAKE_DISTANCE, GENTLE_BRAKE_FACTOR, AGGRESSIVE_BRAKE_FACTOR, SNAP_STOP_DISTANCE, SNAP_STOP_SPEED } = require_auto_stop();

        if (absDist < GENTLE_BRAKE_DISTANCE) {
            const factor = absDist < AGGRESSIVE_BRAKE_DISTANCE ? AGGRESSIVE_BRAKE_FACTOR : GENTLE_BRAKE_FACTOR;
            this.speed *= Math.pow(factor, dt);
            if (this.speed < 0.2) this.speed = 0;
        }

        if (absDist < SNAP_STOP_DISTANCE && this.speed < SNAP_STOP_SPEED) {
            this.speed = 0;
            return true;
        }
        return false;
    }

    setWeatherTraction(modifier) { this.tractionModifier = modifier; }

    prepareForDeparture() {
        this.brakeNotch = 0;
        this.throttleNotch = 1;
        this.isEmergencyActive = false;
    }

    lockSpeed() { this.speed = 0; }
}

// Inline import to avoid circular deps
function require_auto_stop() {
    return {
        GENTLE_BRAKE_DISTANCE: 1200,
        AGGRESSIVE_BRAKE_DISTANCE: 400,
        GENTLE_BRAKE_FACTOR: 0.97,
        AGGRESSIVE_BRAKE_FACTOR: 0.92,
        SNAP_STOP_DISTANCE: 150,
        SNAP_STOP_SPEED: 1.0,
    };
}
