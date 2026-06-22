/**
 * 🚀 BOOT SCENE — Asset preloader + ALL procedural pixel-art textures
 * 6 locomotives, 4 rake types, route furniture (overpasses, LC, W/L boards)
 */
import Phaser from 'phaser';

export default class BootScene extends Phaser.Scene {
    constructor() { super({ key: 'BootScene' }); }

    preload() {
        const { width: W, height: H } = this.cameras.main;
        // Loading bar
        const barW = W * 0.5, barX = (W - barW) / 2, barY = H / 2 + 40;
        this.add.text(W/2, H/2 - 60, '🇮🇳 INDIAN RAILWAYS', { fontFamily: '"Orbitron", monospace', fontSize: '28px', color: '#00ff88' }).setOrigin(0.5);
        this.add.text(W/2, H/2 - 25, 'Loading Systems...', { fontFamily: '"Inter", sans-serif', fontSize: '13px', color: '#888' }).setOrigin(0.5);
        const barBg = this.add.graphics(); barBg.fillStyle(0x222222); barBg.fillRect(barX, barY, barW, 8);
        const barFill = this.add.graphics();
        this.load.on('progress', v => { barFill.clear(); barFill.fillStyle(0x00ff88); barFill.fillRect(barX, barY, barW * v, 8); });

        // Audio (local files only — no external CDN to avoid load stalls)
        if (!this.sound.noAudio) {
            this.load.audio('horn', 'assets/P5.mp3');
            this.load.audio('humming', 'assets/humming.mp3');
            this.load.audio('trackSlow', 'assets/short.mp3');
            this.load.audio('trackFast', 'assets/long.mp3');
            this.load.audio('crowd', 'assets/crowd.mp3');
        }

        this._generateAllTextures();
    }

    create() { this.scene.start('GameScene'); this.scene.launch('HUDScene'); }

    _generateAllTextures() {
        // === LOCOMOTIVES ===
        this._genLoco('wap7',  0xc0392b, 0xe74c3c, 0xecf0f1, 0x95a5a6, 0xf1c40f, 0x2980b9);
        this._genLoco('wap4',  0xe74c3c, 0xc0392b, 0xf5b041, 0x7f8c8d, 0xf1c40f, 0x2980b9);
        this._genLoco('wag12', 0x2471a3, 0x1a5276, 0xaed6f1, 0x5d6d7e, 0xf39c12, 0x2c3e50);
        this._genLoco('vande', 0xecf0f1, 0xd5d8dc, 0x2980b9, 0xaab7b8, 0xe67e22, 0x2c3e50);
        this._genLoco('wag9',  0x27ae60, 0x1e8449, 0xabebc6, 0x7f8c8d, 0xf1c40f, 0x2c3e50);
        this._genLoco('wdm3a', 0xe67e22, 0xd35400, 0xecf0f1, 0x95a5a6, 0xf1c40f, 0x2c3e50);

        // === RAKE TYPES ===
        this._genCoach('coach_lhb',   0xc0392b, 0xecf0f1, 0x95a5a6, 0x2980b9);
        this._genCoach('coach_icf',   0x2471a3, 0xaed6f1, 0x1a5276, 0x85c1e9);
        this._genTanker('coach_tanker');
        this._genBoxn('coach_boxn');

        // === COMMON ===
        this._genWheel(); this._genTrack(); this._genSignal();
        this._genTree(); this._genPalmTree(); this._genCloud(); this._genCloudFar();
        this._genOHEPole(); this._genPlatform(); this._genRoof();
        this._genPerson(); this._genBridgeGirder(); this._genOppTrain();
        this._genMountain(); this._genMountainFar(); this._genMountainNear();
        this._genCityBuilding(); this._genRainDrop();
        this._genBridgePillar(); this._genBird(); this._genLakeFog();

        // === NEW ROUTE FURNITURE ===
        this._genOverpass(); this._genLCGate(); this._genWLBoard();
        this._genUnderpass(); this._genYardBg();
        this._genAuto(); this._genCar(); this._genTruck();
        this._genLCGateParts();
        this._genSwitch('track_switch_left', 'left');
        this._genSwitch('track_switch_right', 'right');
        this._genKollamFacade();
        this._genTVCFacade();
        this._genFOB();       // 2.5D Foot Over Bridge
        this._genFOBStair();  // Staircase
        this._genFOBPillar(); // Steel support column
        this._genPlatform2(); // Far-side platform
        this._genPlatBench(); // Bench + dustbin
        this._genLEDBoard();  // Station LED sign
        this._genKeralaHouse();
        this._genShopRow();
        this._genITBuilding();
        this._genPaddyField();
        this._genBoat();
        this._genCompoundWall();
        this._genKsrtcBus();
        this._genROB();       // Road Over Bridge
        this._genKMStone();   // Milestone board

        // ── Station Life ──
        this._genPersonSitting();
        this._genPersonWalking();
        this._genPersonBoarding();
        this._genPorter();
        this._genRailwayStaff();
        this._genVendor();
        // ── Road Traffic ──
        this._genBike();
        this._genAuto2();
        this._genCar2();
        // ── Signal Boards ──
        this._genGBoard();
        this._genSpeedBoard(50);
        this._genSpeedBoard(30);
        this._genNeutralBoard();
        // ── Water ──
        this._genWaterRipple();
        // ══ PHASE 2: Kerala Realism ══
        this._genBananaPlant();       // Banana / plantain grove
        this._genWetlandVeg();        // Reed & wetland grasses
        this._genCoconutCluster();    // Dense coconut cluster
        this._genLocalRoad();         // Kerala village road
        this._genRubberTree();        // Rubber plantation row
        // ══ PHASE 3: Landmarks ══
        this._genVarkalaCliff();      // Laterite red cliff face
        this._genGopuram();           // Temple gopuram silhouette
        this._genItCorridor();        // Technopark glass facade
        this._genVeliLagoon();        // Veli lagoon background strip
        this._genKollamPort();        // Kollam harbour silhouette
        // ══ PHASE 4: Distinct Bridge Types ══
        this._genConcreteBridge();    // Concrete T-girder railway bridge
        this._genSteelTrussBridge();  // Steel through-truss bridge
        this._genCanalBridge();       // Small canal culvert bridge
        this._genBackwaterBridge();   // Long causeway over backwater
    }


    _genLoco(key, bodyMain, bodyAccent, stripe, lower, trim, windowColor) {
        const g = this.make.graphics({ add: false }), W = 128, H = 48;
        
        // ─── 2.5D OBLIQUE ROOF (Z-Depth tilt) ───
        g.fillStyle(0x7f8c8d); // Base roof grey
        g.beginPath();
        g.moveTo(14, 2);   g.lineTo(114, 2);  // Far edge (narrower)
        g.lineTo(120, 10); g.lineTo(8, 10);   // Near edge (wider)
        g.closePath();
        g.fill();
        
        // Corrugated lines on roof (slanted lines)
        g.fillStyle(0x95a5a6);
        for (let x = 20; x < 100; x += 16) {
            g.beginPath();
            g.moveTo(x, 2);   g.lineTo(x + 4, 2);
            g.lineTo(x - 2, 10); g.lineTo(x - 6, 10);
            g.closePath();
            g.fill();
        }

        // Pantograph base on roof
        g.fillStyle(0x333333);
        g.fillRect(30, 4, 10, 4);
        g.fillRect(80, 4, 10, 4);

        // ─── 2.5D SIDE PANEL (Front visible face) ───
        g.fillStyle(bodyMain); g.fillRect(8, 10, 112, 26);
        // Sloped cab nose on right (X=120) and left (X=8)
        g.fillStyle(bodyAccent);
        g.fillRect(112, 10, 8, 26); // Right cab side
        g.fillStyle(0x2c3e50);
        g.fillRect(120, 12, 5, 20);  // Right nose shadow

        // Stripe
        g.fillStyle(stripe); g.fillRect(8, 26, 112, 3);
        // Lower body panel
        g.fillStyle(lower); g.fillRect(8, 29, 112, 7);

        // Windshields & Windows (slanted slightly)
        g.fillStyle(windowColor);
        g.fillRect(114, 13, 8, 8); // Front cab window
        g.fillRect(6, 13, 8, 8);   // Rear cab window
        
        // Side grills & trim
        g.fillStyle(trim);
        g.fillRect(122, 20, 3, 3);
        g.fillRect(40, 16, 40, 2); // Metal side line

        // Machine room side circular/square windows
        g.fillStyle(0x1a1a2e);
        for (let i = 0; i < 4; i++) {
            g.fillCircle(28 + i * 20, 18, 3);
        }

        // Base frame/buffer beam
        g.fillStyle(0x111111); g.fillRect(6, 36, 116, 4);
        g.fillStyle(0x333333); g.fillRect(122, 30, 4, 8); g.fillRect(2, 30, 4, 8);

        g.generateTexture(key, W, H); g.destroy();
    }

    // ─── GENERIC COACH GENERATOR ───
    _genCoach(key, body, stripe, lower, windowColor) {
        const g = this.make.graphics({ add: false }), W = 96, H = 48;
        
        // ─── 2.5D OBLIQUE ROOF ───
        g.fillStyle(0x7f8c8d);
        g.beginPath();
        g.moveTo(6, 2);   g.lineTo(90, 2);
        g.lineTo(94, 10); g.lineTo(2, 10);
        g.closePath();
        g.fill();

        // Corrugated roof lines
        g.fillStyle(0x95a5a6);
        for (let x = 12; x < 84; x += 12) {
            g.beginPath();
            g.moveTo(x, 2);   g.lineTo(x + 3, 2);
            g.lineTo(x - 1, 10); g.lineTo(x - 4, 10);
            g.closePath();
            g.fill();
        }

        // ─── 2.5D SIDE PANEL ───
        g.fillStyle(body); g.fillRect(2, 10, 92, 26);
        
        // Windows (rounded rectangular LHB style)
        g.fillStyle(windowColor);
        for (let i = 0; i < 7; i++) {
            g.fillRect(8 + i * 11, 13, 8, 8);
        }

        // Doors (left & right ends)
        g.fillStyle(0x111111);
        g.fillRect(4, 11, 3, 24);
        g.fillRect(89, 11, 3, 24);

        // Stripe
        g.fillStyle(stripe); g.fillRect(2, 26, 92, 3);
        // Lower panel
        g.fillStyle(lower); g.fillRect(2, 29, 92, 7);

        // Bottom underframe
        g.fillStyle(0x111111); g.fillRect(4, 36, 88, 4);
        g.fillStyle(0x1a1a1a); g.fillRect(0, 10, 2, 26); g.fillRect(94, 10, 2, 26);

        g.generateTexture(key, W, H); g.destroy();
    }

    // ─── TANKER WAGON ───
    _genTanker(key) {
        const g = this.make.graphics({ add: false }), W = 96, H = 48;
        // Underframe
        g.fillStyle(0x111111); g.fillRect(4, 34, 88, 4);
        g.fillStyle(0x333333); g.fillRect(0, 32, 4, 8); g.fillRect(92, 32, 4, 8);

        // 3D Cylinder tank
        g.fillStyle(0x7f8c8d); g.fillEllipse(48, 20, 84, 24); // Back shadow/depth
        g.fillStyle(0xbdc3c7); g.fillEllipse(48, 18, 80, 20); // Front face
        
        // Dome on top
        g.fillStyle(0x95a5a6); g.fillRect(40, 4, 16, 6);
        g.fillStyle(0xd5dbdb); g.fillRect(44, 2, 8, 3);

        // Hazmat warning plate
        g.fillStyle(0xe74c3c); g.fillRect(20, 14, 8, 8);
        g.fillStyle(0xf39c12); g.fillRect(60, 14, 16, 3);

        g.generateTexture(key, W, H); g.destroy();
    }

    // ─── BOXN FREIGHT WAGON ───
    _genBoxn(key) {
        const g = this.make.graphics({ add: false }), W = 96, H = 48;
        // Underframe
        g.fillStyle(0x111111); g.fillRect(4, 36, 88, 4);
        g.fillStyle(0x333333); g.fillRect(0, 30, 4, 12); g.fillRect(92, 30, 4, 12);

        // 3D interior (black coal pile showing behind the front wall)
        g.fillStyle(0x1a1a1a); // Coal
        g.fillRect(6, 6, 84, 12);
        g.fillTriangle(10, 12, 30, 2, 50, 12);
        g.fillTriangle(46, 12, 68, 0, 88, 12);

        // Front wall (open top)
        g.fillStyle(0x6d4c2a); g.fillRect(4, 12, 88, 24);
        // Inside shadow at top edge
        g.fillStyle(0x4d331a); g.fillRect(4, 12, 88, 2);

        // Vertical support ribs (drawn with shading)
        for (let i = 0; i < 6; i++) {
            g.fillStyle(0x4a3219); g.fillRect(12 + i * 14, 12, 3, 24);
            g.fillStyle(0x8a5b2e); g.fillRect(12 + i * 14, 12, 1, 24);
        }

        g.generateTexture(key, W, H); g.destroy();
    }

    // ─── OVERPASS (foreground Layer 4) ───
    _genOverpass() {
        const g = this.make.graphics({ add: false }), W = 320, H = 200;
        // Left pillar
        g.fillStyle(0x5d6d7e); g.fillRect(0, 40, 40, 160);
        // Right pillar
        g.fillStyle(0x5d6d7e); g.fillRect(280, 40, 40, 160);
        // Deck
        g.fillStyle(0x7f8c8d); g.fillRect(0, 30, 320, 30);
        // Road surface
        g.fillStyle(0x2c3e50); g.fillRect(0, 30, 320, 12);
        
        // ─── Micro Road Traffic (KSRTC Bus + Auto-rickshaw on deck) ───
        // Red KSRTC Bus (X=60 to 92, Y=18 to 30)
        g.fillStyle(0xc0392b); g.fillRect(60, 18, 32, 12); // Red body
        g.fillStyle(0xf1c40f); // Yellow windows
        for (let col = 0; col < 3; col++) g.fillRect(64 + col * 8, 20, 5, 4);
        g.fillStyle(0x111111); g.fillRect(64, 30, 4, 1); g.fillRect(84, 30, 4, 1); // Wheels

        // Yellow Auto-rickshaw (X=180 to 196, Y=22 to 30)
        g.fillStyle(0xf1c40f); g.fillRect(180, 22, 16, 8); // Yellow body
        g.fillStyle(0x111111); g.fillRect(180, 18, 12, 4); // Black canopy
        g.fillStyle(0x87b4e8); g.fillRect(182, 23, 4, 3); // Window glass
        g.fillStyle(0x111111); g.fillRect(182, 30, 3, 1); g.fillRect(190, 30, 3, 1); // Wheels

        // Railing
        g.lineStyle(2, 0xaaaaaa);
        g.lineBetween(0, 28, 320, 28);
        // Shadow
        g.fillStyle(0x000000, 0.25); g.fillRect(30, 60, 260, 8);
        g.generateTexture('overpass', W, H); g.destroy();
    }

    // ─── LEVEL CROSSING GATE ───
    _genLCGate() {
        const g = this.make.graphics({ add: false }), W = 128, H = 96;
        // Left post
        g.fillStyle(0x444444); g.fillRect(8, 0, 8, 96);
        // Right post
        g.fillStyle(0x444444); g.fillRect(112, 0, 8, 96);
        // Gate arm left (striped)
        g.fillStyle(0xf1c40f); g.fillRect(0, 20, 64, 8);
        g.fillStyle(0x111111); for (let i=0;i<8;i++) g.fillRect(i*8, 20, 4, 8);
        // Gate arm right
        g.fillStyle(0xf1c40f); g.fillRect(64, 20, 64, 8);
        g.fillStyle(0x111111); for (let i=0;i<8;i++) g.fillRect(64+i*8, 20, 4, 8);
        // Warning light
        g.fillStyle(0xff0000); g.fillCircle(12, 12, 5);
        g.fillStyle(0xff0000); g.fillCircle(116, 12, 5);
        // Road surface
        g.fillStyle(0x333333); g.fillRect(16, 70, 96, 26);
        g.fillStyle(0xf1c40f); g.fillRect(58, 70, 12, 26); // Center line
        g.generateTexture('lcGate', W, H); g.destroy();
    }

    // ─── W/L (WHISTLE LEVEL) BOARD ───
    _genWLBoard() {
        const g = this.make.graphics({ add: false }), W = 32, H = 80;
        // Post
        g.fillStyle(0x444444); g.fillRect(12, 20, 8, 60);
        // Board (white diamond with W/L)
        g.fillStyle(0xffffff);
        g.fillTriangle(16, 0, 32, 20, 16, 40);
        g.fillTriangle(16, 0, 0, 20, 16, 40);
        // Border
        g.lineStyle(2, 0x000000);
        g.lineBetween(16, 0, 32, 20); g.lineBetween(32, 20, 16, 40);
        g.lineBetween(16, 40, 0, 20); g.lineBetween(0, 20, 16, 0);
        // W/L text (simplified as colored blocks)
        g.fillStyle(0x000000);
        g.fillRect(10, 14, 5, 8); g.fillRect(17, 14, 5, 8);
        g.generateTexture('wlBoard', W, H); g.destroy();
    }

    // ─── UNDERPASS ───
    _genUnderpass() {
        const g = this.make.graphics({ add: false }), W = 256, H = 80;
        // Arch
        g.fillStyle(0x5d6d7e);
        g.fillRect(0, 0, 256, 20);
        g.fillRect(0, 0, 30, 80); g.fillRect(226, 0, 30, 80);
        // Dark inside
        g.fillStyle(0x111111, 0.7);
        g.fillRect(30, 20, 196, 60);
        // Road
        g.fillStyle(0x333333); g.fillRect(30, 60, 196, 20);
        g.generateTexture('underpass', W, H); g.destroy();
    }

    // ─── RAIL YARD BACKGROUND ───
    _genYardBg() {
        const g = this.make.graphics({ add: false }), W = 512, H = 100;
        // Multiple track lines
        g.lineStyle(2, 0x666666);
        for (let y = 10; y < 90; y += 15) g.lineBetween(0, y, 512, y);
        // Parked coaches (simplified)
        const colors = [0xc0392b, 0x2471a3, 0x27ae60, 0x7f8c8d];
        for (let i = 0; i < 8; i++) {
            g.fillStyle(colors[i % 4], 0.6);
            g.fillRect(20 + i * 60, 15 + (i % 3) * 25, 50, 12);
        }
        g.generateTexture('yardBg', W, H); g.destroy();
    }

    // ─── EXISTING TEXTURES (unchanged) ───
    _genWheel() {
        const g = this.make.graphics({ add: false });
        g.fillStyle(0x95a5a6); g.fillCircle(8, 8, 7);
        g.fillStyle(0x2c3e50); g.fillCircle(8, 8, 5);
        g.fillStyle(0x7f8c8d); g.fillCircle(8, 8, 2);
        g.lineStyle(1, 0xbdc3c7); g.lineBetween(8,1,8,15); g.lineBetween(1,8,15,8);
        g.generateTexture('wheel', 16, 16); g.destroy();
    }
    _genTrack() {
        const g = this.make.graphics({ add: false }), W = 64, H = 32;
        // Ballast backing (dark grey/brown soil)
        g.fillStyle(0x3a3028); g.fillRect(0, 4, W, 26);
        
        // Concrete sleepers (skewed at ~15 degrees for 3/4 perspective)
        g.fillStyle(0x7f8c8d);
        // Sleeper 1: from top-left (10, 6) to bottom-right (6, 26)
        g.beginPath();
        g.moveTo(10, 6);   g.lineTo(16, 6);
        g.lineTo(12, 26);  g.lineTo(6, 26);
        g.closePath();
        g.fill();
        
        // Sleeper 2: from top-left (42, 6) to bottom-right (38, 26)
        g.beginPath();
        g.moveTo(42, 6);   g.lineTo(48, 6);
        g.lineTo(44, 26);  g.lineTo(38, 26);
        g.closePath();
        g.fill();

        // Steel rails (drawn horizontally with light reflection on top edge)
        g.fillStyle(0xbdc3c7); g.fillRect(0, 8, W, 2);   // Far rail (thin, light)
        g.fillStyle(0x95a5a6); g.fillRect(0, 24, W, 3);  // Near rail (thicker, darker)
        
        g.generateTexture('track', W, H); g.destroy();
    }
    _genSignal() {
        const aspects = {
            'signal_green': { g: 0x00ff00, y: 0x333333, r: 0x333333 },
            'signal_yellow': { g: 0x333333, y: 0xffff00, r: 0x333333 },
            'signal_doubleyellow': { g: 0x333333, y: 0xffff00, r: 0x333333 },
            'signal_red': { g: 0x333333, y: 0x333333, r: 0xff0000 },
        };
        for (const [key, colors] of Object.entries(aspects)) {
            const g = this.make.graphics({ add: false });
            g.fillStyle(0x222222); g.fillRect(5,0,4,96);
            g.fillStyle(0x111111); g.fillRect(0,0,14,40);
            g.fillStyle(colors.g); g.fillCircle(7,8,4);
            g.fillStyle(colors.y); g.fillCircle(7,20,4);
            g.fillStyle(colors.r); g.fillCircle(7,32,4);
            g.generateTexture(key, 14, 96); g.destroy();
        }
    }
    _genTree() {
        const g = this.make.graphics({ add: false });
        g.fillStyle(0x2b1d0e); g.fillRect(20,32,8,32);
        g.fillStyle(0x0a3d0a); g.fillCircle(24,24,18);
        g.fillStyle(0x061606); g.fillCircle(14,30,14);
        g.fillStyle(0x0a3d0a); g.fillCircle(34,30,14);
        g.generateTexture('tree', 48, 64); g.destroy();
    }
    _genPalmTree() {
        const g = this.make.graphics({ add: false });
        g.fillStyle(0x4a3728); g.fillRect(14,20,4,44);
        g.fillStyle(0x0a4d0a);
        for (let i=0;i<6;i++) { const a=i/6*Math.PI*2; g.fillEllipse(16+Math.cos(a)*14,16+Math.sin(a)*8,16,6); }
        g.generateTexture('palm', 32, 64); g.destroy();
    }
    _genCloud() {
        const g = this.make.graphics({ add: false });
        g.fillStyle(0xffffff,0.6);
        g.fillCircle(16,20,12); g.fillCircle(32,16,16); g.fillCircle(48,20,12);
        g.generateTexture('cloud', 64, 32); g.destroy();
    }
    _genOHEPole() {
        const g = this.make.graphics({ add: false });
        g.fillStyle(0x333333); g.fillRect(2,0,4,128);
        g.fillStyle(0x444444); g.fillRect(0,4,8,3);
        g.generateTexture('ohePole', 8, 128); g.destroy();
    }
    _genPlatform() {
        const g = this.make.graphics({ add: false });
        g.fillStyle(0x95a5a6); g.fillRect(0,0,256,8);
        g.fillStyle(0xf1c40f); g.fillRect(0,1,256,3);
        g.fillStyle(0x7f8c8d); g.fillRect(0,8,256,40);
        g.fillStyle(0x2c3e50); g.fillRect(0,42,256,22);
        g.generateTexture('platform', 256, 64); g.destroy();
    }
    _genRoof() {
        const g = this.make.graphics({ add: false });
        g.fillStyle(0x8b2e2e); g.fillRect(0,0,256,20);
        g.fillStyle(0x5a1f1f); g.fillRect(0,0,256,6);
        g.generateTexture('stationRoof', 256, 20); g.destroy();
    }

    // ════════════════════════════════════════════════════════════
    // 2.5D FOOT OVER BRIDGE SYSTEM
    // Real IR FOB: covered steel-truss walkway crossing above track
    // between Platform 1 and Platform 2, with stair towers each end.
    // ════════════════════════════════════════════════════════════

    /**
     * FOB MAIN SPAN — 2.5D perspective walkway
     *
     * Drawn as a slightly top-angled view:
     *   - Wider at the bottom (near side / front)
     *   - Narrower at top (far side / back) = perspective depth
     *   - Corrugated roof visible from above
     *   - Mesh side visible on near face
     */
    _genFOB() {
        const W = 200, H = 100;
        const g = this.make.graphics({ add: false });

        // ── 2.5D trapezoidal body ──────────────────────────────
        // Near face (full width) at bottom, far face (narrower) at top
        // Simulated with fillRect + colour gradient bands

        // TOP face (roof seen from slight above) — light grey corrugated
        g.fillStyle(0xb8bfc7); g.fillRect(10, 0, W - 20, 22);
        // Corrugated ridge lines on roof
        for (let x = 14; x < W - 20; x += 10) {
            g.fillStyle(x % 20 === 14 ? 0xd0d5dd : 0xa0a8b0);
            g.fillRect(x, 0, 6, 22);
        }
        // Yellow edge stripe on roof
        g.fillStyle(0xf1c40f); g.fillRect(10, 20, W - 20, 3);

        // NEAR FACE (tall mesh panel) — front visible side
        g.fillStyle(0x4b5563); g.fillRect(0, 22, W, 58);
        // Mesh grid on near face
        g.fillStyle(0x6b7280);
        for (let y = 24; y < 76; y += 7)  g.fillRect(0, y, W, 1);  // horizontals
        for (let x = 0;  x < W;  x += 12) g.fillRect(x, 22, 1, 58); // verticals

        // Diagonal bracing on near face
        g.fillStyle(0x374151);
        for (let x = 0; x < W - 20; x += 40) {
            // X brace pattern using thin rects
            g.fillRect(x,      22,  3, 29);
            g.fillRect(x + 18, 22,  3, 29);
            g.fillRect(x,      51,  3, 29);
            g.fillRect(x + 18, 51,  3, 29);
        }

        // ── Structural chords ──────────────────────────────────
        // Top chord (near face top)
        g.fillStyle(0x9ca3af); g.fillRect(0, 22, W, 5);
        // Bottom chord (near face bottom)
        g.fillStyle(0x9ca3af); g.fillRect(0, 75, W, 5);
        // Left upright
        g.fillStyle(0x6b7280); g.fillRect(0, 0, 8, 100);
        // Right upright
        g.fillStyle(0x6b7280); g.fillRect(W - 8, 0, 8, 100);

        // ── Walkway floor (bottom, chequer plate) ─────────────
        g.fillStyle(0x5a6370); g.fillRect(4, 80, W - 8, 16);
        for (let x = 8; x < W - 8; x += 10) {
            g.fillStyle(0x4a5360); g.fillRect(x, 82, 5, 4);
            g.fillStyle(0x6a7380); g.fillRect(x, 88, 5, 4);
        }

        // ── Railway Board name panel (center, deep blue) ──────
        const mx = W / 2 - 22;
        g.fillStyle(0x1e3a8a); g.fillRect(mx, 28, 44, 20);
        g.fillStyle(0xffffff);
        g.fillRect(mx + 3, 31, 38, 3);
        g.fillRect(mx + 3, 38, 38, 3);
        // Thin amber outline
        g.lineStyle(2, 0xf59e0b, 1);
        g.strokeRect(mx, 28, 44, 20);

        // ── Handrail bar (top of near face) ───────────────────
        g.fillStyle(0xd1d5db); g.fillRect(2, 22, W - 4, 3);

        g.generateTexture('fob', W, H);
        g.destroy();
    }

    /**
     * FOB STAIRCASE — 2.5D angled stair tower
     * Steps shown from slight side-top angle.
     * Both sides use same texture; right side flipped horizontally.
     */
    _genFOBStair() {
        const W = 64, H = 100;
        const g = this.make.graphics({ add: false });

        // ── Stair shaft walls ──────────────────────────────────
        g.fillStyle(0x5a6272); g.fillRect(0, 0, W, H);

        // ── Step treads (diagonal cascade, 9 steps) ───────────
        for (let i = 0; i < 9; i++) {
            const tx = 4 + i * 5;
            const ty = 20 + i * 7;
            // Tread (horizontal face — lighter)
            g.fillStyle(0x9ca3af); g.fillRect(tx, ty, 18, 4);
            // Riser (vertical face — darker)
            g.fillStyle(0x6b7280); g.fillRect(tx + 18, ty, 4, 7);
        }

        // ── Handrail (amber/yellow, IR standard) ──────────────
        // Diagonal rail following step line
        g.fillStyle(0xf59e0b);
        for (let i = 0; i < 9; i++) {
            g.fillRect(4 + i * 5, 17 + i * 7, 20, 3);
        }
        // Top horizontal rail
        g.fillStyle(0xf59e0b); g.fillRect(4, 14, 20, 3);
        // Bottom horizontal rail
        g.fillStyle(0xf59e0b); g.fillRect(44, 76, 16, 3);

        // ── Side walls / enclosure ─────────────────────────────
        g.fillStyle(0x4a5568);
        g.fillRect(0, 0, 5, H);      // left wall
        g.fillRect(W - 5, 0, 5, H); // right wall

        // ── Top landing (connects to FOB span) ────────────────
        g.fillStyle(0x9ca3af); g.fillRect(0, 0, W, 18);
        g.fillStyle(0x6b7280); g.fillRect(0, 16, W, 3);

        // ── Bottom landing (connects to platform) ─────────────
        g.fillStyle(0x9ca3af); g.fillRect(0, 84, W, 16);
        g.fillStyle(0x374151); g.fillRect(0, 96, W, 4);

        // ── Yellow stripe at bottom edge (IR safety) ──────────
        g.fillStyle(0xf1c40f); g.fillRect(0, 82, W, 4);

        g.generateTexture('fobStair', W, H);
        g.destroy();
    }

    /** FOB PILLAR — vertical I-beam steel support column */
    _genFOBPillar() {
        const W = 16, H = 90;
        const g = this.make.graphics({ add: false });
        // I-beam shape: top flange, web, bottom flange
        g.fillStyle(0x7a8599); g.fillRect(0, 0, W, 5);         // top flange
        g.fillStyle(0x5d6b80); g.fillRect(5, 5, 6, H - 10);   // web
        g.fillStyle(0x7a8599); g.fillRect(0, H - 5, W, 5);    // bottom flange
        // Highlight on left
        g.fillStyle(0xa0aab8); g.fillRect(0, 2, 3, H - 4);
        // Rivet rows
        g.fillStyle(0x4a5568);
        for (let y = 10; y < H - 10; y += 18) {
            g.fillRect(3, y, 3, 3);
            g.fillRect(10, y, 3, 3);
        }
        g.generateTexture('fobPillar', W, H);
        g.destroy();
    }

    // ════════════════════════════════════════════════════════════
    // STATION PLATFORM SYSTEM
    // ════════════════════════════════════════════════════════════

    /** PLATFORM 2 — far side (opposite platform, receding depth) */
    _genPlatform2() {
        const g = this.make.graphics({ add: false }), W = 256, H = 32;
        // Slightly darker and shorter than near platform
        g.fillStyle(0x808b8d); g.fillRect(0, 0, W, H);
        g.fillStyle(0xd4ac0d); g.fillRect(0, 0, W, 3);   // yellow edge
        g.fillStyle(0x6d7a7c); g.fillRect(0, 3, W, 6);   // edge slab
        g.fillStyle(0x4a5568); g.fillRect(0, 22, W, 10); // base shadow
        // Tactile paving strip (yellow bumps)
        g.fillStyle(0xe2b33a);
        for (let x = 4; x < W; x += 10) g.fillCircle(x, 5, 2);
        g.generateTexture('platform2', W, H); g.destroy();
    }

    /** PLATFORM BENCH + DUSTBIN decorative row */
    _genPlatBench() {
        const W = 48, H = 24;
        const g = this.make.graphics({ add: false });
        // Bench legs
        g.fillStyle(0x5d6d7e); g.fillRect(4, 12, 4, 12); g.fillRect(22, 12, 4, 12);
        // Bench seat
        g.fillStyle(0x8b6914); g.fillRect(2, 8, 28, 6);
        // Bench back
        g.fillStyle(0x6b5010); g.fillRect(24, 2, 4, 10);
        // Dustbin (right side)
        g.fillStyle(0x2c7a2c); g.fillRect(34, 6, 10, 16);
        g.fillStyle(0x1a5c1a); g.fillRect(34, 6, 10, 4);
        g.fillStyle(0x228b22); g.fillRect(36, 4, 6, 4);
        g.generateTexture('platBench', W, H); g.destroy();
    }

    /** STATION LED BOARD — electronic display sign */
    _genLEDBoard() {
        const W = 80, H = 28;
        const g = this.make.graphics({ add: false });
        // Frame
        g.fillStyle(0x1a1a2e); g.fillRect(0, 0, W, H);
        g.fillStyle(0x16213e); g.fillRect(2, 2, W - 4, H - 4);
        // LED pixel matrix simulation
        g.fillStyle(0x00ff88);
        for (let x = 4; x < W - 4; x += 5) {
            for (let y = 4; y < H - 6; y += 5) {
                if (Math.random() > 0.4) g.fillRect(x, y, 3, 3);
            }
        }
        // Status bar (orange)
        g.fillStyle(0xff8c00); g.fillRect(2, H - 6, W - 4, 4);
        g.generateTexture('ledBoard', W, H); g.destroy();
    }

    // ════════════════════════════════════════════════════════════
    // KERALA ROUTE SCENERY ASSETS
    // ════════════════════════════════════════════════════════════

    /** Typical Kerala house — sloped Mangalore-tile roof, white walls */
    _genKeralaHouse() {
        const W = 80, H = 72;
        const g = this.make.graphics({ add: false });
        // White wall body
        g.fillStyle(0xf5f0e8); g.fillRect(8, 28, 64, 44);
        // Terracotta sloped roof (2-slope)
        g.fillStyle(0xb5451b);
        g.fillTriangle(0, 28, 40, 4, 80, 28);
        // Roof ridge highlight
        g.fillStyle(0xcc5522); g.fillRect(36, 4, 8, 4);
        // Roof tile lines
        g.fillStyle(0x9a3a15);
        for (let x = 0; x < 80; x += 8) g.fillRect(x, 8, 2, 20);
        // Door (dark wood)
        g.fillStyle(0x5c3d11); g.fillRect(32, 44, 16, 28);
        // Window left
        g.fillStyle(0x87ceeb); g.fillRect(10, 36, 14, 12);
        g.fillStyle(0xffffff); g.fillRect(16, 36, 2, 12); g.fillRect(10, 41, 14, 2);
        // Window right
        g.fillStyle(0x87ceeb); g.fillRect(56, 36, 14, 12);
        g.fillStyle(0xffffff); g.fillRect(62, 36, 2, 12); g.fillRect(56, 41, 14, 2);
        // Compound wall base
        g.fillStyle(0xd4cfc8); g.fillRect(0, 66, W, 6);
        g.generateTexture('kerala_house', W, H); g.destroy();
    }

    /** Row of small Kerala shops — shuttered or open */
    _genShopRow() {
        const W = 128, H = 64;
        const g = this.make.graphics({ add: false });
        const shopColors = [0xe8d5b7, 0xdce8d5, 0xd5d8e8, 0xe8d5d5];
        for (let i = 0; i < 4; i++) {
            const sx = i * 32;
            g.fillStyle(shopColors[i]); g.fillRect(sx, 16, 30, 48);
            // Shop sign band
            g.fillStyle(0x2c3e50); g.fillRect(sx, 16, 30, 10);
            // Shutter
            g.fillStyle(0x8898aa); g.fillRect(sx + 4, 28, 22, 30);
            for (let y = 30; y < 56; y += 6) g.fillStyle(0x6b7a8a), g.fillRect(sx + 4, y, 22, 2);
            // Signboard text lines
            g.fillStyle(0xf1c40f);
            g.fillRect(sx + 4, 18, 22, 2); g.fillRect(sx + 4, 22, 16, 2);
        }
        // Shared flat canopy
        g.fillStyle(0x4a5568); g.fillRect(0, 10, W, 8);
        g.fillStyle(0x2d3a4a); g.fillRect(0, 10, W, 3);
        g.generateTexture('shop_row', W, H); g.destroy();
    }

    /** Multi-storey IT/commercial building (Kazhakuttam zone) */
    _genITBuilding() {
        const W = 80, H = 120;
        const g = this.make.graphics({ add: false });
        // Main body
        g.fillStyle(0x2c3e6b); g.fillRect(0, 0, W, H);
        // Glass curtain wall (blue-grey)
        g.fillStyle(0x4a6fa5); g.fillRect(4, 4, W - 8, H - 4);
        // Floor bands
        g.fillStyle(0x1a2d50);
        for (let y = 4; y < H; y += 14) g.fillRect(4, y, W - 8, 2);
        // Window grid
        g.fillStyle(0x87b4e8);
        for (let col = 0; col < 4; col++) {
            for (let row = 0; row < 7; row++) {
                const wx = 8 + col * 17, wy = 8 + row * 14;
                g.fillRect(wx, wy, 12, 10);
                // Reflection line
                g.fillStyle(0xaacfff); g.fillRect(wx + 1, wy + 1, 3, 8);
                g.fillStyle(0x87b4e8);
            }
        }
        // Rooftop water tank
        g.fillStyle(0x4a5568); g.fillRect(28, -8, 24, 10);
        // Company logo panel (top)
        g.fillStyle(0x00d4aa); g.fillRect(20, 4, 40, 6);
        g.generateTexture('it_building', W, H); g.destroy();
    }

    /** Paddy field background strip — flat green paddy */
    _genPaddyField() {
        const W = 256, H = 48;
        const g = this.make.graphics({ add: false });
        // Sky reflection in water (flooded paddy = mirror flat)
        g.fillStyle(0xb8d4e8); g.fillRect(0, 0, W, 20);
        // Water surface shimmer lines
        g.fillStyle(0xa8c8de);
        for (let x = 0; x < W; x += 16) g.fillRect(x, 8, 8, 2);
        // Rice plant rows (bright green)
        g.fillStyle(0x4a8c2a); g.fillRect(0, 18, W, 18);
        g.fillStyle(0x5aaa33);
        for (let x = 4; x < W; x += 10) g.fillRect(x, 16, 3, 12);
        // Bund (raised earthen path)
        g.fillStyle(0x8a7040); g.fillRect(0, 34, W, 8);
        g.fillStyle(0x6a5830); g.fillRect(0, 40, W, 4);
        g.generateTexture('paddy_field', W, H); g.destroy();
    }

    /** Kerala backwater fishing boat */
    _genBoat() {
        const W = 56, H = 28;
        const g = this.make.graphics({ add: false });
        // Hull (wooden dugout canoe shape)
        g.fillStyle(0x6b4226);
        g.fillTriangle(0, 24, 4, 12, 52, 14);
        g.fillTriangle(52, 14, 56, 20, 0, 24);
        // Hull planks
        g.fillStyle(0x5a3820);
        for (let x = 4; x < 52; x += 8) g.fillRect(x, 14, 2, 10);
        // Sail mast
        g.fillStyle(0x8b6914); g.fillRect(26, 0, 3, 16);
        // Sail (white triangle)
        g.fillStyle(0xf0ede4, 0.9);
        g.fillTriangle(26, 2, 26, 14, 44, 10);
        // Water reflection below boat
        g.fillStyle(0x4a90d9, 0.4); g.fillRect(4, 24, 48, 4);
        g.generateTexture('boat', W, H); g.destroy();
    }

    /** Kerala compound wall with gate post */
    _genCompoundWall() {
        const W = 96, H = 36;
        const g = this.make.graphics({ add: false });
        // Wall body (cream/off-white plastered brick)
        g.fillStyle(0xe8dfc8); g.fillRect(0, 8, W, 28);
        // Brick joint lines
        g.fillStyle(0xd4c8a8);
        for (let y = 12; y < 36; y += 8) g.fillRect(0, y, W, 2);
        for (let x = 8; x < W; x += 16) g.fillRect(x, 8, 2, 28);
        // Coping (top ledge)
        g.fillStyle(0xc8bca0); g.fillRect(0, 6, W, 5);
        // Gate post (right side)
        g.fillStyle(0xb8a888); g.fillRect(W - 10, 0, 10, 36);
        // Gate (dark iron bars)
        g.fillStyle(0x2c3030); g.fillRect(W - 8, 4, 2, 32);
        g.fillRect(W - 4, 4, 2, 32);
        g.generateTexture('compound_wall', W, H); g.destroy();
    }

    /** KSRTC Kerala State bus (red + cream) */
    _genKsrtcBus() {
        const W = 96, H = 36;
        const g = this.make.graphics({ add: false });
        // Body (red)
        g.fillStyle(0xc0392b); g.fillRect(4, 4, 88, 28);
        // Cream stripe
        g.fillStyle(0xf5e6c8); g.fillRect(4, 12, 88, 10);
        // Front
        g.fillStyle(0x8b1a1a); g.fillRect(0, 4, 6, 28);
        // Windows
        g.fillStyle(0x87ceeb);
        for (let x = 10; x < 86; x += 14) g.fillRect(x, 6, 10, 8);
        // Windshield
        g.fillStyle(0x87ceeb); g.fillRect(4, 6, 10, 14);
        // KSRTC text band (yellow)
        g.fillStyle(0xf1c40f); g.fillRect(4, 22, 60, 4);
        // Wheels
        g.fillStyle(0x1a1a1a); g.fillCircle(20, 34, 5); g.fillCircle(76, 34, 5);
        g.fillStyle(0x888888); g.fillCircle(20, 34, 3); g.fillCircle(76, 34, 3);
        g.generateTexture('ksrtc_bus', W, H); g.destroy();
    }

    // ════════════════════════════════════════════════════════════
    // ROAD OVER BRIDGE (ROB) — Train passes UNDER
    // ════════════════════════════════════════════════════════════

    /**
     * ROB deck texture — concrete road bridge deck.
     * Rendered at LOW depth (depth 2) so train (depth 8) passes under.
     * Front pillar rendered separately at depth 14 (in front of train).
     */
    _genROB() {
        const W = 340, H = 120;
        const g = this.make.graphics({ add: false });

        // ── Left pillar ────────────────────────────────────────
        g.fillStyle(0x6b7a8a); g.fillRect(0, 30, 48, 90);
        g.fillStyle(0x8a9aaa); g.fillRect(0, 30, 8, 90);  // highlight
        g.fillStyle(0x3a4a5a); g.fillRect(40, 30, 8, 90); // shadow
        // Horizontal joint bands
        g.fillStyle(0x2c3a4a);
        for (let y = 50; y < 120; y += 20) g.fillRect(0, y, 48, 3);

        // ── Right pillar ───────────────────────────────────────
        g.fillStyle(0x6b7a8a); g.fillRect(292, 30, 48, 90);
        g.fillStyle(0x8a9aaa); g.fillRect(292, 30, 8, 90);
        g.fillStyle(0x3a4a5a); g.fillRect(332, 30, 8, 90);
        for (let y = 50; y < 120; y += 20) g.fillRect(292, y, 48, 3);

        // ── Bridge deck ────────────────────────────────────────
        g.fillStyle(0x7f8c8d); g.fillRect(0, 0, W, 38);
        // Road surface on top
        g.fillStyle(0x4a4a4a); g.fillRect(0, 0, W, 16);
        // Road lane markings
        g.fillStyle(0xf1c40f);
        for (let x = 20; x < W - 20; x += 30) g.fillRect(x, 6, 16, 4);
        // Crash barrier on edge
        g.fillStyle(0xd0d8e0); g.fillRect(0, 14, W, 8);
        // Underside of deck (visible when train is near)
        g.fillStyle(0x5d6d7e); g.fillRect(0, 22, W, 16);
        // Expansion joint lines on underside
        g.fillStyle(0x3a4a5a);
        for (let x = 60; x < W; x += 60) g.fillRect(x, 22, 3, 16);

        // ── Drop shadow ────────────────────────────────────────
        g.fillStyle(0x000000, 0.2); g.fillRect(8, 36, W - 16, 6);

        g.generateTexture('rob', W, H);
        g.destroy();
    }
    _genPerson() {
        [0xe67e22,0xc0392b,0x16a085,0x2980b9,0xf1c40f,0xecf0f1].forEach((c,i) => {
            const g = this.make.graphics({ add: false });
            g.fillStyle(0x111111); g.fillCircle(4,3,3);
            g.fillStyle(c); g.fillRect(1,6,6,8);
            g.fillStyle(0x222222); g.fillRect(1,14,2,4); g.fillRect(5,14,2,4);
            g.generateTexture(`person_${i}`, 8, 18); g.destroy();
        });
    }
    _genBridgeGirder() {
        const g = this.make.graphics({ add: false });
        g.fillStyle(0x2b2b2b); g.fillRect(0,0,128,32);
        g.lineStyle(2,0x444444); for (let i=0;i<8;i++) { g.lineBetween(i*16,0,i*16+16,32); g.lineBetween(i*16+16,0,i*16,32); }
        g.fillStyle(0x1a1a1a); g.fillRect(0,0,128,3); g.fillRect(0,29,128,3);
        g.generateTexture('bridgeGirder', 128, 32); g.destroy();
    }
    _genOppTrain() {
        const g = this.make.graphics({ add: false });
        g.fillStyle(0x444444); g.fillRect(0,4,128,24);
        g.fillStyle(0x333333); g.fillRect(0,0,20,28);
        g.fillStyle(0x1a3d5c); for (let i=0;i<10;i++) g.fillRect(24+i*10,8,6,8);
        g.generateTexture('oppTrain', 128, 32); g.destroy();
    }
    // ─── LARGE MOUNTAIN (mid-distance, with snow + rock faces) ───
    _genMountain() {
        const g = this.make.graphics({ add: false }), W = 320, H = 220;

        // Background peak (grey-purple haze, very distant)
        g.fillStyle(0x5a677a);
        g.fillTriangle(10, 220, 100, 30, 200, 220);
        g.fillStyle(0x4a576a);
        g.fillTriangle(100, 30, 100, 220, 200, 220);

        // Snow cap on far peak
        g.fillStyle(0xdce8f0);
        g.fillTriangle(100, 30, 80, 75, 120, 75);
        g.fillStyle(0xf5f9fc);
        g.fillTriangle(100, 30, 90, 55, 110, 55);

        // Mid mountain — dark green slopes
        g.fillStyle(0x1f4a30);
        g.fillTriangle(80, 220, 180, 48, 280, 220);
        g.fillStyle(0x163320);
        g.fillTriangle(180, 48, 180, 220, 280, 220);

        // Rock face band (grayish mid-section on mid mountain)
        g.fillStyle(0x5d6d7e, 0.7);
        g.fillTriangle(155, 80, 178, 50, 200, 80);
        // Snow on mid peak
        g.fillStyle(0xe8f4f8);
        g.fillTriangle(180, 48, 162, 88, 198, 88);
        g.fillStyle(0xffffff);
        g.fillTriangle(180, 48, 172, 70, 188, 70);

        // Foreground forested ridge (Kerala style – lush green)
        g.fillStyle(0x215c30);
        g.fillTriangle(60, 220, 160, 100, 260, 220);
        g.fillStyle(0x1a4825);
        g.fillTriangle(160, 100, 160, 220, 260, 220);
        // Treetop silhouette bumps on ridge
        g.fillStyle(0x0d3018);
        for (let bx = 65; bx < 255; bx += 18) {
            g.fillCircle(bx, 175 - Math.abs(Math.sin(bx * 0.15)) * 30, 12);
        }

        // Atmospheric mist at base
        g.fillStyle(0xb8d8e8, 0.18);
        g.fillRect(0, 145, 320, 35);
        g.fillStyle(0xcce8f2, 0.28);
        g.fillRect(0, 175, 320, 45);

        g.generateTexture('mountain', W, H); g.destroy();
    }

    // ─── FAR MOUNTAIN (very hazy, pale blue silhouette) ───
    _genMountainFar() {
        const g = this.make.graphics({ add: false }), W = 400, H = 140;
        // Mega ridge — barely visible, atmospheric perspective
        g.fillStyle(0x8ea8c0, 0.45);
        g.fillTriangle(0, 140, 80, 30, 160, 140);
        g.fillTriangle(120, 140, 200, 10, 280, 140);
        g.fillTriangle(240, 140, 310, 50, 400, 140);
        // Lighten tips (haze)
        g.fillStyle(0xbdd7e8, 0.3);
        g.fillTriangle(200, 10, 185, 45, 215, 45);
        g.fillStyle(0xd8eaf5, 0.6);
        g.fillRect(0, 100, 400, 40);
        g.generateTexture('mountainFar', W, H); g.destroy();
    }

    // ─── NEAR MOUNTAIN (foothills, lush green) ───
    _genMountainNear() {
        const g = this.make.graphics({ add: false }), W = 256, H = 120;
        g.fillStyle(0x1a5c2a);
        g.fillTriangle(0, 120, 90, 20, 180, 120);
        g.fillStyle(0x134020);
        g.fillTriangle(90, 20, 90, 120, 180, 120);
        // Foliage bumps
        g.fillStyle(0x0e3016);
        for (let bx = 5; bx < 175; bx += 16) {
            g.fillCircle(bx, 95 - Math.abs(Math.sin(bx * 0.18)) * 22, 11);
        }
        g.fillStyle(0x38a856, 0.25);
        g.fillRect(0, 85, 256, 35);
        g.generateTexture('mountainNear', W, H); g.destroy();
    }

    // ─── BIRD (simple V-silhouette, single frame) ───
    _genBird() {
        const g = this.make.graphics({ add: false }), W = 24, H = 12;
        g.fillStyle(0x222222);
        // Left wing
        g.fillTriangle(12, 6, 0, 0, 8, 8);
        // Right wing
        g.fillTriangle(12, 6, 24, 0, 16, 8);
        g.generateTexture('bird', W, H); g.destroy();
    }

    // ─── LAKE FOG / MIST BAND ───
    _genLakeFog() {
        const g = this.make.graphics({ add: false }), W = 256, H = 48;
        g.fillStyle(0xd0eaf8, 0.35);
        g.fillRect(0, 24, 256, 24);
        g.fillStyle(0xe8f4fb, 0.22);
        g.fillRect(0, 8, 256, 20);
        g.fillStyle(0xf2faff, 0.12);
        g.fillRect(0, 0, 256, 12);
        g.generateTexture('lakeFog', W, H); g.destroy();
    }

    // ─── ADDITIONAL CLOUD (smaller, far-distance) ───
    _genCloudFar() {
        const g = this.make.graphics({ add: false }), W = 80, H = 24;
        g.fillStyle(0xffffff, 0.45);
        g.fillCircle(20, 14, 8);
        g.fillCircle(38, 10, 12);
        g.fillCircle(58, 14, 9);
        g.generateTexture('cloudFar', W, H); g.destroy();
    }
    _genCityBuilding() {
        const g = this.make.graphics({ add: false });
        g.fillStyle(0x2c3e50);
        g.fillRect(0,80,40,100); g.fillRect(50,60,30,120); g.fillRect(90,40,50,140);
        g.fillRect(150,70,35,110); g.fillRect(195,50,45,130); g.fillRect(250,90,30,90);
        g.fillStyle(0xf39c12,0.7);
        for (let bx=0;bx<320;bx+=50) for (let by=60;by<170;by+=12) {
            if (Math.random()>0.4) g.fillRect(bx+5,by,4,4);
        }
        g.generateTexture('cityBuilding', 320, 180); g.destroy();
    }
    _genRainDrop() {
        const g = this.make.graphics({ add: false });
        g.fillStyle(0xaaddff,0.7); g.fillRect(0,0,2,8);
        g.generateTexture('raindrop', 2, 8); g.destroy();
    }
    _genAuto() {
        const g = this.make.graphics({ add: false }), W = 32, H = 20;
        g.fillStyle(0x27ae60); g.fillRect(2, 8, 28, 8);
        g.fillStyle(0xf1c40f); g.fillRect(6, 2, 22, 6);
        g.fillStyle(0xf1c40f); g.fillRect(2, 6, 4, 4);
        g.fillStyle(0xaed6f1); g.fillRect(4, 4, 6, 5);
        g.fillStyle(0x111111); g.fillRect(12, 5, 12, 6);
        g.fillStyle(0x111111); g.fillCircle(8, 17, 3); g.fillCircle(24, 17, 3);
        g.fillStyle(0x7f8c8d); g.fillCircle(8, 17, 1); g.fillCircle(24, 17, 1);
        g.generateTexture('vehicle_auto', W, H); g.destroy();
    }
    _genCar() {
        const g = this.make.graphics({ add: false }), W = 36, H = 16;
        g.fillStyle(0xc0392b); g.fillRect(2, 6, 32, 6);
        g.fillStyle(0xe74c3c); g.fillRect(8, 2, 18, 4);
        g.fillStyle(0xaed6f1); g.fillRect(10, 3, 6, 3); g.fillRect(18, 3, 6, 3);
        g.fillStyle(0xf1c40f); g.fillRect(33, 7, 2, 2);
        g.fillStyle(0xff3333); g.fillRect(1, 7, 2, 2);
        g.fillStyle(0x111111); g.fillCircle(8, 13, 3); g.fillCircle(28, 13, 3);
        g.fillStyle(0xbdc3c7); g.fillCircle(8, 13, 1); g.fillCircle(28, 13, 1);
        g.generateTexture('vehicle_car', W, H); g.destroy();
    }
    _genTruck() {
        const g = this.make.graphics({ add: false }), W = 48, H = 24;
        g.fillStyle(0x222222); g.fillRect(2, 16, 44, 4);
        g.fillStyle(0xe67e22); g.fillRect(30, 4, 16, 12);
        g.fillStyle(0xd35400); g.fillRect(30, 2, 14, 2);
        g.fillStyle(0xaed6f1); g.fillRect(36, 6, 8, 5);
        g.fillStyle(0x2980b9); g.fillRect(2, 6, 28, 10);
        g.fillStyle(0x1a5276); g.fillRect(2, 4, 28, 2);
        g.fillStyle(0xf1c40f); g.fillRect(30, 10, 16, 2);
        g.fillStyle(0xe74c3c); g.fillRect(10, 8, 12, 4);
        g.fillStyle(0x111111); g.fillCircle(10, 20, 4); g.fillCircle(20, 20, 4); g.fillCircle(38, 20, 4);
        g.fillStyle(0x7f8c8d); g.fillCircle(10, 20, 1); g.fillCircle(20, 20, 1); g.fillCircle(38, 20, 1);
        g.generateTexture('vehicle_truck', W, H); g.destroy();
    }
    _genLCGateParts() {
        // 1. Post with light
        let g = this.make.graphics({ add: false });
        g.fillStyle(0x444444); g.fillRect(4, 16, 8, 80); // Post
        g.fillStyle(0x222222); g.fillRect(0, 0, 16, 16); // Light box
        g.fillStyle(0xff0000); g.fillCircle(8, 8, 5); // Warning light red
        g.generateTexture('lc_post', 16, 96); g.destroy();

        // 2. Gate Arm (pivot at left)
        g = this.make.graphics({ add: false });
        g.fillStyle(0xf1c40f); g.fillRect(0, 0, 64, 8); // Yellow bar
        g.fillStyle(0x111111); for (let i = 0; i < 8; i++) g.fillRect(i * 8, 0, 4, 8); // Black stripes
        g.generateTexture('lc_arm', 64, 8); g.destroy();

        // 3. Road background
        g = this.make.graphics({ add: false });
        g.fillStyle(0x333333); g.fillRect(0, 0, 128, 26);
        // Hatched zebra markings
        g.fillStyle(0x555555);
        for (let x = 32; x < 96; x += 12) {
            g.fillRect(x, 0, 4, 26);
        }
        // White stop lines on both sides of gates
        g.fillStyle(0xffffff);
        g.fillRect(20, 0, 4, 26);
        g.fillRect(108, 0, 4, 26);
        // Center line
        g.fillStyle(0xf1c40f); g.fillRect(58, 0, 12, 26); // Center line
        g.generateTexture('lc_road', 128, 26); g.destroy();
    }

    _genKMStone() {
        const W = 16, H = 28;
        const g = this.make.graphics({ add: false });
        // Body (white)
        g.fillStyle(0xffffff); g.fillRect(2, 4, 12, 24);
        // Top half (yellow)
        g.fillStyle(0xf1c40f); g.fillRect(2, 4, 12, 10);
        // Rounded top
        g.fillTriangle(2, 4, 8, 0, 14, 4);
        g.generateTexture('km_stone', W, H); g.destroy();
    }
    _genSwitch(key, direction) {
        const g = this.make.graphics({ add: false }), W = 64, H = 32;
        // Main horizontal track sleepers
        g.fillStyle(0x6b4f3b);
        g.fillRect(0, 14, 20, 8); g.fillRect(32, 14, 20, 8);
        g.fillStyle(0xaaaaaa); g.fillRect(0, 12, 64, 2); // top rail
        g.fillStyle(0x444444); g.fillRect(0, 18, 64, 2); // bottom rail
        g.fillStyle(0x333333); g.fillRect(0, 20, 64, 4); // ballast/shadow

        // Diverging rails
        g.fillStyle(0x6b4f3b);
        g.fillRect(16, 22, 16, 6);
        
        g.lineStyle(2, 0xaaaaaa, 1.0);
        if (direction === 'left') { // branches upward Y axis
            const curve1 = new Phaser.Curves.QuadraticBezier(
                new Phaser.Math.Vector2(0, 12),
                new Phaser.Math.Vector2(32, 12),
                new Phaser.Math.Vector2(64, 2)
            );
            curve1.draw(g);
            
            g.lineStyle(2, 0x444444, 1.0);
            const curve2 = new Phaser.Curves.QuadraticBezier(
                new Phaser.Math.Vector2(0, 18),
                new Phaser.Math.Vector2(32, 18),
                new Phaser.Math.Vector2(64, 8)
            );
            curve2.draw(g);
        } else { // branches downward Y axis
            const curve1 = new Phaser.Curves.QuadraticBezier(
                new Phaser.Math.Vector2(0, 12),
                new Phaser.Math.Vector2(32, 12),
                new Phaser.Math.Vector2(64, 22)
            );
            curve1.draw(g);
            
            g.lineStyle(2, 0x444444, 1.0);
            const curve2 = new Phaser.Curves.QuadraticBezier(
                new Phaser.Math.Vector2(0, 18),
                new Phaser.Math.Vector2(32, 18),
                new Phaser.Math.Vector2(64, 28)
            );
            curve2.draw(g);
        }

        // Switch stand lever indicator
        g.fillStyle(0x222222); g.fillRect(28, 2, 4, 10);
        g.fillStyle(0xff3333); g.fillCircle(30, 2, 4);
        
        g.generateTexture(key, W, H); g.destroy();
    }
    _genKollamFacade() {
        const g = this.make.graphics({ add: false }), W = 256, H = 96;
        g.fillStyle(0xa93226); // Brick red
        g.fillRect(10, 20, 236, 76);
        g.fillStyle(0xf2f4f4); // Off-white roof trim
        g.fillRect(10, 16, 236, 4);
        g.fillStyle(0x78281f); // Darker red central tower
        g.fillRect(108, 0, 40, 20);
        g.fillStyle(0xf2f4f4);
        g.fillRect(108, 0, 40, 3);
        g.fillStyle(0x1a252f);
        g.fillRect(116, 4, 8, 12);
        g.fillRect(132, 4, 8, 12);
        g.fillStyle(0x78281f);
        for (let x = 20; x < 240; x += 32) {
            if (x === 116) continue;
            g.fillStyle(0x1a252f);
            g.fillRect(x, 36, 16, 24);
            g.fillStyle(0xf2f4f4);
            g.fillRect(x - 2, 32, 20, 4);
            g.fillRect(x - 2, 36, 2, 24);
            g.fillRect(x + 16, 36, 2, 24);
        }
        g.fillStyle(0x11161b);
        g.fillRect(36, 68, 24, 28);
        g.fillRect(116, 68, 24, 28);
        g.fillRect(196, 68, 24, 28);
        g.fillStyle(0xf2f4f4);
        g.fillTriangle(34, 68, 48, 54, 62, 68);
        g.fillTriangle(114, 68, 128, 54, 142, 68);
        g.fillTriangle(194, 68, 208, 54, 222, 68);
        g.fillStyle(0xf1c40f); // signboard
        g.fillRect(98, 24, 60, 10);
        g.fillStyle(0x000000);
        g.fillRect(102, 26, 52, 2);
        g.fillRect(108, 30, 40, 2);
        g.generateTexture('facade_kollam', W, H); g.destroy();
    }
    _genTVCFacade() {
        const g = this.make.graphics({ add: false }), W = 256, H = 96;
        g.fillStyle(0xe28743); // Salmon
        g.fillRect(10, 30, 236, 66);
        g.fillStyle(0xb97738); // Darker side towers
        g.fillRect(20, 10, 30, 86);
        g.fillRect(206, 10, 30, 86);
        g.fillRect(108, 4, 40, 92);
        g.fillStyle(0xf4f6f7); // White domes
        g.fillEllipse(128, 6, 36, 12);
        g.fillEllipse(35, 12, 26, 10);
        g.fillEllipse(221, 12, 26, 10);
        g.fillStyle(0x1a252f);
        for (let x = 60; x < 200; x += 32) {
            g.fillRect(x, 60, 20, 36);
            g.fillStyle(0xf4f6f7);
            g.fillEllipse(x + 10, 60, 20, 12);
            g.fillStyle(0x1a252f);
        }
        g.fillRect(26, 68, 18, 28);
        g.fillRect(212, 68, 18, 28);
        g.fillRect(122, 24, 12, 16);
        g.fillRect(122, 44, 12, 12);
        g.fillRect(30, 30, 10, 12);
        g.fillRect(216, 30, 10, 12);
        g.fillStyle(0xf1c40f); // signboard
        g.fillRect(98, 46, 60, 10);
        g.fillStyle(0x000000);
        g.fillRect(102, 48, 52, 2);
        g.fillRect(108, 52, 40, 2);
        g.generateTexture('facade_tvc', W, H); g.destroy();
    }
    _genBridgePillar() {
        const g = this.make.graphics({ add: false }), W = 48, H = 120;
        
        // Main concrete column body (grayish-blue)
        g.fillStyle(0x7f8c8d);
        g.fillRect(8, 0, 32, 120);
        
        // Highlight side (left edge)
        g.fillStyle(0xbdc3c7);
        g.fillRect(8, 0, 4, 120);
        
        // Shadow side (right edge)
        g.fillStyle(0x5d6d7e);
        g.fillRect(36, 0, 4, 120);
        
        // Horizontal concrete block seams/joints
        g.fillStyle(0x34495e);
        for (let y = 20; y < 120; y += 24) {
            g.fillRect(8, y, 32, 3);
        }
        
        // Stone pier base (wider foundation block at the bottom)
        g.fillStyle(0x4b5866);
        g.fillRect(0, 96, 48, 24);
        g.fillStyle(0x34495e);
        g.fillRect(0, 116, 48, 4); // shadow base
        
        g.generateTexture('bridgePillar', W, H); g.destroy();
    }

    // ═══════════════════════════════════════════════════════
    // STATION LIFE — PASSENGER TYPES (2D pixel art)
    // ═══════════════════════════════════════════════════════

    /** Sitting passenger — on bench, slightly hunched */
    _genPersonSitting() {
        [0xe67e22, 0xc0392b, 0x16a085, 0x2980b9, 0x8e44ad, 0xf1c40f].forEach((c, i) => {
            const g = this.make.graphics({ add: false }), W = 12, H = 16;
            // Head
            g.fillStyle(0xc68642); g.fillCircle(6, 3, 3);
            // Body (seated, shorter torso)
            g.fillStyle(c); g.fillRect(2, 6, 8, 6);
            // Legs (bent forward)
            g.fillStyle(0x2c2c2c); g.fillRect(2, 12, 4, 3); g.fillRect(6, 12, 4, 3);
            // Feet flat
            g.fillStyle(0x1a1a1a); g.fillRect(1, 14, 5, 2); g.fillRect(6, 14, 5, 2);
            g.generateTexture(`person_sit_${i}`, W, H); g.destroy();
        });
    }

    /** Walking passenger — mid-stride with offset legs */
    _genPersonWalking() {
        [0xe74c3c, 0x27ae60, 0x3498db, 0x9b59b6, 0xe67e22, 0xecf0f1].forEach((c, i) => {
            const g = this.make.graphics({ add: false }), W = 10, H = 20;
            // Head
            g.fillStyle(0xc68642); g.fillCircle(5, 3, 3);
            // Hair
            g.fillStyle(0x2c1a0e); g.fillRect(2, 0, 6, 3);
            // Body
            g.fillStyle(c); g.fillRect(1, 6, 8, 7);
            // Left leg forward
            g.fillStyle(0x2c2c5a); g.fillRect(1, 13, 3, 5);
            // Right leg back
            g.fillStyle(0x1a1a3a); g.fillRect(5, 13, 3, 4);
            // Shoes
            g.fillStyle(0x111111); g.fillRect(0, 17, 4, 2); g.fillRect(5, 16, 4, 2);
            g.generateTexture(`person_walk_${i}`, W, H); g.destroy();
        });
    }

    /** Boarding passenger — arms raised, at train door */
    _genPersonBoarding() {
        [0xc0392b, 0x2471a3, 0x27ae60, 0x8e44ad].forEach((c, i) => {
            const g = this.make.graphics({ add: false }), W = 14, H = 22;
            // Head
            g.fillStyle(0xc68642); g.fillCircle(7, 3, 3);
            // Arms raised (holding luggage/door)
            g.fillStyle(c);
            g.fillRect(0, 6, 3, 6);  // left arm up
            g.fillRect(11, 6, 3, 6); // right arm up
            g.fillRect(3, 6, 8, 8);  // body
            // Luggage bag
            g.fillStyle(0x7f5c3a); g.fillRect(9, 10, 5, 7);
            g.fillStyle(0x5a3f28); g.fillRect(9, 8, 5, 3);
            // Legs
            g.fillStyle(0x2c2c5a); g.fillRect(3, 14, 3, 6); g.fillRect(8, 14, 3, 6);
            g.generateTexture(`person_board_${i}`, W, H); g.destroy();
        });
    }

    /** Railway porter — red uniform, carrying luggage on head */
    _genPorter() {
        const g = this.make.graphics({ add: false }), W = 14, H = 26;
        // Head
        g.fillStyle(0xc68642); g.fillCircle(7, 5, 3);
        // Luggage on head
        g.fillStyle(0x8b6914); g.fillRect(3, 0, 8, 5);
        g.fillStyle(0x6a4f10); g.fillRect(4, -1, 6, 2);
        // Red uniform shirt
        g.fillStyle(0xc0392b); g.fillRect(2, 8, 10, 8);
        // White collar
        g.fillStyle(0xecf0f1); g.fillRect(5, 8, 4, 3);
        // Khaki pants
        g.fillStyle(0xa08030); g.fillRect(3, 16, 3, 8); g.fillRect(8, 16, 3, 8);
        // Shoes
        g.fillStyle(0x111111); g.fillRect(2, 23, 5, 3); g.fillRect(7, 23, 5, 3);
        g.generateTexture('porter', W, H); g.destroy();
    }

    /** Railway staff — white uniform with blue cap */
    _genRailwayStaff() {
        const g = this.make.graphics({ add: false }), W = 12, H = 24;
        // Cap (blue IR cap)
        g.fillStyle(0x1a4a8a); g.fillRect(1, 1, 10, 4);
        g.fillStyle(0x0d2a5c); g.fillRect(0, 4, 12, 2);
        // Head
        g.fillStyle(0xc08050); g.fillRect(2, 4, 8, 6);
        // White uniform
        g.fillStyle(0xf0f0f0); g.fillRect(1, 10, 10, 8);
        // Shoulder board (gold stripe)
        g.fillStyle(0xf1c40f); g.fillRect(1, 10, 10, 2);
        // Black pants
        g.fillStyle(0x1a1a1a); g.fillRect(2, 18, 3, 6); g.fillRect(7, 18, 3, 6);
        // Shoes
        g.fillStyle(0x050505); g.fillRect(1, 23, 4, 2); g.fillRect(7, 23, 4, 2);
        g.generateTexture('railway_staff', W, H); g.destroy();
    }

    /** Vendor — carrying basket on arm, colourful shirt */
    _genVendor() {
        const g = this.make.graphics({ add: false }), W = 14, H = 22;
        // Head + hair
        g.fillStyle(0xb87040); g.fillCircle(7, 4, 3);
        g.fillStyle(0x1a0a00); g.fillRect(4, 1, 6, 3);
        // Colourful lungi/dhoti
        g.fillStyle(0xd4450a); g.fillRect(3, 14, 8, 8);
        // White shirt
        g.fillStyle(0xf0ede8); g.fillRect(2, 7, 10, 8);
        // Basket (arm extended)
        g.fillStyle(0xa0722a); g.fillRect(11, 9, 5, 5);
        g.fillStyle(0x8a5e20); g.fillRect(12, 8, 3, 2);
        // Basket contents (yellow = bananas/snacks)
        g.fillStyle(0xf1c40f); g.fillRect(12, 9, 3, 2);
        // Legs
        g.fillStyle(0xc03010); g.fillRect(3, 18, 3, 4); g.fillRect(8, 18, 3, 4);
        g.generateTexture('vendor', W, H); g.destroy();
    }

    // ═══════════════════════════════════════════════════════
    // ROAD TRAFFIC (2D pixel art, side view)
    // ═══════════════════════════════════════════════════════

    /** Bike / motorcycle — side view */
    _genBike() {
        const g = this.make.graphics({ add: false }), W = 36, H = 22;
        // Wheels
        g.fillStyle(0x111111); g.fillCircle(7, 17, 5); g.fillCircle(28, 17, 5);
        g.fillStyle(0x666666); g.fillCircle(7, 17, 3); g.fillCircle(28, 17, 3);
        // Frame
        g.fillStyle(0xc0392b); g.fillRect(7, 10, 22, 3);
        g.fillStyle(0xa0301e); g.fillRect(5, 10, 4, 8); g.fillRect(24, 8, 6, 6);
        // Engine block
        g.fillStyle(0x7f8c8d); g.fillRect(13, 10, 8, 6);
        // Handlebar
        g.fillStyle(0x555555); g.fillRect(26, 5, 4, 6);
        // Rider
        g.fillStyle(0xc68642); g.fillCircle(24, 5, 3); // head
        g.fillStyle(0x2c3e50); g.fillRect(21, 7, 6, 5); // body
        // Headlight
        g.fillStyle(0xffff88); g.fillCircle(32, 14, 2);
        g.generateTexture('bike', W, H); g.destroy();
    }

    /** Auto-rickshaw — yellow Kerala style */
    _genAuto2() {
        const g = this.make.graphics({ add: false }), W = 48, H = 28;
        // Body (yellow)
        g.fillStyle(0xf1c40f); g.fillRect(8, 4, 34, 20);
        // Black roof
        g.fillStyle(0x1a1a1a); g.fillRect(8, 2, 34, 4);
        // Green stripe (Kerala autos have green/yellow)
        g.fillStyle(0x27ae60); g.fillRect(8, 14, 34, 4);
        // Front cabin
        g.fillStyle(0xe6b800); g.fillRect(4, 6, 6, 16);
        // Windshield
        g.fillStyle(0x87ceeb, 0.7); g.fillRect(5, 7, 5, 8);
        // Passenger area open side
        g.fillStyle(0xd4a800); g.fillRect(38, 6, 4, 16);
        // Wheels
        g.fillStyle(0x111111); g.fillCircle(14, 25, 5); g.fillCircle(36, 25, 5);
        g.fillStyle(0x666666); g.fillCircle(14, 25, 3); g.fillCircle(36, 25, 3);
        // Headlight
        g.fillStyle(0xffff88); g.fillCircle(4, 12, 2);
        g.generateTexture('auto2', W, H); g.destroy();
    }

    /** Car — Kerala road car, side view */
    _genCar2() {
        const colors = [0x2980b9, 0x27ae60, 0xc0392b, 0x7f8c8d, 0x2c3e50, 0xe67e22];
        colors.forEach((col, i) => {
            const g = this.make.graphics({ add: false }), W = 56, H = 28;
            // Body lower
            g.fillStyle(col); g.fillRect(4, 14, 48, 12);
            // Body upper (cabin)
            g.fillStyle(col); g.fillRect(12, 6, 32, 10);
            // Roof (slightly lighter)
            g.fillStyle(Phaser.Display.Color.ValueToColor(col).lighten(20).color);
            g.fillRect(14, 4, 28, 4);
            // Windows
            g.fillStyle(0x87ceeb, 0.8);
            g.fillRect(14, 7, 10, 8); // front window
            g.fillRect(28, 7, 10, 8); // rear window
            // Door line
            g.fillStyle(0x000000, 0.3); g.fillRect(26, 14, 2, 12);
            // Wheels
            g.fillStyle(0x111111); g.fillCircle(14, 25, 6); g.fillCircle(42, 25, 6);
            g.fillStyle(0x888888); g.fillCircle(14, 25, 4); g.fillCircle(42, 25, 4);
            g.fillStyle(0xcccccc); g.fillCircle(14, 25, 2); g.fillCircle(42, 25, 2);
            // Headlight
            g.fillStyle(0xffffaa); g.fillRect(2, 16, 4, 5);
            // Tail light
            g.fillStyle(0xff3300); g.fillRect(50, 16, 4, 5);
            g.generateTexture(`car2_${i}`, W, H); g.destroy();
        });
    }

    // ═══════════════════════════════════════════════════════
    // SIGNAL INFRASTRUCTURE BOARDS
    // ═══════════════════════════════════════════════════════

    /** G Board — Gate signal near level crossings */
    _genGBoard() {
        const g = this.make.graphics({ add: false }), W = 24, H = 60;
        // Post
        g.fillStyle(0x444444); g.fillRect(10, 20, 4, 40);
        // Circular board (black circle, white G)
        g.fillStyle(0x111111); g.fillCircle(12, 12, 11);
        g.fillStyle(0xffffff); g.fillCircle(12, 12, 9);
        g.fillStyle(0x111111); g.fillCircle(12, 12, 7);
        // White G letter (simplified blocks)
        g.fillStyle(0xffffff);
        g.fillRect(8, 8, 8, 2);  // top
        g.fillRect(6, 8, 2, 8);  // left
        g.fillRect(8, 14, 8, 2); // mid
        g.fillRect(14, 12, 2, 4); // right bottom
        g.fillRect(8, 16, 8, 2); // bottom
        g.generateTexture('gBoard', W, H); g.destroy();
    }

    /** Speed Restriction Board — black border, white number */
    _genSpeedBoard(speed) {
        const g = this.make.graphics({ add: false }), W = 32, H = 70;
        // Post
        g.fillStyle(0x444444); g.fillRect(14, 30, 4, 40);
        // Board (white square with black border)
        g.fillStyle(0x000000); g.fillRect(2, 0, 28, 32);
        g.fillStyle(0xffffff); g.fillRect(4, 2, 24, 28);
        // Speed number (drawn as pixel blocks)
        g.fillStyle(0x000000);
        if (speed === 50) {
            // "5" shape
            g.fillRect(8, 6, 12, 3); g.fillRect(8, 6, 3, 7); g.fillRect(8, 13, 12, 3);
            g.fillRect(17, 13, 3, 7); g.fillRect(8, 20, 12, 3);
            // "0" shape
            g.fillRect(8, 6, 12, 3); // reusing for visual balance
        } else {
            // "3" shape
            g.fillRect(8, 6, 12, 3); g.fillRect(17, 6, 3, 7); g.fillRect(8, 13, 12, 3);
            g.fillRect(17, 13, 3, 7); g.fillRect(8, 20, 12, 3);
        }
        // Big number text overlay (fillStyle text approx)
        g.fillStyle(0x000000);
        g.fillRect(7, 7, 18, 16); // dark block
        g.fillStyle(0xffffff);
        // Digit using small rects
        const d = speed.toString();
        g.fillRect(9, 9, 14, 2);
        g.fillRect(9, 11, 2, 10); g.fillRect(21, 11, 2, 10);
        g.fillRect(9, 21, 14, 2);
        g.generateTexture(`speedBoard_${speed}`, W, H); g.destroy();
    }

    /** Neutral Section Board — black/white diagonal stripes */
    _genNeutralBoard() {
        const g = this.make.graphics({ add: false }), W = 28, H = 60;
        // Post
        g.fillStyle(0x444444); g.fillRect(12, 28, 4, 32);
        // Board (diamond shape neutral section marker)
        g.fillStyle(0x000000); g.fillRect(4, 4, 20, 24);
        // Diagonal stripes (alternating black/white)
        for (let i = 0; i < 5; i++) {
            g.fillStyle(i % 2 === 0 ? 0xffffff : 0x000000);
            g.fillRect(4 + i * 4, 4, 4, 24);
        }
        // Border
        g.lineStyle(2, 0x000000, 1);
        g.strokeRect(4, 4, 20, 24);
        // N label (Neutral)
        g.fillStyle(0xff0000); g.fillRect(10, 0, 8, 6);
        g.fillStyle(0xffffff); g.fillRect(11, 1, 2, 4); g.fillRect(15, 1, 2, 4);
        g.fillRect(11, 1, 6, 2);
        g.generateTexture('neutralBoard', W, H); g.destroy();
    }

    // ═══════════════════════════════════════════════════════
    // WATER SYSTEM
    // ═══════════════════════════════════════════════════════

    /** Water ripple / shimmer tile for lake/river animation */
    _genWaterRipple() {
        const g = this.make.graphics({ add: false }), W = 64, H = 16;
        // Base water colour
        g.fillStyle(0x2d7dd2); g.fillRect(0, 0, W, H);
        // Ripple highlight lines (curved shimmer)
        g.fillStyle(0x5ba3e8, 0.6);
        g.fillRect(4, 3, 12, 2); g.fillRect(24, 5, 8, 2);
        g.fillRect(40, 3, 14, 2); g.fillRect(54, 6, 8, 2);
        // Dark trough between ripples
        g.fillStyle(0x1a5da0, 0.5);
        g.fillRect(0, 7, W, 2);
        g.fillStyle(0xadd8ff, 0.4);
        g.fillRect(18, 1, 6, 3); g.fillRect(44, 9, 4, 2);
        g.generateTexture('waterRipple', W, H); g.destroy();
    }

    // ═══════════════════════════════════════════════════════════════
    // PHASE 2 — KERALA REALISM TEXTURES
    // ═══════════════════════════════════════════════════════════════

    /** Banana / plantain plant — wide leaves, green trunk */
    _genBananaPlant() {
        const g = this.make.graphics({ add: false }), W = 60, H = 80;
        // Trunk (greenish-white)
        g.fillStyle(0x7a9a30); g.fillRect(25, 40, 10, 40);
        g.fillStyle(0x5a7a20); g.fillRect(28, 42, 4, 38);
        // Large leaves — left
        g.fillStyle(0x2d8020);
        g.fillRect(0, 20, 30, 8);   // broad left leaf
        g.fillRect(0, 18, 25, 6);
        // Large leaves — right
        g.fillRect(30, 22, 30, 8);  // broad right leaf
        g.fillRect(35, 20, 25, 6);
        // Leaf veins (lighter)
        g.fillStyle(0x50a040);
        g.fillRect(5, 22, 20, 2); g.fillRect(35, 24, 20, 2);
        // Banana bunch (yellow cluster)
        g.fillStyle(0xf1c40f); g.fillRect(20, 35, 20, 8);
        g.fillStyle(0xe6b800); g.fillRect(22, 37, 16, 4);
        g.generateTexture('banana_plant', W, H); g.destroy();
    }

    /** Wetland vegetation — reeds and sedge grass at water edge */
    _genWetlandVeg() {
        const g = this.make.graphics({ add: false }), W = 128, H = 40;
        // Water base
        g.fillStyle(0x3a8abf, 0.4); g.fillRect(0, 24, W, 16);
        // Reed stalks (thin vertical lines)
        const stalkX = [8, 16, 28, 36, 50, 62, 75, 88, 100, 112, 120];
        stalkX.forEach(x => {
            g.fillStyle(0x6a8a30); g.fillRect(x, 8, 2, 32);
            // Reed head (brown oval top)
            g.fillStyle(0x7a5020); g.fillRect(x - 1, 6, 4, 8);
        });
        // Sedge grass clumps
        g.fillStyle(0x4a7020);
        g.fillRect(20, 16, 10, 20); g.fillRect(44, 18, 8, 18);
        g.fillRect(70, 14, 12, 22); g.fillRect(104, 17, 10, 19);
        // Water ripple hint
        g.fillStyle(0x5aabdf, 0.5);
        g.fillRect(0, 28, W, 2);
        g.generateTexture('wetland', W, H); g.destroy();
    }

    /** Dense coconut palm cluster — 3 palms together */
    _genCoconutCluster() {
        const g = this.make.graphics({ add: false }), W = 80, H = 90;
        // Three trunks
        [[12, 30], [36, 10], [60, 25]].forEach(([x, topY]) => {
            // Trunk — slight curve simulation with rect sequence
            g.fillStyle(0x8a6030); g.fillRect(x, topY + 40, 6, 50);
            g.fillStyle(0x704e20); g.fillRect(x + 1, topY + 38, 4, 52);
            // Ring marks on trunk
            for (let y = topY + 45; y < topY + 90; y += 8) {
                g.fillStyle(0x5a3e18); g.fillRect(x, y, 6, 2);
            }
            // Frond fan (3 fronds per palm)
            g.fillStyle(0x1a7a20);
            g.fillRect(x - 18, topY + 10, 20, 5);  // left frond
            g.fillRect(x + 4,  topY + 10, 20, 5);  // right frond
            g.fillRect(x - 6,  topY,      10, 16); // upward frond
            // Coconuts (brown dots)
            g.fillStyle(0x6a4010);
            g.fillCircle(x + 3, topY + 28, 4);
            g.fillCircle(x + 8, topY + 30, 3);
        });
        g.generateTexture('coconut_cluster', W, H); g.destroy();
    }

    /** Kerala village road — narrow tarmac with red laterite sides */
    _genLocalRoad() {
        const g = this.make.graphics({ add: false }), W = 200, H = 20;
        // Laterite/earth shoulders
        g.fillStyle(0xb05030); g.fillRect(0, 0, W, H);
        // Tarmac road surface
        g.fillStyle(0x404040); g.fillRect(0, 4, W, 12);
        // Centre line (dashed white)
        g.fillStyle(0xffffff);
        for (let x = 0; x < W; x += 20) { g.fillRect(x, 9, 12, 2); }
        // Road edge markings
        g.fillStyle(0xcccccc);
        g.fillRect(0, 4, W, 1); g.fillRect(0, 15, W, 1);
        g.generateTexture('local_road', W, H); g.destroy();
    }

    /** Rubber tree plantation — tall straight trunks with herringbone tap marks */
    _genRubberTree() {
        const g = this.make.graphics({ add: false }), W = 80, H = 100;
        // Three rubber trees in a row
        [14, 38, 62].forEach(x => {
            // Tall grey-white trunk
            g.fillStyle(0xd4c8a0); g.fillRect(x, 10, 8, 90);
            g.fillStyle(0xb8a880); g.fillRect(x + 2, 12, 4, 88);
            // Tapping groove (herringbone diagonal marks — iconic rubber tree feature)
            g.fillStyle(0x8a7050);
            for (let y = 20; y < 70; y += 8) {
                g.fillRect(x, y, 4, 2);     // left diagonal
                g.fillRect(x + 4, y + 2, 4, 2); // right diagonal
            }
            // Latex cup at base
            g.fillStyle(0xffffff); g.fillCircle(x + 4, 75, 3);
            g.fillStyle(0xf0e080); g.fillCircle(x + 4, 75, 2);
            // Canopy (small, typical rubber)
            g.fillStyle(0x2a6020); g.fillRect(x - 10, 4, 28, 12);
            g.fillStyle(0x1e5018); g.fillRect(x - 8, 0, 24, 8);
        });
        g.generateTexture('rubber_tree', W, H); g.destroy();
    }

    // ═══════════════════════════════════════════════════════════════
    // PHASE 3 — ROUTE-SPECIFIC LANDMARKS
    // ═══════════════════════════════════════════════════════════════

    /**
     * Varkala Cliff — iconic red laterite cliff face.
     * Visible near Varkala station. The cliff sits to the west (sea side).
     * Layered sedimentary horizontal bands of red/brown/cream laterite.
     */
    _genVarkalaCliff() {
        const g = this.make.graphics({ add: false }), W = 256, H = 160;
        // Sky behind cliff
        g.fillStyle(0x87ceeb); g.fillRect(0, 0, W, H);
        // Cliff mass — layered laterite bands (bottom to top)
        const layers = [
            { y: 60, h: 30, c: 0x8b3a1a }, // deep red base
            { y: 46, h: 16, c: 0xa04828 }, // mid red
            { y: 34, h: 14, c: 0xb86040 }, // rusty orange
            { y: 22, h: 14, c: 0xc87850 }, // lighter orange
            { y: 10, h: 14, c: 0xd49060 }, // cream top
            { y: 0,  h: 12, c: 0x5a8030 }, // green vegetation cap
        ];
        layers.forEach(l => {
            g.fillStyle(l.c); g.fillRect(0, l.y, W, l.h);
        });
        // Erosion detail — irregular edges on layers
        g.fillStyle(0x8b3a1a);
        [20, 55, 90, 130, 165, 200].forEach(x => {
            g.fillRect(x, 44, 12, 6); // jutting rock
        });
        // Vegetation on cliff top (dark green trees)
        g.fillStyle(0x2a6020);
        [10, 40, 80, 120, 160, 200, 240].forEach(x => {
            g.fillCircle(x, 5, 10 + Math.random() * 6);
        });
        // Beach/wave at base
        g.fillStyle(0x3a8abf, 0.6); g.fillRect(0, 88, W, 20);
        g.fillStyle(0xffffff, 0.5); g.fillRect(0, 86, W, 4);
        // Cliff shadow (dark right side)
        g.fillStyle(0x000000, 0.15);
        g.fillRect(W - 30, 0, 30, 100);
        g.generateTexture('varkala_cliff', W, H); g.destroy();
    }

    /**
     * Padmanabhaswamy Temple Gopuram silhouette.
     * Visible on TVC approach. Classic Dravidian tower with multiple tiers.
     * Dark silhouette against sky — dawn/dusk effect.
     */
    _genGopuram() {
        const g = this.make.graphics({ add: false }), W = 64, H = 180;
        const cx = 32;
        // Base platform
        g.fillStyle(0x2a1a0a); g.fillRect(4, 158, W - 8, 22);
        // Gopuram tiers (each level narrows and has curved top)
        const tiers = [
            { w: 48, h: 20, y: 140 },
            { w: 40, h: 18, y: 124 },
            { w: 34, h: 16, y: 110 },
            { w: 28, h: 14, y: 98 },
            { w: 22, h: 12, y: 88 },
            { w: 16, h: 10, y: 80 },
            { w: 12, h: 8,  y: 74 },
            { w: 8,  h: 6,  y: 70 },
        ];
        tiers.forEach(t => {
            g.fillStyle(0x3a2010);
            g.fillRect(cx - t.w / 2, t.y, t.w, t.h);
            // Decorative ridge on each tier
            g.fillStyle(0x5a3820);
            g.fillRect(cx - t.w / 2, t.y, t.w, 2);
            // Small decorative elements (mini kalasam shapes)
            if (t.w > 16) {
                for (let dx = -t.w / 2 + 4; dx < t.w / 2; dx += 8) {
                    g.fillStyle(0x4a2818); g.fillRect(cx + dx, t.y - 3, 3, 5);
                }
            }
        });
        // Kalasam (finial at top)
        g.fillStyle(0x7a5030); g.fillCircle(cx, 66, 5);
        g.fillStyle(0xf0c040); g.fillCircle(cx, 64, 3);
        // Entrance arch (gateway at base)
        g.fillStyle(0x1a0a00);
        g.fillRect(cx - 10, 140, 20, 18); // gateway opening
        g.generateTexture('gopuram', W, H); g.destroy();
    }

    /** Kazhakkuttam IT Corridor building — glass curtain wall with corporate look */
    _genItCorridor() {
        const g = this.make.graphics({ add: false }), W = 160, H = 130;
        // Main glass tower
        g.fillStyle(0x1a3a5a); g.fillRect(20, 10, 80, 110);
        // Glass curtain wall reflection grid
        g.fillStyle(0x2a5a8a);
        for (let y = 14; y < 118; y += 12) {
            g.fillRect(20, y, 80, 8);
        }
        // Vertical column dividers
        g.fillStyle(0x0a2a4a);
        for (let x = 20; x < 100; x += 16) {
            g.fillRect(x, 10, 2, 110);
        }
        // Blue reflections (sky in glass)
        g.fillStyle(0x5090c0, 0.3);
        g.fillRect(24, 14, 30, 60);
        // Company sign board top
        g.fillStyle(0x2c3e50); g.fillRect(20, 10, 80, 12);
        g.fillStyle(0x00ccff); g.fillRect(24, 14, 70, 4);
        // Second smaller building behind
        g.fillStyle(0x2a4a6a); g.fillRect(110, 40, 45, 80);
        g.fillStyle(0x3a6a9a);
        for (let y = 44; y < 118; y += 10) { g.fillRect(110, y, 45, 6); }
        // Ground floor
        g.fillStyle(0x4a4a4a); g.fillRect(10, 118, 150, 12);
        // Road in front
        g.fillStyle(0x303030); g.fillRect(0, 126, W, 4);
        g.generateTexture('it_corridor', W, H); g.destroy();
    }

    /** Veli Lagoon background strip — calm water body */
    _genVeliLagoon() {
        const g = this.make.graphics({ add: false }), W = 320, H = 60;
        // Distant horizon (faint treeline)
        g.fillStyle(0x4a7040); g.fillRect(0, 0, W, 15);
        g.fillStyle(0x2a5020); g.fillRect(0, 5, W, 10);
        // Water body (calm lagoon)
        g.fillStyle(0x2a6090); g.fillRect(0, 15, W, 45);
        // Subtle water horizontal gradients
        g.fillStyle(0x3a80b0, 0.5); g.fillRect(0, 20, W, 15);
        // Silver shimmer on lagoon
        g.fillStyle(0xaaddff, 0.3);
        for (let x = 0; x < W; x += 40) { g.fillRect(x, 25, 20, 2); }
        for (let x = 10; x < W; x += 40) { g.fillRect(x, 35, 15, 2); }
        // Boat silhouette
        g.fillStyle(0x1a1a1a); g.fillRect(100, 32, 24, 6);
        g.fillRect(110, 20, 2, 14); // mast
        g.fillStyle(0x3a3a3a); g.fillRect(107, 22, 10, 2); // small sail
        g.generateTexture('veli_lagoon', W, H); g.destroy();
    }

    /** Kollam harbour silhouette — fishing boats and distant buildings */
    _genKollamPort() {
        const g = this.make.graphics({ add: false }), W = 256, H = 80;
        // Water
        g.fillStyle(0x1a5080); g.fillRect(0, 45, W, 35);
        g.fillStyle(0x2a70a0, 0.5); g.fillRect(0, 50, W, 10);
        // Distant buildings (dark silhouette)
        g.fillStyle(0x2a2a2a);
        [[10, 20, 30, 50], [50, 10, 20, 50], [80, 25, 25, 50],
         [115, 15, 35, 50], [160, 20, 20, 50], [190, 5, 30, 50],
         [230, 18, 20, 50]].forEach(([x, y, w, h]) => {
            g.fillRect(x, y, w, h);
        });
        // Fishing boats
        g.fillStyle(0x4a3010);
        [[20, 42, 30], [100, 40, 36], [180, 43, 28]].forEach(([x, y, w]) => {
            g.fillRect(x, y, w, 6);
            g.fillRect(x + w / 2, y - 14, 2, 16); // mast
        });
        // Water shimmer
        g.fillStyle(0xaaccee, 0.2);
        for (let x = 0; x < W; x += 30) { g.fillRect(x, 55, 18, 2); }
        g.generateTexture('kollam_port', W, H); g.destroy();
    }

    // ═══════════════════════════════════════════════════════════════
    // PHASE 4 — DISTINCT BRIDGE TYPES
    // ═══════════════════════════════════════════════════════════════

    /**
     * Concrete T-girder railway bridge.
     * Used for: Murukkampuzha Bridge, Veli Creek Bridge.
     * Characteristic: White/grey pre-stressed concrete deck, solid piers.
     */
    _genConcreteBridge() {
        const g = this.make.graphics({ add: false }), W = 320, H = 60;
        // Deck (thick concrete girder)
        g.fillStyle(0xd0d0c8); g.fillRect(0, 0, W, 18);
        g.fillStyle(0xb8b8b0); g.fillRect(0, 18, W, 6); // soffit
        // T-beam underside (ribs)
        g.fillStyle(0xc0c0b8);
        for (let x = 0; x < W; x += 40) {
            g.fillRect(x, 12, 8, 12); // T-web
        }
        // Parapet walls
        g.fillStyle(0xe0e0d8); g.fillRect(0, 0, W, 4);
        g.fillRect(0, 4, 4, 14);
        // Concrete piers (square section)
        [60, 160, 260].forEach(px => {
            g.fillStyle(0xb0b0a8); g.fillRect(px, 22, 20, 38);
            // Pier cap (wider at top)
            g.fillStyle(0xc8c8c0); g.fillRect(px - 6, 20, 32, 6);
        });
        // Water surface hint
        g.fillStyle(0x2a6090, 0.4); g.fillRect(0, 52, W, 8);
        g.generateTexture('bridge_concrete', W, H); g.destroy();
    }

    /**
     * Steel through-truss railway bridge.
     * Used for: Akathumuri Bridge.
     * Characteristic: Warren truss with diagonal members, riveted joints,
     * painted in Indian Railways OHE pole colour (grey/green).
     */
    _genSteelTrussBridge() {
        const g = this.make.graphics({ add: false }), W = 320, H = 80;
        // Bottom chord (main horizontal beam)
        g.fillStyle(0x5a6a5a); g.fillRect(0, 40, W, 6);
        // Top chord
        g.fillStyle(0x5a6a5a); g.fillRect(0, 10, W, 6);
        // Vertical posts (every 40px)
        for (let x = 0; x <= W; x += 40) {
            g.fillStyle(0x4a5a4a); g.fillRect(x, 10, 4, 36);
        }
        // Diagonal tension members (Warren truss pattern)
        g.lineStyle(3, 0x506050, 1);
        for (let i = 0; i < 8; i++) {
            const x1 = i * 40, x2 = (i + 1) * 40;
            if (i % 2 === 0) {
                // Diagonal up-right
                g.lineBetween(x1, 46, x2, 10);
            } else {
                // Diagonal down-right
                g.lineBetween(x1, 10, x2, 46);
            }
        }
        // Rivet detail (dots at joints)
        g.fillStyle(0x303830);
        for (let x = 0; x <= W; x += 40) {
            g.fillCircle(x + 2, 13, 2); g.fillCircle(x + 2, 43, 2);
        }
        // Deck boards (transverse planks on top of bottom chord)
        g.fillStyle(0x6a5a40);
        for (let x = 4; x < W; x += 10) { g.fillRect(x, 40, 6, 8); }
        // Rail on deck
        g.fillStyle(0x888888); g.fillRect(0, 36, W, 4);
        // River surface
        g.fillStyle(0x2a5a80, 0.5); g.fillRect(0, 60, W, 20);
        g.generateTexture('bridge_steel', W, H); g.destroy();
    }

    /**
     * Small canal culvert bridge.
     * Used for smaller crossings. Low profile, single span.
     * Characteristic: Stone/brick arch, short span ~30m.
     */
    _genCanalBridge() {
        const g = this.make.graphics({ add: false }), W = 160, H = 50;
        // Masonry arch (brick red)
        g.fillStyle(0x9a5030); g.fillRect(0, 10, W, 30);
        // Arch opening (water visible)
        g.fillStyle(0x2a6090, 0.8); g.fillRect(40, 18, 80, 22);
        // Stone courses (horizontal lines on arch)
        g.fillStyle(0x7a3820);
        for (let y = 12; y < 38; y += 6) { g.fillRect(0, y, W, 2); }
        // Vertical joints
        for (let x = 10; x < W; x += 18) { g.fillRect(x, 10, 2, 8); }
        // Parapet (top flat section)
        g.fillStyle(0xc09070); g.fillRect(0, 6, W, 6);
        g.fillStyle(0xa07050); g.fillRect(0, 4, W, 3);
        // Canal water
        g.fillStyle(0x3a7a50, 0.7); g.fillRect(0, 40, W, 10);
        // Vegetation on sides
        g.fillStyle(0x2a6020);
        g.fillRect(0, 32, 30, 8); g.fillRect(130, 32, 30, 8);
        g.generateTexture('bridge_canal', W, H); g.destroy();
    }

    /**
     * Backwater causeway / embankment bridge.
     * Used for: Paravur Lake Bridge (1.8km crossing).
     * Characteristic: Long low embankment with arch openings, white concrete,
     * water visible on both sides.
     */
    _genBackwaterBridge() {
        const g = this.make.graphics({ add: false }), W = 400, H = 60;
        // Causeway embankment (long, low)
        g.fillStyle(0xd4d0c4); g.fillRect(0, 8, W, 22);
        // Arch openings (water channels)
        g.fillStyle(0x2a70b0, 0.7);
        [50, 130, 210, 290, 370].forEach(x => {
            g.fillRect(x, 12, 20, 16);
        });
        // Concrete parapet rail (white top)
        g.fillStyle(0xeeeee8); g.fillRect(0, 6, W, 4);
        g.fillStyle(0xffffff); g.fillRect(0, 4, W, 3);
        // Water on both sides
        g.fillStyle(0x2a7aaa, 0.5); g.fillRect(0, 32, W, 28);
        // Shimmering water highlights
        g.fillStyle(0x70b8e0, 0.4);
        for (let x = 0; x < W; x += 36) {
            g.fillRect(x, 36, 20, 2); g.fillRect(x + 8, 44, 14, 2);
        }
        // Distant coconut palms visible over the water
        g.fillStyle(0x1a5010, 0.5);
        [20, 80, 160, 240, 320, 380].forEach(x => {
            g.fillRect(x, 0, 4, 10);
            g.fillRect(x - 8, -2, 20, 5);
        });
        g.generateTexture('bridge_backwater', W, H); g.destroy();
    }
}
