/**
 * TrafficManager — Moving road vehicles along the route
 *
 * Manages a pool of vehicle sprites (bikes, autos, cars) that:
 *   - Appear on road sections near the track (level crossings, city zones)
 *   - Move at realistic road speeds (independent of train speed)
 *   - Spawn based on zone density (more in city, fewer in paddy fields)
 *   - Move in both directions (left ↔ right)
 *
 * All vehicles are purely 2D side-view sprites.
 */

import { getZoneAt } from './SceneryZoneManager.js';

// Vehicle configs: [key, speed (px/frame), yOffset, depth]
const VEHICLE_TYPES = [
    { key: 'bike',      speed: 1.8, yOff: 28,  depth: 4.2, scale: 2.2 },
    { key: 'auto2',     speed: 1.2, yOff: 22,  depth: 4.1, scale: 2.2 },
    { key: 'car2_c',   speed: 1.5, yOff: 22,  depth: 4.0, scale: 2.0 },
    { key: 'ksrtc_bus', speed: 0.9, yOff: 16,  depth: 3.8, scale: 2.5 },
];

export default class TrafficManager {
    constructor(scene, trackY) {
        this.scene      = scene;
        this.trackY     = trackY;
        this._spawnTimer = 0;
        this._W = scene.cameras.main.width;
        this._pool = [];
        // Smaller pool on mobile to reduce draw calls
        this._buildPool(window.__TRAINSIM_MOBILE__ ? 12 : 24);
    }

    _buildPool(n) {
        const carColors = [0, 1, 2, 3, 4, 5];
        for (let i = 0; i < n; i++) {
            const cfg = VEHICLE_TYPES[i % VEHICLE_TYPES.length];
            // Pick car variant or keep as-is
            let key = cfg.key;
            if (key === 'car2_c') key = `car2_${carColors[i % 6]}`;
            const tex = this.scene.textures.exists(key) ? key :
                        (this.scene.textures.exists('auto2') ? 'auto2' : 'vehicle_auto');

            const s = this.scene.add.sprite(0, 0, tex)
                .setScale(cfg.scale)
                .setOrigin(0.5, 1)
                .setDepth(cfg.depth)
                .setVisible(false);
            if (s.setPipeline) s.setPipeline('Light2D');
            this._pool.push({ sprite: s, cfg, active: false, screenX: 0, vx: 0, y: 0 });
        }
    }

    /**
     * @param {number} delta - frame delta ms
     * @param {object} physics - the game's custom PhysicsEngine instance
     * @param {number} W - screen width
     */
    update(delta, physics, W) {
        const dt        = delta / 16.667;
        const trainSpeed = physics.speed ?? 0;
        const km        = (physics.worldDistance ?? 0) / 3000; // KM_SCALE
        const zone      = getZoneAt(km);

        // ── Spawn timer ──
        const interval = zone.buildingDensity > 0.6 ? 60 : 140;
        this._spawnTimer += dt * Math.max(trainSpeed, 1);
        if (this._spawnTimer > interval) {
            this._spawnTimer = 0;
            this._spawn(W);
        }

        // ── Move + cull ──
        this._pool.forEach(v => {
            if (!v.active) return;

            // Move in screen space (vehicles move independently of train)
            v.screenX += v.vx * dt;

            v.sprite.setPosition(v.screenX, v.y);
            v.sprite.setFlipX(v.vx < 0);

            // Cull if off screen
            if (v.screenX < -200 || v.screenX > W + 200) {
                v.sprite.setVisible(false);
                v.active = false;
            }
        });
    }

    _spawn(W) {
        const free = this._pool.find(v => !v.active);
        if (!free) return;

        const cfg  = VEHICLE_TYPES[Math.floor(Math.random() * VEHICLE_TYPES.length)];
        const goRight = Math.random() > 0.5;

        // Road slightly above or below track level
        const roadY = this.trackY + cfg.yOff + (Math.random() > 0.5 ? 0 : 55);

        const startX = goRight ? -80 : W + 80;
        const vx     = goRight ? cfg.speed * 2.0 : -cfg.speed * 2.0;

        // Resolve texture
        let texKey = cfg.key;
        if (texKey === 'car2_c') texKey = `car2_${Math.floor(Math.random() * 6)}`;
        if (!this.scene.textures.exists(texKey)) texKey = 'auto2';
        if (!this.scene.textures.exists(texKey)) texKey = 'vehicle_auto';
        if (!this.scene.textures.exists(texKey)) return;

        free.sprite.setTexture(texKey).setPosition(startX, roadY).setVisible(true).setAlpha(0.9);
        free.screenX  = startX;
        free.vx       = vx;
        free.y        = roadY;
        free.active   = true;
    }
}

