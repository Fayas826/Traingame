/**
 * 📋 MENU SCENE — Disclaimer → Loco Picker → Rake Picker → Start
 * Three independent selection columns (Engine, Rake, Timetable) as specified.
 */
import Phaser from 'phaser';
import { LOCO_PROFILES, RAKE_PROFILES } from '../config.js';

const LOCOS = Object.values(LOCO_PROFILES);
const RAKES = Object.values(RAKE_PROFILES);

const TRAIN_TYPES = [
    { id: 'Passenger', name: 'Passenger Train', style: 'Stopping at all stations', description: 'Stops at all 18 stations from Kollam to TVC', color: '#1abc9c' },
    { id: 'Express', name: 'Express Train', style: 'Limited Stoppage Service', description: 'Stops only at Kollam, Varkala, Kazhakuttam, TVC', color: '#e67e22' },
    { id: 'Superfast', name: 'Superfast Express', style: 'Fast Intercity Link', description: 'Stops only at Kollam, Varkala, and Trivandrum Central', color: '#e74c3c' },
    { id: 'MEMU', name: 'MEMU Service', style: 'Suburban Commuter', description: 'Stops at all intermediate halts and stations', color: '#9b59b6' },
    { id: 'Special', name: 'Festival Special', style: 'Special Stoppage Pattern', description: 'Stops at Kollam, Paravur, Varkala, TVC North, TVC', color: '#f1c40f' }
];

export default class MenuScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MenuScene' });
        this.phase = 'disclaimer'; // disclaimer → select → ready
        this.selectedLoco = 0;
        this.selectedRake = 0;
        this.selectedTrainType = 0;
    }

    create() {
        // Ensure HTML HUD elements are hidden on load
        document.getElementById('alp-hud')?.classList.add('hud-hidden');
        document.getElementById('mission-stat')?.classList.add('hud-hidden');
        document.getElementById('cockpit-ui')?.classList.add('hud-hidden');
        document.getElementById('train-debug-panel')?.classList.add('hud-hidden');
        document.body.classList.remove('systems-active');

        const container = document.getElementById('game-container');
        if (container) {
            this.scale.resize(container.clientWidth, container.clientHeight);
        }

        const W = this.cameras.main.width, H = this.cameras.main.height;
        this.cameras.main.setBackgroundColor('#0a0a0f');

        // Container for all menu elements
        this.menuContainer = this.add.container(0, 0);

        this._buildDisclaimer(W, H);
    }

    // ═══════════════════════════════════════════
    // PHASE 1: DISCLAIMER
    // ═══════════════════════════════════════════
    _buildDisclaimer(W, H) {
        this._clearMenu();

        // Background decorative lines
        const bg = this.add.graphics();
        bg.lineStyle(1, 0x00ff88, 0.08);
        for (let y = 0; y < H; y += 40) bg.lineBetween(0, y, W, y);
        for (let x = 0; x < W; x += 40) bg.lineBetween(x, 0, x, H);
        this.menuContainer.add(bg);

        // Title
        const flag = this.add.text(W/2, H*0.08, '🇮🇳', { fontSize: '48px' }).setOrigin(0.5);
        const title = this.add.text(W/2, H*0.16, 'KERALA RAILWAY SIMULATOR', {
            fontFamily: '"Orbitron", monospace', fontSize: '38px', color: '#00ff88',
            stroke: '#003311', strokeThickness: 2,
        }).setOrigin(0.5);
        const sub = this.add.text(W/2, H*0.22, '2.5D DIGITAL TWIN SIMULATOR', {
            fontFamily: '"Orbitron", monospace', fontSize: '14px', color: '#555',
            letterSpacing: 4,
        }).setOrigin(0.5);

        // Disclaimer box
        const boxX = W*0.15, boxY = H*0.28, boxW = W*0.7, boxH = H*0.45;
        const box = this.add.graphics();
        box.fillStyle(0x0d1117, 0.95);
        box.fillRoundedRect(boxX, boxY, boxW, boxH, 8);
        box.lineStyle(1, 0x00ff88, 0.3);
        box.strokeRoundedRect(boxX, boxY, boxW, boxH, 8);

        const disclaimerTitle = this.add.text(W/2, boxY + 25, '⚠️  EDUCATIONAL DISCLAIMER', {
            fontFamily: '"Orbitron", monospace', fontSize: '16px', color: '#f1c40f',
        }).setOrigin(0.5);

        const disclaimerLines = [
            'This simulation is strictly for EDUCATIONAL PURPOSES to demonstrate',
            'how a train operates on the Indian Railways system.',
            '',
            '• Learn the duties of a Loco Pilot and Assistant Loco Pilot (ALP)',
            '• Understand the 4-aspect colour light signalling system',
            '• Experience realistic route objects: signals, bridges, level crossings',
            '• Drive the real Kollam Junction (QLN) → Trivandrum Central (TVC) route',
            '',
            'CONTROLS:',
            '  ↑ Arrow / Touch Right  =  Increase Throttle Notch',
            '  ↓ Arrow / Touch Left   =  Apply Brake / Decrease Notch',
            '  [H] = Horn    [L] = Headlights    [B] = Emergency Brake',
            '  [C] = Cycle Camera    [A] = Toggle Autopilot',
            '',
            'Blow the horn at every W/L (Whistle Level) board for safe driving.',
        ];

        disclaimerLines.forEach((line, i) => {
            const isHeader = line.startsWith('CONTROLS');
            const col = isHeader ? '#00ff88' : '#E0E0E0';
            this.menuContainer.add(
                this.add.text(boxX + 30, boxY + 50 + i * 19, line, {
                    fontFamily: '"Inter", sans-serif', fontSize: '12px', color: col,
                })
            );
        });

        // Proceed button
        const btnX = W/2, btnY = H*0.82;
        const btn = this.add.graphics();
        btn.fillStyle(0x0d1117, 1);
        btn.fillRoundedRect(btnX - 120, btnY - 22, 240, 44, 6);
        btn.lineStyle(2, 0x00ff88, 1);
        btn.strokeRoundedRect(btnX - 120, btnY - 22, 240, 44, 6);

        const btnText = this.add.text(btnX, btnY, 'PROCEED TO CONFIGURATION', {
            fontFamily: '"Orbitron", monospace', fontSize: '12px', color: '#00ff88',
        }).setOrigin(0.5);

        const btnZone = this.add.zone(btnX, btnY, 240, 44).setInteractive({ useHandCursor: true });
        btnZone.on('pointerover', () => { btn.clear(); btn.fillStyle(0x00ff88, 0.15); btn.fillRoundedRect(btnX-120, btnY-22, 240, 44, 6); btn.lineStyle(2, 0x00ff88, 1); btn.strokeRoundedRect(btnX-120, btnY-22, 240, 44, 6); });
        btnZone.on('pointerout', () => { btn.clear(); btn.fillStyle(0x0d1117, 1); btn.fillRoundedRect(btnX-120, btnY-22, 240, 44, 6); btn.lineStyle(2, 0x00ff88, 1); btn.strokeRoundedRect(btnX-120, btnY-22, 240, 44, 6); });
        btnZone.on('pointerdown', () => {
            this._buildSelector(W, H);
        });

        [flag, title, sub, box, disclaimerTitle, btn, btnText, btnZone].forEach(o => this.menuContainer.add(o));

        const ver = this.add.text(W/2, H*0.95, 'Phaser.js WebGL · 60 FPS · Pixel-Perfect Rendering', {
            fontFamily: '"Inter", sans-serif', fontSize: '10px', color: '#E0E0E0',
        }).setOrigin(0.5);
        this.menuContainer.add(ver);
    }

    // ═══════════════════════════════════════════
    // PHASE 2: TRIPLE-COLUMN SELECTOR
    // ═══════════════════════════════════════════
    _buildSelector(W, H) {
        this._clearMenu();
        this.phase = 'select';

        const bg = this.add.graphics();
        bg.lineStyle(1, 0x00ff88, 0.04);
        for (let y = 0; y < H; y += 40) bg.lineBetween(0, y, W, y);
        this.menuContainer.add(bg);

        // Title
        const title = this.add.text(W/2, 30, 'CONFIGURE YOUR TRAIN & SERVICE', {
            fontFamily: '"Orbitron", monospace', fontSize: '22px', color: '#00ff88',
        }).setOrigin(0.5);
        this.menuContainer.add(title);

        // Three columns
        const colW = W * 0.28;
        const col1X = W * 0.04;
        const col2X = W * 0.36;
        const col3X = W * 0.68;
        const startY = 75;

        // ─── Column 1: CHOOSE ENGINE ───
        this.menuContainer.add(this.add.text(col1X + colW/2, startY, '⚡ CHOOSE ENGINE', {
            fontFamily: '"Orbitron", monospace', fontSize: '13px', color: '#f1c40f',
        }).setOrigin(0.5));

        this.locoCards = [];
        LOCOS.forEach((loco, i) => {
            const cardY = startY + 35 + i * 62;
            const card = this._createCard(col1X, cardY, colW, 54, loco.name, loco.type, loco.description, loco.color, i === this.selectedLoco);
            card.zone.on('pointerdown', () => {
                this.selectedLoco = i;
                this._refreshCards();
            });
            this.locoCards.push(card);
        });

        // ─── Column 2: CHOOSE BOGIE RAKE ───
        this.menuContainer.add(this.add.text(col2X + colW/2, startY, '🚃 CHOOSE BOGIE RAKE', {
            fontFamily: '"Orbitron", monospace', fontSize: '13px', color: '#f1c40f',
        }).setOrigin(0.5));

        this.rakeCards = [];
        RAKES.forEach((rake, i) => {
            const cardY = startY + 35 + i * 72;
            const card = this._createCard(col2X, cardY, colW, 64, rake.name, rake.style, rake.description, '#2980b9', i === this.selectedRake);
            card.zone.on('pointerdown', () => {
                this.selectedRake = i;
                this._refreshCards();
            });
            this.rakeCards.push(card);
        });

        // ─── Column 3: CHOOSE TRAIN SERVICE ───
        this.menuContainer.add(this.add.text(col3X + colW/2, startY, '📅 CHOOSE TRAIN SERVICE', {
            fontFamily: '"Orbitron", monospace', fontSize: '13px', color: '#f1c40f',
        }).setOrigin(0.5));

        this.trainTypeCards = [];
        TRAIN_TYPES.forEach((tt, i) => {
            const cardY = startY + 35 + i * 62;
            const card = this._createCard(col3X, cardY, colW, 54, tt.name, tt.style, tt.description, tt.color, i === this.selectedTrainType);
            card.zone.on('pointerdown', () => {
                this.selectedTrainType = i;
                this._refreshCards();
            });
            this.trainTypeCards.push(card);
        });

        // ─── START BUTTON ───
        const btnY = H - 60;
        const startBtn = this.add.graphics();
        startBtn.fillStyle(0x00ff88, 0.15);
        startBtn.fillRoundedRect(W/2 - 180, btnY - 25, 360, 50, 8);
        startBtn.lineStyle(2, 0x00ff88, 1);
        startBtn.strokeRoundedRect(W/2 - 180, btnY - 25, 360, 50, 8);
        this.menuContainer.add(startBtn);

        const startText = this.add.text(W/2, btnY, '🚂  ACTIVATE SYSTEMS & DEPART', {
            fontFamily: '"Orbitron", monospace', fontSize: '13px', color: '#00ff88',
        }).setOrigin(0.5);
        this.menuContainer.add(startText);

        const startZone = this.add.zone(W/2, btnY, 360, 50).setInteractive({ useHandCursor: true });
        startZone.on('pointerover', () => { startBtn.clear(); startBtn.fillStyle(0x00ff88, 0.3); startBtn.fillRoundedRect(W/2-180, btnY-25, 360, 50, 8); startBtn.lineStyle(2, 0x00ff88, 1); startBtn.strokeRoundedRect(W/2-180, btnY-25, 360, 50, 8); });
        startZone.on('pointerout', () => { startBtn.clear(); startBtn.fillStyle(0x00ff88, 0.15); startBtn.fillRoundedRect(W/2-180, btnY-25, 360, 50, 8); startBtn.lineStyle(2, 0x00ff88, 1); startBtn.strokeRoundedRect(W/2-180, btnY-25, 360, 50, 8); });
        startZone.on('pointerdown', () => {
            this._launchGame();
        });
        this.menuContainer.add(startZone);

        // Selected config summary
        this.summaryText = this.add.text(W/2, H - 100, '', {
            fontFamily: '"Inter", sans-serif', fontSize: '11px', color: '#888', align: 'center',
        }).setOrigin(0.5);
        this.menuContainer.add(this.summaryText);
        this._refreshCards();
    }

    _createCard(x, y, w, h, title, subtitle, desc, accentColor, selected) {
        const gfx = this.add.graphics();
        const borderColor = selected ? 0x00ff88 : 0x333333;
        const bgAlpha = selected ? 0.2 : 0.05;
        gfx.fillStyle(0x00ff88, bgAlpha);
        gfx.fillRoundedRect(x, y, w, h, 6);
        gfx.lineStyle(selected ? 2 : 1, borderColor, selected ? 1 : 0.5);
        gfx.strokeRoundedRect(x, y, w, h, 6);

        // Accent bar
        const ac = Phaser.Display.Color.HexStringToColor(accentColor).color;
        gfx.fillStyle(ac, 0.8);
        gfx.fillRect(x, y, 5, h);

        const tTitle = this.add.text(x + 16, y + 8, title, {
            fontFamily: '"Orbitron", monospace', fontSize: '12px', color: selected ? '#00ff88' : '#ccc',
        });
        const tSub = this.add.text(x + 16, y + 24, subtitle, {
            fontFamily: '"Inter", sans-serif', fontSize: '10px', color: '#777',
        });
        const tDesc = this.add.text(x + 16, y + 38, desc || '', {
            fontFamily: '"Inter", sans-serif', fontSize: '9px', color: '#555',
        });

        const zone = this.add.zone(x + w/2, y + h/2, w, h).setInteractive({ useHandCursor: true });

        [gfx, tTitle, tSub, tDesc, zone].forEach(o => this.menuContainer.add(o));

        return { gfx, tTitle, tSub, tDesc, zone, x, y, w, h, accentColor, selected };
    }

    _refreshCards() {
        // Refresh loco cards
        this.locoCards.forEach((card, i) => {
            const sel = i === this.selectedLoco;
            card.gfx.clear();
            card.gfx.fillStyle(0x00ff88, sel ? 0.2 : 0.05);
            card.gfx.fillRoundedRect(card.x, card.y, card.w, card.h, 6);
            card.gfx.lineStyle(sel ? 2 : 1, sel ? 0x00ff88 : 0x333333, sel ? 1 : 0.5);
            card.gfx.strokeRoundedRect(card.x, card.y, card.w, card.h, 6);
            const ac = Phaser.Display.Color.HexStringToColor(card.accentColor).color;
            card.gfx.fillStyle(ac, 0.8);
            card.gfx.fillRect(card.x, card.y, 5, card.h);
            card.tTitle.setColor(sel ? '#00ff88' : '#ccc');
        });

        // Refresh rake cards
        this.rakeCards.forEach((card, i) => {
            const sel = i === this.selectedRake;
            card.gfx.clear();
            card.gfx.fillStyle(0x2980b9, sel ? 0.15 : 0.05);
            card.gfx.fillRoundedRect(card.x, card.y, card.w, card.h, 6);
            card.gfx.lineStyle(sel ? 2 : 1, sel ? 0x2980b9 : 0x333333, sel ? 1 : 0.5);
            card.gfx.strokeRoundedRect(card.x, card.y, card.w, card.h, 6);
            card.gfx.fillStyle(0x2980b9, 0.8);
            card.gfx.fillRect(card.x, card.y, 5, card.h);
            card.tTitle.setColor(sel ? '#2980b9' : '#ccc');
        });

        // Refresh train service cards
        this.trainTypeCards.forEach((card, i) => {
            const sel = i === this.selectedTrainType;
            const acColor = Phaser.Display.Color.HexStringToColor(card.accentColor).color;
            card.gfx.clear();
            card.gfx.fillStyle(acColor, sel ? 0.2 : 0.05);
            card.gfx.fillRoundedRect(card.x, card.y, card.w, card.h, 6);
            card.gfx.lineStyle(sel ? 2 : 1, sel ? acColor : 0x333333, sel ? 1 : 0.5);
            card.gfx.strokeRoundedRect(card.x, card.y, card.w, card.h, 6);
            card.gfx.fillStyle(acColor, 0.8);
            card.gfx.fillRect(card.x, card.y, 5, card.h);
            card.tTitle.setColor(sel ? '#00ff88' : '#ccc');
        });

        // Update summary
        const loco = LOCOS[this.selectedLoco];
        const rake = RAKES[this.selectedRake];
        const tt = TRAIN_TYPES[this.selectedTrainType];
        const totalMass = loco.mass + rake.coachCount * rake.massPerCoach;
        if (this.summaryText) {
            this.summaryText.setText(
                `Configuration: ${loco.name} + ${rake.name} (${rake.coachCount} cars) · Timetable: ${tt.name} · Total Mass: ${totalMass} tons`
            );
        }
    }

    _launchGame() {
        const loco = LOCOS[this.selectedLoco];
        const rake = RAKES[this.selectedRake];
        const tt = TRAIN_TYPES[this.selectedTrainType];

        // Store selection in registry for other scenes
        this.registry.set('selectedLoco', loco.id);
        this.registry.set('selectedRake', rake.id);
        this.registry.set('selectedTrainType', tt.id);

        this.scene.start('BootScene');
    }

    _clearMenu() {
        this.menuContainer?.removeAll(true);
    }
}
