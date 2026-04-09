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
    scrollingMultiplier: 4.8
};

let canvas, ctx, speed = 0, worldDistance = 0, bgX = 0, throttle = 0, brake = 0;
let clouds = [], hills = [], trees = [], stations = [], signals = [], mountains = [];
let coachOffsets = [];
let timeOfDay = 0, wheelRotation = 0; 
let audioStarted = false, hornAudio, locoAudio, slowTrackAudio, fastTrackAudio, crowdAudio;
let lampsOn = false, lastAlpMsg = "", lastTrackSoundDist = 0;
let oppTrain = null, rainDrops = [], isRaining = false, rainAlpha = 0;
let starterTimer = 7, isWaitingForStarter = true; // 🚦 7-Sec Starter State

function init() {
    canvas = document.getElementById(CONFIG.canvasId);
    ctx = canvas.getContext('2d', { alpha: false });
    resize();
    window.addEventListener('resize', resize);

    hornAudio = new Audio('assets/P5.mp3'); 
    locoAudio = new Audio('assets/humming.mp3'); 
    locoAudio.loop = true;
    slowTrackAudio = new Audio('assets/short.mp3');
    fastTrackAudio = new Audio('assets/long.mp3');

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
    canvas.height = window.innerHeight;
    CONFIG.trackY = canvas.height - 250;
    
    // 📱 PROPORTIONAL AUTO-ZOOM (V151.16)
    // Automatically fits any screen size by scaling the UI wrapper
    const wrapper = document.querySelector('.game-wrapper');
    const baseHeight = 1080; // Ideal height
    const currentHeight = window.innerHeight;
    const scale = Math.min(1, currentHeight / 800); // Only zoom out on small heights
    
    // Apply zoom primarily to the UI elements to keep logic (Canvas) separate
    const cockpit = document.getElementById('cockpit-ui');
    const alpHud = document.getElementById('alp-hud');
    const missionStat = document.getElementById('mission-stat');
    
    if(window.innerWidth < 900) {
        cockpit.style.transform = `scale(${scale})`;
        cockpit.style.transformOrigin = 'bottom left';
        cockpit.style.width = `${100 / scale}%`;
        
        alpHud.style.transform = `scale(${scale * 0.9})`;
        alpHud.style.transformOrigin = 'top left';
    } else {
        cockpit.style.transform = 'none';
        cockpit.style.width = '100%';
        alpHud.style.transform = 'none';
    }
}

function spawnMountain() { mountains.push({ x: Math.random() * canvas.width * 4, sz: 1200 + Math.random() * 800, h: 500 + Math.random() * 400 }); }
function spawnVolumetricCloud(x) { clouds.push({ x, y: Math.random()*250, sz: 200+Math.random()*200, op: 0.05 + Math.random()*0.1, layer: (Math.random()*2)|0 }); }
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

function gameLoop() { update(); draw(); requestAnimationFrame(gameLoop); }

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
    }

    // 🏔️ ASSET UPDATE
    mountains.forEach(m => { m.x -= speed * 0.12; if(m.x < -2000) m.x = canvas.width + 1000; });
    trees.forEach((t, i) => { t.x -= speed * (t.layer === 0 ? 6.5 : t.layer === 1 ? 4.8 : 2.2); if(t.x < -1500) trees.splice(i,1); });
    if(Math.random() < 0.2) spawnTreeLayered();
    clouds.forEach(c => { c.x -= speed * (c.layer === 0 ? 0.05 : 0.15); if(c.x < -600) c.x = canvas.width + 600; });

    document.getElementById('speed-display').innerText = (speed * 11).toFixed(0);

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
    let skyBright = Math.abs(500 - timeOfDay) / 5 * (isRaining ? 0.6 : 1);
    let skyGrd = ctx.createLinearGradient(0,0,0,CONFIG.trackY);
    skyGrd.addColorStop(0, `hsl(210, 45%, ${skyBright}%)`);
    skyGrd.addColorStop(1, `hsl(210, 45%, ${skyBright + 15}%)`);
    ctx.fillStyle = skyGrd; ctx.fillRect(0, 0, canvas.width, canvas.height);

    clouds.forEach(c => {
        ctx.fillStyle = `rgba(255, 255, 255, ${c.op * 2.5})`;
        for(let j=0; j<5; j++) ctx.beginPath(), ctx.arc(c.x + (j-2)*(c.sz/4), c.y + Math.sin(j)*15, c.sz/2, 0, Math.PI*2), ctx.fill();
    });

    mountains.forEach(m => {
        let mGrd = ctx.createLinearGradient(m.x, CONFIG.trackY-m.h, m.x, CONFIG.trackY);
        mGrd.addColorStop(0, '#2d5a27'); mGrd.addColorStop(1, '#1b3022');
        ctx.fillStyle = mGrd; ctx.beginPath(); ctx.moveTo(m.x, CONFIG.trackY); ctx.lineTo(m.x+m.sz/2, CONFIG.trackY-m.h); ctx.lineTo(m.x+m.sz, CONFIG.trackY); ctx.fill();
    });

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
    drawRestoredTrain();
    trees.filter(t => t.layer === 0).forEach(drawTree); 
    drawForegroundGrass();
    
    if(rainAlpha > 0) {
        ctx.strokeStyle = `rgba(200, 220, 255, ${rainAlpha * 0.5})`;
        rainDrops.forEach(d => {
            d.y += d.s; d.x -= speed; if(d.y > canvas.height) d.y = -20; if(d.x < 0) d.x = canvas.width;
            ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d.x-5, d.y+15); ctx.stroke();
        });
    }

    drawDigitalCockpitGauges();
    ctx.restore();
}

function drawSignals4Aspect() {
    signals.forEach(s => {
        let sx = s.x - worldDistance + (canvas.width / 2);
        if(sx > -100 && sx < canvas.width + 100) {
            ctx.fillStyle = '#222'; ctx.fillRect(sx, CONFIG.trackY-350, 12, 350); 
            ctx.fillStyle = '#111'; ctx.fillRect(sx-15, CONFIG.trackY-350, 42, 110);
            const drawAspect = (yOff, color, active) => {
                ctx.fillStyle = active ? color : '#333';
                ctx.beginPath(); ctx.arc(sx+6, CONFIG.trackY-335+yOff, 10, 0, Math.PI*2); ctx.fill();
                if(active) { ctx.shadowBlur = 15; ctx.shadowColor = color; ctx.stroke(); ctx.shadowBlur = 0; }
            };
            drawAspect(0, '#0f0', s.aspect === 'GREEN'); 
            drawAspect(25, '#ff0', s.aspect === 'DOUBLE_YELLOW' || s.aspect === 'YELLOW'); 
            drawAspect(50, '#ff0', s.aspect === 'DOUBLE_YELLOW'); 
            drawAspect(75, '#f00', s.aspect === 'RED');
        }
    });
}

function drawDigitalCockpitGauges() {
    ctx.save();
    let gx = 150, gy = canvas.height - 130;
    ctx.fillStyle = 'rgba(0, 20, 0, 0.9)'; ctx.strokeStyle = '#00ff00'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(gx, gy, 80, 0, Math.PI*2); ctx.fill(); ctx.stroke();
    ctx.save(); ctx.translate(gx, gy);
    ctx.rotate(-Math.PI/1.2 + (speed / CONFIG.maxSpeed) * Math.PI*1.5);
    ctx.strokeStyle = '#00ff00'; ctx.lineWidth = 8; // Thickening for video parity
    ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(0,-72); // Length matched to video
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = 'rgba(0, 20, 0, 0.9)'; ctx.fillRect(gx+120, gy-60, 40, 120);
    ctx.fillStyle = '#ff0'; ctx.fillRect(gx+125, gy+55, 30, -throttle * 110);
    ctx.restore();
}

function drawRestoredTrain() {
    // 📐 ABSOLUTE GROUNDING: Sub-pixel 1.5px drop for final contact
    let y = CONFIG.trackY - 110.5; 
    // 🔗 COUPLER & CORRIDOR LOGIC
    for(let i=1; i<=4; i++) {
        let cx = CONFIG.trainX - (i * 440);
        drawLHBProcedural(cx, y + coachOffsets[i-1]);
        drawCoupling(cx + 400, y + 60); // Corridor Connectors
    }
    drawWAP7Procedural(CONFIG.trainX, y + coachOffsets[0]);
    drawCoupling(CONFIG.trainX - 35, y + 65, true); // Engine Buffer
}

function drawCoupling(x, y, isEngine = false) {
    ctx.fillStyle = '#111';
    if(isEngine) {
        ctx.fillRect(x, y, 35, 15); // Buffer beam
    } else {
        ctx.fillStyle = '#444'; ctx.fillRect(x, y - 45, 40, 75); // Corridor Vestibule
        ctx.fillStyle = '#111'; ctx.fillRect(x, y, 40, 10); // Coupling bar
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
    const W = 520, H = 85; // 📉 SCALED TO MATCH COACH (V150.9)
    drawBogie(x + 80, y + H - 15); drawBogie(x + 340, y + H - 15);
    
    ctx.fillStyle = '#b30000';
    ctx.beginPath();
    ctx.moveTo(x + 50, y + 5); ctx.lineTo(x + W - 50, y + 5); 
    ctx.bezierCurveTo(x + W + 10, y + 5, x + W + 30, y + 30, x + W + 30, y + H - 15); 
    ctx.lineTo(x + W + 30, y + H); ctx.lineTo(x - 30, y + H); 
    ctx.lineTo(x - 30, y + H - 15); 
    ctx.bezierCurveTo(x - 30, y + 30, x - 10, y + 5, x + 50, y + 5); 
    ctx.fill();

    ctx.fillStyle = '#fafafa'; ctx.fillRect(x - 30, y + 42, W + 60, 16);

    ctx.strokeStyle = '#555'; ctx.lineWidth = 4;
    let px = x + 380, py = y, pHeight = Math.abs(py - (CONFIG.trackY - 325)); 
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px-40, py-pHeight/2); ctx.lineTo(px, py-pHeight); ctx.lineTo(px + 60, py - pHeight); ctx.stroke();
    ctx.fillStyle = '#222'; ctx.fillRect(px-15, py-pHeight-5, 90, 8);

    ctx.fillStyle = 'white'; ctx.font = 'bold 20px Arial'; ctx.textAlign = 'center';
    ctx.fillText("भारतीय रेल", x + W/2, y + 38);
    ctx.font = 'bold 16px Arial'; ctx.fillText("WAP-7 30602", x + W/2, y + 78);
    
    ctx.fillStyle = '#fafafa'; ctx.beginPath(); ctx.arc(x + 100, y + 25, 18, 0, Math.PI*2); ctx.fill(); 

    if(lampsOn) {
        ctx.fillStyle = 'rgba(255, 255, 180, 0.4)';
        ctx.beginPath(); ctx.moveTo(x+W+30, y+70); ctx.lineTo(x+W+800, y-150); ctx.lineTo(x+W+800, y+400); ctx.fill();
    }
}

function drawLHBProcedural(x, y) {
    const W = 400, H = 85; // 📉 REDUCED SCALE (V150.5)
    drawBogie(x + 40, y + H - 12); drawBogie(x + 260, y + H - 12);
    
    ctx.fillStyle = '#b30000'; ctx.fillRect(x, y, W, H/2); 
    ctx.fillStyle = '#9e9e9e'; ctx.fillRect(x, y + H/2, W, H/2); 
    
    ctx.fillStyle = '#b30000';
    ctx.fillRect(x + 5, y + 8, 35, H - 16); // Door 1
    ctx.fillRect(x + W - 40, y + 8, 35, H - 16); // Door 2

    for(let i=0; i<8; i++) {
        let wx = x + 60 + i * 38;
        ctx.fillStyle = '#222'; ctx.fillRect(wx, y + 12, 28, 38); 
        ctx.fillStyle = 'rgba(0, 100, 200, 0.4)'; ctx.fillRect(wx + 3, y + 15, 22, 32); 
    }

    ctx.fillStyle = 'white'; ctx.font = 'bold 14px Arial'; ctx.textAlign = 'center';
    ctx.fillText("INDIAN RAILWAYS", x + W/2, y + 10);
    
    ctx.fillStyle = '#ffd700'; ctx.fillRect(x, y, 3, H); ctx.fillRect(x + W - 3, y, 3, H);
}

function drawBogie(x, y) { ctx.fillStyle = '#111'; ctx.fillRect(x, y + 2, 130, 28); drawWheel(x + 25, y + 24); drawWheel(x + 105, y + 24); }
function drawWheel(x, y) { ctx.save(); ctx.translate(x, y); ctx.rotate(wheelRotation); ctx.fillStyle = '#333'; ctx.beginPath(); ctx.arc(0, 0, 19, 0, Math.PI*2); ctx.fill(); ctx.restore(); }

function drawTree(t) {
    let wind = Math.sin(Date.now()/1000 + t.sway) * 16;
    let treeY = CONFIG.trackY + (t.layer === 0 ? 45 : t.layer === 1 ? 10 : 0);
    let trunkH = t.h / (t.isPalm ? 2.5 : 4);
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
    const pW = 7500; 
    ctx.fillStyle = '#b33939'; ctx.beginPath(); ctx.moveTo(x-500, CONFIG.trackY-450); ctx.lineTo(x+100, CONFIG.trackY-600); ctx.lineTo(x+700, CONFIG.trackY-450); ctx.fill();
    ctx.fillStyle = '#111'; ctx.fillRect(x-450, CONFIG.trackY-450, 1000, 380); 
    ctx.fillStyle = '#222'; ctx.fillRect(x-pW/2, CONFIG.trackY-28, pW, 28);
    ctx.fillStyle = '#ffd700'; ctx.fillRect(x-pW/2, CONFIG.trackY-22, pW, 3);
    for(let k=0; k<12; k++) {
        let sx = x - pW/2.5 + (k * 650);
        ctx.fillStyle = '#2c3e50'; ctx.fillRect(sx, CONFIG.trackY-200, 300, 15);
        ctx.fillStyle = '#333'; ctx.fillRect(sx, CONFIG.trackY-200, 8, 172); ctx.fillRect(sx+292, CONFIG.trackY-200, 8, 172);
        ctx.fillStyle = '#f39c12'; ctx.fillRect(sx+80, CONFIG.trackY-55, 140, 10); ctx.fillRect(sx+80, CONFIG.trackY-75, 140, 5);
        ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(sx+120, CONFIG.trackY-90, 7, 0, Math.PI*2); ctx.fill(); ctx.fillRect(sx+112, CONFIG.trackY-84, 16, 20);
        ctx.beginPath(); ctx.arc(sx+180, CONFIG.trackY-90, 7, 0, Math.PI*2); ctx.fill(); ctx.fillRect(sx+172, CONFIG.trackY-84, 16, 20);
    }
    ctx.fillStyle = '#000';
    for(let j=0; j<35; j++) { let px = x - pW/2.2 + (j*210+Math.sin(j)*120); ctx.beginPath(); ctx.arc(px, CONFIG.trackY-75, 8, 0, Math.PI*2); ctx.fill(); ctx.fillRect(px-8, CONFIG.trackY-67, 16, 28); }
    ctx.fillStyle = '#b33939'; ctx.fillRect(x+800, CONFIG.trackY-140, 250, 110);
    ctx.fillStyle = '#f1c40f'; ctx.font = 'bold 36px Arial'; ctx.textAlign = 'center'; ctx.fillText(name, x, CONFIG.trackY-125);
    ctx.fillStyle = '#0f0'; ctx.fillRect(x+415, CONFIG.trackY-100, 35, 25);
}

function drawOHELines() { 
    let poleOffset = bgX % 450; 
    ctx.lineWidth = 3; ctx.strokeStyle = '#4488ff'; ctx.beginPath(); ctx.moveTo(0, CONFIG.trackY-325); ctx.lineTo(canvas.width, CONFIG.trackY-325); ctx.stroke();
    for(let i=-450; i<canvas.width+450; i+=450) { let px = i-poleOffset; ctx.fillStyle = '#222'; ctx.fillRect(px, CONFIG.trackY-370, 15, 370); } 
}

function drawMainTrack() { let offset = bgX % 85; ctx.fillStyle = '#3e2723'; for(let i=-100; i<canvas.width+120; i+=85) ctx.fillRect(i-offset, CONFIG.trackY-11, 35, 22); ctx.strokeStyle = '#5d4037'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(0, CONFIG.trackY-6); ctx.lineTo(canvas.width, CONFIG.trackY-6); ctx.moveTo(0, CONFIG.trackY+6); ctx.lineTo(canvas.width, CONFIG.trackY+6); ctx.stroke(); }
function drawForegroundGrass() { let offset = (bgX * 2.5) % 400; ctx.fillStyle = '#0a1d0a'; for(let i=-400; i<canvas.width+400; i+=250) ctx.fillRect(i-offset, canvas.height-80, 80, 80); }

function drawMegaBridge(x, width) {
    ctx.fillStyle = '#002b4d'; ctx.fillRect(0, CONFIG.trackY+10, canvas.width, canvas.height); ctx.save(); ctx.translate(x, 0);
    for(let k=0; k<6; k++) { let hx = 600 + k*1400; ctx.fillStyle = '#4e342e'; ctx.fillRect(hx, CONFIG.trackY+60, 220, 70); ctx.fillStyle = '#d7ccc8'; ctx.fillRect(hx+20, CONFIG.trackY+15, 180, 50); ctx.fillStyle = '#111'; ctx.fillRect(hx+40, CONFIG.trackY+25, 30, 20); }
    for(let i=0; i<Math.floor(width/650); i++) { let px = i*650; ctx.fillStyle = '#1a1a1a'; ctx.fillRect(px, CONFIG.trackY+10, 120, canvas.height); ctx.fillStyle = '#0a0a0a'; ctx.beginPath(); ctx.moveTo(px+120, CONFIG.trackY+10); ctx.quadraticCurveTo(px+380, CONFIG.trackY+220, px+600, CONFIG.trackY+10); ctx.fill(); }
    ctx.strokeStyle = '#333'; ctx.lineWidth = 12;
    for(let i=0; i<Math.floor(width/900); i++) {
        let tx = i*900; ctx.strokeRect(tx, CONFIG.trackY-480, 900, 480);
        ctx.beginPath(); ctx.moveTo(tx, CONFIG.trackY-480); ctx.lineTo(tx+450, CONFIG.trackY); ctx.lineTo(tx+900, CONFIG.trackY-480); ctx.stroke();
    }
    ctx.restore();
}

window.onload = init;