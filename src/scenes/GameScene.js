import Phaser from 'phaser';
import { PHYSICS, PARALLAX, VISUAL, SIGNALS, G_STATE, LOCO_PROFILES, RAKE_PROFILES, KM_SCALE, getStructuralType } from '../config.js';
import { ROUTE_EVENTS, kmToWorld, getStations, getBridgeZones, getElevationAt, ELEVATION_SCALE, getGradientAt, getSpeedLimitAt } from '../systems/TrackMap.js';
import PhysicsEngine from '../systems/PhysicsEngine.js';
import StationManager from '../systems/StationManager.js';
import SignalManager from '../systems/SignalManager.js';
import WeatherSystem from '../systems/WeatherSystem.js';
import AudioMixer from '../systems/AudioMixer.js';
import ALPManager from '../systems/ALPManager.js';
import Train from '../entities/Train.js';
import AITrainManager from '../systems/AITrainManager.js';
import SceneryManager from '../systems/SceneryManager.js';
import StationLifeManager from '../systems/StationLifeManager.js';
import TrafficManager from '../systems/TrafficManager.js';
import PASystem from '../systems/PASystem.js';
import { BRIDGE_TYPES } from '../systems/SceneryZoneManager.js';
import bridge from '../systems/BackendBridge.js';

const LOCO_TEX = { 'WAP-7':'wap7','WAP-4':'wap4','WAG-12':'wag12','VANDE_BHARAT':'vande','WAG-9':'wag9','WDM-3A':'wdm3a' };
const RAKE_TEX = { 'LHB':'coach_lhb','ICF':'coach_icf','TANKER':'coach_tanker','BOXN':'coach_boxn' };

export default class GameScene extends Phaser.Scene {
    constructor() { super({ key: 'GameScene' }); }

    create() {
        this._signalDiagnosticsLogged = false;
        this._signalInitWarningShown = false;
        this._signalUpdateWarningShown = false;

        // Reveal HTML HUD elements when gameplay starts (which changes container height)
        document.getElementById('alp-hud')?.classList.remove('hud-hidden');
        document.getElementById('mission-stat')?.classList.remove('hud-hidden');
        document.getElementById('cockpit-ui')?.classList.remove('hud-hidden');
        document.getElementById('train-debug-panel')?.classList.remove('hud-hidden');
        document.body.classList.add('systems-active');

        this.autopilotActive = false;
        this.autopilotTimer = 0;
        this.currentCameraView = 'ISOMETRIC';
        this.currentCameraViewIndex = 0;
        this.cameraViews = ['ISOMETRIC', 'DYNAMIC_ZOOM', 'CINEMATIC', 'DRIVER', 'DRONE', 'TRACKSIDE', 'STATION'];
        this.tracksideWorldX = 0;

        // Instantly resize the Phaser canvas to match the new container height
        const container = document.getElementById('game-container');
        if (container) {
            this.scale.resize(container.clientWidth, container.clientHeight);
        }

        const W = this.cameras.main.width, H = this.cameras.main.height;
        const isMobile = W < 800;
        this.trackY = H * (isMobile ? VISUAL.TRACK_Y_RATIO_MOBILE : VISUAL.TRACK_Y_RATIO);
        this.trainFixedX = W * VISUAL.TRAIN_FIXED_X_RATIO;

        // Initialize Dynamic Lighting Pipeline
        this.lights.enable();
        this.lights.setAmbientColor(0xffffff);

        // Pool of warm station platform lights (lit at night/sunset)
        this.stationLights = [];
        for (let i = 0; i < 4; i++) {
            this.stationLights.push(this.lights.addLight(0, 0, 400, 0xffbb66, 0));
        }

        // Read loco/rake selection from registry
        const locoId = this.registry.get('selectedLoco') || 'WAP-7';
        const rakeId = this.registry.get('selectedRake') || 'LHB';
        const locoTex = LOCO_TEX[locoId] || 'wap7';
        const rakeTex = RAKE_TEX[rakeId] || 'coach_lhb';
        const rakeProfile = RAKE_PROFILES[rakeId] || RAKE_PROFILES['LHB'];

        // Systems
        this.physics = new PhysicsEngine(locoId, rakeId);
        this.physics.scene = this;
        this.stationMgr = new StationManager(this.physics, this);
        try {
            this.signalMgr = new SignalManager(this);
        } catch (error) {
            this.signalMgr = null;
            this._signalInitWarningShown = true;
            console.warn('SignalManager failed to initialize. Continuing without signal updates.', error);
        }
        console.log('SignalManager:', this.signalMgr);
        console.log('Update Type:', typeof this.signalMgr?.update);
        this.alpMgr = new ALPManager(this.signalMgr, (msg) => this._speak(msg));
        this.weather = new WeatherSystem();
        this.audio = new AudioMixer(this);
        this.train = new Train(this, this.trackY, locoTex, rakeTex, rakeProfile.coachCount);
        this.train.setTrainX(this.trainFixedX);

        // Parallax layers
        this._buildSky(W, H);
        this._buildBackground(W, H);

        // Track segments pool (2.5D elevation compliant)
        this.trackSegments = [];
        for (let i = 0; i < 24; i++) {
            const s = this.add.sprite(0, 0, 'track').setScale(3).setOrigin(0.5, 0.5).setDepth(5);
            s.setPipeline('Light2D');
            this.trackSegments.push(s);
        }

        // OHE wire
        this.oheWire = this.add.graphics().setDepth(6);
        this.pantoGfx = this.add.graphics().setDepth(11.1);

        // Signal sprites pool
        this.signalSprites = [];
        for (let i = 0; i < 8; i++) {
            const s = this.add.sprite(0, 0, 'signal_green').setScale(3).setOrigin(0.5, 1).setDepth(7).setVisible(false);
            this.signalSprites.push(s);
        }

        // Route furniture pools
        this.furnitureSprites = { overpass:[], lcGate:[], wlBoard:[], underpass:[], yard:[], platform:[], roof:[] };
        this._initPool('overpass', 'overpass', 4, 3, 14);
        this._initPool('lcGate', 'lcGate', 5, 2.5, 7);
        this._initPool('wlBoard', 'wlBoard', 6, 2, 7);
        this._initPool('underpass', 'underpass', 3, 2.5, 14);
        this._initPool('yard', 'yardBg', 2, 3, 3);
        this._initPool('platform', 'platform', 4, 3, 4);
        this._initPool('roof', 'stationRoof', 4, 3, 3);

        // ─── PLATFORM 2 (far/opposite side) ───
        this.platform2Sprites = [];
        this.platBenches      = [];
        this.ledBoards        = [];
        for (let i = 0; i < 14; i++) {
            const p2 = this.add.sprite(0, 0, 'platform2')
                .setScale(3, 2.2).setOrigin(0.5, 0).setDepth(12.0).setVisible(false).setAlpha(0.85);
            if (p2.setPipeline) p2.setPipeline('Light2D');
            this.platform2Sprites.push(p2);

            // Bench on near platform
            const bench = this.add.sprite(0, 0, 'platBench')
                .setScale(2.5).setOrigin(0.5, 1).setDepth(4.1).setVisible(false);
            this.platBenches.push(bench);

            // LED board on far platform
            const led = this.add.sprite(0, 0, 'ledBoard')
                .setScale(2.2).setOrigin(0.5, 1).setDepth(12.2).setVisible(false);
            this.ledBoards.push(led);
        }

        // ─── ROB (Road Over Bridge) POOL ───
        this.robSprites = [];
        for (let i = 0; i < 8; i++) {
            const rob = this.add.sprite(0, 0, 'rob')
                .setScale(2.2, 1.8).setOrigin(0.5, 1).setDepth(2).setVisible(false).setAlpha(0.92);
            if (rob.setPipeline) rob.setPipeline('Light2D');
            this.robSprites.push(rob);
        }

        // Scenery is handled dynamically via SceneryManager

        // ─── SIGNAL BOARD POOL (G-boards, speed boards, neutral section) ───
        this.signBoardSprites = [];
        const signBoardConfigs = [
            { key: 'gBoard',         scale: 2.2, depth: 4.5 },
            { key: 'speedBoard_50',  scale: 2.0, depth: 4.5 },
            { key: 'speedBoard_30',  scale: 2.0, depth: 4.5 },
            { key: 'neutralBoard',   scale: 2.2, depth: 4.5 },
        ];
        // 3 of each type = 12 total boards along the route
        for (let rep = 0; rep < 3; rep++) {
            signBoardConfigs.forEach(cfg => {
                if (!this.textures.exists(cfg.key)) return;
                const s = this.add.sprite(0, 0, cfg.key)
                    .setScale(cfg.scale).setOrigin(0.5, 1).setDepth(cfg.depth).setVisible(false);
                if (s.setPipeline) s.setPipeline('Light2D');
                this.signBoardSprites.push({ sprite: s, key: cfg.key });
            });
        }

        // ─── WATER RIPPLE TILES (animate on rivers/lakes) ───
        this.waterTiles = [];
        if (this.textures.exists('waterRipple')) {
            for (let i = 0; i < 20; i++) {
                const wt = this.add.sprite(0, 0, 'waterRipple')
                    .setScale(3, 2.5).setOrigin(0, 0).setDepth(3.8).setVisible(false).setAlpha(0.85);
                this.waterTiles.push({ sprite: wt, phase: Math.random() * Math.PI * 2 });
            }
        }
        this._waterTimer = 0;

        // Rain particles
        this.rainEmitter = null;
        if (this.textures.exists('raindrop')) {
            this.rainEmitter = this.add.particles(0, 0, 'raindrop', {
                x: { min: 0, max: W }, y: -10, speedY: { min: 300, max: 500 },
                speedX: { min: -50, max: -20 }, lifespan: 1500, quantity: 2,
                alpha: { start: 0.7, end: 0 }, scaleX: 1, scaleY: 1.5, depth: 20,
            });
            this.rainEmitter.stop();
        }

        // Night overlay
        this.nightOverlay = this.add.rectangle(W/2, H/2, W, H, 0x000022, 0).setDepth(19).setBlendMode(Phaser.BlendModes.MULTIPLY);

        // God-rays graphics (rendered just above sky, depth 0.5)
        this.godRaysGfx = this.add.graphics().setDepth(0).setAlpha(0);
        this.godRayAngle = 0;

        // Stars
        this.stars = this.add.graphics().setDepth(0);
        this.starPositions = Array.from({ length: 120 }, () => ({ x: Math.random() * W, y: Math.random() * H * 0.45, twinkle: Math.random() * Math.PI * 2 }));

        // ─── SMOKE PARTICLE POOL ───
        this.smokeTimer = 0;
        this.smokeParticles = [];
        for (let i = 0; i < 30; i++) {
            const s = this.add.circle(0, 0, 4, 0x888888, 0).setDepth(13);
            this.smokeParticles.push({ sprite: s, life: 0, vx: 0, vy: 0, maxLife: 0 });
        }

        // ─── PANTOGRAPH SPARK POOL ───
        this.sparkParticles = [];
        for (let i = 0; i < 15; i++) {
            const sp = this.add.circle(0, 0, 2, 0x00ccff, 0).setDepth(15);
            this.sparkParticles.push({ sprite: sp, life: 0, vx: 0, vy: 0, maxLife: 0 });
        }

        // ─── WHEEL SLIP SPARK POOL ───
        this.wheelSparks = [];
        for (let i = 0; i < 15; i++) {
            const sp = this.add.circle(0, 0, 2, 0xffaa00, 0).setDepth(15);
            this.wheelSparks.push({ sprite: sp, life: 0, vx: 0, vy: 0, maxLife: 0 });
        }

        // ─── ROAD TRAFFIC POOL ───
        this.roadVehicles = [];
        const vehicleTypes = ['vehicle_auto', 'vehicle_car', 'vehicle_truck', 'ksrtc_bus', 'bike'];
        for (let i = 0; i < 48; i++) {
            const type = vehicleTypes[i % vehicleTypes.length];
            const scale = (type === 'ksrtc_bus') ? 1.8 : ((type === 'bike') ? 2.2 : 2.5);
            const s = this.add.sprite(0, 0, type).setScale(scale).setDepth(4).setVisible(false);
            s.setPipeline('Light2D');
            this.roadVehicles.push(s);
        }

        // ─── UPGRADED LEVEL CROSSING GATES ───
        this.lcGatesPool = [];
        let vehicleIndex = 0;
        for (let i = 0; i < 8; i++) {
            const road = this.add.sprite(0, 0, 'lc_road').setScale(2.0).setDepth(4).setVisible(false);
            const leftPost = this.add.sprite(0, 0, 'lc_post').setScale(1.2).setOrigin(0.5, 1).setDepth(7).setVisible(false);
            const rightPost = this.add.sprite(0, 0, 'lc_post').setScale(1.2).setOrigin(0.5, 1).setDepth(7).setVisible(false);
            const leftArm = this.add.sprite(0, 0, 'lc_arm').setScale(1.2).setOrigin(0, 0.5).setDepth(7).setVisible(false);
            const rightArm = this.add.sprite(0, 0, 'lc_arm').setScale(1.2).setOrigin(1, 0.5).setDepth(7).setVisible(false);

            road.setPipeline('Light2D');
            leftPost.setPipeline('Light2D');
            rightPost.setPipeline('Light2D');
            leftArm.setPipeline('Light2D');
            rightArm.setPipeline('Light2D');

            // Attach 6 road vehicles per gate (3 left, 3 right)
            const vehicles = [];
            for (let v = 0; v < 6; v++) {
                const sprite = this.roadVehicles[vehicleIndex % this.roadVehicles.length];
                vehicleIndex++;
                const isLeft = (v % 2 === 0);
                const posIndex = Math.floor(v / 2); // 0, 1, 2
                vehicles.push({
                    sprite,
                    side: isLeft ? 'left' : 'right',
                    posIndex: posIndex,
                    relativeX: isLeft 
                        ? -120 - posIndex * 50 - Math.random() * 15 
                        : 120 + posIndex * 50 + Math.random() * 15,
                    speed: 0,
                    maxSpeed: 1.0 + Math.random() * 0.5,
                    waiting: false
                });
            }

            this.lcGatesPool.push({
                road,
                leftPost,
                rightPost,
                leftArm,
                rightArm,
                currentAngle: -90,
                vehicles
            });
        }

        // ─── KILOMETER STONE POOL ───
        this.kmStones = [];
        for (let i = 0; i < 5; i++) {
            const s = this.add.sprite(0, 0, 'km_stone').setScale(2.5).setOrigin(0.5, 1).setDepth(6).setVisible(false);
            const t = this.add.text(0, 0, '', {
                fontSize: '8px',
                fontFamily: 'monospace',
                color: '#000000',
                fontWeight: 'bold'
            }).setOrigin(0.5, 1).setDepth(7).setVisible(false);
            this.kmStones.push({ sprite: s, text: t });
        }

        // ─── PARKED COACHES POOL FOR YARDS ───
        this.parkedCoaches = [];
        for (let i = 0; i < 12; i++) {
            const key = i % 2 === 0 ? 'coach_lhb' : 'coach_icf';
            const c = this.add.sprite(0, 0, key).setScale(1.8).setOrigin(0.5, 1).setDepth(3.05).setVisible(false);
            c.setPipeline('Light2D');
            this.parkedCoaches.push(c);
        }

        // ─── SWITCH SPRITES POOL ───
        this.switchSprites = [];
        for (let i = 0; i < 12; i++) {
            const s = this.add.sprite(0, 0, 'track_switch_left').setScale(3).setOrigin(0.5, 1).setDepth(4.6).setVisible(false);
            s.setPipeline('Light2D');
            this.switchSprites.push(s);
        }

        // ─── TERMINAL FACADES ───
        this.kollamFacadeShadow = this.add.sprite(0, 0, 'facade_kollam').setScale(3).setOrigin(0.5, 1).setDepth(3.0).setTint(0x000000).setAlpha(0.22).setVisible(false);
        this.kollamFacade = this.add.sprite(0, 0, 'facade_kollam').setScale(3).setOrigin(0.5, 1).setDepth(3.1).setVisible(false);
        this.kollamFacade.setPipeline('Light2D');

        this.tvcFacadeShadow = this.add.sprite(0, 0, 'facade_tvc').setScale(3).setOrigin(0.5, 1).setDepth(3.0).setTint(0x000000).setAlpha(0.22).setVisible(false);
        this.tvcFacade = this.add.sprite(0, 0, 'facade_tvc').setScale(3).setOrigin(0.5, 1).setDepth(3.1).setVisible(false);
        this.tvcFacade.setPipeline('Light2D');

        // ─── STATION NAME LABELS ───
        this.stationLabels = [];
        for (let i = 0; i < 6; i++) {
            const mainLabel = this.add.text(0, 0, '', {
                fontFamily: '"Orbitron", monospace', fontSize: '18px', color: '#ffffff',
                stroke: '#000000', strokeThickness: 3, align: 'center',
            }).setOrigin(0.5).setDepth(16).setVisible(false);
            const hindiLabel = this.add.text(0, 0, '', {
                fontFamily: '"Inter", sans-serif', fontSize: '13px', color: '#f1c40f',
                stroke: '#000000', strokeThickness: 2, align: 'center',
            }).setOrigin(0.5).setDepth(16).setVisible(false);
            this.stationLabels.push({ main: mainLabel, hindi: hindiLabel });
        }

        // ─── WATER REFLECTION GRAPHICS ───
        this.waterGfx = this.add.graphics().setDepth(4);
        this.waterPhase = 0;
        this.bridgeZones = getBridgeZones();

        // (City buildings are now managed by SceneryManager)

        // ─── OHE POLE POOL ───
        this.ohePoles = [];
        for (let i = 0; i < 18; i++) {
            const pole = this.add.sprite(0, 0, 'ohePole').setScale(1.5).setOrigin(0.5, 1).setDepth(6).setVisible(false);
            pole.setPipeline('Light2D');
            this.ohePoles.push(pole);
        }

        // ─── BIRD FLOCK POOL ───
        this.birds = [];
        for (let i = 0; i < 24; i++) {
            const b = this.add.sprite(0, 0, 'bird').setScale(1.2).setDepth(1.5).setVisible(false).setAlpha(0.75);
            this.birds.push({ sprite: b, x: 0, y: 0, vx: 0, vy: 0, active: false, flock: -1 });
        }
        this.birdFlocks = []; // { x, y, targetY, speed, birds[] }
        this.birdSpawnTimer = 0;

        // ─── BRIDGE GIRDER POOL ───
        this.bridgeGirders = [];
        for (let i = 0; i < 30; i++) {
            const b = this.add.sprite(0, 0, 'bridgeGirder').setScale(3).setOrigin(0, 0).setDepth(4.5).setVisible(false);
            b.setPipeline('Light2D');
            this.bridgeGirders.push(b);
        }

        // ─── FOOT OVER BRIDGE (FOB) POOL ───
        // Each station gets 1 FOB span + 2 staircase sections + 2 pillars
        this.fobSpans   = [];
        this.fobStairsL = [];
        this.fobStairsR = [];
        this.fobPillarsL = [];
        this.fobPillarsR = [];
        const FOB_COUNT = 14;
        for (let i = 0; i < FOB_COUNT; i++) {
            // Main span — 2.5D perspective, clearly above track
            const span = this.add.sprite(0, 0, 'fob')
                .setScale(4.5, 3.5).setOrigin(0.5, 1).setDepth(15).setVisible(false).setAlpha(0.94);
            if (span.setPipeline) span.setPipeline('Light2D');
            this.fobSpans.push(span);

            // Left staircase (descends to near platform)
            const stL = this.add.sprite(0, 0, 'fobStair')
                .setScale(3, 3.5).setOrigin(1, 1).setDepth(14.8).setVisible(false);
            if (stL.setPipeline) stL.setPipeline('Light2D');
            this.fobStairsL.push(stL);

            // Right staircase (descends to far platform, mirrored)
            const stR = this.add.sprite(0, 0, 'fobStair')
                .setScale(3, 3.5).setOrigin(0, 1).setFlipX(true).setDepth(14.8).setVisible(false);
            if (stR.setPipeline) stR.setPipeline('Light2D');
            this.fobStairsR.push(stR);

            // Left I-beam pillar (supports span on near side)
            const plL = this.add.sprite(0, 0, 'fobPillar')
                .setScale(2, 3).setOrigin(0.5, 1).setDepth(10).setVisible(false);
            this.fobPillarsL.push(plL);

            // Right I-beam pillar
            const plR = this.add.sprite(0, 0, 'fobPillar')
                .setScale(2, 3).setOrigin(0.5, 1).setDepth(10).setVisible(false);
            this.fobPillarsR.push(plR);
        }

        // ─── BRIDGE PILLARS POOL ───
        this.bridgePillars = [];
        for (let i = 0; i < 30; i++) {
            const p = this.add.sprite(0, 0, 'bridgePillar').setScale(3).setOrigin(0.5, 0).setDepth(4.4).setVisible(false);
            p.setPipeline('Light2D');
            this.bridgePillars.push(p);
        }

        // AI Trains & Dynamic Scenery
        this.aiTrackY = this.trackY - 20;
        this.aiTrainMgr = new AITrainManager(this, this.aiTrackY);
        this.sceneryMgr = new SceneryManager(this, this.trackY);

        // Station life (passengers, staff, vendors on both platforms)
        this.stationLifeMgr = new StationLifeManager(this, this.trackY);

        // Road traffic (bikes, autos, cars)
        this.trafficMgr = new TrafficManager(this, this.trackY);

        // PA announcements (Web Speech API)
        this.paSystem = new PASystem(this);

        // Legacy people pool (kept for backward compat, hidden now)
        this.people = [];


        // Input
        if (this.input.keyboard) {
            const kb = this.input.keyboard;
            kb.on('keydown-UP', () => { this.audio.start(); this.physics.notchUp(this.stationMgr.gameState, this.stationMgr.isWaitingForStarter); });
            kb.on('keydown-DOWN', () => { this.audio.start(); this.physics.notchDown(); });
            kb.on('keydown-B', () => { this.audio.start(); this.physics.emergencyBrake(); });
            kb.on('keydown-H', () => { this.audio.start(); this.audio.playHorn(); this.stationMgr.registerHorn(); });
            kb.on('keydown-L', () => this.train.toggleLights());
            kb.on('keydown-C', () => { this.cycleCameraView(); });
            kb.on('keydown-A', () => {
                this.autopilotActive = !this.autopilotActive;
                this._speak(`Autopilot ${this.autopilotActive ? 'activated' : 'deactivated'}`);
            });
        }

        // Mission complete text
        this.missionText = this.add.text(W/2, H/2, '', { fontFamily: '"Orbitron", monospace', fontSize: '36px', color: '#00ff88', stroke: '#00', strokeThickness: 4, align: 'center' }).setOrigin(0.5).setDepth(30).setVisible(false);

        // Expose for HUD
        this.registry.set('physics', this.physics);
        this.registry.set('stationMgr', this.stationMgr);
        this.registry.set('signalMgr', this.signalMgr);
        this.registry.set('bridge', bridge);
    }

    _initPool(name, texture, count, scale, depth) {
        for (let i = 0; i < count; i++) {
            const originY = name === 'platform' ? 0 : 1;
            const s = this.add.sprite(0, 0, texture).setScale(scale).setOrigin(0.5, originY).setDepth(depth).setVisible(false);
            if (name === 'platform' || name === 'roof') {
                s.setPipeline('Light2D');
            }
            this.furnitureSprites[name].push(s);
        }
    }

    getScreenY(worldX, baseOffset = 0) {
        const trainElevation = getElevationAt(this.physics.worldDistance);
        const objElevation = getElevationAt(worldX);
        return this.trackY + baseOffset - (objElevation - trainElevation) * ELEVATION_SCALE;
    }

    update(time, delta) {
        if (!this.physics) return;
        const W = this.cameras.main.width, H = this.cameras.main.height;

        // Autopilot controller
        if (this.autopilotActive) {
            this.autopilotTimer = (this.autopilotTimer || 0) + 1;
            if (this.autopilotTimer % 30 === 0) {
                const targetKmh = this.computeTargetSpeedKmh();
                const currentKmh = this.physics.displaySpeed;
                
                if (targetKmh === 0 && currentKmh === 0) {
                    this.physics.throttleNotch = 0;
                    this.physics.brakeNotch = 5; // Hold train
                } else if (currentKmh < targetKmh) {
                    if (this.physics.brakeNotch > 0) {
                        this.physics.brakeNotch--;
                    } else if (this.physics.throttleNotch < 8) {
                        this.physics.throttleNotch++;
                    }
                } else if (currentKmh > targetKmh + 2) {
                    if (this.physics.throttleNotch > 0) {
                        this.physics.throttleNotch = Math.max(0, this.physics.throttleNotch - 2);
                    } else if (this.physics.brakeNotch < 5) {
                        const diff = currentKmh - targetKmh;
                        if (diff > 10) {
                            this.physics.brakeNotch = Math.min(5, this.physics.brakeNotch + 2);
                        } else {
                            this.physics.brakeNotch = Math.min(5, this.physics.brakeNotch + 1);
                        }
                    }
                } else {
                    // Maintain speed
                    this.physics.brakeNotch = 0;
                    if (currentKmh > targetKmh + 1 && this.physics.throttleNotch > 0) {
                        this.physics.throttleNotch--;
                    }
                }
            }
        }

        // Physics
        this.physics.update(delta);
        const bgX = this.physics.bgX;
        const worldDist = this.physics.worldDistance;

        // Weather
        this.weather.update(worldDist, this.physics);
        this._updateDayNight(W, H);
        if (this.rainEmitter) {
            if (this.weather.isRaining) this.rainEmitter.start(); else this.rainEmitter.stop();
        }

        // Station + Signal logic
        this.stationMgr.update(delta, (msg, q) => this._speak(msg, q), this.signalMgr);
        if (!this._signalDiagnosticsLogged) {
            console.log('SignalManager:', this.signalMgr);
            console.log('Update Type:', typeof this.signalMgr?.update);
            this._signalDiagnosticsLogged = true;
        }
        if (this.signalMgr && typeof this.signalMgr.update === 'function') {
            this.signalMgr.update(worldDist);
        } else if (!this._signalUpdateWarningShown) {
            this._signalUpdateWarningShown = true;
            console.warn('SignalManager update() is unavailable. Game will continue without signal updates.');
        }
        this.alpMgr.update(this.physics, delta);

        // Audio
        this.audio.update(delta, this.physics, this.stationMgr, this.weather);

        // Scroll parallax
        this._scrollParallax(bgX);

        // Render 2.5D Segmented tracks
        const trackSpacing = 192; // 64px * 3 scale
        const startWorldX = Math.floor((worldDist - this.trainFixedX) / trackSpacing) * trackSpacing;
        
        this.trackSegments.forEach(s => s.setVisible(false));
        
        let segIdx = 0;
        for (let px = startWorldX; px < worldDist + W + 500 && segIdx < this.trackSegments.length; px += trackSpacing) {
            const screenX = this.trainFixedX + (px - worldDist);
            if (screenX < -192 || screenX > W + 192) continue;
            
            const elevOffset = -(getElevationAt(px) - getElevationAt(worldDist)) * ELEVATION_SCALE;
            const screenY = this.trackY + elevOffset;
            
            // Calculate slope to rotate the track segment
            const slope = getGradientAt(px).slope;
            const angle = Math.atan(slope * ELEVATION_SCALE);
            
            this.trackSegments[segIdx]
                .setPosition(screenX + 96, screenY) // center point offset (64 * 3 / 2 = 96)
                .setRotation(angle)
                .setVisible(true);
            segIdx++;
        }

        // OHE wire + poles — real contact wire touches pantograph head
        this.oheWire.clear();
        
        // Messenger wire (upper, catenary cable)
        this.oheWire.lineStyle(1, 0x555555, 0.6);
        this.oheWire.beginPath();
        let firstM = true;
        for (let x = 0; x <= W; x += 20) {
            const segmentWorldX = worldDist + (x - this.trainFixedX) / PARALLAX.TRACK;
            const elevOffset = -(getElevationAt(segmentWorldX) - getElevationAt(worldDist)) * ELEVATION_SCALE;
            const my = this.trackY + this._getMessengerWireHeightAt(segmentWorldX) + elevOffset;
            if (firstM) {
                this.oheWire.moveTo(x, my);
                firstM = false;
            } else {
                this.oheWire.lineTo(x, my);
            }
        }
        this.oheWire.strokePath();

        // Contact wire (lower — pantograph presses against this)
        this.oheWire.lineStyle(2, 0x888888, 0.9);
        this.oheWire.beginPath();
        let firstC = true;
        for (let x = 0; x <= W; x += 20) {
            const segmentWorldX = worldDist + (x - this.trainFixedX) / PARALLAX.TRACK;
            const elevOffset = -(getElevationAt(segmentWorldX) - getElevationAt(worldDist)) * ELEVATION_SCALE;
            const cy = this.trackY + this._getContactWireHeightAt(segmentWorldX) + elevOffset;
            if (firstC) {
                this.oheWire.moveTo(x, cy);
                firstC = false;
            } else {
                this.oheWire.lineTo(x, cy);
            }
        }
        this.oheWire.strokePath();

        // Droppers (vertical links every 80px scrolling dynamically)
        this.oheWire.lineStyle(1, 0x666666, 0.5);
        const droX0 = 80 - ((bgX * PARALLAX.TRACK) % 80);
        for (let dx = droX0; dx < W; dx += 80) {
            const segmentWorldX = worldDist + (dx - this.trainFixedX) / PARALLAX.TRACK;
            const elevOffset = -(getElevationAt(segmentWorldX) - getElevationAt(worldDist)) * ELEVATION_SCALE;
            const my = this.trackY + this._getMessengerWireHeightAt(segmentWorldX) + elevOffset;
            const cy = this.trackY + this._getContactWireHeightAt(segmentWorldX) + elevOffset;
            this.oheWire.lineBetween(dx, my, dx, cy);
        }

        this._renderOHEPoles(worldDist, W);
        this._updatePantograph(worldDist);

        // Train
        this.train.update(this.physics, this.physics.coachOffsets, this.stationMgr.doorOpenAmount);

        // Render route furniture
        this._renderSignals(worldDist, bgX, W);
        this._renderRouteFurniture(worldDist, bgX, W, H, delta);
        this._renderSwitches(worldDist, W);
        this._renderROBs(worldDist, W);             // Road Over Bridges (train passes under)
        this._renderStationAssets(worldDist, bgX, W); // Platforms 1 + 2, roof, benches, LEDs
        this._renderFOBs(worldDist, W);              // 2.5D Foot Over Bridges
        this._renderBridges(worldDist, W);            // River/lake bridge girders
        this._renderPeople(worldDist, bgX);
        this._renderStationNames(worldDist);

        // Visual FX
        this._updateSmoke(delta);
        this._updateSparks(delta);
        this._updateWheelSparks(delta);
        this._renderWaterReflections(worldDist, W, H);
        this._updateBirds(delta, W, H);

        // ── World vibration (game feel) — camera ONLY, not HUD ──
        // Using low-intensity camera shake: HUD stays fixed because
        // it's DOM-based and not part of the Phaser camera.
        if (this.physics.speed > 0.5) {
            const struct = getStructuralType(worldDist);
            if (this.physics.isEmergencyActive) {
                this.cameras.main.shake(80, 0.0012); // Reduced — was 0.002
            } else if (struct.main === 'bridge') {
                this.cameras.main.shake(40, 0.0004); // Reduced — was 0.0006
            } else {
                // Very subtle micro-vibration based on speed
                this.cameras.main.shake(30, 0.00006 * (this.physics.speed / 5));
            }
        }

        // ── Cockpit panel: stable (no DOM shake) ──
        // The cab panel must remain fixed while the world view vibrates.
        // We intentionally do NOT apply transform shake to cockpit-ui.
        const cockpit = document.getElementById('cockpit-ui');
        if (cockpit) cockpit.style.transform = 'none';

        // Opposite AI trains and Scenery
        this.aiTrainMgr.update(delta, this.physics, W);
        this.sceneryMgr.update(delta, this.physics, W);

        // Station population (passengers, staff, vendors)
        if (this.stationLifeMgr) {
            this.stationLifeMgr.update(delta, this.physics, getStations(), W);
        }

        // Road traffic (bikes, autos, cars)
        if (this.trafficMgr) {
            this.trafficMgr.update(delta, this.physics, W);
        }

        // Signal boards along the route
        this._renderSignalBoards(worldDist, W);

        // Animated water ripple on rivers/lakes
        this._updateWaterRipple(delta, worldDist, W);

        // Landmarks (Varkala cliff, gopuram, Veli lagoon)
        this._renderLandmarks(worldDist, W);
        this._renderVarkalaCliffs(worldDist, W);

        // Level crossing bell trigger
        const nearestLC = ROUTE_EVENTS.filter(e => e.type === 'level_crossing')
            .find(lc => Math.abs(kmToWorld(lc.km) - worldDist) < 2500);
        this.physics.isAtLevelCrossing = !!nearestLC;
        this.physics.nearestLCX = nearestLC ? kmToWorld(nearestLC.km) : null;

        // Station PA announcements
        if (this.paSystem) {
            this.paSystem.update(this.stationMgr, this.physics, getStations);
        }

        // HUD update
        const hud = this.scene.get('HUDScene');
        if (hud?.updateData) hud.updateData(this.physics, this.stationMgr, this.weather);

        // ALP callout update
        const callout = this.signalMgr?.getSignalCallout
            ? this.signalMgr.getSignalCallout(worldDist, this.stationMgr.getCalloutMessage())
            : this.stationMgr.getCalloutMessage();
        const calloutEl = document.getElementById('signal-callout');
        if (calloutEl) calloutEl.textContent = callout;

        // Poll C# backend engines (non-blocking)
        const currentKm = this.physics.worldDistance / KM_SCALE;
        const gameTimeMin = currentKm * 0.8; // approx game-time in minutes
        bridge.pollAll(currentKm, gameTimeMin, this.physics.speed * 8.6);

        // Apply C# engine data to physics (if backend online)
        if (bridge.online) {
            // Feed real adhesion from WeatherEngine into PhysicsEngine
            this.physics.setWeatherTraction(bridge.weather.adhesion / 0.30);
            // Show enhanced signal callout from SignalEngine
            if (bridge.signal.callout) this.physics.signalCallout = bridge.signal.callout;
            // Speed limit warning from RouteEngine
            const speedKmh = this.physics.speed * 8.6;
            if (speedKmh > bridge.route.speedLimit + 2) {
                this.physics.speedLimitWarning = `⚠️ OVER LIMIT: ${Math.round(speedKmh)} > ${bridge.route.speedLimit} km/h`;
            } else {
                this.physics.speedLimitWarning = '';
            }
            // Update gradient label from RouteEngine
            if (bridge.route.gradient) {
                this.physics.currentGradientLabel = bridge.route.gradient.label || 'LEVEL';
            }
        }

        // Mission complete
        if (this.stationMgr.missionComplete && !this.missionText.visible) {
            const wl = this.stationMgr.wlStats;
            const grade = bridge.online ? bridge.score.grade : '—';
            const scoreVal = bridge.online ? bridge.score.totalScore : '—';
            this.missionText.setText(
                `MISSION ACCOMPLISHED\nKollam JCT → Trivandrum Central\n64.6 KM Completed\n` +
                `W/L Boards: ${wl.honked}/${wl.honked + wl.missed}\n` +
                `Score: ${scoreVal}  Grade: ${grade}`
            );
            this.missionText.setVisible(true);
        }
        // Update camera views
        this._updateCamera(time, delta, W, H, worldDist);

        // Update DOM Train Debug Panel
        const debugSpeedEl = document.getElementById('debug-speed');
        if (debugSpeedEl) {
            const currentSpeedKmh = this.physics.displaySpeed;
            const targetSpeedKmh = this.computeTargetSpeedKmh();
            const nextSig = this.signalMgr?.getNextSignal(worldDist);
            const signalAspect = nextSig ? `${nextSig.aspect} (${Math.round((nextSig.x - worldDist) / 3) / 10}0m)` : 'CLEAR';
            const brakeState = this.physics.isEmergencyActive ? 'EMERGENCY' : (this.physics.brakeNotch > 0 ? `BRAKING (Notch ${this.physics.brakeNotch})` : 'RELEASED');
            
            let stopReason = 'NONE';
            if (this.physics.speed === 0) {
                if (this.physics.isEmergencyActive) {
                    stopReason = 'EMERGENCY BRAKE';
                } else if (this.stationMgr.isWaitingForStarter) {
                    stopReason = 'STARTER SIGNAL';
                } else if (this.stationMgr.gameState === 'STOPPED' || this.stationMgr.gameState === 'BOARDING' || this.stationMgr.gameState === 'READY') {
                    stopReason = 'TIMETABLE DWELL';
                } else if (this.physics.brakeNotch > 0) {
                    stopReason = 'MANUAL BRAKE';
                } else if (nextSig && nextSig.aspect === 'RED' && Math.abs(nextSig.x - worldDist) < 150) {
                    stopReason = 'RED SIGNAL';
                }
            }

            debugSpeedEl.textContent = `${currentSpeedKmh.toFixed(1)} KM/H`;
            document.getElementById('debug-target-speed').textContent = `${targetSpeedKmh.toFixed(1)} KM/H`;
            document.getElementById('debug-signal-aspect').textContent = signalAspect;
            document.getElementById('debug-brake-state').textContent = brakeState;
            document.getElementById('debug-stop-reason').textContent = stopReason;
            document.getElementById('debug-timetable-state').textContent = this.stationMgr.trainType;
            document.getElementById('debug-ai-control').textContent = this.autopilotActive ? 'ACTIVE (AUTOPILOT)' : 'OFF (MANUAL)';
            document.getElementById('debug-camera-view').textContent = this.currentCameraView ? this.currentCameraView.replace('_', ' ') : 'ISOMETRIC';
        }
    }

    // ═══ ROUTE FURNITURE RENDERING ═══
    _renderRouteFurniture(worldDist, bgX, W, H, delta) {
        const viewStart = worldDist - 2000;
        const viewEnd = worldDist + W / PARALLAX.TRACK + 4000;
        let opIdx = 0, lcIdx = 0, wlIdx = 0, upIdx = 0, ydIdx = 0;

        // Hide all first
        Object.values(this.furnitureSprites).forEach(arr => arr.forEach(s => s.setVisible(false)));
        this.roadVehicles.forEach(v => v.setVisible(false));
        this.lcGatesPool.forEach(gate => {
            gate.road.setVisible(false);
            gate.leftPost.setVisible(false);
            gate.rightPost.setVisible(false);
            gate.leftArm.setVisible(false);
            gate.rightArm.setVisible(false);
        });
        this.kmStones.forEach(k => {
            k.sprite.setVisible(false);
            k.text.setVisible(false);
        });
        this.parkedCoaches.forEach(c => c.setVisible(false));

        // Render Kilometer milestones
        let kmIdx = 0;
        const startKm = Math.max(0, Math.floor(viewStart / 3000));
        const endKm = Math.min(65, Math.ceil(viewEnd / 3000));
        for (let km = startKm; km <= endKm; km++) {
            const wx = km * 3000;
            const screenX = this.trainFixedX + (wx - worldDist) * PARALLAX.TRACK;
            if (screenX >= -50 && screenX <= W + 50 && kmIdx < this.kmStones.length) {
                const stone = this.kmStones[kmIdx++];
                stone.sprite.setPosition(screenX, this.getScreenY(wx, 14)).setVisible(true);
                stone.text.setText(`${km}`)
                    .setPosition(screenX, this.getScreenY(wx, -38))
                    .setVisible(true);
            }
        }

        ROUTE_EVENTS.forEach(evt => {
            const wx = kmToWorld(evt.km);
            if (wx < viewStart || wx > viewEnd) return;
            const screenX = this.trainFixedX + (wx - worldDist) * PARALLAX.TRACK;

            if (evt.type === 'overpass' && opIdx < this.furnitureSprites.overpass.length) {
                const sp = this.furnitureSprites.overpass[opIdx++];
                sp.setPosition(screenX, this.getScreenY(wx, -100)).setVisible(true).setDepth(14);
            }
            if (evt.type === 'level_crossing' && lcIdx < this.lcGatesPool.length) {
                const gate = this.lcGatesPool[lcIdx++];
                const distToTrain = wx - worldDist;

                // Close gate if train is approaching within 1.5 KM (4500 world units) and has not fully cleared (-200 units)
                const shouldClose = (distToTrain > -300 && distToTrain < 4500);
                const targetAngle = shouldClose ? 0 : -90;

                // Interpolate gate angle for smooth animation
                const angleStep = 1.5 * (delta / 16.667);
                if (gate.currentAngle < targetAngle) {
                    gate.currentAngle = Math.min(targetAngle, gate.currentAngle + angleStep);
                } else if (gate.currentAngle > targetAngle) {
                    gate.currentAngle = Math.max(targetAngle, gate.currentAngle - angleStep);
                }

                // Render road background & posts
                gate.road.setPosition(screenX, this.getScreenY(wx, 20)).setVisible(true);
                gate.leftPost.setPosition(screenX - 60, this.getScreenY(wx, 20)).setVisible(true);
                gate.rightPost.setPosition(screenX + 60, this.getScreenY(wx, 20)).setVisible(true);

                // Render arms
                gate.leftArm.setPosition(screenX - 60, this.getScreenY(wx, -20))
                            .setAngle(gate.currentAngle)
                            .setVisible(true);
                gate.rightArm.setPosition(screenX + 60, this.getScreenY(wx, -20))
                             .setAngle(-gate.currentAngle) // Right arm pivots on the right end
                             .setVisible(true);

                // Flashing lights
                const isFlashing = (Math.floor(Date.now() / 250) % 2 === 0);
                if (isFlashing && (gate.currentAngle > -90)) {
                    gate.leftPost.setTint(0xff4444);
                    gate.rightPost.setTint(0xff4444);
                } else {
                    gate.leftPost.clearTint();
                    gate.rightPost.clearTint();
                }

                // Draw alternating flashing red light circles on cantilever OHE graphics layer
                if (gate.currentAngle > -90) {
                    const g = this.oheGraphics;
                    g.fillStyle(isFlashing ? 0xff0000 : 0x440000, 1.0);
                    g.fillCircle(screenX - 60, this.getScreenY(wx, -85), 6);
                    g.fillStyle(!isFlashing ? 0xff0000 : 0x440000, 1.0);
                    g.fillCircle(screenX + 60, this.getScreenY(wx, -85), 6);
                }

                // Update and render vehicles
                const isClosed = gate.currentAngle > -15; // Gate is closed or closing
                gate.vehicles.forEach(veh => {
                    const stopX = (veh.side === 'left') 
                        ? -75 - veh.posIndex * 40 
                        : 75 + veh.posIndex * 40;

                    if (veh.side === 'left') {
                        if (isClosed && veh.relativeX < stopX) {
                            const distToStop = stopX - veh.relativeX;
                            const targetSpeed = Math.min(veh.maxSpeed, distToStop * 0.05);
                            veh.speed += (targetSpeed - veh.speed) * 0.15;
                        } else if (isClosed && veh.relativeX >= stopX && veh.relativeX < 0) {
                            veh.speed = 0;
                        } else {
                            veh.speed += (veh.maxSpeed - veh.speed) * 0.05;
                        }
                        veh.relativeX += veh.speed * (delta / 16.667);
                        if (veh.relativeX > 600) {
                            veh.relativeX = -300 - Math.random() * 150;
                        }
                        veh.sprite.setPosition(screenX + veh.relativeX, this.getScreenY(wx, 14))
                                  .setFlipX(true)
                                  .setVisible(true);
                    } else {
                        if (isClosed && veh.relativeX > stopX) {
                            const distToStop = veh.relativeX - stopX;
                            const targetSpeed = -Math.min(veh.maxSpeed, distToStop * 0.05);
                            veh.speed += (targetSpeed - veh.speed) * 0.15;
                        } else if (isClosed && veh.relativeX <= stopX && veh.relativeX > 0) {
                            veh.speed = 0;
                        } else {
                            veh.speed += (-veh.maxSpeed - veh.speed) * 0.05;
                        }
                        veh.relativeX += veh.speed * (delta / 16.667);
                        if (veh.relativeX < -600) {
                            veh.relativeX = 300 + Math.random() * 150;
                        }
                        veh.sprite.setPosition(screenX + veh.relativeX, this.getScreenY(wx, 14))
                                  .setFlipX(false)
                                  .setVisible(true);
                    }
                });
            }
            if (evt.type === 'wl_board' && wlIdx < this.furnitureSprites.wlBoard.length) {
                const sp = this.furnitureSprites.wlBoard[wlIdx++];
                sp.setPosition(screenX, this.getScreenY(wx, -30)).setVisible(true);
            }
            if (evt.type === 'underpass' && upIdx < this.furnitureSprites.underpass.length) {
                const sp = this.furnitureSprites.underpass[upIdx++];
                sp.setPosition(screenX, this.getScreenY(wx, 20)).setVisible(true);
            }
            if (evt.type === 'yard' && ydIdx < this.furnitureSprites.yard.length) {
                const sp = this.furnitureSprites.yard[ydIdx++];
                sp.setPosition(screenX, this.getScreenY(wx, -20)).setVisible(true).setDepth(3.0);

                // Render parked coaches on yard tracks!
                let parkedIdx = 0;
                for (let t = 0; t < 3; t++) {
                    const trackYOffset = -190 + t * 60; // stabling tracks height relative to trackY
                    const startOffset = -350 + t * 100;
                    for (let c = 0; c < 4; c++) {
                        if (parkedIdx < this.parkedCoaches.length) {
                            const coachSprite = this.parkedCoaches[parkedIdx++];
                            coachSprite.setPosition(screenX + startOffset + c * 172, this.getScreenY(wx, trackYOffset))
                                        .setVisible(true);
                        }
                    }
                }
            }
        });
    }

    _renderSwitches(worldDist, W) {
        this.switchSprites.forEach(s => s.setVisible(false));
        const stations = getStations();
        let idx = 0;
        stations.forEach(st => {
            const switchKm = st.km - 0.2;
            const wx = kmToWorld(switchKm);
            const dist = wx - worldDist;
            if (Math.abs(dist) > 4000 || idx >= this.switchSprites.length) return;
            const screenX = this.trainFixedX + dist * PARALLAX.TRACK;
            const sp = this.switchSprites[idx++];
            const texKey = st.km % 2 === 0 ? 'track_switch_left' : 'track_switch_right';
            sp.setTexture(texKey).setPosition(screenX, this.getScreenY(wx, 4)).setVisible(true);
        });
    }

    /**
     * Renders dual platforms (near + far), station roof, benches, LED boards,
     * and terminal facades. Matches real Indian Railways station layout:
     *
     *   [Platform 1 — near, passengers, benches]
     *   ══════════════ TRACK ══════════════
     *   [Platform 2 — far, passengers, LED boards]
     */
    _renderStationAssets(worldDist, bgX, W) {
        const stations = getStations();
        let platIdx = 0, roofIdx = 0, p2Idx = 0, benchIdx = 0, ledIdx = 0;

        // Reset all platform-related sprites
        this.platform2Sprites.forEach(s => s.setVisible(false));
        this.platBenches.forEach(s => s.setVisible(false));
        this.ledBoards.forEach(s => s.setVisible(false));
        this.stationLights.forEach(l => l.setIntensity(0));
        if (this.kollamFacade) this.kollamFacade.setVisible(false);
        if (this.kollamFacadeShadow) this.kollamFacadeShadow.setVisible(false);
        if (this.tvcFacade) this.tvcFacade.setVisible(false);
        if (this.tvcFacadeShadow) this.tvcFacadeShadow.setVisible(false);

        const cycle = this.weather.dayNightCycle;
        const isDark = cycle >= 0.58 || cycle <= 0.22;

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

        stations.forEach(st => {
            const wx   = kmToWorld(st.km);
            const dist = wx - worldDist;
            if (Math.abs(dist) > 5500) return;
            const screenX = this.trainFixedX + dist * PARALLAX.TRACK;

            // ── Platform 1 (near side — above track) ──
            if (platIdx < this.furnitureSprites.platform.length) {
                this.furnitureSprites.platform[platIdx]
                    .setPosition(screenX, this.getScreenY(wx, -8))
                    .setVisible(true);

                // Warm light at night
                if (this.stationLights[platIdx]) {
                    this.stationLights[platIdx]
                        .setPosition(screenX, this.getScreenY(wx, -80))
                        .setIntensity(isDark ? 2.5 : 0);
                }
                platIdx++;
            }

            // ── Platform 2 (far side — below track, receding depth) ──
            if (p2Idx < this.platform2Sprites.length) {
                this.platform2Sprites[p2Idx]
                    .setPosition(screenX, this.getScreenY(wx, 28))
                    .setVisible(true)
                    .setAlpha(isDark ? 0.7 : 0.82);
                p2Idx++;
            }

            // ── Station roof (above Platform 1) ──
            if (roofIdx < this.furnitureSprites.roof.length) {
                // Roof sits 220px above track — FOB will be at -310 (clear gap)
                this.furnitureSprites.roof[roofIdx]
                    .setPosition(screenX, this.getScreenY(wx, -220))
                    .setVisible(true);
                roofIdx++;
            }

            // ── Benches on Platform 1 (near side) ──
            if (benchIdx < this.platBenches.length && st.isStoppage) {
                this.platBenches[benchIdx]
                    .setPosition(screenX - 80, this.getScreenY(wx, -10))
                    .setVisible(true);
                benchIdx++;
            }

            // ── LED boards on Platform 2 (far side) ──
            if (ledIdx < this.ledBoards.length && st.isStoppage) {
                this.ledBoards[ledIdx]
                    .setPosition(screenX + 60, this.getScreenY(wx, 18))
                    .setVisible(true);
                ledIdx++;
            }

            // ── Terminal facades (unique buildings) ──
            if (st.code === 'QLN' && this.kollamFacade) {
                this.kollamFacade.setPosition(screenX, this.getScreenY(wx, -20)).setVisible(true);
                if (this.kollamFacadeShadow) {
                    this.kollamFacadeShadow.setPosition(screenX + shadowX, this.getScreenY(wx, -20 + shadowY))
                        .setAlpha(shadowAlpha)
                        .setVisible(shadowAlpha > 0);
                }
            } else if (st.code === 'TVC' && this.tvcFacade) {
                this.tvcFacade.setPosition(screenX, this.getScreenY(wx, -20)).setVisible(true);
                if (this.tvcFacadeShadow) {
                    this.tvcFacadeShadow.setPosition(screenX + shadowX, this.getScreenY(wx, -20 + shadowY))
                        .setAlpha(shadowAlpha)
                        .setVisible(shadowAlpha > 0);
                }
            }
        });
    }

    /**
     * ROB (Road Over Bridge) Renderer — train passes UNDER.
     *
     * ROB deck is rendered at depth 2 (behind everything).
     * Train at depth 8 visually passes below the ROB.
     * This creates the correct visual of going under a bridge.
     */
    _renderROBs(worldDist, W) {
        this.robSprites.forEach(s => s.setVisible(false));

        // Import ROB positions from zone manager (lazy import fallback)
        const ROB_KMS = [4.2, 11.0, 27.5, 51.8, 57.2, 62.0];
        let idx = 0;

        ROB_KMS.forEach(km => {
            if (idx >= this.robSprites.length) return;
            const wx   = km * 3000; // KM_SCALE approximate
            const dist = wx - worldDist;
            if (Math.abs(dist) > 5000) return;

            const screenX = this.trainFixedX + dist * PARALLAX.TRACK;
            this.robSprites[idx]
                .setPosition(screenX, this.getScreenY(wx, -40))
                .setVisible(true)
                .setDepth(2); // BEHIND train
            idx++;
        });
    }

    /**
     * 2.5D FOB Renderer — completely independent from station roof.
     *
     * Layout per station (Y values relative to trackY):
     *   trackY - 310  : FOB span top (above roof at trackY - 220)
     *   trackY - 310  : Staircase tops (left + right)
     *   trackY - 80   : FOB pillar base (rests on platform)
     *
     * The 90px gap between roof (trackY - 220) and FOB bottom
     * (~trackY - 310 + span height * scale) makes FOB clearly separate.
     */
    _renderFOBs(worldDist, W) {
        this.fobSpans.forEach(s => s.setVisible(false));
        this.fobStairsL.forEach(s => s.setVisible(false));
        this.fobStairsR.forEach(s => s.setVisible(false));
        this.fobPillarsL.forEach(s => s.setVisible(false));
        this.fobPillarsR.forEach(s => s.setVisible(false));

        const stations = getStations();
        let idx = 0;

        const cycle   = this.weather.dayNightCycle;
        const isNight = cycle >= 0.58 || cycle <= 0.22;
        const nightTint = 0xd4e8ff; // cool blue-white fluorescent

        stations.forEach(st => {
            if (idx >= this.fobSpans.length) return;
            const wx   = kmToWorld(st.km);
            const dist = wx - worldDist;
            if (Math.abs(dist) > 5500) return;

            const screenX = this.trainFixedX + dist * PARALLAX.TRACK;

            // FOB span Y: clearly above station roof (roof at trackY - 220)
            // FOB bottom edge will be at trackY - 310, giving ~90px clear gap
            const fobY     = this.getScreenY(wx, -310);
            const stairW   = 3 * 64 * 0.5; // staircase sprite width * scale
            const spanHalfW = 4.5 * 200 * 0.5; // fob sprite W * scaleX * 0.5

            // ── Support pillars ──
            const pillarLX = screenX - spanHalfW * 0.6;
            const pillarRX = screenX + spanHalfW * 0.6;

            // Left pillar grounds on Platform 1
            this.fobPillarsL[idx].setPosition(pillarLX, this.getScreenY(wx, -8)).setVisible(true);
            // Right pillar grounds on Platform 2
            this.fobPillarsR[idx].setPosition(pillarRX, this.getScreenY(wx, 30)).setVisible(true);

            // ── Main span ──
            const span = this.fobSpans[idx];
            span.setPosition(screenX, fobY).setVisible(true);
            if (isNight) span.setTint(nightTint); else span.clearTint();

            // ── Left staircase (descends to Platform 1) ──
            const stL = this.fobStairsL[idx];
            stL.setPosition(screenX - spanHalfW + 8, this.getScreenY(wx, -8)).setVisible(true);
            if (isNight) stL.setTint(nightTint); else stL.clearTint();

            // ── Right staircase (descends to Platform 2) ──
            const stR = this.fobStairsR[idx];
            stR.setPosition(screenX + spanHalfW - 8, this.getScreenY(wx, 30)).setVisible(true);
            if (isNight) stR.setTint(nightTint); else stR.clearTint();

            idx++;
        });
    }

    _renderSignals(worldDist, bgX, W) {
        this.signalSprites.forEach(s => s.setVisible(false));
        if (!this.signalMgr || !Array.isArray(this.signalMgr.signals)) return;

        let idx = 0;
        this.signalMgr.signals.forEach(sig => {
            const dist = sig.x - worldDist;
            if (Math.abs(dist) > 4000 || idx >= this.signalSprites.length) return;
            
            const screenX = this.trainFixedX + dist * PARALLAX.TRACK;
            const aspect = sig.aspect || 'GREEN';
            const texKey = aspect === 'RED' ? 'signal_red' : aspect === 'YELLOW' ? 'signal_yellow' : aspect === 'DOUBLE_YELLOW' ? 'signal_doubleyellow' : 'signal_green';
            const sp = this.signalSprites[idx++];
            sp.setTexture(texKey).setPosition(screenX, this.getScreenY(sig.x, -20)).setVisible(true);
        });
    }

    /**
     * Render signal infrastructure boards at fixed route positions.
     * G boards near level crossings, speed restriction boards near curves,
     * neutral section boards near traction sub-stations.
     */
    _renderSignalBoards(worldDist, W) {
        if (!this.signBoardSprites?.length) return;
        this.signBoardSprites.forEach(b => b.sprite.setVisible(false));

        // Fixed board positions (km along route)
        const BOARDS = [
            { km: 2.1,  key: 'speedBoard_30'  },
            { km: 3.9,  key: 'gBoard'          },
            { km: 7.5,  key: 'speedBoard_50'   },
            { km: 10.8, key: 'gBoard'          },
            { km: 13.2, key: 'neutralBoard'    },
            { km: 18.5, key: 'speedBoard_30'   },
            { km: 24.0, key: 'gBoard'          },
            { km: 29.3, key: 'speedBoard_50'   },
            { km: 31.8, key: 'neutralBoard'    },
            { km: 38.2, key: 'gBoard'          },
            { km: 44.5, key: 'speedBoard_30'   },
            { km: 51.0, key: 'neutralBoard'    },
        ];

        let bIdx = 0;
        BOARDS.forEach(bd => {
            if (bIdx >= this.signBoardSprites.length) return;
            const wx   = bd.km * KM_SCALE;
            const dist = wx - worldDist;
            if (Math.abs(dist) > 4000) return;

            // Find a matching board from pool
            const found = this.signBoardSprites.find(b => b.key === bd.key && !b.sprite.visible);
            if (!found) return;

            const screenX = this.trainFixedX + dist * PARALLAX.TRACK;
            found.sprite.setPosition(screenX, this.getScreenY(wx, -5)).setVisible(true);
        });
    }

    /**
     * Animated water ripple on river/lake sections.
     * Tiles the waterRipple texture horizontally across bridge zones.
     * Phase offset creates gentle wave animation without spritesheet.
     */
    _updateWaterRipple(delta, worldDist, W) {
        if (!this.waterTiles?.length) return;
        this.waterTiles.forEach(wt => wt.sprite.setVisible(false));

        this._waterTimer += delta / 1000;
        const bridges = getBridgeZones();
        let tIdx = 0;

        bridges.forEach(bz => {
            const startDist = bz.start - worldDist;
            const endDist   = bz.end   - worldDist;
            const startSX   = this.trainFixedX + startDist * PARALLAX.TRACK;
            const endSX     = this.trainFixedX + endDist   * PARALLAX.TRACK;

            // Only render if any part is on screen
            if (endSX < -200 || startSX > W + 200) return;

            // Tile ripple sprites across the bridge water width
            const tileW = 64 * 3; // sprite W × scale
            for (let sx = startSX; sx < endSX + tileW; sx += tileW) {
                if (tIdx >= this.waterTiles.length) break;
                const wt = this.waterTiles[tIdx++];

                // Ripple Y — water surface is slightly below track
                const waterY = this.trackY + 10;

                // Phase-shifted shimmer: each tile has offset phase
                const shimmer = Math.sin(this._waterTimer * 2 + wt.phase) * 1.5;

                wt.sprite
                    .setPosition(sx, waterY + shimmer)
                    .setVisible(true)
                    .setAlpha(0.7 + Math.sin(this._waterTimer + wt.phase) * 0.15);
            }
        });
    }

    _renderPeople(worldDist, bgX) {
        this.people.forEach(p => p.setVisible(false));
        const stations = getStations();
        let pIdx = 0;
        stations.forEach(st => {
            if (!st.isStoppage) return;
            const wx = kmToWorld(st.km);
            const dist = wx - worldDist;
            if (Math.abs(dist) > 3000) return;
            for (let i = 0; i < 5 && pIdx < this.people.length; i++) {
                const personWorldX = wx + (i - 2) * 120;
                const px = this.trainFixedX + (personWorldX - worldDist) * PARALLAX.TRACK;
                this.people[pIdx].setPosition(px, this.getScreenY(personWorldX, -5)).setVisible(true);
                pIdx++;
            }
        });
    }

    // ═══ PARALLAX ═══
    _buildSky(W, H) {
        // Sky is drawn dynamically each frame into skyGfx
        this.skyGfx = this.add.graphics().setDepth(0);
        // Horizon glow strip (changes color at sunrise/sunset)
        this.horizonGlow = this.add.graphics().setDepth(0);
        // Sun / Moon disc
        this.sunMoon = this.add.circle(W * 0.82, H * 0.1, 32, 0xFDB813).setDepth(0.8);
        // Sun halo (soft ring around sun)
        this.sunHalo = this.add.circle(W * 0.82, H * 0.1, 52, 0xffe080, 0.18).setDepth(0.7);
        // Store sky width/height for dynamic re-draw
        this._skyW = W;
        this._skyH = H;
    }

    _buildBackground(W, H) {
        // ── KOLLAM-TVC ROUTE: FLAT COASTAL PLAIN — NO MOUNTAINS ──
        // The Kollam→TVC line runs through the coastal plains of Kerala.
        // Mountains belong to the Kollam→Punalur/Sengottai line (going east).
        // We use a very faint far treeline haze instead.

        // Empty arrays kept for backward compat (parallax scroll still references them)
        this.mountainsFar  = [];
        this.mountains     = [];
        this.mountainsNear = [];

        // ── FAR HORIZON TREELINE (very faint, replaces mountains) ──
        // This simulates the distant palm/rubber treeline of the coastal plain
        this.horizonTreeline = [];
        for (let i = 0; i < 8; i++) {
            const s = this.add.sprite(i * 250, H * 0.58, 'palm')
                .setOrigin(0.5, 1)
                .setScale(3.0 + Math.random() * 1.0)
                .setDepth(0.4)
                .setAlpha(0.08 + Math.random() * 0.06) // very faint horizon haze
                .setTint(0x4a7040);                     // muted dark green
            this.horizonTreeline.push(s);
        }

        // ── LARGE CLOUDS (standard, mid-sky) ──
        this.clouds = [];
        for (let i = 0; i < 6; i++) {
            this.clouds.push(
                this.add.sprite(i * 300, H * 0.12 + Math.random() * 80, 'cloud')
                    .setScale(2.5 + Math.random()).setDepth(1).setAlpha(0.55)
            );
        }

        // ── FAR CLOUDS (upper sky, slow-moving) ──
        this.cloudsFar = [];
        for (let i = 0; i < 8; i++) {
            this.cloudsFar.push(
                this.add.sprite(i * 220, H * 0.06 + Math.random() * 50, 'cloudFar')
                    .setScale(2).setDepth(0.5).setAlpha(0.35)
            );
        }

        this.farTrees = [];
        for (let i = 0; i < 10; i++) {
            this.farTrees.push(this.add.sprite(i * 200, this.trackY - 20, 'tree').setScale(1.5).setOrigin(0.5, 1).setDepth(2).setAlpha(0.4));
        }
        this.midTrees = [];
        for (let i = 0; i < 8; i++) {
            this.midTrees.push(this.add.sprite(i * 250, this.trackY + 5, Math.random() > 0.5 ? 'palm' : 'tree').setScale(2.5).setOrigin(0.5, 1).setDepth(3));
        }

        // Ground fill — multi-layer for depth
        this.groundGfx = this.add.graphics().setDepth(4);
        
        // Background track (AI track)
        this.groundGfx.fillStyle(0x1a1208); this.groundGfx.fillRect(0, this.aiTrackY + 4, W, 8);
        this.groundGfx.fillStyle(0x3a2a1f); this.groundGfx.fillRect(0, this.aiTrackY + 12, W, 10);
        
        // Foreground track (Player track)
        this.groundGfx.fillStyle(0x2d1f0e); this.groundGfx.fillRect(0, this.trackY + 4, W, 8);
        this.groundGfx.fillStyle(0x4a3728); this.groundGfx.fillRect(0, this.trackY + 12, W, 10);
        
        this.groundGfx.fillStyle(0x3d2b1f); this.groundGfx.fillRect(0, this.trackY + 22, W, 30);
        this.groundGfx.fillStyle(0x5a4a3a); this.groundGfx.fillRect(0, this.trackY + 52, W, 20);
        this.groundGfx.fillStyle(0x2a4a2a); this.groundGfx.fillRect(0, this.trackY + 72, W, H);
    }

    _scrollParallax(bgX) {
        const W = this.cameras.main.width;
        // Horizon treeline — very slow, flat coastal drift
        this.horizonTreeline?.forEach((t, i) => {
            t.x = ((i * 250) - bgX * PARALLAX.FAR_MOUNTAINS * 0.35) % (W * 2.8) - 150;
        });
        // Mountain arrays are now empty (coastal route) — these no-op safely
        this.mountainsFar.forEach((m, i) => {
            m.x = ((i * W * 0.55) - bgX * PARALLAX.FAR_MOUNTAINS * 0.4) % (W * 2.5) - W * 0.5;
        });
        this.mountains.forEach((m, i) => {
            m.x = ((i * W * 0.45) - bgX * PARALLAX.FAR_MOUNTAINS * 0.75) % (W * 2.5) - W * 0.5;
        });
        this.mountainsNear.forEach((m, i) => {
            m.x = ((i * W * 0.38) - bgX * PARALLAX.FAR_MOUNTAINS * 1.1) % (W * 2.2) - W * 0.4;
        });
        this.farTrees.forEach((t, i) => { t.x = ((i * 200) - bgX * PARALLAX.FAR_TREES) % (W + 400) - 100; });
        this.midTrees.forEach((t, i) => { t.x = ((i * 250) - bgX * PARALLAX.MID_TREES) % (W + 500) - 200; });
        // Clouds — different layer speeds
        this.clouds.forEach((c, i) => { c.x = ((i * 300) - bgX * PARALLAX.CLOUDS * 0.9) % (W + 600) - 200; });
        this.cloudsFar.forEach((c, i) => { c.x = ((i * 220) - bgX * PARALLAX.CLOUDS * 0.45) % (W + 500) - 150; });
    }

    _updateDayNight(W, H) {
        const cycle = this.weather.dayNightCycle; // 0.0 to 1.0
        const nightAlpha = Math.max(0, Math.sin(cycle * Math.PI * 2 - Math.PI / 2)) * 0.62;

        // ── DYNAMIC SKY GRADIENT ──
        // Phase categories: dawn (0.18-0.28), day (0.28-0.55), dusk (0.55-0.68), night (rest)
        let skyTop, skyBot;
        if (nightAlpha < 0.05) {
            // Daytime — bright blue
            const t = Math.min(1, Math.max(0, (cycle - 0.28) / 0.27));
            const topR = Math.round(Phaser.Math.Linear(0x52, 0x1a, t) * (1 - t) + 0x08 * t);
            const topG = Math.round(Phaser.Math.Linear(0xae, 0x4a, t));
            const topB = Math.round(Phaser.Math.Linear(0xe0, 0xb0, t));
            skyTop = (topR << 16) | (topG << 8) | topB;
            skyBot = 0xd4ecff;
        } else if (cycle < 0.28 || cycle > 0.55) {
            // Twilight / golden hour
            const isDawn = cycle < 0.28;
            const t = isDawn ? Phaser.Math.Clamp((cycle - 0.15) / 0.13, 0, 1)
                             : Phaser.Math.Clamp((cycle - 0.55) / 0.13, 0, 1);
            skyTop = isDawn ? Phaser.Display.Color.Interpolate.ColorWithColor(
                { r: 0x0a, g: 0x0e, b: 0x25 }, { r: 0x52, g: 0xae, b: 0xe0 }, 100, Math.round(t * 100)
            ) : Phaser.Display.Color.Interpolate.ColorWithColor(
                { r: 0x52, g: 0xae, b: 0xe0 }, { r: 0x0a, g: 0x0e, b: 0x25 }, 100, Math.round(t * 100)
            );
            skyTop = (skyTop.r << 16) | (skyTop.g << 8) | skyTop.b;
            skyBot = isDawn ? 0xffb87a : 0xff8c5a;
        } else {
            // Night
            skyTop = 0x060a18;
            skyBot = 0x111a30;
        }

        // Redraw sky gradient
        this.skyGfx.clear();
        this.skyGfx.fillGradientStyle(skyTop, skyTop, skyBot, skyBot, 1);
        this.skyGfx.fillRect(0, 0, W, H);

        // ── HORIZON GLOW (orange/pink during twilight) ──
        this.horizonGlow.clear();
        const horizonY = H * 0.45;
        const isDusk  = cycle > 0.52 && cycle < 0.72;
        const isDawn2 = cycle > 0.14 && cycle < 0.32;
        if (isDusk || isDawn2) {
            const glowAlpha = isDusk
                ? Phaser.Math.Clamp(Math.sin((cycle - 0.52) / 0.2 * Math.PI), 0, 1) * 0.55
                : Phaser.Math.Clamp(Math.sin((cycle - 0.14) / 0.18 * Math.PI), 0, 1) * 0.45;
            const glowColor = isDusk ? 0xff6030 : 0xff8850;
            // Soft band at horizon
            this.horizonGlow.fillStyle(glowColor, glowAlpha * 0.7);
            this.horizonGlow.fillRect(0, horizonY - 30, W, 70);
            this.horizonGlow.fillStyle(0xffaa44, glowAlpha * 0.4);
            this.horizonGlow.fillRect(0, horizonY - 15, W, 35);
        }

        // ── GOD RAYS (sunrise/sunset, low-angle light beams) ──
        this.godRayAngle += 0.004;
        this.godRaysGfx.clear();
        // Calculate dynamic sun/moon position in an arc across the sky
        let sunX = W * 0.82;
        let sunY = H * 0.1;
        const isSun = nightAlpha < 0.3;

        if (isSun) {
            // Day starts at 0.2 (sunrise) and ends at 0.6 (sunset)
            const t = Phaser.Math.Clamp((cycle - 0.2) / 0.4, 0, 1);
            const angle = Math.PI - t * Math.PI; // PI to 0
            sunX = W * 0.5 + Math.cos(angle) * (W * 0.45);
            sunY = H * 0.45 - Math.sin(angle) * (H * 0.35);
        } else {
            // Moon rises at 0.7 and sets at 0.1
            let t = 0.5;
            if (cycle >= 0.7) {
                t = (cycle - 0.7) / 0.4;
            } else if (cycle <= 0.1) {
                t = (cycle + 0.3) / 0.4;
            }
            t = Phaser.Math.Clamp(t, 0, 1);
            const angle = Math.PI - t * Math.PI; // PI to 0
            sunX = W * 0.5 + Math.cos(angle) * (W * 0.45);
            sunY = H * 0.45 - Math.sin(angle) * (H * 0.35);
        }

        const isGoldenHour = (cycle > 0.16 && cycle < 0.30) || (cycle > 0.53 && cycle < 0.70);
        if (isGoldenHour) {
            const rayAlpha = isDusk
                ? Phaser.Math.Clamp(Math.sin((cycle - 0.53) / 0.17 * Math.PI), 0, 1) * 0.12
                : Phaser.Math.Clamp(Math.sin((cycle - 0.16) / 0.14 * Math.PI), 0, 1) * 0.1;
            if (rayAlpha > 0.01) {
                this.godRaysGfx.setAlpha(1);
                const rayColor = 0xffd580;
                for (let ri = 0; ri < 8; ri++) {
                    const a = this.godRayAngle + ri * (Math.PI / 8);
                    const len = H * 2.5;
                    const ex = sunX + Math.cos(a) * len;
                    const ey = sunY + Math.sin(a) * len;
                    this.godRaysGfx.fillStyle(rayColor, rayAlpha * (0.5 + 0.5 * Math.sin(this.godRayAngle * 3 + ri)));
                    this.godRaysGfx.fillTriangle(
                        sunX - 5, sunY,
                        sunX + 5, sunY,
                        ex, ey
                    );
                }
            } else {
                this.godRaysGfx.setAlpha(0);
            }
        } else {
            this.godRaysGfx.setAlpha(0);
        }

        // ── SUN / MOON ──
        this.sunMoon.setFillStyle(isSun ? 0xFDB813 : 0xd8e0ec).setRadius(isSun ? 32 : 22);
        this.sunMoon.setPosition(sunX, sunY).setVisible(true);
        // Sun halo pulsates gently
        const haloR = isSun ? 52 + Math.sin(this.godRayAngle * 2) * 4 : 30;
        this.sunHalo.setPosition(sunX, sunY).setRadius(haloR).setFillStyle(isSun ? 0xffe080 : 0x8090b0, isSun ? 0.14 : 0.08);

        // ── STARS ──
        this.nightOverlay.setAlpha(nightAlpha);
        this.stars.clear();
        if (nightAlpha > 0.15) {
            this.starPositions.forEach((s, idx) => {
                s.twinkle += 0.03;
                const alpha = nightAlpha * (0.6 + 0.4 * Math.sin(s.twinkle));
                const size = idx % 7 === 0 ? 2 : 1.2;
                this.stars.fillStyle(0xffffff, alpha);
                this.stars.fillCircle(s.x, s.y * (H / (H * 0.45)), size);
            });
        }

        // ── MOUNTAIN TINT (reflects sky colour) ──
        const mtTint = isSun ? 0xffffff : 0x99aabb;
        const mtFarAlpha = isSun ? 0.6 : 0.3;
        this.mountainsFar.forEach(m => m.setTint(mtTint).setAlpha(mtFarAlpha));
        this.mountains.forEach(m => m.setTint(mtTint).setAlpha(isSun ? 0.88 : 0.45));
        this.mountainsNear.forEach(m => m.setTint(mtTint).setAlpha(isSun ? 0.95 : 0.55));
        // Clouds tint
        const cloudTint = isDusk ? 0xffaa88 : (isDawn2 ? 0xffcc99 : 0xffffff);
        this.clouds.forEach(c => c.setTint(cloudTint));
        this.cloudsFar.forEach(c => c.setTint(cloudTint).setAlpha(isDusk || isDawn2 ? 0.5 : 0.35));

        // ── AMBIENT LIGHT ──
        const ambientVal = Math.round(255 - nightAlpha * 200);
        this.lights.setAmbientColor(Phaser.Display.Color.GetColor(ambientVal, ambientVal, Math.min(255, ambientVal + 20)));
    }

    // ═══ RESTORED VISUAL FEATURES ═══

    // ─── SMOKE PARTICLES ───
    _updateSmoke(delta) {
        const dt = delta / 16.667;
        const speed = this.physics.speed;
        const isMoving = speed > 0.5;
        const isDiesel = (this.registry.get('selectedLoco') || '').includes('WDM');
        const smokeRate = isDiesel ? 0.15 : 0.06; // Diesel locos produce more smoke

        // Spawn new smoke
        if (isMoving) {
            this.smokeTimer += dt;
            if (this.smokeTimer > (1 / smokeRate)) {
                this.smokeTimer = 0;
                const dead = this.smokeParticles.find(p => p.life <= 0);
                if (dead) {
                    dead.life = 1;
                    dead.maxLife = 40 + Math.random() * 30;
                    dead.vx = -(speed * 0.3 + Math.random() * 1.5);
                    dead.vy = -(1.5 + Math.random() * 2);
                    dead.sprite.setPosition(
                        this.trainFixedX + 128 * 3 * 0.3,
                        this.trackY - 140 + Math.random() * 10
                    );
                }
            }
        }

        // Update existing smoke
        this.smokeParticles.forEach(p => {
            if (p.life <= 0) { p.sprite.setAlpha(0); return; }
            p.life -= dt / p.maxLife;
            p.sprite.x += p.vx * dt;
            p.sprite.y += p.vy * dt;
            p.vy *= 0.98; // decelerate upward
            const r = 4 + (1 - p.life) * 12; // grow as it fades
            p.sprite.setRadius(r).setAlpha(p.life * 0.5).setFillStyle(
                isDiesel ? 0x333333 : 0xaaaaaa, p.life * 0.4
            );
        });
    }

    // ─── PANTOGRAPH SPARKS ───
    _updateSparks(delta) {
        const dt = delta / 16.667;
        const speed = this.physics.speed;
        const throttle = this.physics.throttleNotch || 0;
        const isElectric = !(this.registry.get('selectedLoco') || '').includes('WDM');

        // Spawn sparks during acceleration on electric locos (scales with rain weather)
        const isRaining = this.weather?.isRaining || false;
        const sparkChance = (isRaining ? 0.16 : 0.08) * throttle;
        if (isElectric && throttle > 2 && speed > 1 && Math.random() < sparkChance) {
            const dead = this.sparkParticles.find(p => p.life <= 0);
            if (dead) {
                dead.life = 1;
                dead.maxLife = (isRaining ? 12 : 8) + Math.random() * 8;
                dead.vx = (Math.random() - 0.5) * (isRaining ? 12 : 8);
                dead.vy = (Math.random() - 0.5) * 6;
                dead.sprite.setPosition(
                    this.trainFixedX + 128 * 3 * 0.35 + Math.random() * 20,
                    this.trackY - 178
                );
            }
        }

        this.sparkParticles.forEach(p => {
            if (p.life <= 0) { p.sprite.setAlpha(0); return; }
            p.life -= dt / p.maxLife;
            p.sprite.x += p.vx * dt;
            p.sprite.y += p.vy * dt;
            p.vy += 0.5 * dt; // gravity
            const colors = [0x00ccff, 0xffaa00, 0xffffff, 0xff6600];
            p.sprite.setFillStyle(colors[Math.floor(Math.random() * colors.length)], p.life)
                    .setAlpha(p.life).setRadius(1 + Math.random() * 2);
        });
    }

    // ─── WHEEL SLIP SPARKS ───
    _updateWheelSparks(delta) {
        const dt = delta / 16.667;
        const isWheelSlip = this.physics.isWheelSlipActive;

        if (isWheelSlip && Math.random() < 0.4) {
            const dead = this.wheelSparks.find(p => p.life <= 0);
            if (dead) {
                dead.life = 1;
                dead.maxLife = 6 + Math.random() * 8;
                dead.vx = -10 - Math.random() * 8;
                dead.vy = -3 - Math.random() * 4;
                const wheelOffset = Math.random() > 0.5 ? -40 : 20;
                dead.sprite.setPosition(
                    this.trainFixedX + wheelOffset,
                    this.trackY + 4
                );
            }
        }

        this.wheelSparks.forEach(p => {
            if (p.life <= 0) { p.sprite.setAlpha(0); return; }
            p.life -= dt / p.maxLife;
            p.sprite.x += p.vx * dt;
            p.sprite.y += p.vy * dt;
            p.vy += 0.4 * dt; // gravity
            const colors = [0xffaa00, 0xffcc00, 0xff3300, 0xffffff];
            p.sprite.setFillStyle(colors[Math.floor(Math.random() * colors.length)], p.life)
                    .setAlpha(p.life).setRadius(1.5 + Math.random() * 2);
        });
    }

    // ─── STATION NAME LABELS (Hindi + English) ───
    _renderStationNames(worldDist) {
        this.stationLabels.forEach(l => { l.main.setVisible(false); l.hindi.setVisible(false); });
        const stations = getStations();
        let idx = 0;
        stations.forEach(st => {
            const wx = kmToWorld(st.km);
            const dist = wx - worldDist;
            if (Math.abs(dist) > 4000 || idx >= this.stationLabels.length) return;
            const screenX = this.trainFixedX + dist * PARALLAX.TRACK;
            const label = this.stationLabels[idx++];
            label.main.setText(st.name + (st.code ? ` (${st.code})` : '')).setPosition(screenX, this.getScreenY(wx, -90)).setVisible(true);
            if (st.hindi) {
                label.hindi.setText(st.hindi).setPosition(screenX, this.getScreenY(wx, -70)).setVisible(true);
            }
        });
    }

    // ─── CINEMATIC WATER REFLECTIONS (Bridges over lakes) ───
    _renderWaterReflections(worldDist, W, H) {
        this.waterGfx.clear();
        this.waterPhase += 0.025;
        const cycle = this.weather.dayNightCycle;
        const isNight = Math.max(0, Math.sin(cycle * Math.PI * 2 - Math.PI / 2)) > 0.3;
        const isDusk  = cycle > 0.52 && cycle < 0.72;
        const isDawn  = cycle > 0.14 && cycle < 0.30;

        this.bridgeZones.forEach(bz => {
            if (bz.type !== 'WATER') return;
            const startScreen = this.trainFixedX + (bz.start - worldDist) * PARALLAX.TRACK;
            const endScreen = this.trainFixedX + (bz.end - worldDist) * PARALLAX.TRACK;
            if (endScreen < -200 || startScreen > W + 200) return;
            const waterW = Math.max(0, endScreen - startScreen);
            const waterY = this.getScreenY(bz.start, 22);
            const waterHeight = H - waterY;

            // ── LAKE BASE COLOUR (changes with time of day) ──
            let waterColor, waterAlpha;
            if (isNight)        { waterColor = 0x060e1e; waterAlpha = 0.92; }
            else if (isDusk)    { waterColor = 0x5c1a0a; waterAlpha = 0.85; }
            else if (isDawn)    { waterColor = 0x103870; waterAlpha = 0.82; }
            else                { waterColor = 0x0b4570; waterAlpha = 0.80; }

            this.waterGfx.fillStyle(waterColor, waterAlpha);
            this.waterGfx.fillRect(startScreen, waterY, waterW, waterHeight);

            // ── MOUNTAIN REFLECTION (blurry gradient mirror) ──
            const reflColor = isDusk ? 0x7c3020 : (isDawn ? 0x2060a0 : 0x1a6080);
            for (let ri = 0; ri < 6; ri++) {
                const ry = waterY + ri * (waterHeight / 7);
                const rAlpha = 0.18 - ri * 0.025;
                this.waterGfx.fillStyle(reflColor, rAlpha);
                this.waterGfx.fillRect(startScreen, ry, waterW, waterHeight / 7);
            }

            // ── SUN/MOON REFLECTION STREAK ──
            const reflX = startScreen + waterW * 0.65;
            const reflW = 30 + Math.sin(this.waterPhase * 1.2) * 15;
            const streakColor = isDusk ? 0xff9060 : (isNight ? 0xc0d0e0 : 0xffd080);
            this.waterGfx.fillStyle(streakColor, 0.3);
            this.waterGfx.fillRect(reflX - reflW / 2, waterY, reflW, waterHeight);
            // Bright core
            this.waterGfx.fillStyle(streakColor, 0.55);
            this.waterGfx.fillRect(reflX - 6, waterY + 2, 12, waterHeight - 10);

            // ── SHIMMERING RIPPLE WAVES ──
            const rippleColor = isDusk ? 0xffaa80 : (isNight ? 0x4060a0 : 0x55aacc);
            this.waterGfx.lineStyle(1.2, rippleColor, 0.5);
            const numRipples = Math.floor(waterHeight / 18);
            for (let r = 0; r < numRipples; r++) {
                const ry = waterY + 6 + r * 18;
                const phaseShift = r * 1.8 + this.waterPhase;
                this.waterGfx.beginPath();
                let first = true;
                for (let x = startScreen; x < endScreen; x += 5) {
                    const shimmer = Math.sin((x * 0.018) + phaseShift) * 4
                                  + Math.sin((x * 0.03) + phaseShift * 1.4) * 1.5;
                    if (first) { this.waterGfx.moveTo(x, ry + shimmer); first = false; }
                    else         this.waterGfx.lineTo(x, ry + shimmer);
                }
                this.waterGfx.strokePath();
            }

            // ── LIGHT SPARKLES / GLINTS ──
            const sparkColor = isNight ? 0xaac8e0 : 0xffffff;
            for (let s = 0; s < 20; s++) {
                const sx = startScreen + Math.abs(Math.sin(this.waterPhase * 0.4 + s * 1.37)) * waterW;
                const sy = waterY + 4 + Math.abs(Math.cos(this.waterPhase * 0.6 + s * 0.91)) * (waterHeight - 10);
                const sparkA = 0.1 + 0.4 * Math.abs(Math.sin(this.waterPhase * 1.1 + s));
                this.waterGfx.fillStyle(sparkColor, sparkA);
                this.waterGfx.fillCircle(sx, sy, 1.5 + Math.sin(this.waterPhase + s) * 0.8);
            }

            // ── MIST / FOG AT WATER EDGE ──
            const mistAlpha = 0.12 + 0.06 * Math.sin(this.waterPhase * 0.5);
            this.waterGfx.fillStyle(0xe0f4ff, mistAlpha);
            this.waterGfx.fillRect(startScreen, waterY, waterW, 28);
        });
    }

    // ─── BIRD FLOCK SYSTEM ───
    _updateBirds(delta, W, H) {
        const dt = delta / 16.667;
        const cycle = this.weather.dayNightCycle;
        const isNight = Math.max(0, Math.sin(cycle * Math.PI * 2 - Math.PI / 2)) > 0.4;

        // Only spawn birds during daytime
        if (!isNight) {
            this.birdSpawnTimer -= dt;
            if (this.birdSpawnTimer <= 0) {
                this.birdSpawnTimer = 180 + Math.random() * 300; // every ~3-8 seconds
                // Find enough inactive birds for a flock of 3-8
                const flockSize = 3 + Math.floor(Math.random() * 6);
                const freeBirds = this.birds.filter(b => !b.active);
                if (freeBirds.length >= flockSize) {
                    const speed = 1.8 + Math.random() * 1.5;
                    const startY = H * (0.08 + Math.random() * 0.25);
                    const veer = (Math.random() - 0.5) * 0.6;
                    for (let i = 0; i < flockSize; i++) {
                        const b = freeBirds[i];
                        b.x = -40 - Math.random() * 80;
                        b.y = startY + (Math.random() - 0.5) * 40;
                        b.vx = speed + Math.random() * 0.4;
                        b.vy = veer;
                        b.active = true;
                        b.sprite.setPosition(b.x, b.y).setVisible(true)
                               .setAlpha(0.65 + Math.random() * 0.3)
                               .setScale(0.8 + Math.random() * 0.7);
                    }
                }
            }
        }

        // Update birds
        this.birds.forEach(b => {
            if (!b.active) return;
            b.x += b.vx * dt;
            b.y += b.vy * dt * 0.5;
            // Gentle sinusoidal Y drift (soaring)
            b.y += Math.sin(b.x * 0.015) * 0.4 * dt;
            b.sprite.setPosition(b.x, b.y);
            // Retire off-screen
            if (b.x > W + 80) {
                b.active = false;
                b.sprite.setVisible(false);
            }
        });
    }

    // ─── OHE POLES (every 300 world units) ───
    _renderOHEPoles(worldDist, W) {
        const spacing = 300; // world units between poles (~60m at KM_SCALE=3000)
        const startPole = Math.floor((worldDist - 1000) / spacing) * spacing;
        let poleIdx = 0;
        this.ohePoles.forEach(p => p.setVisible(false));

        // Draw cantilever arms on the OHE graphics layer
        if (this.oheGraphics) {
            this.oheGraphics.clear();
        } else {
            this.oheGraphics = this.add.graphics().setDepth(5.1);
        }
        const g = this.oheGraphics;
        // Neutral section tracking (approximately every 7th pole = ~2.1km)
        let poleCount = Math.floor(worldDist / spacing);

        for (let px = startPole; px < worldDist + W + 2000 && poleIdx < this.ohePoles.length; px += spacing) {
            const dist = px - worldDist;
            const screenX = this.trainFixedX + dist * PARALLAX.TRACK;
            if (screenX < -100 || screenX > W + 100) { poleCount++; continue; }

            // Set pole position
            const elevOffset = -(getElevationAt(px) - getElevationAt(worldDist)) * ELEVATION_SCALE;
            const poleTopY  = this.trackY - 195 + elevOffset; // top of pole = OHE messenger wire height
            const poleBaseY = this.trackY + 10 + elevOffset;
            this.ohePoles[poleIdx].setPosition(screenX, poleBaseY).setVisible(true);
            poleIdx++;

            // ── Cantilever arm (T-bracket from pole top) ──
            // Indian Railways OHE: steel cantilever arm extends ~4m to the track centre
            // Arm tilts slightly outward (away from track) at 5°
            const armLen  = 28; // pixels at this scale
            const armEndX = screenX + armLen;   // arm extends track-side (right)
            const armEndY = poleTopY + 6;        // slight downward angle

            // Main cantilever arm
            g.lineStyle(2, 0x8a9a88, 0.9);
            g.lineBetween(screenX, poleTopY, armEndX, armEndY);

            // Steady arm (connects arm tip to contact wire)
            g.lineStyle(1, 0x7a8a78, 0.8);
            g.lineBetween(armEndX, armEndY, armEndX, this.trackY + this._getContactWireHeightAt(px + 28) + elevOffset);

            // Registration arm bracket (small horizontal brace)
            g.lineStyle(2, 0x9aaa98, 0.7);
            g.lineBetween(screenX, poleTopY + 20, armEndX, poleTopY + 20);

            // ── Neutral section visual ──
            // Every 700 poles (~210km), show neutral section board + gap in wire
            // On this 64km route, approximately every 9000 world units (~3km)
            const isNeutral = (Math.round(px / 9000) * 9000 === Math.round(px / 300) * 300) &&
                              Math.abs(px % 9000) < 300;
            if (isNeutral) {
                // Neutral section gap (diamond separator)
                g.lineStyle(3, 0xffcc00, 0.9);
                g.strokeRect(screenX - 8, this.trackY - 188 + elevOffset, 16, 20);
                g.lineStyle(2, 0xff4400, 0.8);
                g.lineBetween(screenX - 6, this.trackY - 188 + elevOffset, screenX + 6, this.trackY - 168 + elevOffset);
                g.lineBetween(screenX - 6, this.trackY - 168 + elevOffset, screenX + 6, this.trackY - 188 + elevOffset);
            }

            poleCount++;
        }
    }

    /**
     * Render route-specific landmarks at exact km positions.
     * Landmarks are large background sprites placed at defined distances.
     */
    _renderLandmarks(worldDist, W) {
        const H = this.cameras.main.height;

        // Landmark definitions: [km, texKey, scaleX, scaleY, yRatio, depthVal, alphaVal]
        const LANDMARKS = [
            { km: 0.5,  key: 'kollam_port',    sx: 2.5, sy: 2.0, yR: 0.48, depth: 0.6,  alpha: 0.7 },
            { km: 55.5, key: 'veli_lagoon',     sx: 3.5, sy: 2.0, yR: 0.52, depth: 0.55, alpha: 0.65 },
            { km: 63.8, key: 'gopuram',         sx: 2.0, sy: 2.0, yR: 0.35, depth: 0.8,  alpha: 0.55 },
        ];

        if (!this._landmarkSprites) {
            // Create landmark sprites once
            this._landmarkSprites = LANDMARKS.map(lm => {
                if (!this.textures.exists(lm.key)) return null;
                const s = this.add.sprite(0, 0, lm.key)
                    .setScale(lm.sx, lm.sy)
                    .setOrigin(0.5, 1)
                    .setDepth(lm.depth)
                    .setAlpha(lm.alpha)
                    .setVisible(false);
                return s;
            });
        }

        LANDMARKS.forEach((lm, i) => {
            const sp = this._landmarkSprites[i];
            if (!sp) return;

            const wx   = lm.km * KM_SCALE;
            const dist = wx - worldDist;

            // Show if within 5000 world units (on screen)
            if (Math.abs(dist) > 5000) {
                sp.setVisible(false);
                return;
            }

            const screenX = this.trainFixedX + dist * PARALLAX.FAR_MOUNTAINS;
            sp.setPosition(screenX, this.getScreenY(wx, H * lm.yR - this.trackY)).setVisible(true);
        });
    }

    /**
     * Render the Varkala coastal red cliffs continuously from km 22 to 28.
     * Tiles the cliff sprites side-by-side in the background with culling.
     */
    _renderVarkalaCliffs(worldDist, W) {
        const H = this.cameras.main.height;
        if (!this.varkalaCliffPool) {
            this.varkalaCliffPool = [];
            for (let i = 0; i < 4; i++) {
                const s = this.add.sprite(0, 0, 'varkala_cliff')
                    .setScale(3.5, 2.5)
                    .setOrigin(0.5, 1)
                    .setDepth(0.5)
                    .setAlpha(0.85)
                    .setVisible(false);
                this.varkalaCliffPool.push(s);
            }
        }

        // Hide all first
        this.varkalaCliffPool.forEach(s => s.setVisible(false));

        const startWX = 22.0 * KM_SCALE;
        const endWX   = 28.0 * KM_SCALE;
        const cliffW  = 256 * 3.5; // scaled width = 896

        const startScreenX = this.trainFixedX + (startWX - worldDist) * PARALLAX.FAR_MOUNTAINS;
        const endScreenX   = this.trainFixedX + (endWX - worldDist) * PARALLAX.FAR_MOUNTAINS;

        // If offscreen, return
        if (endScreenX < -cliffW || startScreenX > W + cliffW) return;

        const step = cliffW - 2; // slight overlap to prevent seams
        let poolIdx = 0;
        for (let sx = startScreenX; sx < endScreenX + cliffW / 2; sx += step) {
            if (sx < -cliffW || sx > W + cliffW) continue;
            if (poolIdx < this.varkalaCliffPool.length) {
                const cliffWorldX = worldDist + (sx - this.trainFixedX) / PARALLAX.FAR_MOUNTAINS;
                this.varkalaCliffPool[poolIdx]
                    .setPosition(sx, this.getScreenY(cliffWorldX, H * 0.46 - this.trackY))
                    .setVisible(true);
                poolIdx++;
            }
        }
    }

    _renderBridges(worldDist, W) {
        this.bridgeGirders.forEach(b => b.setVisible(false));
        this.bridgePillars.forEach(p => p.setVisible(false));
        let girderIdx = 0;
        let pillarIdx = 0;

        this.bridgeZones.forEach(bz => {
            const startScreen = this.trainFixedX + (bz.start - worldDist) * PARALLAX.TRACK;
            const endScreen = this.trainFixedX + (bz.end - worldDist) * PARALLAX.TRACK;

            if (endScreen < -200 || startScreen > W + 200) return;

            // Determine bridge texture from BRIDGE_TYPES (synchronous, imported at top)
            const bzkm = bz.start / 3000;
            const btEntry = BRIDGE_TYPES?.find(bt => Math.abs(bt.km - bzkm) < 1.0);
            const bridgeTex = (btEntry?.texKey && this.textures.exists(btEntry.texKey))
                ? btEntry.texKey : 'bridgeGirder';

            const girderWidth = bridgeTex === 'bridge_backwater' ? 800 :
                                bridgeTex === 'bridge_steel'     ? 800 : 384;

            // Pillars under the bridge
            const pillarSpacing = bridgeTex === 'bridge_backwater' ? 240 : 160;
            for (let sx = startScreen + 80; sx < endScreen - 40 && pillarIdx < this.bridgePillars.length; sx += pillarSpacing) {
                const pillarWorldX = worldDist + (sx - this.trainFixedX) / PARALLAX.TRACK;
                this.bridgePillars[pillarIdx++].setPosition(sx, this.getScreenY(pillarWorldX, 14)).setVisible(true);
            }

            // Girders with correct bridge texture
            for (let sx = startScreen; sx < endScreen && girderIdx < this.bridgeGirders.length; sx += girderWidth) {
                const sp = this.bridgeGirders[girderIdx++];
                if (this.textures.exists(bridgeTex)) sp.setTexture(bridgeTex);
                const girderWorldX = worldDist + (sx - this.trainFixedX) / PARALLAX.TRACK;
                sp.setPosition(sx, this.getScreenY(girderWorldX, 4)).setVisible(true);
            }
        });
    }

    _getContactWireHeightAt(worldX) {
        let yOffset = -178;
        // Sag between poles (poles are spaced every 300 units)
        const polePhase = (worldX % 300) / 300;
        yOffset += Math.sin(polePhase * Math.PI) * 2.0;

        // Low-clearance at ROBs (Road Over Bridges)
        const ROB_KMS = [4.2, 11.0, 27.5, 51.8, 57.2, 62.0];
        for (let i = 0; i < ROB_KMS.length; i++) {
            const robX = ROB_KMS[i] * 3000;
            const dist = Math.abs(worldX - robX);
            if (dist < 800) {
                const t = (800 - dist) / 800;
                const dip = Math.sin(t * Math.PI / 2) * 16;
                yOffset += dip;
                break;
            }
        }
        return yOffset;
    }

    _getMessengerWireHeightAt(worldX) {
        let yOffset = -195;
        const polePhase = (worldX % 300) / 300;
        yOffset += Math.sin(polePhase * Math.PI) * 12.0; // larger sag (12px)

        // Dipping at ROBs to match contact wire
        const ROB_KMS = [4.2, 11.0, 27.5, 51.8, 57.2, 62.0];
        for (let i = 0; i < ROB_KMS.length; i++) {
            const robX = ROB_KMS[i] * 3000;
            const dist = Math.abs(worldX - robX);
            if (dist < 800) {
                const t = (800 - dist) / 800;
                const dip = Math.sin(t * Math.PI / 2) * 16;
                yOffset += dip;
                break;
            }
        }
        return yOffset;
    }

    _updatePantograph(worldDist) {
        const selectedLoco = this.registry.get('selectedLoco') || '';
        const isElectric = !selectedLoco.includes('WDM');

        this.pantoGfx.clear();
        if (!isElectric) return;

        const dir = this.train.isFacingLeft ? -1 : 1;
        const baseX = this.trainFixedX - 100 * dir;
        const baseY = this.train.loco.y - 138;

        const pantoWorldX = worldDist + (baseX - this.trainFixedX) / PARALLAX.TRACK;
        const targetWireY = this.trackY + this._getContactWireHeightAt(pantoWorldX);

        // Main frame (thick steel tubes, red/orange)
        const knuckleX = baseX - 14 * dir;
        const knuckleY = (baseY + targetWireY) / 2 - 5;

        this.pantoGfx.lineStyle(2.5, 0xd03030, 1.0);
        this.pantoGfx.lineBetween(baseX, baseY, knuckleX, knuckleY); // lower arm
        this.pantoGfx.lineBetween(knuckleX, knuckleY, baseX, targetWireY); // upper arm

        // Collector shoe (horizontal head)
        this.pantoGfx.lineStyle(3, 0x333333, 1.0); // carbon strips
        this.pantoGfx.lineBetween(baseX - 10, targetWireY, baseX + 10, targetWireY);
        this.pantoGfx.lineStyle(1.5, 0xd03030, 1.0); // shoe horns
        this.pantoGfx.lineBetween(baseX - 10, targetWireY, baseX - 13, targetWireY + 4);
        this.pantoGfx.lineBetween(baseX + 10, targetWireY, baseX + 13, targetWireY + 4);

        // Guide bar (parallel to lower arm)
        this.pantoGfx.lineStyle(1, 0x888888, 0.7);
        this.pantoGfx.lineBetween(baseX + 4 * dir, baseY, knuckleX + 4 * dir, knuckleY + 2);

        // Folded panto at front
        const frontBaseX = this.trainFixedX + 100 * dir;
        const frontBaseY = this.train.loco.y - 138;
        this.pantoGfx.lineStyle(2, 0x7f8c8d, 0.95);
        this.pantoGfx.lineBetween(frontBaseX, frontBaseY, frontBaseX + 24 * dir, frontBaseY - 2);
        this.pantoGfx.lineBetween(frontBaseX + 24 * dir, frontBaseY - 2, frontBaseX + 4 * dir, frontBaseY - 4);
        this.pantoGfx.lineStyle(2.5, 0x333333, 1.0);
        this.pantoGfx.lineBetween(frontBaseX + 2 * dir, frontBaseY - 4, frontBaseX + 14 * dir, frontBaseY - 4); // shoe flat
    }

    cycleCameraView() {
        this.currentCameraViewIndex = (this.currentCameraViewIndex + 1) % this.cameraViews.length;
        this.currentCameraView = this.cameraViews[this.currentCameraViewIndex];
        this._speak(`Camera view: ${this.currentCameraView.replace('_', ' ')}`);
        
        // Reset trackside camera position when switched to TRACKSIDE
        if (this.currentCameraView === 'TRACKSIDE') {
            this.tracksideWorldX = this.physics.worldDistance + 800; // Place it ahead of train
        }
        // Reset camera zoom/scroll defaults
        this.cameras.main.setZoom(1);
        this.cameras.main.setScroll(0, 0);
    }

    computeTargetSpeedKmh() {
        const worldDist = this.physics.worldDistance;
        let limit = getSpeedLimitAt(worldDist);

        // Turnout check (matches physics engine turnout check)
        const trainKm = worldDist / 3000;
        let isOnTurnout = false;
        this.stationMgr.stations.forEach(st => {
            if (st.isStoppage) {
                const switchKm = st.km - 0.2;
                if (Math.abs(trainKm - switchKm) < 0.05) {
                    isOnTurnout = true;
                }
            }
        });
        if (isOnTurnout && limit > 30) {
            limit = 30;
        }

        let target = limit;

        // 1. Check Signal Aspect
        if (this.signalMgr && Array.isArray(this.signalMgr.signals)) {
            const nextSig = this.signalMgr.getNextSignal(worldDist);
            if (nextSig) {
                const distToSig = nextSig.x - worldDist;
                if (nextSig.aspect === 'RED') {
                    if (distToSig <= 50) {
                        target = 0;
                    } else if (distToSig <= 300) {
                        target = Math.min(target, 5);
                    } else if (distToSig <= 600) {
                        target = Math.min(target, 20);
                    } else if (distToSig <= 1000) {
                        target = Math.min(target, 40);
                    } else if (distToSig <= 1500) {
                        target = Math.min(target, 60);
                    }
                } else if (nextSig.aspect === 'YELLOW') {
                    if (distToSig < 1500) {
                        target = Math.min(target, 50);
                    }
                } else if (nextSig.aspect === 'DOUBLE_YELLOW') {
                    if (distToSig < 1500) {
                        target = Math.min(target, 75);
                    }
                }
            }
        }

        // 2. Check Station Stoppage Dwell & Approach
        if (this.stationMgr.isWaitingForStarter || 
            this.stationMgr.gameState === 'BOARDING' || 
            this.stationMgr.gameState === 'STOPPED' || 
            this.stationMgr.gameState === 'READY') {
            target = 0;
        } else if (this.stationMgr.gameState === 'APPROACHING') {
            target = 0;
        } else {
            // Check if we are approaching a stoppage station soon (within 2000m)
            const nextSt = this.stationMgr.stations.find(s => s.isStoppage && s.x > worldDist);
            if (nextSt) {
                const distToSt = nextSt.x - worldDist;
                if (distToSt < 2200) {
                    target = Math.min(target, 45);
                }
            }
        }

        return target;
    }

    _updateCamera(time, delta, W, H, worldDist) {
        if (!this.currentCameraView) {
            this.currentCameraView = 'ISOMETRIC';
            this.currentCameraViewIndex = 0;
            this.cameraViews = ['ISOMETRIC', 'DYNAMIC_ZOOM', 'CINEMATIC', 'DRIVER', 'DRONE', 'TRACKSIDE', 'STATION'];
        }

        // Reset scroll first unless overridden
        this.cameras.main.setScroll(0, 0);

        switch (this.currentCameraView) {
            case 'ISOMETRIC':
                this.cameras.main.setZoom(1.15);
                this.cameras.main.setScroll(0, -60);
                break;

            case 'DYNAMIC_ZOOM':
                // Speed-based dynamic zoom
                const speed = this.physics.speed;
                const targetZoom = Phaser.Math.Clamp(1.4 - (speed / 10) * 0.5, 0.9, 1.4);
                this.cameras.main.zoom += (targetZoom - this.cameras.main.zoom) * 0.05;
                this.cameras.main.setScroll(0, -40);
                break;

            case 'CINEMATIC':
                const timeSec = time / 1000;
                const cineZoom = 1.1 + Math.sin(timeSec * 0.4) * 0.15;
                const cineScrollX = Math.sin(timeSec * 0.3) * 100;
                const cineScrollY = -50 + Math.cos(timeSec * 0.5) * 20;
                this.cameras.main.setZoom(cineZoom);
                this.cameras.main.setScroll(cineScrollX, cineScrollY);
                break;

            case 'DRIVER':
                // Focus on cab (locomotive front)
                const dir = this.train.isFacingLeft ? -1 : 1;
                const cabX = this.trainFixedX + 180 * dir;
                const driverScrollX = cabX - W / 2;
                const driverScrollY = this.trackY - H / 2 - 60;
                this.cameras.main.setZoom(1.8);
                this.cameras.main.setScroll(driverScrollX, driverScrollY);
                break;

            case 'DRONE':
                // High angle lookdown
                this.cameras.main.setZoom(0.75);
                this.cameras.main.setScroll(0, -120);
                break;

            case 'TRACKSIDE':
                // Fixed trackside location that train passes by
                if (!this.tracksideWorldX || worldDist - this.tracksideWorldX > 2000) {
                    this.tracksideWorldX = worldDist + 1500;
                }
                const tracksideScrollX = (this.tracksideWorldX - worldDist) + this.trainFixedX - W / 2;
                this.cameras.main.setScroll(tracksideScrollX, -40);
                this.cameras.main.setZoom(1.25);
                break;

            case 'STATION':
                // Focus on station when close
                const isAtStation = (this.stationMgr.gameState === 'APPROACHING' ||
                                     this.stationMgr.gameState === 'STOPPED' ||
                                     this.stationMgr.gameState === 'BOARDING' ||
                                     this.stationMgr.gameState === 'READY');
                const stationZoom = isAtStation ? 1.55 : 1.0;
                this.cameras.main.zoom += (stationZoom - this.cameras.main.zoom) * 0.05;
                this.cameras.main.setScroll(0, isAtStation ? -80 : -40);
                break;
        }
    }

    _speak(msg, queue = false) {
        if (!msg) return;
        try {
            const u = new SpeechSynthesisUtterance(msg);
            u.rate = 1.1; u.pitch = 0.9; u.volume = 0.8;
            const isHindi = /[\u0900-\u097F]/.test(msg);
            u.lang = isHindi ? 'hi-IN' : 'en-IN';
            if (!queue) {
                speechSynthesis.cancel();
            }
            speechSynthesis.speak(u);
        } catch (e) {}
        this.registry.set('alpMessage', msg);
    }
}
