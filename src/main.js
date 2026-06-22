import Phaser from 'phaser';
import MenuScene from './scenes/MenuScene.js';
import BootScene from './scenes/BootScene.js';
import GameScene from './scenes/GameScene.js';
import HUDScene from './scenes/HUDScene.js';

const urlParams = new URLSearchParams(window.location.search);
const disableAudio = urlParams.has('noaudio') || navigator.webdriver || /HeadlessChrome/.test(navigator.userAgent);

// ── Phase 7: Mobile Performance Detection ──
const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
    || window.innerWidth < 768;
const isTablet = /iPad/i.test(navigator.userAgent) || (window.innerWidth >= 768 && window.innerWidth < 1024 && isMobile);

// Export mobile flag for pool sizing in other systems
window.__TRAINSIM_MOBILE__ = isMobile;
window.__TRAINSIM_TABLET__ = isTablet;

// Limit pixel ratio on mobile to reduce GPU load
// Desktop: native DPR. Mobile: max 1.5. Low-end mobile: 1.0
const dpr = isMobile
    ? Math.min(window.devicePixelRatio || 1, isTablet ? 1.5 : 1.2)
    : Math.min(window.devicePixelRatio || 1, 2.0);

const config = {
    type: Phaser.WEBGL,
    parent: 'game-container',
    width: window.innerWidth,
    height: window.innerHeight,
    pixelArt: true,
    antialias: false,
    roundPixels: true,
    resolution: dpr,
    fps: {
        target: isMobile ? 50 : 60,
        forceSetTimeOut: isMobile, // more stable on mobile browsers
        min: isMobile ? 30 : 24,
    },
    scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH },
    audio: {
        disableWebAudio: disableAudio,
        noAudio: disableAudio
    },
    render: {
        powerPreference: 'high-performance',
        desynchronized: true,       // reduce latency on mobile
        failIfMajorPerformanceCaveat: false,
    },
    scene: [MenuScene, BootScene, GameScene, HUDScene],
};

const game = new Phaser.Game(config);

// Mobile controls
document.addEventListener('DOMContentLoaded', () => {
    const ids = { 'btn-notch-up':'UP','btn-notch-down':'DOWN','btn-horn':'H','btn-ebrake':'B','btn-lights':'L' };
    Object.entries(ids).forEach(([id, key]) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('pointerdown', () => {
            const gs = game.scene.getScene('GameScene');
            if (!gs || !gs.physics) return;
            if (key === 'UP') gs.physics.notchUp(gs.stationMgr?.gameState, gs.stationMgr?.isWaitingForStarter);
            else if (key === 'DOWN') gs.physics.notchDown();
            else if (key === 'B') gs.physics.emergencyBrake();
            else if (key === 'H') { gs.audio?.playHorn(); gs.stationMgr?.registerHorn(); }
            else if (key === 'L') gs.train?.toggleLights();
        });
    });
});

window.addEventListener('resize', () => {
    const container = document.getElementById('game-container');
    if (container) {
        game.scale.resize(container.clientWidth, container.clientHeight);
    } else {
        game.scale.resize(window.innerWidth, window.innerHeight);
    }
});
