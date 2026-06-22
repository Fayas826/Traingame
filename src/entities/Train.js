/**
 * 🚂 TRAIN ENTITY V2 — Supports any loco + rake combo texture
 */
import { COACH, PHYSICS } from '../config.js';
import { getElevationAt, ELEVATION_SCALE } from '../systems/TrackMap.js';

export default class Train {
    constructor(scene, trackY, locoKey = 'wap7', coachKey = 'coach_lhb', coachCount = 4, isFacingLeft = false) {
        this.scene = scene;
        this.trackY = trackY;
        this.trainX = 0;
        this.lampsOn = false;
        this.locoKey = locoKey;
        this.coachKey = coachKey;
        this.isFacingLeft = isFacingLeft;

        this.coaches = [];
        this.wheels = [];
        this.coachSpacing = 100;
        this.coachCount = coachCount;

        this.coachShadows = [];
        this.locoShadow = null;
        this._build();
    }

    _build() {
        const scale = 3;
        for (let i = this.coachCount - 1; i >= 0; i--) {
            // Coach shadow
            const shadow = this.scene.add.sprite(0, 0, this.coachKey).setScale(scale).setOrigin(0.5, 1).setTint(0x000000).setAlpha(0.22).setDepth(this.isFacingLeft ? 3.8 : 4.5);
            if (this.isFacingLeft) shadow.setFlipX(true);
            this.coachShadows.push(shadow);

            const coach = this.scene.add.sprite(0, 0, this.coachKey).setScale(scale).setOrigin(0.5, 1).setDepth(this.isFacingLeft ? 4 : 10);
            if (this.isFacingLeft) coach.setFlipX(true);
            coach.setPipeline('Light2D');
            this.coaches.push(coach);
            for (let w = 0; w < 2; w++) {
                const wh = this.scene.add.sprite(0, 0, 'wheel').setScale(scale * 0.8).setOrigin(0.5, 0.5).setDepth(this.isFacingLeft ? 4 : 9);
                wh.setPipeline('Light2D');
                this.wheels.push(wh);
            }
        }
        
        // Loco shadow
        this.locoShadow = this.scene.add.sprite(0, 0, this.locoKey).setScale(scale).setOrigin(0.5, 1).setTint(0x000000).setAlpha(0.22).setDepth(this.isFacingLeft ? 3.9 : 4.6);
        if (this.isFacingLeft) this.locoShadow.setFlipX(true);

        this.loco = this.scene.add.sprite(0, 0, this.locoKey).setScale(scale).setOrigin(0.5, 1).setDepth(this.isFacingLeft ? 5 : 11);
        if (this.isFacingLeft) this.loco.setFlipX(true);
        this.loco.setPipeline('Light2D');
        for (let w = 0; w < 2; w++) {
            const wh = this.scene.add.sprite(0, 0, 'wheel').setScale(scale * 0.8).setOrigin(0.5, 0.5).setDepth(this.isFacingLeft ? 4 : 9);
            wh.setPipeline('Light2D');
            this.wheels.push(wh);
        }
        this.headlight = this.scene.add.circle(0, 0, 8, 0xffffe0, 0).setDepth(this.isFacingLeft ? 5 : 12);
        this.headlightCone = this.scene.add.graphics().setDepth(21).setBlendMode(Phaser.BlendModes.ADD);

        // Add dynamic light source
        this.headlightLight = this.scene.lights.addLight(0, 0, 300, 0xffffe0, 0);
    }

    update(physics, coachOffsets, doorOpenAmount, speed = 0) {
        const scale = 3, tx = this.trainX, ty = this.trackY, wheelY = ty + 4;
        const dir = this.isFacingLeft ? -1 : 1;

        const cycle = (this.scene && this.scene.weather) ? this.scene.weather.dayNightCycle : 0.4;
        let shadowX = 0;
        let shadowY = 10;
        let shadowAlpha = 0.22;
        
        // Solar-tracking shadow calculation:
        // Day cycle runs from 0.2 (sunrise) to 0.6 (sunset)
        if (cycle >= 0.2 && cycle <= 0.6) {
            const t = (cycle - 0.2) / 0.4;
            const angle = t * Math.PI; // 0 to PI
            const height = Math.sin(angle); // 0 to 1
            const cosAngle = Math.cos(angle); // 1 to -1
            
            shadowX = cosAngle * 24;
            shadowY = (1 - height) * 12 + 6;
            shadowAlpha = height * 0.22;
        } else {
            // Night cycle moon shadow:
            // Moon rises at 0.7, sets at 0.1
            let isMoonActive = false;
            let tMoon = 0;
            if (cycle >= 0.7) {
                isMoonActive = true;
                tMoon = (cycle - 0.7) / 0.4;
            } else if (cycle <= 0.1) {
                isMoonActive = true;
                tMoon = (cycle + 0.3) / 0.4;
            }
            
            if (isMoonActive) {
                const angle = tMoon * Math.PI;
                const height = Math.sin(angle);
                const cosAngle = Math.cos(angle);
                shadowX = cosAngle * 12; // shorter moon shadow
                shadowY = (1 - height) * 6 + 6;
                shadowAlpha = height * 0.08; // very faint moon shadow
            } else {
                shadowAlpha = 0; // pitch dark
            }
        }

        // Enforce active, visible, and depth properties to prevent culling or clipping bugs
        const trainElev = physics ? getElevationAt(physics.worldDistance) : 0;

        if (this.loco) {
            const ly = ty + (coachOffsets[0] || 0) * scale;
            this.loco.setPosition(tx, ly);
            this.loco.setVisible(true);
            this.loco.setAlpha(1);
            this.loco.setDepth(this.isFacingLeft ? 5 : 11);
            if (this.locoShadow) {
                this.locoShadow.setPosition(tx + shadowX, ly + shadowY);
                this.locoShadow.setAlpha(shadowAlpha);
                this.locoShadow.setVisible(shadowAlpha > 0);
            }
        }
        
        for (let i = 0; i < this.coaches.length; i++) {
            const coach = this.coaches[i];
            const shadow = this.coachShadows[i];
            if (coach) {
                const coachWorldX = physics ? (physics.worldDistance - (i + 1) * this.coachSpacing * scale * dir) : 0;
                const coachElev = physics ? getElevationAt(coachWorldX) : 0;
                const coachElevOffset = -(coachElev - trainElev) * ELEVATION_SCALE;

                const cy = ty + (coachOffsets[Math.min(i, coachOffsets.length - 1)] || 0) * scale + coachElevOffset;
                const cx = tx - (i + 1) * this.coachSpacing * scale * dir;
                coach.setPosition(cx, cy);
                coach.setVisible(true);
                coach.setAlpha(1);
                coach.setDepth(this.isFacingLeft ? 4 : 10);
                if (shadow) {
                    shadow.setPosition(cx + shadowX, cy + shadowY);
                    shadow.setAlpha(shadowAlpha);
                    shadow.setVisible(shadowAlpha > 0);
                }
            }
        }
        
        const locoWheelIdx = this.wheels.length - 2;
        const locoW = 128 * scale, coachW = 96 * scale;
        
        // Wheel rotation
        const rot = physics ? physics.wheelRotation : (speed * 0.05);

        if (this.wheels[locoWheelIdx]) {
            const w1WorldX = physics ? (physics.worldDistance - locoW * 0.25 * dir) : 0;
            const w1ElevOffset = physics ? -(getElevationAt(w1WorldX) - trainElev) * ELEVATION_SCALE : 0;
            this.wheels[locoWheelIdx].setPosition(tx - locoW * 0.25 * dir, wheelY + w1ElevOffset).setRotation(rot);
            this.wheels[locoWheelIdx].setVisible(true);
            this.wheels[locoWheelIdx].setAlpha(1);
            this.wheels[locoWheelIdx].setDepth(this.isFacingLeft ? 4 : 9);
        }
        if (this.wheels[locoWheelIdx + 1]) {
            const w2WorldX = physics ? (physics.worldDistance + locoW * 0.15 * dir) : 0;
            const w2ElevOffset = physics ? -(getElevationAt(w2WorldX) - trainElev) * ELEVATION_SCALE : 0;
            this.wheels[locoWheelIdx + 1].setPosition(tx + locoW * 0.15 * dir, wheelY + w2ElevOffset).setRotation(rot);
            this.wheels[locoWheelIdx + 1].setVisible(true);
            this.wheels[locoWheelIdx + 1].setAlpha(1);
            this.wheels[locoWheelIdx + 1].setDepth(this.isFacingLeft ? 4 : 9);
        }
        
        for (let i = 0; i < this.coaches.length; i++) {
            const cx = this.coaches[i] ? this.coaches[i].x : 0;
            const cy = this.coaches[i] ? this.coaches[i].y : ty;
            const coachWorldX = physics ? (physics.worldDistance - (i + 1) * this.coachSpacing * scale * dir) : 0;
            
            const w1 = this.wheels[i * 2];
            const w2 = this.wheels[i * 2 + 1];
            if (w1) {
                const cw1WorldX = coachWorldX - coachW * 0.25 * dir;
                const cw1ElevOffset = physics ? -(getElevationAt(cw1WorldX) - trainElev) * ELEVATION_SCALE : 0;
                w1.setPosition(cx - coachW * 0.25 * dir, wheelY + cw1ElevOffset).setRotation(rot);
                w1.setVisible(true);
                w1.setAlpha(1);
                w1.setDepth(this.isFacingLeft ? 4 : 9);
            }
            if (w2) {
                const cw2WorldX = coachWorldX + coachW * 0.15 * dir;
                const cw2ElevOffset = physics ? -(getElevationAt(cw2WorldX) - trainElev) * ELEVATION_SCALE : 0;
                w2.setPosition(cx + coachW * 0.15 * dir, wheelY + cw2ElevOffset).setRotation(rot);
                w2.setVisible(true);
                w2.setAlpha(1);
                w2.setDepth(this.isFacingLeft ? 4 : 9);
            }
        }
        
        const hlX = tx + locoW * 0.48 * dir, hlY = ty - 20 * scale;
        if (this.headlight) {
            this.headlight.setPosition(hlX, hlY).setAlpha(this.lampsOn ? 0.9 : 0);
            this.headlight.setDepth(this.isFacingLeft ? 5 : 12);
        }
        if (this.headlightLight) {
            this.headlightLight.setPosition(hlX + 150 * dir, hlY);
            this.headlightLight.setIntensity(this.lampsOn ? 2.5 : 0);
        }
        if (this.headlightCone) {
            this.headlightCone.clear();
            this.headlightCone.setDepth(21);
            if (this.lampsOn) {
                this.headlightCone.fillStyle(0xffffe0, 0.12);
                this.headlightCone.fillTriangle(hlX, hlY, hlX + 600 * dir, hlY - 180, hlX + 600 * dir, hlY + 220);
            }
        }
    }

    toggleLights() { this.lampsOn = !this.lampsOn; }
    setTrainX(x) { this.trainX = x; }
    setTrackY(y) { this.trackY = y; }
    
    destroy() {
        if (this.locoShadow) this.locoShadow.destroy();
        this.coachShadows.forEach(s => s.destroy());
        this.loco.destroy();
        this.coaches.forEach(c => c.destroy());
        this.wheels.forEach(w => w.destroy());
        this.headlight.destroy();
        this.headlightCone.destroy();
        if (this.headlightLight) this.scene.lights.removeLight(this.headlightLight);
    }
}
