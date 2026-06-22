/**
 * 🚦 SIGNAL MANAGER — 4-aspect signaling with starter logic
 */
import { SIGNALS } from '../config.js';
import { ROUTE_EVENTS, kmToWorld } from './TrackMap.js';

export default class SignalManager {
    constructor(scene) {
        this.scene = scene;
        this.signals = [];
        this.lastWorldDist = 0;
        this.isInitialized = false;
        this._init();
    }

    _init() {
        // Build signals from ROUTE_EVENTS and standard spacing
        let lastKm = 0;
        let signalId = 0;
        
        ROUTE_EVENTS.forEach(event => {
            // Fill large gaps with automatic block signals
            while ((kmToWorld(event.km) - kmToWorld(lastKm)) > 3000) {
                lastKm += 2.0; // Place a block signal every 2km roughly
                this.signals.push({
                    id: `SIG_AUTO_${signalId++}`,
                    x: kmToWorld(lastKm),
                    aspect: 'GREEN',
                    isStarter: false,
                    name: `Auto Signal ${lastKm.toFixed(1)}`
                });
            }

            if (event.type === 'signal_zone' || event.type === 'signal') {
                this.signals.push({
                    id: `SIG_${signalId++}`,
                    x: kmToWorld(event.km),
                    aspect: event.aspect || 'GREEN',
                    isStarter: false,
                    name: event.name || 'Signal'
                });
                lastKm = event.km;
            } else if (event.type === 'station') {
                const trainType = this.scene?.registry?.get('selectedTrainType') || 'Passenger';
                let isStoppage = false;
                if (trainType === 'Express') {
                    isStoppage = ['QLN', 'VAK', 'KZK', 'TVC'].includes(event.code);
                } else if (trainType === 'Superfast') {
                    isStoppage = ['QLN', 'VAK', 'TVC'].includes(event.code);
                } else if (trainType === 'Special') {
                    isStoppage = ['QLN', 'PVU', 'VAK', 'CRY', 'KZK', 'TVCN', 'TVC'].includes(event.code);
                } else { // Passenger / MEMU
                    isStoppage = true;
                }

                // Stations have Home and Starter signals
                if (isStoppage) {
                    this.signals.push({
                        id: `SIG_${signalId++}`,
                        x: kmToWorld(event.km - 0.1), // Home signal just before station
                        aspect: 'RED', // Starts red for stoppage
                        isStarter: false,
                        name: `${event.name} Home`
                    });
                }
                
                this.signals.push({
                    id: `SIG_${signalId++}`,
                    x: kmToWorld(event.km + 0.2), // Starter signal just after station
                    aspect: isStoppage ? 'RED' : 'GREEN',
                    isStarter: true,
                    name: `${event.name} Starter`
                });
                lastKm = event.km;
            }
        });

        // Sort signals by position
        this.signals.sort((a, b) => a.x - b.x);

        // Calculate missing 4-aspect states backwards
        for (let i = this.signals.length - 2; i >= 0; i--) {
            const current = this.signals[i];
            const next = this.signals[i+1];
            
            // If the current signal doesn't have a hardcoded restrictive aspect
            if (current.aspect === 'GREEN' && !current.isStarter) {
                if (next.aspect === 'RED') {
                    current.aspect = 'YELLOW';
                } else if (next.aspect === 'YELLOW') {
                    current.aspect = 'DOUBLE_YELLOW';
                }
            }
        }

        this.isInitialized = true;
    }

    update(worldDist = 0) {
        if (!Array.isArray(this.signals)) {
            console.warn('SignalManager.update: signals array is unavailable.');
            this.signals = [];
            return;
        }

        this.lastWorldDist = Number.isFinite(worldDist) ? worldDist : this.lastWorldDist;

        if (!this.isInitialized) {
            this._recalculateAspects();
            this.isInitialized = true;
            return;
        }

        this._recalculateAspects();
    }

    activateNextStarter(worldDist) {
        const sig = this.signals.find(s => s.isStarter && s.x > worldDist);
        if (sig && sig.aspect !== 'GREEN') {
            sig.aspect = 'GREEN';
            this._recalculateAspects();
        }
    }

    _recalculateAspects() {
        // When a starter turns green, recalculate previous signals
        for (let i = this.signals.length - 2; i >= 0; i--) {
            const current = this.signals[i];
            const next = this.signals[i+1];
            
            if (!current.isStarter && current.aspect !== 'RED') {
                if (next.aspect === 'RED') current.aspect = 'YELLOW';
                else if (next.aspect === 'YELLOW') current.aspect = 'DOUBLE_YELLOW';
                else current.aspect = 'GREEN';
            }
        }
    }

    getAspect(index) {
        return this.signals[index]?.aspect || 'GREEN';
    }

    getNextSignal(worldDist) {
        return this.signals.find(s => s.x > worldDist);
    }

    getSignalCallout(worldDist, baseMsg) {
        let msg = baseMsg;
        const nextSig = this.getNextSignal(worldDist);
        if (nextSig) {
            const dist = nextSig.x - worldDist;
            if (dist > 0 && dist < 1500) { // Approach zone
                if (nextSig.aspect === 'YELLOW') msg = '🟡 Distant yellow signal, caution';
                if (nextSig.aspect === 'DOUBLE_YELLOW') msg = '🟡🟡 Distant double yellow, restrict speed';
                if (nextSig.aspect === 'RED') msg = `🔴 ${nextSig.name} - Danger!`;
            }
        }
        return msg;
    }
}
