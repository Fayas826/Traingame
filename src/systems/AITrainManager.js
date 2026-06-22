/**
 * 🚂 AI TRAIN MANAGER
 * Handles spawning and movement of fully formed opposite direction trains.
 */
import { VISUAL, LOCO_PROFILES, RAKE_PROFILES } from '../config.js';
import Train from '../entities/Train.js';

export default class AITrainManager {
    constructor(scene, trackY) {
        this.scene = scene;
        this.trackY = trackY;
        this.aiTrains = []; // active AI trains
        this.spawnTimer = 0;
        
        this.availableLocos = ['wap7', 'wap4', 'wag12', 'vande', 'wag9', 'wdm3a'];
        this.availableRakes = ['coach_lhb', 'coach_icf', 'coach_tanker', 'coach_boxn'];
    }

    update(delta, physics, W) {
        const dt = delta / 16.667; 
        const playerSpeed = physics.speed;
        
        // Spawn logic
        if (playerSpeed > 5) {
            this.spawnTimer += dt;
            // Spawn train based on chance and timer
            if (this.spawnTimer > 1500 && Math.random() < VISUAL.OPP_TRAIN_SPAWN_CHANCE) {
                this.spawnTimer = 0;
                this._spawnTrain(W);
            }
        }

        // Update active trains
        for (let i = this.aiTrains.length - 1; i >= 0; i--) {
            const ai = this.aiTrains[i];
            
            // AI Train specific speed + player speed relative to background
            const relSpeed = VISUAL.OPP_TRAIN_SPEED + playerSpeed * 2;
            ai.x -= relSpeed * dt;
            ai.speed += relSpeed * dt; // for wheel rotation accumulation

            // Update the Train entity
            ai.trainEntity.setTrainX(ai.x);
            // coachOffsets is empty [0,0,0,0] for AI trains for simplicity
            const emptyOffsets = Array(ai.coachCount).fill(0);
            ai.trainEntity.update(null, emptyOffsets, 0, ai.speed);

            // Camera shake when passing opposing trains (vibration and wind buffeting)
            if (Math.abs(ai.x - this.scene.trainFixedX) < 600 && playerSpeed > 0.5) {
                this.scene.cameras.main.shake(50, 0.001);
            }

            // Horn sound trigger (play when loco is just entering the screen)
            if (!ai.honked && ai.x < W + 100 && ai.x > W) {
                ai.honked = true;
                ai.trainEntity.toggleLights(); // turn on headlights!
                
                // Play horn with doppler (lower pitch, move from right to left)
                try {
                    const u = new SpeechSynthesisUtterance("HONNKKKK");
                    u.rate = 0.8; u.pitch = 0.5; u.volume = 0.4;
                    speechSynthesis.speak(u);
                } catch(e) {}
            }

            // Cleanup when entirely off-screen to the left
            if (ai.x < -1500 - (ai.coachCount * 300)) {
                ai.trainEntity.destroy();
                this.aiTrains.splice(i, 1);
            }
        }
    }

    _spawnTrain(W) {
        const locoKey = this.availableLocos[Math.floor(Math.random() * this.availableLocos.length)];
        let rakeKey = this.availableRakes[Math.floor(Math.random() * this.availableRakes.length)];
        
        // Vande Bharat logic (usually self-propelled, but we'll use a matching coach if available, else LHB)
        if (locoKey === 'vande') rakeKey = 'coach_lhb'; 

        const coachCount = 4 + Math.floor(Math.random() * 4); // 4 to 7 coaches
        
        // Create the Train entity facing LEFT
        const trainEntity = new Train(this.scene, this.trackY, locoKey, rakeKey, coachCount, true);
        trainEntity.setTrainX(W + 1000); // Start way offscreen to the right

        this.aiTrains.push({
            x: W + 1000,
            trainEntity: trainEntity,
            coachCount: coachCount,
            speed: 0,
            honked: false
        });
    }
}
