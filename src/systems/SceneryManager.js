import { KM_SCALE, PARALLAX } from '../config.js';
import { getBridgeZones } from './TrackMap.js';
import { getZoneAt, pickZoneAsset } from './SceneryZoneManager.js';

/**
 * SceneryManager — Zone-accurate Kerala environment renderer
 *
 * Uses SceneryZoneManager to spawn the correct assets per route km:
 *   Kollam city → suburban → backwaters → paddy → Varkala →
 *   villages → Kazhakuttam IT → Veli Lake → Pettah → TVC
 *
 * Mountains appear only as very faint far-horizon haze — NOT dominant.
 */
export default class SceneryManager {
    constructor(scene, trackY) {
        this.scene  = scene;
        this.trackY = trackY;
        this.objects     = [];
        this.spawnTimer  = 0;

        // Texture availability map (checked lazily on first spawn)
        this._texCache = {};
    }

    update(delta, physics, W) {
        const dt        = delta / 16.667;
        const speed     = physics.speed;
        const worldDist = physics.worldDistance;
        const km        = worldDist / KM_SCALE;

        if (speed > 0.5) {
            this.spawnTimer += dt * Math.max(speed, 2);
            const zone = getZoneAt(km);
            if (this.spawnTimer > zone.spawnInterval) {
                this.spawnTimer = 0;
                this._spawnForZone(zone, worldDist, km, W);
            }
        }

        const cycle = (this.scene && this.scene.weather) ? this.scene.weather.dayNightCycle : 0.4;
        let shadowX = 0;
        let shadowY = 10;
        let shadowAlpha = 0.22;
        
        if (cycle >= 0.2 && cycle <= 0.6) {
            const t = (cycle - 0.2) / 0.4;
            const angle = t * Math.PI;
            const height = Math.sin(angle);
            const cosAngle = Math.cos(angle);
            shadowX = cosAngle * 24;
            shadowY = (1 - height) * 12 + 6;
            shadowAlpha = height * 0.22;
        } else {
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
                shadowX = cosAngle * 12;
                shadowY = (1 - height) * 6 + 6;
                shadowAlpha = height * 0.08;
            } else {
                shadowAlpha = 0;
            }
        }

        // Move + cull objects
        for (let i = this.objects.length - 1; i >= 0; i--) {
            const obj = this.objects[i];
            
            if (obj.sprite.texture.key === 'boat') {
                const bob = Math.sin(this.scene.waterPhase * 1.5 + obj.worldX * 0.05) * 3;
                obj.sprite.y = obj.y + bob;
                obj.worldX += 0.03 * (Math.sin(obj.worldX * 0.1) > 0 ? 1 : -1);
            } else {
                obj.sprite.y = obj.y;
            }

            const sx  = this.scene.trainFixedX + (obj.worldX - worldDist) * obj.parallax;
            obj.sprite.setPosition(sx, obj.sprite.y);
            if (obj.shadow) {
                obj.shadow.setPosition(sx + shadowX * (obj.sprite.scaleX / 3), obj.sprite.y + shadowY * (obj.sprite.scaleY / 3));
                obj.shadow.setAlpha(shadowAlpha * obj.sprite.alpha);
                obj.shadow.setVisible(shadowAlpha > 0 && obj.sprite.texture.key !== 'boat'); // no shadow for boats
            }
            // Cull: use screen-relative threshold (not hardcoded -400)
            if (sx < -(W * 0.3 + 200)) {
                if (obj.shadow) obj.shadow.destroy();
                obj.sprite.destroy();
                this.objects.splice(i, 1);
            }
        }
    }

    _texExists(key) {
        if (this._texCache[key] === undefined) {
            this._texCache[key] = this.scene.textures.exists(key);
        }
        return this._texCache[key];
    }

    _spawnForZone(zone, worldDist, km, W) {
        // Skip bridge zones
        const bridges = getBridgeZones();
        // Approximate worldX for the spawn point
        const approxWorldX = worldDist + (W + 300 - this.scene.trainFixedX) / PARALLAX.MID_TREES;
        const spawnKm = approxWorldX / KM_SCALE;
        const onBridge = bridges.some(bz => approxWorldX >= bz.start && approxWorldX <= bz.end);
        if (onBridge) return;

        // Pick asset from zone
        let assetKey = pickZoneAsset(zone);

        // Fallback chain for missing textures
        const fallbacks = {
            'kerala_house':  'cityBuilding',
            'shop_row':      'cityBuilding',
            'it_building':   'cityBuilding',
            'compound_wall': 'tree',
            'boat':          'palm',
            'ksrtc_bus':     'cityBuilding',
            'auto':          'palm',
        };
        // Extended fallback for Phase 2 assets
        const extFallbacks = {
            'banana_plant':    'palm',
            'wetland':         'tree',
            'coconut_cluster': 'palm',
            'local_road':      'compound_wall',
            'rubber_tree':     'tree',
            'varkala_cliff':   'cityBuilding',
            'it_corridor':     'it_building',
            'veli_lagoon':     'boat',
            'kollam_port':     'cityBuilding',
        };
        if (!this._texExists(assetKey)) {
            assetKey = fallbacks[assetKey] || extFallbacks[assetKey] || 'tree';
        }

        // Decide layer (near vs far)
        const isFar  = Math.random() > 0.45;
        const isTree = ['tree', 'palm', 'boat', 'banana_plant', 'wetland', 'coconut_cluster', 'rubber_tree'].includes(assetKey);
        const isBldg = ['cityBuilding', 'kerala_house', 'shop_row', 'it_building', 'compound_wall',
                        'ksrtc_bus', 'auto', 'it_corridor', 'local_road', 'varkala_cliff',
                        'veli_lagoon', 'kollam_port'].includes(assetKey);

        let scale, depth, yOffset, parallax, alpha;

        if (assetKey === 'boat') {
            scale    = 1.5 + Math.random() * 0.5;
            depth    = 4.1; // floating on top of water (which is depth 4)
            yOffset  = 30;  // put it in water below the tracks
            parallax = PARALLAX.MID_TREES;
            alpha    = 1.0;
        } else if (isBldg) {
            scale    = isFar ? (1.4 + Math.random() * 0.8) : (1.8 + Math.random() * 1.2);
            depth    = isFar ? 1.8 : 2.5;
            yOffset  = isFar ? -55 : -20;
            parallax = isFar ? PARALLAX.FAR_TREES : PARALLAX.MID_TREES * 0.85;
            alpha    = isFar ? (0.45 + Math.random() * 0.3) : (0.75 + Math.random() * 0.25);
        } else {
            // Trees / palms
            scale    = isFar ? (1.2 + Math.random() * 0.6) : (1.8 + Math.random() * 1.0);
            depth    = isFar ? 2 : 3.5;
            yOffset  = isFar ? -10 : 5;
            parallax = isFar ? PARALLAX.FAR_TREES : PARALLAX.MID_TREES;
            alpha    = isFar ? (0.5 + Math.random() * 0.3) : 1;
        }

        const targetSX  = W + 250 + Math.random() * 200;
        const spawnWX   = worldDist + (targetSX - this.scene.trainFixedX) / parallax;
        const finalY    = this.trackY + yOffset;

        const shadow = this.scene.add.sprite(targetSX, finalY, assetKey)
            .setScale(scale)
            .setOrigin(0.5, 1)
            .setDepth(depth - 0.05)
            .setTint(0x000000)
            .setAlpha(0)
            .setVisible(false);

        const sprite = this.scene.add.sprite(targetSX, finalY, assetKey)
            .setScale(scale)
            .setOrigin(0.5, 1)
            .setDepth(depth)
            .setAlpha(alpha);

        if (sprite.setPipeline) sprite.setPipeline('Light2D');

        this.objects.push({ sprite, shadow, worldX: spawnWX, y: finalY, parallax });
    }
}
