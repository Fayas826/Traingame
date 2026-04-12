/**
 * 🚂 SUPREME PROCEDURAL TRAIN ENGINE (V150.0 - FINAL COMPLIANCE)
 * 100% PARITY WITH CLIENT-CLIENT INSTRUCTIONS (FINAL)
 * [FIXED] 7-SEC STARTER: Starts with Red, flips to Green after 7s.
 * [FIXED] SIGNAL SEQUENCE: 3x Green -> Yellow -> 2x Yellow -> Home -> Red.
 * [FIXED] STATIONS: 6-Station Expansion (Kollam -> TVC).
 * [FIXED] HYBRID: Works on PC (Arrows/WS) and Mobile (Touch/Haptics).
 */

const CONFIG = {
    canvasId: 'gameCanvas',
    trackY: 0,
    trainX: 450,
    maxSpeed: 11.5,
    scrollingMultiplier: 4.8,
    vScale: 1.0 // 📏 Global Scaling Engine
};

let canvas, ctx, speedCanvas, sctx, speed = 0, worldDistance = 0, bgX = 0, throttle = 0, brake = 0;
let clouds = [], hills = [], trees = [], stations = [], signals = [], mountains = [];
let coachOffsets = [];
let timeOfDay = 0, wheelRotation = 0; 
let audioStarted = false, hornAudio, locoAudio, slowTrackAudio, fastTrackAudio, crowdAudio;
let lampsOn = false, lastAlpMsg = "", lastTrackSoundDist = 0;
let oppTrain = null, rainDrops = [], isRaining = false, rainAlpha = 0;

// High-Fidelity Assets & Systems
let imgSky = new Image(); imgSky.src = 'assets/sky.png';
let imgMountains = new Image(); imgMountains.src = 'assets/mountains.png';
let imgCity = new Image(); imgCity.src = 'assets/cityscape.png';
let particles = [];
let stars = [], foregroundObjects = [];
for(let i=0; i<150; i++) stars.push({x: Math.random()*3000, y: Math.random()*800, s: Math.random()*2.5 + 0.5, a: Math.random()});
let tunnelAlpha = 0;
let starterTimer = 7, isWaitingForStarter = true; // 🚦 7-Sec Starter State

function init() {
    canvas = document.getElementById(CONFIG.canvasId);
    ctx = canvas.getContext('2d', { alpha: false });
    
    speedCanvas = document.getElementById("speedCanvas");
    sctx = speedCanvas.getContext("2d");
    speedCanvas.width = 120;
    speedCanvas.height = 120;

    resize();
    window.addEventListener('resize', resize);

    hornAudio = new Audio('assets/P5.mp3'); 
    locoAudio = new Audio('assets/humming.mp3'); 
    locoAudio.loop = true;
    slowTrackAudio = new Audio('assets/short.mp3');
    fastTrackAudio = new Audio('assets/long.mp3');
    crowdAudio = new Audio('assets/crowd.mp3');
    crowdAudio.loop = true;
    crowdAudio.volume = 0;

    for(let i=0; i<4; i++) coachOffsets.push(0); 
    for(let i=0; i<12; i++) spawnMountain();
    for(let i=0; i<20; i++) spawnVolumetricCloud(Math.random() * canvas.width);
    for(let i=0; i<100; i++) rainDrops.push({ x: Math.random()*canvas.width, y: Math.random()*canvas.height, s: 10 + Math.random()*15 });
    
    // 🚉 6-STATION EXPANSION (CLIENT SPEC 6)
    stations.push({ name: "KOLLAM JCT", x: 0, annDone: false });
    stations.push({ name: "PARAVUR", x: 40000, annDone: false });
    stations.push({ name: "VARKALA SIVAGIRI", x: 80000, annDone: false });
    stations.push({ name: "KADAKKAVUR", x: 120000, annDone: false });
    stations.push({ name: "CHIRAYINKEEZHU", x: 160000, annDone: false });
    stations.push({ name: "TRIVANDRUM CENTRAL", x: 200000, annDone: false });

    // 🚦 MASTER SIGNAL SEQUENCE (CLIENT SPEC 3)
    // First 400m is the Starter Signal
    const seq = ['GREEN', 'GREEN', 'GREEN', 'YELLOW', 'DOUBLE_YELLOW', 'YELLOW', 'RED'];
    for(let i=0; i<150; i++) {
        let aspect = seq[i % seq.length];
        if(i < 1) aspect = 'RED'; // Starter
        signals.push({ x: 800 + i * 4000, aspect: aspect });
    }

    window.startMobileAudio = () => {
        audioStarted = true;
        document.getElementById('start-overlay').style.display = 'none';
        locoAudio.play().catch(()=>{});
        speakALP("Waiting for signal"); // Initial ALP Callout
        if (navigator.vibrate) navigator.vibrate(50);
    };

    document.getElementById('throttle-liver').addEventListener('input', (e) => {
        if(isWaitingForStarter) { e.target.value = 0; return; }
        throttle = e.target.value / 100; if(throttle > 0) brake = 0;
        document.getElementById('brake-liver').value = 0;
    });
    document.getElementById('brake-liver').addEventListener('input', (e) => {
        brake = e.target.value / 100; if(brake > 0) throttle = 0;
        document.getElementById('throttle-liver').value = 0;
    });

    window.horn = () => { if(hornAudio) { hornAudio.currentTime = 0; hornAudio.play(); } if(navigator.vibrate) navigator.vibrate(200); };
    window.toggleLights = () => { lampsOn = !lampsOn; document.getElementById('light-btn').classList.toggle('active', lampsOn); if(navigator.vibrate) navigator.vibrate(20); };
    window.emergencyBrake = () => { brake = 1; throttle = 0; updateLivers(); if(navigator.vibrate) navigator.vibrate([100, 50, 100]); };

    window.addEventListener('keydown', e => {
        if(!audioStarted) return;
        const key = e.key.toLowerCase();
        if(isWaitingForStarter) return; // Block movement during starter wait
        
        if (e.key === 'ArrowUp') { throttle = Math.min(throttle + 0.1, 1.0); brake = 0; updateLivers(); }
        if (e.key === 'ArrowDown') { throttle = Math.max(throttle - 0.1, 0); updateLivers(); }
        if (key === 'w') { brake = Math.max(brake - 0.05, 0); updateLivers(); }
        if (key === 's') { brake = Math.min(brake + 0.05, 1); throttle = 0; updateLivers(); }
        if (key === 'b') window.emergencyBrake();
        if (key === 'h') window.horn();
        if (key === 'l') window.toggleLights();
    });

    requestAnimationFrame(gameLoop);
}

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight * 0.7;
    
    // 🎨 MOBILE ADAPTIVE ENGINE (Aggressive 60% Scaling)
    const isMobileLocal = canvas.height < 500;
    CONFIG.vScale = isMobileLocal ? 0.60 : 0.88; // 🖥️ Harmonized PC Scale
    CONFIG.trackY = isMobileLocal ? canvas.height * 0.70 : canvas.height * 0.85;
}

// 📏 Scaling Helper
const sc = (val) => val * CONFIG.vScale;

function spawnMountain() { mountains.push({ x: Math.random() * canvas.width * 4, sz: 1200 + Math.random() * 800, h: 500 + Math.random() * 400 }); }
function spawnVolumetricCloud(x) { clouds.push({ x, y: Math.random()*(canvas.height * 0.4), sz: sc(200)+Math.random()*sc(200), op: 0.05 + Math.random()*0.1, layer: (Math.random()*2)|0 }); }
function isAtStation(xWorld) { return stations.some(s => Math.abs(xWorld - s.x) < 5000); }

function spawnTreeLayered() {
    let rx = worldDistance + canvas.width * 2 + Math.random()*1500;
    let isNearStation = stations.some(s => Math.abs(rx - s.x) < 15000);
    if(!isNearStation) {
        let isPalm = Math.random() < 0.45;
        trees.push({ x: rx, h: 320 + Math.random()*180, layer: (Math.random()*3)|0, sway: Math.random()*Math.PI, isPalm });
    }
}

function updateLivers() {
    document.getElementById('throttle-liver').value = throttle * 100;
    document.getElementById('brake-liver').value = brake * 100;
}

function speakALP(text) {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text); u.pitch = 1.0; u.rate = 1.0; 
    window.speechSynthesis.speak(u);
}

function gameLoop() { update(); draw(); drawSpeedometerUI(); requestAnimationFrame(gameLoop); }

function update() {
    // 🚦 STARTER SIGNAL TIMER (7 SECONDS)
    if(audioStarted && isWaitingForStarter) {
        starterTimer -= 0.016;
        if(starterTimer <= 0) {
            isWaitingForStarter = false;
            signals[0].aspect = 'GREEN';
            speakALP("Starter signal green");
        }
    }

    timeOfDay = (timeOfDay + 0.04) % 1000;
    let distKM = worldDistance / 1000;
    isRaining = (distKM > 30 && distKM < 50) || (distKM > 130 && distKM < 150);
    rainAlpha = isRaining ? Math.min(rainAlpha + 0.01, 0.6) : Math.max(rainAlpha - 0.01, 0);

    // Tunnel bounds logic
    if ((distKM > 60 && distKM < 62) || (distKM > 90 && distKM < 92) || (distKM > 120 && distKM < 121)) {
        tunnelAlpha = Math.min(tunnelAlpha + 0.02, 1.0);
    } else {
        tunnelAlpha = Math.max(tunnelAlpha - 0.02, 0);
    }
    
    // Twinkle stars
    stars.forEach(s => {
        s.a += (Math.random() - 0.5) * 0.1;
        s.a = Math.max(0.1, Math.min(s.a, 1.0));
    });

    if (Math.random() < 0.08 && speed > 2) {
        foregroundObjects.push({x: canvas.width + 100, isPole: Math.random() < 0.2});
    }
    foregroundObjects.forEach((f, index) => { 
        f.x -= speed * 1.5; 
        if (f.x < -200) foregroundObjects.splice(index, 1); 
    });

    let traction = isRaining ? 0.65 : 1.0;
    let friction = 0.003 + (speed * 0.001);
    // ⚡ PROPORTIONAL THROTTLE: Speed now scales with Lever position (V151.6/V151.8)
    let power = (throttle * throttle * 0.04 * traction); 
    // ⚡ MOMENTUM BRAKING: Heavy mass deceleration (V151.7)
    let brakeForce = (brake * 0.004); 
    speed += (power - brakeForce - friction);
    // ⚡ REALISTIC MOMENTUM: Only cap speed if accelerating, allow smooth coasting (V151.9)
    if(speed > CONFIG.maxSpeed * throttle && throttle > 0.1) {
        speed = Math.max(speed - 0.005, CONFIG.maxSpeed * throttle); 
    }
    
    if(throttle < 0.05 && speed > 0) speed -= 0.002; // Natural air friction/coasting
    speed = Math.max(0, Math.min(speed, CONFIG.maxSpeed));
    worldDistance += speed;
    bgX = (worldDistance * CONFIG.scrollingMultiplier);
    wheelRotation += speed * 0.45;

    // 🚆 OPPOSITE TRAFFIC
    if(!oppTrain && Math.random() < 0.003 && speed > 5) oppTrain = { x: canvas.width + 1000, speed: 18, coachCount: 15 };
    if(oppTrain) {
        oppTrain.x -= (speed + oppTrain.speed);
        if(oppTrain.x < -8000) oppTrain = null;
    }

    coachOffsets.forEach((_, i) => coachOffsets[i] = Math.sin(Date.now()/(130 + i*15)) * (speed * 0.45));
    
    // 🔊 AUDIO ENGINE
    if(audioStarted && locoAudio) {
        let atStation = isAtStation(worldDistance);
        if(atStation && speed > 0.1 && speed < 5) {
            if(!window.hummingActive) { window.hummingActive = true; window.hummStartTime = Date.now(); locoAudio.currentTime = 0; locoAudio.play(); }
            let elapsed = (Date.now() - window.hummStartTime) / 1000;
            if(elapsed < 5) locoAudio.volume = Math.min(0.45, (5 - elapsed) / 5);
            else { locoAudio.volume = 0; if(!locoAudio.paused) locoAudio.pause(); }
        } else if (speed === 0 || speed >= 5 || !atStation) {
            window.hummingActive = false; locoAudio.volume = 0; if(!locoAudio.paused) locoAudio.pause();
        }
        
        // Crowd Proximity Audio
        let nearestDist = 999999;
        stations.forEach(s => { let d = Math.abs(worldDistance - s.x); if(d < nearestDist) nearestDist = d; });
        if(nearestDist < 4000 && crowdAudio) {
            let targetVol = 1.0 - (nearestDist / 4000);
            crowdAudio.volume = Math.max(0, Math.min(1, targetVol));
            if(crowdAudio.paused) crowdAudio.play().catch(()=>{});
        } else if (crowdAudio) {
            crowdAudio.volume = 0;
            if(!crowdAudio.paused) crowdAudio.pause();
        }
    }

    // 🏔️ ASSET UPDATE
    mountains.forEach(m => { m.x -= speed * 0.12; if(m.x < -2000) m.x = canvas.width + 1000; });
    trees.forEach((t, i) => { t.x -= speed * (t.layer === 0 ? 6.5 : t.layer === 1 ? 4.8 : 2.2); if(t.x < -1500) trees.splice(i,1); });
    if(Math.random() < 0.2) spawnTreeLayered();
    // Unified Background Velocity (Locked at 0.72 to match 4.8 * 0.15 parallax)
    clouds.forEach(c => { c.x -= speed * 0.72; if(c.x < -600) c.x = canvas.width + 600; });

    // 🔥 DYNAMIC PARTICLE PHYSICS
    if (throttle > 0.7 && speed > 2 && Math.random() < 0.2) {
        // Pantograph blue/white sparks
        particles.push({x: CONFIG.trainX + 380, y: CONFIG.trackY - 325 - Math.random()*10, vx: -speed*0.5 - Math.random()*2, vy: (Math.random()-0.5)*2, type: 'spark', a: 1.0, c: '#aaddff'});
    }
    if (brake > 0.5 && speed > 3) {
        // High friction brake sparks at the front wheels
        for(let z=0; z<3; z++) {
            particles.push({x: CONFIG.trainX + 80 + Math.random()*20, y: CONFIG.trackY - 10, vx: -speed*1.2 - Math.random()*5, vy: -Math.random()*4, type: 'fire', a: 1.0, c: Math.random() > 0.5 ? '#ff5500' : '#ff9900'});
        }
    }
    particles.forEach((p, i) => {
        p.x += p.vx; p.y += p.vy;
        if(p.type === 'spark') { p.a -= 0.05; }
        if(p.type === 'fire') { p.a -= 0.08; p.vy += 0.2; } // gravity
        if(p.a <= 0) particles.splice(i, 1);
    });

    // 🚦 ALP SIGNAL CALLOUTS (CLIENT SPEC 3/9)
    let msg = isWaitingForStarter ? "🔴 Waiting for signal" : "🟢 Starter signal green";
    signals.forEach(s => {
        let dist = s.x - worldDistance;
        if(dist > 0 && dist < 1200) {
            if(s.aspect === 'YELLOW') msg = "🟡 Distant yellow – caution";
            if(s.aspect === 'DOUBLE_YELLOW') msg = "🟡🟡 Distant double yellow";
            if(s.aspect === 'RED' && !isWaitingForStarter) msg = "🔴 Home Signal - Danger";
        }
    });
    stations.forEach(s => {
        let dist = s.x - worldDistance;
        if(dist > 0 && dist < 1500) msg = `📢 Entering ${s.name}`;
    });
    if(msg !== lastAlpMsg) {
        lastAlpMsg = msg;
        document.getElementById('signal-callout').innerText = msg;
        if(audioStarted) speakALP(msg.replace(/🔴|🟡|🟢|🟡🟡|📢 /g, ''));
    }
}

function draw() {
    ctx.save();
    let skyBrightRaw = Math.abs(500 - timeOfDay) / 5;
    let distKM = worldDistance / 1000;
    
    // Day/Night & Sunset Logic
    let isSunset = skyBrightRaw < 50 && skyBrightRaw > 25;
    let isNight = skyBrightRaw <= 25;
    let starOp = isNight ? 1 : (isSunset ? 0.3 : 0);
    
    let skyGrd = ctx.createLinearGradient(0,0,0,CONFIG.trackY);
    if(isSunset) {
        skyGrd.addColorStop(0, '#2c3e50'); // Deep sunset blue
        skyGrd.addColorStop(0.5, '#e67e22'); // Orange horizon
        skyGrd.addColorStop(1, '#f39c12'); // Gold
    } else {
        // Vibrant Sky Blue to match assets
        skyGrd.addColorStop(0, `hsl(210, 80%, ${skyBrightRaw * (isRaining ? 0.6 : 1)}%)`); 
        skyGrd.addColorStop(1, `hsl(200, 90%, ${skyBrightRaw * (isRaining ? 0.6 : 1) + 20}%)`);
    }
    ctx.fillStyle = skyGrd; ctx.fillRect(0, 0, canvas.width, canvas.height);

    // (Celestial bodies moved to after sky parallax for depth correction)

    // Parallax Layer 1: Unified Sky (Locked to ground velocity for "One Physical Structure" feel)
    if(imgSky.complete && imgSky.width > 0) {
        let skyFactor = 0.15; // 🔗 LOCKED to mountain/city speed
        let skyOff = (bgX * skyFactor) % imgSky.width;
        ctx.globalAlpha = isNight ? 0.3 : (isSunset ? 0.8 : 1.0);
        
        // Robust Tiling Loop (INCREASED 20px overlap to kill all seams on high-res)
        let startX = -skyOff;
        let tW = Math.ceil(imgSky.width);
        while(startX < canvas.width) {
            ctx.drawImage(imgSky, startX, 0, tW + 20, canvas.height); // Full height for solid cushion
            startX += tW;
        }
        ctx.globalAlpha = 1.0;
    }

    // 🌙 CELESTIAL REALITY ENGINE (Stars & Volumetric Moon)
    if (starOp > 0) {
        const moonX = canvas.width - 300;
        const moonY = 180;
        const moonRad = 50;

        // 1. Stars (Blinking background)
        ctx.fillStyle = 'rgba(255, 255, 255, 1)';
        stars.forEach(s => {
            ctx.beginPath(); ctx.globalAlpha = s.a * starOp; ctx.arc(s.x, s.y, s.s, 0, Math.PI*2); ctx.fill();
        });

        // 2. Volumetric Moon (Radial Glow Halo)
        let haloGrd = ctx.createRadialGradient(moonX, moonY, 0, moonX, moonY, moonRad * 3);
        haloGrd.addColorStop(0, `rgba(255, 255, 240, ${starOp})`);
        haloGrd.addColorStop(0.2, `rgba(255, 250, 200, ${starOp * 0.8})`);
        haloGrd.addColorStop(0.5, `rgba(255, 255, 255, ${starOp * 0.3})`);
        haloGrd.addColorStop(1, 'rgba(255, 255, 255, 0)');
        
        ctx.globalAlpha = 1.0;
        ctx.fillStyle = haloGrd;
        ctx.beginPath(); ctx.arc(moonX, moonY, moonRad * 3, 0, Math.PI*2); ctx.fill();

        // Solid Moon Core
        ctx.fillStyle = `rgba(255, 255, 230, ${starOp})`;
        ctx.beginPath(); ctx.arc(moonX, moonY, moonRad, 0, Math.PI*2); ctx.fill();
    }

    clouds.forEach(c => {
        let moonX = canvas.width - 300, moonY = 180;
        let distToMoon = Math.sqrt(Math.pow(c.x - moonX, 2) + Math.pow(c.y - moonY, 2));
        let isNearMoon = distToMoon < 400;

        let baseAlpha = c.op * 2.5;
        if (isNearMoon && isNight) baseAlpha *= 1.5; // Silver lining glow

        let cColor;
        if (isNight) cColor = isNearMoon ? `rgba(220, 220, 255, ${baseAlpha})` : `rgba(80, 80, 95, ${baseAlpha})`;
        else if (isSunset) cColor = `rgba(255, 200, 150, ${baseAlpha})`;
        else cColor = `rgba(240, 248, 255, ${baseAlpha})`;

        for(let j=0; j<5; j++) {
            let cx = c.x + (j-2)*(c.sz/4);
            let cy = c.y + Math.sin(j)*15;
            let rad = c.sz/2;
            
            let grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
            grd.addColorStop(0, cColor);
            grd.addColorStop(0.7, cColor);
            grd.addColorStop(1, 'rgba(255, 255, 255, 0)');
            
            ctx.globalAlpha = 1.0;
            ctx.fillStyle = grd;
            ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI*2); ctx.fill();
        }
    });

    // Parallax Layer 2: Biome Mountains/City
    let currentParallax = distKM > 100 ? imgCity : imgMountains;
    if(currentParallax && currentParallax.complete && currentParallax.width > 0) {
        // --- UNIFIED ATMOSPHERE ENGINE (Atmospheric Fusion) ---
        let cutY = currentParallax.height * 0.45;
        let sH = currentParallax.height - cutY;
        let pW = Math.max(canvas.width * 1.5, 1200); 
        let worldMultiplier = 0.15;
        let pOff = (bgX * worldMultiplier) % pW;
        let destH = canvas.height * 0.65; // 🏔️ MAJESTIC ELEVATION (Panoramic Scale)
        let horizonY = CONFIG.trackY - destH + 20;

        // 🌫️ 1. HORIZON HAZE BRIDGE (Infinite extension - No Edges)
        let hazeGrd = ctx.createLinearGradient(0, 0, 0, horizonY + 150);
        hazeGrd.addColorStop(0, 'rgba(0,0,0,0)');
        hazeGrd.addColorStop(0.3, 'rgba(0,0,0,0)');
        hazeGrd.addColorStop(0.7, `hsla(200, 90%, ${skyBrightRaw + 10}%, 0.3)`); 
        hazeGrd.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = hazeGrd; ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.save();
        // 🎨 2. DYNAMIC HUE-MATCHING (Color Sync)
        if(isNight) ctx.filter = 'brightness(35%) contrast(110%) hue-rotate(10deg)';
        else if(isSunset) ctx.filter = 'brightness(75%) sepia(50%) saturate(140%) hue-rotate(-15deg)';
        else ctx.filter = 'brightness(68%) contrast(90%) saturate(80%) sepia(20%) hue-rotate(-5deg)';

        // ⛰️ 3. TILING WITH EDGE FEATHERING
        let mountainX = -pOff;
        let tileWidth = Math.ceil(pW);
        while(mountainX < canvas.width) {
            // Draw mountain tile
            ctx.drawImage(currentParallax, 0, cutY, currentParallax.width, sH, mountainX, horizonY - 1, tileWidth + 20, destH + 2);
            
            // Subtle Peak Softener (Feathers the very top edge of the tile)
            let peakSoftGrd = ctx.createLinearGradient(0, horizonY, 0, horizonY + 40);
            peakSoftGrd.addColorStop(0, `hsla(200, 90%, ${skyBrightRaw + 20}%, 0.2)`);
            peakSoftGrd.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = peakSoftGrd; ctx.fillRect(mountainX, horizonY, tileWidth + 20, 40);
            
            mountainX += tileWidth;
        }
        ctx.restore();

        // 🌟 4. RIM LIGHTING BLOOM (Light Bleed over peaks)
        ctx.globalCompositeOperation = 'lighter';
        let bloomGrd = ctx.createLinearGradient(0, horizonY - 40, 0, horizonY + 20);
        bloomGrd.addColorStop(0, isSunset ? 'rgba(255, 120, 0, 0.35)' : 'rgba(180, 220, 255, 0.45)');
        bloomGrd.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = bloomGrd; 
        ctx.fillRect(0, horizonY - 40, canvas.width, 60);
        ctx.globalCompositeOperation = 'source-over';

        // 🌫️ 5. TOP-EDGE FEATHER (Erasing the sharp cutout line)
        let featherGrd = ctx.createLinearGradient(0, horizonY, 0, horizonY + 45);
        featherGrd.addColorStop(0, isSunset ? 'rgba(200, 100, 50, 0.2)' : 'rgba(200, 230, 255, 0.25)');
        featherGrd.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = featherGrd; ctx.fillRect(0, horizonY, canvas.width, 45);

        // ⚓ 6. GROUND ANCHORING
        let anchorGrd = ctx.createLinearGradient(0, CONFIG.trackY - 100, 0, CONFIG.trackY);
        anchorGrd.addColorStop(0, 'rgba(0,0,0,0)');
        anchorGrd.addColorStop(1, 'rgba(0,0,0,0.6)');
        ctx.fillStyle = anchorGrd; ctx.fillRect(0, CONFIG.trackY-100, canvas.width, 100);

        if(distKM > 100 && isNight) {
            ctx.fillStyle = 'rgba(255,200,100,0.8)';
            let winOff = (bgX * worldMultiplier) % pW;
            let winX = -winOff;
            while(winX < canvas.width) {
                for(let w=0; w<20; w++) {
                    ctx.fillRect( winX + (w*150)%pW, horizonY + 60 + Math.random()*150, 4, 4 );
                }
                winX += pW;
            }
        }
    }

    trees.filter(t => t.layer === 2).forEach(drawTree);

    let staticBridgeX = (worldDistance < 100000) ? 50000 : 150000;
    const bridgeRelativeX = staticBridgeX - worldDistance + (canvas.width / 2);
    if(bridgeRelativeX > -8000 && bridgeRelativeX < canvas.width + 8000) drawMegaBridge(bridgeRelativeX - 4000, 8000);
    else { ctx.fillStyle = '#1a221a'; ctx.fillRect(0, CONFIG.trackY, canvas.width, canvas.height - CONFIG.trackY); }

    drawOHELines();
    drawSignals4Aspect();
    drawMainTrack();
    trees.filter(t => t.layer === 1).forEach(drawTree);
    stations.forEach(s => {
        let sx = s.x - worldDistance + (canvas.width / 2);
        if(sx > -6000 && sx < canvas.width + 6000) drawStationProcedural(sx, s.name);
    });

    if(oppTrain) drawOppositeTrain(oppTrain);
    trees.filter(t => t.layer === 0).forEach(drawTree); 
    drawRestoredTrain();

    // 🌳 FOREGROUND GROUNDING: Lowered to clear train bogies (Adaptive Offset)
    let foreOffset = (canvas.height < 500) ? 60 : 40; 
    drawForegroundGrass(foreOffset);
    
    // Render Particles (Sparks & Smoke)
    particles.forEach(p => {
        ctx.fillStyle = p.c;
        ctx.globalAlpha = p.a;
        if(p.type === 'spark') {
            ctx.beginPath(); ctx.arc(p.x, p.y, Math.random()*3 + 1, 0, Math.PI*2); ctx.fill();
        } else if(p.type === 'fire') {
            ctx.fillRect(p.x, p.y, 4, 4);
        }
    });
    ctx.globalAlpha = 1.0;

    if(rainAlpha > 0) {
        rainDrops.forEach(d => {
            d.y += d.s; d.x -= speed; if(d.y > canvas.height) d.y = -20; if(d.x < 0) d.x = canvas.width;
            
            // Illuminating rain in the headlight cone
            let isIlluminated = lampsOn && d.x > CONFIG.trainX + 500 && d.y > CONFIG.trackY - 200 && d.y < CONFIG.trackY + 300;
            ctx.strokeStyle = isIlluminated ? `rgba(255, 255, 100, ${rainAlpha})` : `rgba(200, 220, 255, ${rainAlpha * 0.5})`;
            ctx.lineWidth = isIlluminated ? 2 : 1;
            
            ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d.x-5, d.y+15); ctx.stroke();
        });
    }

    // Foreground High-Speed Overlay (Lowered to clear train wheels)
    foregroundObjects.forEach(f => {
        if(f.isPole) {
            ctx.fillStyle = '#222'; ctx.fillRect(f.x, CONFIG.trackY + 10, 20, canvas.height);
            ctx.fillStyle = '#ff3333'; ctx.fillRect(f.x - 5, CONFIG.trackY + 20, 30, 30);
        } else {
            ctx.fillStyle = '#0f2f0f'; ctx.beginPath(); ctx.arc(f.x, canvas.height + 40, 100, 0, Math.PI*2); ctx.fill();
        }
    });

    // Dark Tunnel Overlay
    if(tunnelAlpha > 0) {
        ctx.fillStyle = `rgba(5, 5, 8, ${tunnelAlpha})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        if(lampsOn) {
            ctx.globalCompositeOperation = 'destination-out';
            let lGrd = ctx.createRadialGradient(CONFIG.trainX + 450, CONFIG.trackY - 60, 20, CONFIG.trainX + 1500, CONFIG.trackY - 60, 700);
            lGrd.addColorStop(0, `rgba(255, 255, 255, ${tunnelAlpha})`);
            lGrd.addColorStop(1, 'rgba(255, 255, 255, 0)');
            ctx.fillStyle = lGrd;
            ctx.beginPath();
            ctx.moveTo(CONFIG.trainX + 450, CONFIG.trackY - 60);
            ctx.lineTo(CONFIG.trainX + 2500, CONFIG.trackY - 500);
            ctx.lineTo(CONFIG.trainX + 2500, CONFIG.trackY + 500);
            ctx.fill();
            ctx.globalCompositeOperation = 'source-over';
        }
    }

    ctx.restore();
}

function drawSignals4Aspect() {
    signals.forEach(s => {
        let sx = s.x - worldDistance + (canvas.width / 2);
        if(sx > -100 && sx < canvas.width + 100) {
            ctx.fillStyle = '#222'; ctx.fillRect(sx, CONFIG.trackY-sc(350), sc(12), sc(350)); 
            ctx.fillStyle = '#111'; ctx.fillRect(sx-sc(15), CONFIG.trackY-sc(350), sc(42), sc(110));
            
            // Adaptive Wire Height (PC: ~300. Mobile: ~200)
            let wireY = (canvas.height < 500) ? CONFIG.trackY - sc(200) : CONFIG.trackY - sc(325);
            
            const drawAspect = (yOff, color, active) => {
                ctx.fillStyle = active ? color : '#333';
                ctx.beginPath(); ctx.arc(sx+sc(6), wireY - sc(10) + sc(yOff), sc(10), 0, Math.PI*2); ctx.fill();
                if(active) { ctx.shadowBlur = 15; ctx.shadowColor = color; ctx.stroke(); ctx.shadowBlur = 0; }
            };
            drawAspect(0, '#0f0', s.aspect === 'GREEN'); 
            drawAspect(25, '#ff0', s.aspect === 'DOUBLE_YELLOW' || s.aspect === 'YELLOW'); 
            drawAspect(50, '#ff0', s.aspect === 'DOUBLE_YELLOW'); 
            drawAspect(75, '#f00', s.aspect === 'RED');
        }
    });
}

function drawSpeedometerUI() {
    if(!sctx) return;
    const cx = 60;
    const cy = 60;

    sctx.clearRect(0, 0, 120, 120);

    // circle
    sctx.strokeStyle = "#00ff88";
    sctx.lineWidth = 4;
    sctx.beginPath();
    sctx.arc(cx, cy, 50, 0, Math.PI * 2);
    sctx.stroke();

    // needle
    let displaySpeed = speed * 11;
    let angle = (displaySpeed / 160) * Math.PI;
    sctx.strokeStyle = "#00ff88";
    sctx.beginPath();
    sctx.moveTo(cx, cy);
    sctx.lineTo(
        cx + Math.cos(angle - Math.PI / 2) * 40,
        cy + Math.sin(angle - Math.PI / 2) * 40
    );
    sctx.stroke();

    // 🔥 SPEED TEXT (BOTTOM — FIXED)
    sctx.fillStyle = "#00ffcc";
    sctx.font = "bold 14px Arial";
    sctx.textAlign = "center";

    sctx.fillText(Math.floor(displaySpeed), cx, cy + 25); // bottom position
    sctx.font = "10px Arial";
    sctx.fillText("KM/H", cx, cy + 40);
}

function drawRestoredTrain() {
    // 📐 ABSOLUTE GROUNDING
    let y = CONFIG.trackY - sc(94); 
    // 🔗 COUPLER & CORRIDOR LOGIC
    for(let i=1; i<=4; i++) {
        let cx = CONFIG.trainX - (i * sc(440));
        drawLHBProcedural(cx, y + coachOffsets[i-1]);
        drawCoupling(cx + sc(400), y + sc(60)); 
    }
    drawWAP7Procedural(CONFIG.trainX, y + coachOffsets[0]);
    drawCoupling(CONFIG.trainX - sc(35), y + sc(65), true); 
}

function drawCoupling(x, y, isEngine = false) {
    ctx.fillStyle = '#111';
    if(isEngine) {
        ctx.fillRect(x, y, sc(35), sc(15)); 
    } else {
        ctx.fillStyle = '#444'; ctx.fillRect(x, y - sc(45), sc(40), sc(75)); 
        ctx.fillStyle = '#111'; ctx.fillRect(x, y, sc(40), sc(10)); 
    }
}

function drawOppositeTrain(train) {
    ctx.save();
    let y = CONFIG.trackY + 120;
    ctx.fillStyle = '#333'; ctx.fillRect(train.x, y - 90, 500, 90); 
    ctx.fillStyle = '#444'; for(let i=1; i<=train.coachCount; i++) ctx.fillRect(train.x + (i*420), y - 80, 400, 80);
    ctx.restore();
}

function drawWAP7Procedural(x, y) {
    const W = sc(520), H = sc(85); 
    drawBogie(x + sc(80), y + H - sc(15)); drawBogie(x + sc(340), y + H - sc(15));
    
    // Draw Pantograph Framework
    ctx.strokeStyle = '#444'; ctx.lineWidth = sc(4);
    
    // Adaptive Wire Connectivity (Same Logic as Signals)
    let wireHeight = (canvas.height < 500) ? CONFIG.trackY - sc(200) : CONFIG.trackY - sc(325);
    let px = x + sc(380), py = y, pHeight = Math.abs(py - wireHeight); 
    let shudder = (speed > 5) ? (Math.random() * 4 - 2) : 0;
    
    ctx.beginPath(); 
    ctx.moveTo(px-sc(10), py); ctx.lineTo((px-sc(40))+shudder, py-pHeight/2); 
    ctx.lineTo(px+shudder, py-pHeight); 
    ctx.moveTo((px-sc(40))+shudder, py-pHeight/2); ctx.lineTo((px+sc(20))+shudder, py-pHeight/2); 
    ctx.stroke();
    // Contact bar on wire
    ctx.fillStyle = '#222'; ctx.fillRect(px-sc(30)+shudder, py-pHeight-sc(5), sc(60), sc(8));
    ctx.fillStyle = '#e74c3c'; ctx.beginPath(); ctx.arc(px, py-sc(2), sc(8), 0, Math.PI*2); ctx.fill(); // Base Insulator

    // Main Engine Body Background Gradient
    let bodyGrd = ctx.createLinearGradient(0, y, 0, y + H);
    bodyGrd.addColorStop(0, '#e74c3c');   // Highlights
    bodyGrd.addColorStop(0.3, '#c0392b'); // Base Red
    bodyGrd.addColorStop(1, '#641e16');   // Shadow bottom
    
    ctx.fillStyle = bodyGrd;
    ctx.beginPath();
    ctx.moveTo(x + 50, y + 5); 
    ctx.lineTo(x + W - 30, y + 5); 
    ctx.bezierCurveTo(x + W + 10, y + 5, x + W + 30, y + 30, x + W + 30, y + H - 15); 
    ctx.lineTo(x + W + 30, y + H); 
    ctx.lineTo(x - 30, y + H); 
    ctx.lineTo(x - 30, y + H - 15); 
    ctx.bezierCurveTo(x - 30, y + 30, x - 10, y + 5, x + 50, y + 5); 
    ctx.fill();

    // The white stripe with metallic gradient
    let stripeGrd = ctx.createLinearGradient(0, y + 42, 0, y + 60);
    stripeGrd.addColorStop(0, '#ffffff'); stripeGrd.addColorStop(1, '#95a5a6');
    ctx.fillStyle = stripeGrd; 
    ctx.fillRect(x - 30, y + 42, W + 58, 18);
    
    // Advanced Louvers / Vents on the stripe
    ctx.fillStyle = '#2c3e50';
    for(let i=0; i<6; i++) {
        let lx = x + 30 + (i * 65);
        ctx.fillRect(lx, y + 45, 40, 12); // Vent background
        ctx.fillStyle = '#111';
        for(let j=0; j<8; j++) ctx.fillRect(lx + j*5, y + 45, 2, 12); // Grills
        ctx.fillStyle = '#2c3e50';
    }

    // Cab Windows (Driver Seat)
    let cabGrd = ctx.createLinearGradient(x + W - 10, y + 10, x + W + 25, y + 40);
    cabGrd.addColorStop(0, '#111'); cabGrd.addColorStop(0.5, '#2980b9'); cabGrd.addColorStop(1, '#111');
    ctx.fillStyle = cabGrd;
    ctx.beginPath();
    ctx.moveTo(x + W - 5, y + 10); ctx.lineTo(x + W + 15, y + 10);
    ctx.lineTo(x + W + 22, y + 40); ctx.lineTo(x + W - 10, y + 40);
    ctx.fill();
    ctx.strokeStyle = '#ecf0f1'; ctx.lineWidth = 2; ctx.stroke(); // Window frame

    // Secondary Cab (Rear)
    ctx.fill(); ctx.beginPath(); ctx.moveTo(x + 5, y + 10); ctx.lineTo(x - 15, y + 10); ctx.lineTo(x - 22, y + 40); ctx.lineTo(x + 10, y + 40); ctx.fill(); ctx.stroke();

    // Roof equipment (Insulators & equipment boxes)
    ctx.fillStyle = '#bdc3c7'; ctx.fillRect(x+100, y-5, 60, 10); ctx.fillRect(x+210, y-5, 80, 10);
    ctx.fillStyle = '#8e44ad'; ctx.fillRect(x+115, y-10, 10, 15); ctx.fillRect(x+135, y-10, 10, 15);
    ctx.fillStyle = '#2c3e50'; ctx.beginPath(); ctx.arc(x+250, y+5, 12, 0, Math.PI, true); ctx.fill();

    // Typography & Logos
    ctx.fillStyle = 'white'; ctx.font = 'bold 18px Arial'; ctx.textAlign = 'center';
    ctx.fillText("भारतीय रेल", x + W/2, y + 25);
    ctx.fillStyle = '#f1c40f'; ctx.font = 'bold 14px Arial';
    ctx.fillText("WAP-7  30602", x + W/2, y + 38);

    // Dynamic Headlight Casing
    ctx.fillStyle = lampsOn ? '#ffffe0' : '#7f8c8d';
    ctx.beginPath(); ctx.arc(x + W + 28, y + 48, 6, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = '#333'; ctx.lineWidth = 2; ctx.stroke();
    
    // Headlights Cone Array
    if(lampsOn) {
        let lGrd = ctx.createLinearGradient(x + W + 30, y + 48, x + W + 1200, y + 48);
        lGrd.addColorStop(0, 'rgba(255, 255, 180, 0.8)');
        lGrd.addColorStop(1, 'rgba(255, 255, 180, 0.0)');
        ctx.fillStyle = lGrd;
        ctx.beginPath(); ctx.moveTo(x+W+30, y+48); ctx.lineTo(x+W+1200, y-200); ctx.lineTo(x+W+1200, y+400); ctx.fill();
    }
}

function drawLHBProcedural(x, y) {
    const W = sc(400), H = sc(85); 
    drawBogie(x + sc(40), y + H - sc(12)); drawBogie(x + sc(260), y + H - sc(12));
    
    // Rajdhani Red Scheme with Gradients
    let redGrd = ctx.createLinearGradient(0, y, 0, y + H/2);
    redGrd.addColorStop(0, '#e74c3c'); redGrd.addColorStop(1, '#922b21');
    ctx.fillStyle = redGrd; ctx.fillRect(x, y, W, H/2); 
    
    let greyGrd = ctx.createLinearGradient(0, y + H/2, 0, y + H);
    greyGrd.addColorStop(0, '#bdc3c7'); greyGrd.addColorStop(1, '#566573');
    ctx.fillStyle = greyGrd; ctx.fillRect(x, y + H/2, W, H/2); 
    
    // Corrugated Roof Lines
    ctx.strokeStyle = '#b30000'; ctx.lineWidth = 1;
    for(let r=0; r<W; r+=sc(8)) {
        ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + r, y + sc(6)); ctx.stroke();
    }
    
    // Doors
    ctx.fillStyle = '#a93226'; ctx.fillRect(x + sc(5), y + sc(8), sc(35), H - sc(16)); 
    ctx.fillRect(x + W - sc(40), y + sc(8), sc(35), H - sc(16)); 
    
    // Door yellow Grab-rails
    ctx.fillStyle = '#f1c40f';
    ctx.fillRect(x + sc(4), y + sc(16), sc(2), sc(45)); ctx.fillRect(x + sc(40), y + sc(16), sc(2), sc(45));
    ctx.fillRect(x + W - sc(41), y + sc(16), sc(2), sc(45)); ctx.fillRect(x + W - sc(5), y + sc(16), sc(2), sc(45));

    // Advanced Tinted Windows
    for(let i=0; i<8; i++) {
        let wx = x + 60 + i * 38;
        // Outer Rubber Seal
        ctx.fillStyle = '#111'; ctx.fillRect(wx, y + 12, 28, 38); 
        // Gradient Blue Glass
        let wGrd = ctx.createLinearGradient(wx, y+15, wx+22, y+47);
        wGrd.addColorStop(0, 'rgba(41, 128, 185, 0.9)'); wGrd.addColorStop(1, 'rgba(21, 67, 96, 0.95)');
        ctx.fillStyle = wGrd; ctx.fillRect(wx + 3, y + 15, 22, 32); 
        // Diagonal glass glare
        ctx.fillStyle = 'rgba(255, 255, 255, 0.15)'; 
        ctx.beginPath(); ctx.moveTo(wx+3, y+15); ctx.lineTo(wx+25, y+15); ctx.lineTo(wx+3, y+47); ctx.fill();
    }

    // Typography
    ctx.fillStyle = 'white'; ctx.font = 'bold 12px Arial'; ctx.textAlign = 'center';
    ctx.fillText("INDIAN RAILWAYS", x + W/2, y + 10);
    
    // Inter-coach Connections (Rubber vestibules)
    ctx.fillStyle = '#111'; ctx.fillRect(x - 5, y + 10, 5, H - 20); ctx.fillRect(x + W, y + 10, 5, H - 20);
    ctx.fillStyle = '#f1c40f'; ctx.fillRect(x, y, 3, H); ctx.fillRect(x + W - 3, y, 3, H);
}

function drawBogie(x, y) { 
    // Bogie Frame Highlights
    ctx.fillStyle = '#34495e'; ctx.fillRect(x, y-sc(2), sc(130), sc(8)); // Top Frame
    ctx.fillStyle = '#111'; ctx.fillRect(x+sc(10), y + sc(2), sc(110), sc(28)); // Main block
    
    // Central Suspension Coil Spring
    ctx.fillStyle = '#f1c40f';
    for(let s=0; s<4; s++) { ctx.fillRect(x+sc(55), y+sc(6)+(s*sc(5)), sc(20), sc(4)); }
    
    // Heavy Traction Motors (boxes between wheels)
    ctx.fillStyle = '#2c3e50'; ctx.fillRect(x+sc(25), y+sc(6), sc(30), sc(18)); ctx.fillRect(x+sc(75), y+sc(6), sc(30), sc(18));

    drawWheel(x + sc(25), y + sc(24)); drawWheel(x + sc(105), y + sc(24)); 
}

function drawWheel(x, y) { 
    ctx.save(); ctx.translate(x, y); ctx.rotate(wheelRotation); 
    // Outer Steel Flange
    ctx.fillStyle = '#95a5a6'; ctx.beginPath(); ctx.arc(0, 0, sc(20), 0, Math.PI*2); ctx.fill(); 
    // Inner Dark Rim
    ctx.fillStyle = '#2c3e50'; ctx.beginPath(); ctx.arc(0, 0, sc(17), 0, Math.PI*2); ctx.fill(); 
    // Wheel Axle Core
    ctx.fillStyle = '#7f8c8d'; ctx.beginPath(); ctx.arc(0, 0, sc(6), 0, Math.PI*2); ctx.fill(); 
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(0, 0, sc(3), 0, Math.PI*2); ctx.fill(); 
    
    // Spoke/Movement indicators
    ctx.fillStyle = '#bdc3c7'; ctx.fillRect(-sc(2), -sc(15), sc(4), sc(30)); ctx.fillRect(-sc(15), -sc(2), sc(30), sc(4));
    ctx.restore(); 
    
    // Static Brake Pads (do not rotate)
    ctx.fillStyle = '#d35400'; ctx.fillRect(x - sc(22), y - sc(5), sc(6), sc(12)); 
    ctx.fillRect(x + sc(16), y - sc(5), sc(6), sc(12)); 
}

function drawTree(t) {
    let wind = Math.sin(Date.now()/1000 + t.sway) * 16;
    let treeY = CONFIG.trackY - 20 + (t.layer === 0 ? 15 : t.layer === 1 ? 5 : 0);
    let trunkH = (t.h * 0.4) / (t.isPalm ? 2.5 : 4);
    ctx.fillStyle = '#2b1d0e'; ctx.fillRect(t.x + (t.isPalm ? 20 : 10), treeY, t.isPalm?10:20, -trunkH);
    if(t.isPalm) {
        ctx.fillStyle = '#0a1d0a'; ctx.save(); ctx.translate(t.x + 25, treeY - trunkH);
        for(let i=0; i<8; i++) { ctx.rotate(Math.PI/4); ctx.beginPath(); ctx.ellipse(40+wind, 0, 85, 22, 0, 0, Math.PI*2); ctx.fill(); }
        ctx.restore();
    } else {
        ctx.fillStyle = '#061606'; let fx = t.x + 20 + wind, fy = treeY - trunkH;
        ctx.beginPath(); ctx.arc(fx, fy-40, 95, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(fx-40, fy, 75, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(fx+40, fy, 75, 0, Math.PI*2); ctx.fill();
    }
}

function drawStationProcedural(x, name) {
    const pW = sc(7500); 
    
    // Better 3D Platform Roof
    let roofGrd = ctx.createLinearGradient(0, CONFIG.trackY-sc(450), 0, CONFIG.trackY-sc(300));
    roofGrd.addColorStop(0, '#5a1f1f');
    roofGrd.addColorStop(1, '#8b2e2e');
    ctx.fillStyle = roofGrd;
    ctx.fillRect(x - pW/2, CONFIG.trackY-sc(450), pW, sc(150));
    ctx.fillStyle = '#3a1313'; // Roof edge
    ctx.fillRect(x - pW/2, CONFIG.trackY-sc(300), pW, sc(10));
    
    const hindiNames = { "KOLLAM JCT": "कोल्लम जंक्शन", "PARAVUR": "परवूर", "VARKALA SIVAGIRI": "वरकला शिवगिरि", "KADAKKAVUR": "कडक्कावूर", "CHIRAYINKEEZHU": "चिरायिनकीझु", "TRIVANDRUM CENTRAL": "तिरुवनंतपुरम सेंट्रल" };
    const hindiName = hindiNames[name] || "";

    for(let k=0; k<20; k++) {
        let sx = x - pW/2.5 + (k * sc(400));
        
        // Steel Pillars
        ctx.fillStyle = '#7f8c8d'; 
        ctx.fillRect(sx, CONFIG.trackY-sc(300), sc(15), sc(272)); 
        
        // Digital LED indicators hanging from roof
        if (k % 2 === 0) {
            ctx.fillStyle = '#111'; ctx.fillRect(sx - sc(40), CONFIG.trackY-sc(280), sc(100), sc(30));
            ctx.fillStyle = '#ff3333'; ctx.font = `bold ${sc(12)}px monospace`; ctx.fillText('ETA 05 MIN', sx + sc(10), CONFIG.trackY-sc(260));
        }
        
        // Authentic Station Display Board
        if (k % 5 === 1) {
            ctx.fillStyle = '#111'; ctx.fillRect(sx + sc(10), CONFIG.trackY-sc(200), sc(10), sc(100)); // Posts
            ctx.fillRect(sx + sc(180), CONFIG.trackY-sc(200), sc(10), sc(100));
            
            ctx.fillStyle = '#ffcc00'; ctx.fillRect(sx, CONFIG.trackY-sc(200), sc(200), sc(80)); // Classic yellow board
            ctx.strokeStyle = '#000'; ctx.lineWidth = sc(4); ctx.strokeRect(sx, CONFIG.trackY-sc(200), sc(200), sc(80));
            
            ctx.fillStyle = '#000'; 
            ctx.textAlign = 'center';
            ctx.font = `bold ${sc(20)}px Arial`; ctx.fillText(name, sx + sc(100), CONFIG.trackY-sc(150)); // English
            ctx.font = `bold ${sc(14)}px Arial`; ctx.fillText(hindiName, sx + sc(100), CONFIG.trackY-sc(175)); // Hindi
        }
        
        // Benches and Stalls
        if (k % 3 === 0) {
            // Purple Bench
            ctx.fillStyle = '#8e44ad'; ctx.fillRect(sx + 50, CONFIG.trackY-60, 60, 30);
            ctx.fillStyle = '#6c3483'; ctx.fillRect(sx + 50, CONFIG.trackY-60, 60, 8);
            // Person on bench
            ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(sx + 80, CONFIG.trackY-75, 10, 0, Math.PI*2); ctx.fill();
            ctx.fillRect(sx + 75, CONFIG.trackY-65, 10, 20);
        } else if (k % 7 === 0) {
            // Small Book Stall (A.H Wheeler style)
            ctx.fillStyle = '#d35400'; ctx.fillRect(sx + 50, CONFIG.trackY-100, 120, 72);
            ctx.fillStyle = '#2c3e50'; ctx.fillRect(sx + 45, CONFIG.trackY-100, 130, 20); // Awning
            ctx.fillStyle = '#ecf0f1'; ctx.font = 'bold 12px Arial'; ctx.fillText('A.H WHEELER', sx + 110, CONFIG.trackY-85);
            ctx.fillStyle = '#f1c40f'; ctx.fillRect(sx + 60, CONFIG.trackY-60, 100, 30); // Counter
        }
    }
    
    // Dynamic Crowd (animated shadow silhouettes based on time)
    ctx.fillStyle = '#1a1a1a';
    for(let j=0; j<80; j++) { 
        let walkOffset = Math.sin((Date.now()/500) + j) * 20; 
        let px = x - pW/2.2 + (j*130) + walkOffset; 
        
        // Head
        ctx.beginPath(); ctx.arc(px, CONFIG.trackY-75, 8, 0, Math.PI*2); ctx.fill(); 
        // Body
        ctx.fillRect(px-8, CONFIG.trackY-67, 16, 28); 
        // Legs (animated swinging)
        let legSwing = Math.sin(Date.now()/200 + j)*6;
        ctx.fillRect(px-4 + legSwing, CONFIG.trackY-39, 4, 15);
        ctx.fillRect(px+2 - legSwing, CONFIG.trackY-39, 4, 15);
    }
}

function drawOHELines() { 
    let poleOffset = bgX % sc(450); 
    let wireY = (canvas.height < 500) ? CONFIG.trackY - sc(200) : CONFIG.trackY - sc(325);
    ctx.lineWidth = sc(3); ctx.strokeStyle = '#4488ff'; ctx.beginPath(); ctx.moveTo(0, wireY); ctx.lineTo(canvas.width, wireY); ctx.stroke();
    for(let i=-sc(450); i<canvas.width+sc(450); i+=sc(450)) { let px = i-poleOffset; ctx.fillStyle = '#222'; ctx.fillRect(px, CONFIG.trackY-sc(370), sc(15), sc(370)); } 
}

function drawMainTrack() { 
    let offset = bgX % sc(40); 
    ctx.fillStyle = "#444"; ctx.fillRect(0, CONFIG.trackY, canvas.width, sc(8)); 
    
    // 💨 MOTION BLUR ENGINE (Sleepers)
    let blurStrength = Math.min(speed * 0.8, sc(15));
    for(let i=-sc(40); i<canvas.width+sc(40); i+=sc(40)) { 
        ctx.fillStyle = "#6b4f3b"; 
        // Draw multiple translucent layers for "motion streak" effect
        if(speed > 2) {
            ctx.globalAlpha = 0.4;
            ctx.fillRect(i-offset-blurStrength, CONFIG.trackY, sc(20)+blurStrength*2, sc(6));
            ctx.globalAlpha = 1.0;
        }
        ctx.fillRect(i-offset, CONFIG.trackY, sc(20), sc(6)); 
    } 
    ctx.fillStyle = "#aaa"; ctx.fillRect(0, CONFIG.trackY - sc(2), canvas.width, sc(2)); 
}
function drawForegroundGrass(yOffset = 40) { 
    let offset = (bgX * 2.5) % sc(400); 
    ctx.fillStyle = '#0a1d0a'; 
    let grassY = canvas.height + sc(yOffset) - sc(120);
    
    // 💨 MOTION BLUR ENGINE (Bushes)
    let blurWidth = speed * sc(5);
    for(let i=-sc(400); i<canvas.width+sc(400); i+=sc(250)) {
        if(speed > 3) {
            ctx.globalAlpha = 0.3;
            ctx.fillRect(i-offset-blurWidth, grassY, sc(80)+blurWidth, sc(80));
            ctx.globalAlpha = 1.0;
        }
        ctx.fillRect(i-offset, grassY, sc(80), sc(80)); 
    }
}

function drawMegaBridge(x, width) {
    ctx.fillStyle = '#002b4d'; ctx.fillRect(0, CONFIG.trackY+10, canvas.width, canvas.height); ctx.save(); ctx.translate(x, 0);
    for(let k=0; k<6; k++) { let hx = 600 + k*1400; ctx.fillStyle = '#4e342e'; ctx.fillRect(hx, CONFIG.trackY+60, 220, 70); ctx.fillStyle = '#d7ccc8'; ctx.fillRect(hx+20, CONFIG.trackY+15, 180, 50); ctx.fillStyle = '#111'; ctx.fillRect(hx+40, CONFIG.trackY+25, 30, 20); }
    for(let i=0; i<Math.floor(width/650); i++) { let px = i*650; ctx.fillStyle = '#1a1a1a'; ctx.fillRect(px, CONFIG.trackY+10, 120, canvas.height); ctx.fillStyle = '#0a0a0a'; ctx.beginPath(); ctx.moveTo(px+120, CONFIG.trackY+10); ctx.quadraticCurveTo(px+380, CONFIG.trackY+220, px+600, CONFIG.trackY+10); ctx.fill(); }
    ctx.strokeStyle = 'rgba(50, 50, 50, 0.7)'; ctx.lineWidth = 6;
    for(let i=0; i<Math.floor(width/900); i++) {
        let tx = i*900; ctx.strokeRect(tx, CONFIG.trackY-480, 900, 480);
        ctx.beginPath(); ctx.moveTo(tx, CONFIG.trackY-480); ctx.lineTo(tx+450, CONFIG.trackY); ctx.lineTo(tx+900, CONFIG.trackY-480); ctx.stroke();
    }
    ctx.restore();
}

window.onload = init;