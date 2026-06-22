/**
 * 👨‍✈️ ALP MANAGER — Assistant Loco Pilot
 * Handles callouts, signal validation, and penalty triggers.
 */

export default class ALPManager {
    constructor(signalManager, speak) {
        this.signalManager = signalManager;
        this.speak = speak;
        
        this.lastSignalId = null;
        this.lastCalloutTime = 0;
    }

    update(physics, delta) {
        if (!this.signalManager?.getNextSignal) return;

        const worldDist = physics.worldDistance;
        const currentSpeedKmph = physics.speed * 10; // Approx KM/H conversion

        // Check nearest signal ahead
        const nextSig = this.signalManager.getNextSignal(worldDist);
        if (!nextSig) return;

        const distToSignal = nextSig.x - worldDist;

        // SPAD Check: if we passed a RED signal recently (runs every frame for responsiveness)
        if (distToSignal < -5 && distToSignal > -200 && nextSig.aspect === 'RED' && !physics.isEmergencyActive) {
            this.speak("SPAD Violation! Emergency Brakes Applied!");
            physics.applyEmergencyBrake();
            nextSig.aspect = 'RED_PASSED'; // prevent multiple triggers
        }

        // Throttle remaining checks to run once every 10 frames
        this.updateFrameCount = (this.updateFrameCount || 0) + 1;
        if (this.updateFrameCount % 10 === 0) {
            // Wheel slip warning (runs every 4 seconds when wheel slip is active)
            if (physics.isWheelSlipActive) {
                const now = Date.now();
                if (!this.lastWheelSlipWarningTime || (now - this.lastWheelSlipWarningTime > 4000)) {
                    this.speak("Wheel slip active! Reduce throttle notches.");
                    this.lastWheelSlipWarningTime = now;
                }
            }
            // ─── Callouts (at 1000m) ───
            if (distToSignal > 0 && distToSignal < 1200 && this.lastSignalId !== nextSig.id) {
                this.lastSignalId = nextSig.id;
                
                if (nextSig.aspect === 'GREEN') {
                    this.speak(`Signal is Green. Proceed.`);
                } else if (nextSig.aspect === 'DOUBLE_YELLOW') {
                    this.speak(`Double Yellow. Restrict speed.`);
                } else if (nextSig.aspect === 'YELLOW') {
                    this.speak(`Yellow. Caution, prepare to stop.`);
                } else if (nextSig.aspect === 'RED') {
                    this.speak(`Red signal ahead. Stop immediately.`);
                }
            }

            // Speed check under restrictive aspects
            if (distToSignal > 0 && distToSignal < 500) {
                if (nextSig.aspect === 'YELLOW' && currentSpeedKmph > 60) {
                    if (Date.now() - this.lastCalloutTime > 5000) {
                        this.speak("Overspeeding under Caution. Apply Brakes.");
                        this.lastCalloutTime = Date.now();
                    }
                } else if (nextSig.aspect === 'DOUBLE_YELLOW' && currentSpeedKmph > 90) {
                    if (Date.now() - this.lastCalloutTime > 5000) {
                        this.speak("Overspeeding under Double Yellow.");
                        this.lastCalloutTime = Date.now();
                    }
                }
            }
        }
    }
}
