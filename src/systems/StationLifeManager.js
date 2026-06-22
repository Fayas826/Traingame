/**
 * StationLifeManager — Animated passengers, staff, and vendors on both platforms
 *
 * Manages a pool of people sprites with roles:
 *   sitting    → benches on Platform 1
 *   walking    → drift slowly left/right on both platforms
 *   boarding   → appear near train door when stopped
 *   porter     → carry luggage near entrances
 *   staff      → stand near signal post / platform end
 *   vendor     → drift along platform, disappear
 *
 * All animation is achieved by cycling through 2 walk frames and
 * updating X position each frame — pure 2D, no spritesheets needed.
 */

import { KM_SCALE } from '../config.js';

const PARALLAX_TRACK = 0.98; // match GameScene PARALLAX.TRACK

const ROLES = ['sit', 'walk', 'walk', 'walk', 'board', 'porter', 'staff', 'vendor'];

export default class StationLifeManager {
    constructor(scene, trackY) {
        this.scene  = scene;
        this.trackY = trackY;
        this.pool   = [];      // { sprite, role, offset, speed, platform, life, maxLife, flip }
        this._t     = 0;       // global timer for frame cycling
        this._walkFrame = 0;   // 0 or 1 (alternating legs)

        this._build();
    }

    _build() {
        // Increased crowd count to make stations feel alive (270 desktop, 120 mobile)
        const COUNT = window.__TRAINSIM_MOBILE__ ? 120 : 270;
        for (let i = 0; i < COUNT; i++) {
            const role = ROLES[i % ROLES.length];
            const sprite = this._makeSprite(role, i);
            this.pool.push({
                sprite,
                role,
                offset: (Math.random() - 0.5) * 800,   // wider spread along platform
                speed:  (Math.random() * 0.2 + 0.05) * (Math.random() > 0.5 ? 1 : -1),
                platform: i % 3 === 0 ? 2 : 1,         // 1 = far platform, 2 = near platform
                life: 0,
                maxLife: 300 + Math.random() * 400,
                flip: Math.random() > 0.5,
                stationIdx: i % 18,                    // uniquely assign to one of the 18 stations
            });
        }
    }

    _makeSprite(role, i) {
        let key;
        switch (role) {
            case 'sit':    key = `person_sit_${i % 6}`;    break;
            case 'walk':   key = `person_walk_${i % 6}`;   break;
            case 'board':  key = `person_board_${i % 4}`;  break;
            case 'porter': key = 'porter';                  break;
            case 'staff':  key = 'railway_staff';           break;
            case 'vendor': key = 'vendor';                  break;
            default:       key = `person_sit_0`;
        }

        // Fallback chain: role-specific → generic sit → tree (always exists)
        if (!this.scene.textures.exists(key)) key = 'person_sit_0';
        if (!this.scene.textures.exists(key)) key = 'tree';

        const s = this.scene.add.sprite(0, 0, key)
            .setScale(2.8)
            .setOrigin(0.5, 1)
            .setDepth(5.5)
            .setVisible(false);
        if (s.setPipeline) s.setPipeline('Light2D');
        return s;
    }

    update(delta, physics, stations, W) {
        this._t += delta / 16.667;
        const worldDist = physics.worldDistance;
        const speed     = physics.speed;
        const isStopped = speed < 0.3;

        // Walk leg cycle every 18 frames
        this._walkFrame = Math.floor(this._t / 18) % 2;

        // Hide everyone first
        this.pool.forEach(p => p.sprite.setVisible(false));

        // Re-show people near visible stations
        stations.forEach((st, si) => {
            const wx   = st.km * KM_SCALE;
            const dist = wx - worldDist;
            if (Math.abs(dist) > 5500) return;

            const stCentreX = this.scene.trainFixedX + dist * PARALLAX_TRACK;
            const isAtStation = Math.abs(dist) < 1500;

            this.pool.forEach(p => {
                if (p.stationIdx !== si) return; // uniquely assigned to this station
                if (p.sprite.visible) return;          // already used

                // Update position drift
                p.offset += p.speed * (delta / 16.667);
                if (Math.abs(p.offset) > 700) p.speed *= -1; // bounce at ends

                // Platform Y and Depth
                const platY = p.platform === 1
                    ? this.trackY - 14            // Platform 1 (far, background)
                    : this.trackY + 42;           // Platform 2 (near, foreground)
                const depth = p.platform === 1 ? 4.5 : 12.5;

                const sx = stCentreX + p.offset;

                // Only show if within screen + station visible range
                if (sx < -100 || sx > W + 100) return;
                if (!isAtStation && p.role !== 'walk') return;

                // Boarding passengers only show when train is stopped
                if (p.role === 'board' && !isStopped) return;

                // Walking: flip sprite direction based on drift direction
                const flip = p.speed < 0;
                p.sprite.setFlipX(flip);

                // Night: reduce alpha
                const cycle = this.scene.weather?.dayNightCycle ?? 0.4;
                const isDark = cycle >= 0.58 || cycle <= 0.22;
                const baseAlpha = p.platform === 2 ? 0.75 : 1.0;
                p.sprite.setAlpha(isDark ? baseAlpha * 0.6 : baseAlpha);

                p.sprite.setPosition(sx, platY).setDepth(depth).setVisible(true);
            });
        });
    }
}
