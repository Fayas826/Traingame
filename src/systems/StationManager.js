/**
 * 🚉 STATION MANAGER V2 — Uses TrackMap for real-world KM positions
 */
import { G_STATE, BOARDING, SIGNALS } from '../config.js';
import { getStations, kmToWorld, ROUTE_EVENTS } from './TrackMap.js';
import bridge from './BackendBridge.js';

export default class StationManager {
    constructor(physics, scene) {
        this.physics = physics;
        this.scene = scene;
        this.gameState = G_STATE.RUNNING;
        this.currentStationIdx = -1;
        this.targetStationIdx = -1;
        this.dwellTimer = 0;
        this.doorOpenAmount = 0;
        this.isWaitingForStarter = true;
        this.starterTimer = SIGNALS.STARTER_TIMER_SECONDS;
        this.missionComplete = false;
        this.skipAnnounced = new Set();

        // Read selected Train Service / Timetable type from registry
        const trainType = this.scene.registry.get('selectedTrainType') || 'Passenger';
        this.trainType = trainType;

        // Build station list from TrackMap with dynamic stopping pattern
        this.stations = getStations().map(s => {
            let isStoppage = false;
            if (trainType === 'Express') {
                isStoppage = ['QLN', 'VAK', 'KZK', 'TVC'].includes(s.code);
            } else if (trainType === 'Superfast') {
                isStoppage = ['QLN', 'VAK', 'TVC'].includes(s.code);
            } else if (trainType === 'Special') {
                isStoppage = ['QLN', 'PVU', 'VAK', 'CRY', 'KZK', 'TVCN', 'TVC'].includes(s.code);
            } else { // Passenger / MEMU
                isStoppage = true;
            }
            return {
                ...s,
                isStoppage,
                x: kmToWorld(s.km),
                annDone: false,
            };
        });

        // W/L board tracking (for horn validation)
        this.wlBoards = ROUTE_EVENTS.filter(e => e.type === 'wl_board').map(e => ({
            ...e, x: kmToWorld(e.km), honked: false, passed: false,
        }));
        this.wlStats = { honked: 0, missed: 0 };
        this._gameStartTimeMs = Date.now();
    }

    get stationPositions() { return this.stations.map(s => s.x); }

    update(delta, speak, signalManager) {
        const dt = delta / 16.667;
        const worldDist = this.physics.worldDistance;
        const APPROACH = 1500;

        // Throttle station search, announcements, and W/L boards to run once every 10 frames
        this.updateFrameCount = (this.updateFrameCount || 0) + 1;
        if (this.updateFrameCount % 10 === 0 || this.gameState === G_STATE.APPROACHING) {
            let nearestStop = null, nearestStopIdx = -1, distToStop = 999999;
            this.stations.forEach((s, i) => {
                const d = s.x - worldDist;
                if (d > -500 && d < distToStop) {
                    distToStop = d;
                    nearestStop = s;
                    nearestStopIdx = i;
                }
            });
            this.nearestStop = nearestStop;
            this.nearestStopIdx = nearestStopIdx;
            this.distToStop = distToStop;

            // ─── Skip announcements for non-stoppage stations ───
            this.stations.forEach(s => {
                const d = s.x - worldDist;
                if (!s.isStoppage && d > 0 && d < 3000 && !this.skipAnnounced.has(s.code)) {
                    const english = `Attention passengers. Train is skipping ${s.name}. Maintain speed.`;
                    const hindi = `यात्री कृपया ध्यान दें। गाड़ी ${s.hindi || s.name} स्टेशन से बिना रुके गुज़रेगी।`;
                    speak(english, false);
                    speak(hindi, true);
                    this.skipAnnounced.add(s.code);
                }
            });

            // ─── W/L Board horn check ───
            this.wlBoards.forEach(wb => {
                const d = wb.x - worldDist;
                if (!wb.passed && d < 0) {
                    wb.passed = true;
                    if (!wb.honked) {
                        this.wlStats.missed++;
                        bridge.reportWLBoard(false, wb.km);
                    } else {
                        bridge.reportWLBoard(true, wb.km);
                    }
                }
            });
        }

        const nearestStop = this.nearestStop;
        const nearestStopIdx = this.nearestStopIdx;
        const distToStop = this.distToStop;

        // ─── APPROACHING ───
        if (nearestStop && nearestStop.isStoppage && distToStop > 0 && distToStop < APPROACH && this.gameState === G_STATE.RUNNING) {
            this.gameState = G_STATE.APPROACHING;
            this.targetStationIdx = nearestStopIdx;
            const english = `Attention passengers. We are approaching ${nearestStop.name}. Please prepare to deboard.`;
            const hindi = `यात्री कृपया ध्यान दें। हम ${nearestStop.hindi || nearestStop.name} स्टेशन पर पहुँच रहे हैं। कृपया उतरने के लिए तैयार रहें।`;
            speak(english, false);
            speak(hindi, true);
        }

        // ─── Auto-stop ───
        if (this.gameState === G_STATE.APPROACHING) {
            const tStation = this.stations[this.targetStationIdx];
            if (!tStation) { this.gameState = G_STATE.RUNNING; return; }
            const dToT = tStation.x - worldDist;
            const stopped = this.physics.applyAutoStop(dToT, delta);
            if (stopped || (Math.abs(dToT) < 150 && this.physics.speed < 1.0)) {
                this.physics.speed = 0;
                this.gameState = G_STATE.STOPPED;
                this.currentStationIdx = this.targetStationIdx;
                // Report arrival to C# ScoreEngine
                const arrMin = (Date.now() - this._gameStartTimeMs) / 60000;
                const overshoot = Math.abs(tStation.x - worldDist) / 3000 * 1000; // metres
                bridge.reportStationArrival(tStation.code || '', arrMin, arrMin, overshoot > 3 ? overshoot : 0);
                if (tStation.isTerminus) {
                    this.missionComplete = true;
                    const wlMsg = this.wlStats.missed > 0 ? ` W/L boards: ${this.wlStats.honked} honked, ${this.wlStats.missed} missed.` : ' Perfect W/L compliance!';
                    const english = `Attention passengers. We have arrived at Trivandrum Central. Mission accomplished! ${wlMsg}`;
                    const hindi = `यात्री कृपया ध्यान दें। हम तिरुवनंतपुरम सेंट्रल पहुँच चुके हैं। मिशन संपन्न हुआ।`;
                    speak(english, false);
                    speak(hindi, true);
                } else {
                    const english = `Train has stopped at ${tStation.name}. Opening doors. Please watch your step.`;
                    const hindi = `गाड़ी ${tStation.hindi || tStation.name} स्टेशन पर रुक चुकी है। दरवाज़े खुल रहे हैं। कृपया सावधानी बरतें।`;
                    speak(english, false);
                    speak(hindi, true);
                }
                this.targetStationIdx = -1;
            }
        }

        // ─── STOPPED → doors ───
        if (this.gameState === G_STATE.STOPPED) {
            this.doorOpenAmount = Math.min(this.doorOpenAmount + BOARDING.DOOR_OPEN_RATE * dt, 1);
            if (this.doorOpenAmount >= 1) { this.gameState = G_STATE.BOARDING; this.dwellTimer = BOARDING.DWELL_FRAMES; }
        }

        // ─── BOARDING ───
        if (this.gameState === G_STATE.BOARDING) {
            this.dwellTimer -= dt;
            if (this.dwellTimer <= 0) {
                this.gameState = G_STATE.READY;
                const english = `Boarding is complete. Doors are closing. Stand back from the gates.`;
                const hindi = `बोर्डिंग समाप्त हो चुकी है। दरवाज़े बंद हो रहे हैं। कृपया दरवाज़ों से दूर रहें।`;
                speak(english, false);
                speak(hindi, true);
                try { this.scene.sound.play('chime', { volume: 0.5 }); } catch(e) {}
            }
        }

        // ─── READY → close doors ───
        if (this.gameState === G_STATE.READY) {
            this.doorOpenAmount = Math.max(this.doorOpenAmount - BOARDING.DOOR_CLOSE_RATE * dt, 0);
            if (this.doorOpenAmount <= 0) {
                this.gameState = G_STATE.DEPARTING;
                this.currentStationIdx = -1;
                this.isWaitingForStarter = true;
                this.starterTimer = SIGNALS.STARTER_TIMER_SECONDS;
            }
        }

        // ─── STARTER SIGNAL ───
        if (this.isWaitingForStarter) {
            this.starterTimer -= (delta / 1000);
            this.physics.lockSpeed();
            if (this.starterTimer <= SIGNALS.STARTER_GREEN_LEAD && signalManager?.activateNextStarter) {
                signalManager.activateNextStarter(worldDist);
            }
            if (this.starterTimer <= 0) {
                this.isWaitingForStarter = false;
                this.physics.prepareForDeparture();
                const english = `Starter signal is green. You are cleared to depart.`;
                const hindi = `स्टार्टर सिग्नल हरा है। प्रस्थान के लिए अनुमति है।`;
                speak(english, false);
                speak(hindi, true);
                if (this.gameState === G_STATE.DEPARTING) this.gameState = G_STATE.RUNNING;
            }
        }

        if (this.gameState === G_STATE.DEPARTING && !this.isWaitingForStarter) {
            this.gameState = G_STATE.RUNNING;
        }
    }

    /** Register horn press near W/L boards */
    registerHorn() {
        const wd = this.physics.worldDistance;
        this.wlBoards.forEach(wb => {
            const d = Math.abs(wb.x - wd);
            if (d < 2000 && !wb.honked && !wb.passed) {
                wb.honked = true;
                this.wlStats.honked++;
                // Report to bridge immediately so C# knows it was honked
                bridge.reportWLBoard(true, wb.km);
            }
        });
    }

    isAtStation(worldX) { return this.stations.some(s => Math.abs(worldX - s.x) < 5000); }
    getNextStation() { return this.stations.find(s => s.x > this.physics.worldDistance); }

    getCalloutMessage() {
        if (this.missionComplete) return '🚩 MISSION ACCOMPLISHED';
        if (this.isWaitingForStarter) return '🔴 Waiting for signal';
        return '🟢 STARTER Signal green';
    }

    getStatusText() {
        if (this.isWaitingForStarter) return `SIGNAL CLEARANCE (${Math.max(0, this.starterTimer).toFixed(1)}s)`;
        if (this.gameState === G_STATE.BOARDING) return `BOARDING (${Math.max(0, this.dwellTimer / 60).toFixed(1)}s)`;
        if (this.physics.isEmergencyActive) return 'EMERGENCY - SIGNAL JUMP';
        return this.physics.throttleNotch > 0 ? 'TRACTION MANOEUVER' : 'COASTING';
    }
}
