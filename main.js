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

// 🎮 CORE VARS
let canvas, ctx, speedCanvas, sctx, dduCanvas, dctx, speed = 0, worldDistance = 0, bgX = 0;
let throttleNotch = 0, brakeNotch = 0; // ⚙️ NOTCH SYSTEM (Final Pro)
let trees = [], clouds = [], rainDrops = [], foregroundObjects = [], mountains = [], stars = [], mistParticles = [];
let stations = [], signals = [], coachOffsets = [];
let timeOfDay = 0, wheelRotation = 0; 
let audioStarted = false, hornAudio, locoAudio, slowTrackAudio, fastTrackAudio, crowdAudio, chimeAudio, startAudio;
let lampsOn = false, lastAlpMsg = "", lastTrackSoundDist = 0;
let oppTrain = null, weather = 'CLEAR', rainAlpha = 0; // ⛈️ WEATHER ENGINE
let rainAudio;
let tunnelAlpha = 0;
let waterOffset = 0; // 🌊 WATER PHYSICS ENGINE

// 📏 Scaling Helper (FIXED: Defined once)
const sc = (val) => val * CONFIG.vScale;

// 🎮 GAMEPLAY FLOW & MISSION STATES (FIXED: Consolidated)
const G_STATE = {
    RUNNING: 'RUNNING',
    APPROACHING: 'APPROACHING',
    STOPPED: 'STOPPED',
    BOARDING: 'BOARDING',
    READY: 'READY',
    DEPARTING: 'DEPARTING'
};
let gameState = G_STATE.RUNNING;
let currentStationIdx = -1;
let dwellTimer = 0;
let doorOpenAmount = 0; 
let isWaitingForStarter = true;
let starterTimer = 7.0; // 🎯 Strictly 7 Seconds 

// --- 🗺️ SPATIAL WORLD MAP (Solid Ground Architecture) ---
// Defined in World Units (Meters)
const BRIDGE_ZONES = [
    { start: 20000, end: 32000, type: 'STEEL' },   // First Long Valley (Steel)
    { start: 55000, end: 68000, type: 'WATER' },   // Lake Crossing (Proposed Concrete 🔥)
    { start: 105000, end: 115000, type: 'STEEL' }, // Deep Forest River (Steel)
    { start: 140000, end: 155000, type: 'STEEL' }, // High Ghat Pass (Steel)
    { start: 185000, end: 195000, type: 'WATER' }  // Final Coastal Bridge (Water)
];

const getStructuralType = (worldX) => {
    const zone = BRIDGE_ZONES.find(z => worldX >= z.start && worldX <= z.end);
    return zone ? { main: 'bridge', sub: zone.type } : { main: 'ground' };
};

// High-Fidelity Assets
let imgSky = new Image(); imgSky.src = 'assets/sky.png';
let imgMountains = new Image(); imgMountains.src = 'assets/mountains.png';
let imgCity = new Image(); imgCity.src = 'assets/cityscape.png';
let particles = [];
for(let i=0; i<150; i++) stars.push({x: Math.random()*3000, y: Math.random()*800, s: Math.random()*2.5 + 0.5, a: Math.random()});

function init() {
    canvas = document.getElementById(CONFIG.canvasId);
    ctx = canvas.getContext('2d', { alpha: false });
    
    speedCanvas = document.getElementById("speedCanvas");
    sctx = speedCanvas.getContext("2d");
    speedCanvas.width = 120;
    speedCanvas.height = 120;

    dduCanvas = document.getElementById("dduCanvas");
    dctx = dduCanvas.getContext("2d");
    dduCanvas.width = 300;
    dduCanvas.height = 150;

    resize();
    window.addEventListener('resize', resize);

    hornAudio = new Audio('assets/P5.mp3'); 
    locoAudio = new Audio('assets/humming.mp3'); 
    locoAudio.loop = false; // 🔊 NO LOOPING (Final Pro Fix)
    slowTrackAudio = new Audio('assets/short.mp3');
    fastTrackAudio = new Audio('assets/long.mp3');
    crowdAudio = new Audio('assets/crowd.mp3');
    crowdAudio.loop = true;
    crowdAudio.volume = 0;

    rainAudio = new Audio('https://assets.mixkit.co/active_storage/sfx/2407/2407-preview.mp3'); 
    rainAudio.loop = true;
    rainAudio.volume = 0;
    
    // Final Plus Audio Pack
    chimeAudio = new Audio('https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3'); // IR Chime Placeholder
    startAudio = new Audio('assets/humming.mp3'); // We'll use humming specifically for the start sequence

    for(let i=0; i<4; i++) coachOffsets.push(0); 
    for(let i=0; i<12; i++) spawnMountain();
    for(let i=0; i<20; i++) spawnVolumetricCloud(Math.random() * canvas.width);
    
    // Layered 3D Rain (FIXED)
    for(let i=0; i<200; i++) {
        rainDrops.push({ 
            x: Math.random()*canvas.width, 
            y: Math.random()*canvas.height, 
            s: 10 + Math.random()*15,
            layer: Math.random() < 0.3 ? 'front' : 'back' 
        });
    }
    for(let i=0; i<50; i++) mistParticles.push({ x: Math.random()*2000, y: CONFIG.trackY - 250 + Math.random()*200, sz: 50+Math.random()*150, dx: 0.2 + Math.random()*0.4 });
    
    // 🚉 6-STATION MISSION (Kollam -> TVC) - [CLIENT STORYBOARDED]
    stations.push({ id: 'STAT_0', name: "KOLLAM JCT", x: 0, annDone: false, isStarter: true, isStoppage: true });
    stations.push({ id: 'STAT_1', name: "PARAVUR", x: 40000, annDone: false, isStoppage: false }); // SKIP
    stations.push({ id: 'STAT_2', name: "VARKALA SIVAGIRI", x: 80000, annDone: false, isStoppage: true });
    stations.push({ id: 'STAT_3', name: "KADAKKAVUR", x: 120000, annDone: false, isStoppage: false }); // SKIP
    stations.push({ id: 'STAT_4', name: "CHIRAYINKEEZHU", x: 160000, annDone: false, isStoppage: false }); // SKIP
    stations.push({ id: 'STAT_5', name: "TRIVANDRUM CENTRAL", x: 200000, annDone: false, isStoppage: true });

    // 🚦 SIGNAL SEQUENCE (Hard-coded to match client screenshot 3/3)
    const storyboard = ['GREEN', 'GREEN', 'GREEN', 'YELLOW', 'GREEN', 'GREEN', 'DOUBLE_YELLOW', 'YELLOW', 'RED'];
    for(let j=0; j<150; j++) {
        let aspect = (j < storyboard.length) ? storyboard[j] : 'GREEN';
        let sigX = 800 + j * 4000;
        
        // 🚉 NEW: Starter Logic (Only for Stoppage Stations)
        let nearStation = stations.find(s => sigX > s.x && sigX < s.x + 2000);
        let isStart = nearStation ? true : false;
        
        // IF it's a skip station, force the starter to GREEN always
        if(isStart && !nearStation.isStoppage) {
            aspect = 'GREEN';
            isStart = false; // Don't trigger 'Waiting for Starter' at skip stations
        } else if (isStart) {
            aspect = 'RED';
        }

        signals.push({ 
            id: `SIG_${j}`, 
            x: sigX, 
            aspect: aspect, 
            isStarter: isStart 
        });
    }

    // 🚧 LEVEL CROSSING (LC) INFRASTRUCTURE
    window.LC_ZONES = [15000, 45000, 95000, 135000, 175000];

    // ⏱️ WEATHER TRANSITION (Strict Distance-Based Logic - No Randomness)
    // Removed setInterval random weather to prevent confusion.

    window.startMobileAudio = () => {
        audioStarted = true;
        document.body.classList.add('systems-active'); // ⚡ HUD POWER UP
        document.getElementById('start-overlay').style.display = 'none';
        speakALP("Waiting for signal");
        if (navigator.vibrate) navigator.vibrate(50);
    };

    window.notchUp = () => {
        if(isWaitingForStarter || gameState === G_STATE.BOARDING) return;
        
        let changed = false;
        if (brakeNotch === 5 && speed === 0) {
            brakeNotch = 0; changed = true;
        } else if (brakeNotch > 0) {
            brakeNotch--; changed = true;
        } else if (throttleNotch < 8) {
            throttleNotch++; changed = true;
        }
        
        if(changed) {
            updateDashboard();
            pulseHUD(); // ⚡ Success Pulse
            if (navigator.vibrate) navigator.vibrate(30);
        }
    };

    window.notchDown = () => {
        let changed = false;
        if (throttleNotch > 0) {
            throttleNotch--; changed = true;
        } else if (brakeNotch < 5) {
            brakeNotch++; changed = true;
        }
        
        if(changed) {
            updateDashboard();
            pulseHUD(); // ⚡ Success Pulse
            if (navigator.vibrate) navigator.vibrate(20);
        }
    };

    // ⚡ PRO-TACTILE FEEDBACK ENGINE
    function pulseHUD() {
        const hud = document.querySelector('.mobile-hud');
        if(hud) {
            hud.classList.remove('hud-pulse');
            void hud.offsetWidth; // Trigger reflow
            hud.classList.add('hud-pulse');
        }
    }

    window.createRipple = (e) => {
        const zone = e.currentTarget;
        const ripple = document.createElement('span');
        ripple.classList.add('ripple');
        
        const rect = zone.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        ripple.style.width = ripple.style.height = `${size}px`;
        
        // Center ripple on touch coordinate
        const x = (e.clientX || e.touches[0].clientX) - rect.left - size/2;
        const y = (e.clientY || e.touches[0].clientY) - rect.top - size/2;
        
        ripple.style.left = `${x}px`;
        ripple.style.top = `${y}px`;
        
        zone.appendChild(ripple);
        setTimeout(() => ripple.remove(), 600);
    };

    window.horn = () => { if(hornAudio) { hornAudio.currentTime = 0; hornAudio.play(); } };
    window.toggleLights = () => { lampsOn = !lampsOn; document.getElementById('light-btn').classList.toggle('active', lampsOn); };
    window.emergencyBrake = () => { brakeNotch = 5; throttleNotch = 0; updateDashboard(); speakALP("Emergency Brake Applied!"); };
    
    // ⚔️ IMMERSIVE ENGINE (Fullscreen API)
    window.toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                // If standard fails, try webkit (Safari/iOS support)
                if (document.documentElement.webkitRequestFullscreen) {
                    document.documentElement.webkitRequestFullscreen();
                }
            });
        } else {
            document.exitFullscreen();
        }
    };

    // 📱 HYBRID TOUCH CONTROLS (Updated for Notches)
    const handleTouch = (clientX) => {
        if (clientX < window.innerWidth / 2) window.notchDown();
        else window.notchUp();
    };
    canvas.addEventListener('touchstart', (e) => { e.preventDefault(); handleTouch(e.touches[0].clientX); }, {passive: false});
    canvas.addEventListener('mousedown', (e) => { if(audioStarted) handleTouch(e.clientX); });

    window.addEventListener('keydown', e => {
        if(!audioStarted || isWaitingForStarter || gameState === G_STATE.BOARDING) return;
        const key = e.key.toLowerCase();
        if (e.key === 'ArrowUp') window.notchUp();
        if (e.key === 'ArrowDown') window.notchDown();
        if (key === 'b') window.emergencyBrake();
        if (key === 'h') window.horn();
        if (key === 'l') window.toggleLights();
    });

    requestAnimationFrame(gameLoop);
}

function resize() {
    // 📱 PRO MOBILE RESIZE ENGINE (V151.30)
    canvas.width = window.innerWidth;
    
    let vh = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    const isMobileLandscape = vh < 500 && window.innerWidth > vh;
    
    // 🖥️ Laptop View: 70% Height | 📱 Pro Mobile: 100% Height
    canvas.height = isMobileLandscape ? vh : vh * 0.7; 
    
    CONFIG.vScale = isMobileLandscape ? 0.60 : 0.88; 
    
    // 🚆 DYNAMIC TRAIN FRAMING: Pull head into view on small screens
    CONFIG.trainX = isMobileLandscape ? (canvas.width * 0.25) : 450;
    
    // Higher track position for full-screen immersive view
    CONFIG.trackY = isMobileLandscape ? canvas.height * 0.78 : canvas.height * 0.85;
}

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

function updateDashboard() {
    let notchLabel = `N ${throttleNotch}`;
    if (brakeNotch > 0) notchLabel = `B ${brakeNotch}`;
    
    // Laptop Dashboard Sync
    document.getElementById('notch-val').innerText = notchLabel;
    
    // 📱 Pro Mobile HUD Sync
    const mSpeed = document.getElementById('mobile-speed');
    const mNotch = document.getElementById('mobile-notch');
    if(mSpeed) mSpeed.innerText = `${Math.round(speed * 10)} KM/H`;
    if(mNotch) mNotch.innerText = notchLabel;
}

function speakALP(text) {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text); u.pitch = 1.0; u.rate = 1.0; 
    window.speechSynthesis.speak(u);
}

function gameLoop() { update(); draw(); drawSpeedometerUI(); drawDDUDisplay(); requestAnimationFrame(gameLoop); }

function update() {
    // 🚦 MISSION & STATION LOGIC (Final Client Loop)
    let distFromStation = 999999;
    let nearestStation = null;
    let nearestIdx = -1;
    stations.forEach((s, i) => { 
        let d = s.x - worldDistance; 
        if(Math.abs(d) < Math.abs(distFromStation)) { distFromStation = d; nearestStation = s; nearestIdx = i; } 
    });

    // 🚉 APPROACHING & STOPPING LOGIC (EXPRESS SKIP COMPATIBLE)
    if (Math.abs(distFromStation) < 1500 && gameState === G_STATE.RUNNING) {
        if (nearestStation.isStoppage) {
            gameState = G_STATE.APPROACHING;
            speakALP(`Approaching ${nearestStation.name}. Reduce throttle.`);
        } else if (!nearestStation.skipAnnounced) {
            // 🚀 EXPRESS SKIP ANNOUNCEMENT
            speakALP(`Skipping ${nearestStation.name}. Keep full speed.`);
            nearestStation.skipAnnounced = true;
        }
    }

    if (gameState === G_STATE.APPROACHING) {
        // Auto-Slow Assist
        if (Math.abs(distFromStation) < 800 && speed > 5 && brakeNotch === 0) {
             speed *= 0.98;
        }
        
        if (Math.abs(distFromStation) < 150 && speed < 1.0) {
            speed = 0;
            gameState = G_STATE.STOPPED;
            currentStationIdx = nearestIdx;
            speakALP(`Train stopped at ${nearestStation.name}. Opening doors.`);
        }
    }

    // 🚪 DOOR & BOARDING SEQUENCE
    if (gameState === G_STATE.STOPPED) {
        if (doorOpenAmount === 0) speakALP("Opening doors.");
        doorOpenAmount = Math.min(doorOpenAmount + 0.02, 1);
        if (doorOpenAmount >= 1) {
            gameState = G_STATE.BOARDING;
            dwellTimer = 400; // ~6-7 seconds of boarding
        }
    }

    if (gameState === G_STATE.BOARDING) {
        dwellTimer--;
        if (dwellTimer <= 0) {
            gameState = G_STATE.READY;
            speakALP("Boarding complete. Closing doors.");
            if(chimeAudio) chimeAudio.play().catch(()=>{}); 
        }
    }

        if (doorOpenAmount <= 0) { 
            gameState = G_STATE.DEPARTING; 
            currentStationIdx = -1; 
            // 🚦 RESET STARTER LOGIC FOR EVERY STATION (UNIVERSAL FIX)
            isWaitingForStarter = true;
            starterTimer = 7.0;
        }

    // 🚦 STARTER SIGNAL LOGIC (Hard Sync & 7s Timer Fix 🔥)
    if(audioStarted && isWaitingForStarter) {
        starterTimer -= 0.016;
        speed = 0; // Hard lock: No movement until green
        
        // 🎯 1. PRE-FLIP: Signal turns Green 2 seconds before departure
        if(starterTimer <= 2.0) {
            let starterSig = signals.find(s => s.isStarter && s.x > worldDistance);
            if(starterSig && starterSig.aspect !== 'GREEN') {
                starterSig.aspect = 'GREEN';
                document.getElementById('signal-callout').innerHTML = "🟢 Starter signal green";
            }
        }

        // 🎯 2. DEPARTURE: Timer ends
        if(starterTimer <= 0) {
            isWaitingForStarter = false;
            speakALP("Starter signal green. You are cleared to depart.");
            if (gameState === G_STATE.DEPARTING) gameState = G_STATE.RUNNING;
        }
    }

    // Departure Signal Sync
    if (gameState === G_STATE.DEPARTING && !nearestStation?.isStarter) {
        let nextSignal = signals.find(sig => sig.x > worldDistance);
        if (nextSignal && nextSignal.aspect === 'GREEN') {
            gameState = G_STATE.RUNNING;
            speakALP("Permission to depart.");
        } else if (nextSignal && nextSignal.aspect === 'RED') {
            // Wait for signal or force green after dwell if it's a mission stop
            nextSignal.aspect = 'GREEN'; 
        }
    }

    // ☀️ DYNAMIC ATMOSPHERE (Predictable & Cinematic)
    // We slow down time: Night only appears in the final stretch of the trip
    timeOfDay = (0.3 * worldDistance / 1000) % 1000; 
    const isSunset = timeOfDay > 600 && timeOfDay < 800;
    const isNight = timeOfDay >= 800 || timeOfDay < 100;
    
    let distKM = worldDistance / 1000;
    // Storm only in specific Ghat sections (Long stretches)
    isRaining = (distKM > 60 && distKM < 100) || (distKM > 220); 
    weather = isRaining ? 'RAIN' : 'CLEAR';
    rainAlpha = isRaining ? Math.min(rainAlpha + 0.01, 0.6) : Math.max(rainAlpha - 0.01, 0);

    // Rain Particle Lifecycle
    rainDrops.forEach(r => {
        r.y += r.s + (isRaining ? speed : 0);
        if(r.y > canvas.height) { r.y = -20; r.x = Math.random()*canvas.width; }
    });
    
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

    clouds.forEach((c, index) => {
        c.x -= speed * 0.1;
        if (c.x < -c.sz) {
            clouds.splice(index, 1);
            spawnVolumetricCloud(canvas.width + c.sz);
        }
    });

    // ⛈️ WEATHER SYSTEM SYNC (Final Pro)
    let targetRain = (weather === 'RAIN' || weather === 'STORM') ? 1.0 : 0.0;
    rainAlpha += (targetRain - rainAlpha) * 0.01;
    
    if (audioStarted && rainAudio) {
        let targetVol = (weather === 'RAIN') ? 0.3 : (weather === 'STORM' ? 0.6 : 0);
        rainAudio.volume += (targetVol - rainAudio.volume) * 0.01;
        if (rainAlpha > 0.01 && rainAudio.paused) rainAudio.play().catch(()=>{});
    }
    
    // 🔊 CROWD AUDIO SYNC (Vibrant Station Ambience)
    if(audioStarted && crowdAudio) {
        let isNear = isAtStation(worldDistance);
        let targetCrowdVol = isNear ? 0.4 : 0;
        crowdAudio.volume += (targetCrowdVol - crowdAudio.volume) * 0.05;
        if(crowdAudio.volume > 0.01 && crowdAudio.paused) crowdAudio.play().catch(()=>{});
    } else if (crowdAudio) {
        crowdAudio.volume = 0;
        crowdAudio.pause();
    }

    let traction = (weather === 'RAIN' || weather === 'STORM') ? 0.65 : 1.0;
    let friction = 0.003 + (speed * 0.001);
    
    // ⚙️ NOTCH-BASED PHYSICS (Pro Logic)
    // Traction power scales with notch (0-8)
    let power = (throttleNotch * 0.006 * traction); 
    // Braking force scales with notch (0-5)
    let brakeForce = (brakeNotch * 0.008); 
    
    speed += (power - brakeForce - friction);
    
    // 🧠 AWS COORDINATE SYNC (Fixed Offset Parity)
    let nextSignal = signals.find(sig => sig.x > worldDistance);
    if (nextSignal) {
        // We sync the physics distance with the VISUAL distance: (canvas.width / 2) - CONFIG.trainX
        const visualOffset = (canvas.width / 2) - CONFIG.trainX;
        let distToSignalVisual = nextSignal.x - worldDistance + visualOffset;
        
        // AWS triggers when the visual light is within 500m of the FRONT of the train
        if (distToSignalVisual < 500 && distToSignalVisual > -100) {
            if (nextSignal.aspect === 'RED' && speed > 0.1) {
                window.emergencyBrake();
            } else if (nextSignal.aspect === 'YELLOW' && speed > 6) {
                if (Math.random() < 0.01) speakALP("Caution! Check speed.");
            }
        }
    }

    if(speed > CONFIG.maxSpeed && throttleNotch > 6) {
        speed = Math.max(speed - 0.005, CONFIG.maxSpeed); 
    }
    
    if(throttleNotch === 0 && speed > 0) speed -= 0.001; // Natural coasting
    speed = Math.max(0, Math.min(speed, CONFIG.maxSpeed));
    worldDistance += speed;
    bgX = (worldDistance * CONFIG.scrollingMultiplier);
    wheelRotation += speed * 0.45;

    // 🔥 SMOKE EFFECT SPAWNING (CLIENT WOW)
    if (speed > 1 && Math.random() < 0.15) {
        particles.push({
            x: CONFIG.trainX + 380, 
            y: CONFIG.trackY - 330, 
            vx: -speed * 0.8 - Math.random() * 2, 
            vy: -1 - Math.random() * 2, 
            type: 'smoke', 
            a: 0.5, 
            sz: 10 + Math.random() * 20
        });
    }

    // 🚆 OPPOSITE TRAFFIC
    if(!oppTrain && Math.random() < 0.003 && speed > 5) oppTrain = { x: canvas.width + 1000, speed: 18, coachCount: 15 };
    if(oppTrain) {
        oppTrain.x -= (speed + oppTrain.speed);
        if(oppTrain.x < -8000) oppTrain = null;
    }

    coachOffsets.forEach((_, i) => coachOffsets[i] = Math.sin(Date.now()/(130 + i*15)) * (speed * 0.45));
    
    // 🔊 AUDIO ENGINE (Soundscape Restore 🔥)
    if(audioStarted) {
        // 1. STATION WHOOPING (Humming Engine)
        // Checks if within 1.5km of ANY station to ensure full 7s takeoff cycle
        let isNearStation = stations.some(s => Math.abs(worldDistance - s.x) < 1500);
        let isTakingOff = (gameState === G_STATE.DEPARTING || gameState === G_STATE.RUNNING) && isNearStation;
        
        if(isTakingOff && speed > 0.1) {
            if(!window.hummingActive && speed < 2.0) { 
                window.hummingActive = true; 
                window.hummStartTime = Date.now(); 
                locoAudio.currentTime = 0; 
                locoAudio.play().catch(()=>{}); 
            }
            if (window.hummingActive) {
                let elapsed = (Date.now() - window.hummStartTime) / 1000;
                if(elapsed < 7.0 && speed > 0.1) {
                    locoAudio.volume = Math.max(0, 0.6 * (1 - elapsed / 7.0)); 
                } else {
                    locoAudio.volume = 0;
                    if(!locoAudio.paused) locoAudio.pause();
                    window.hummingActive = false;
                }
            }
        } else {
            if(window.hummingActive) {
                locoAudio.volume = 0; if(!locoAudio.paused) locoAudio.pause(); window.hummingActive = false;
            }
        }

        // 2. RHYTHMIC TRACK JOINTS ("Clack-Clack")
        if(speed > 0.5) {
            let jointInterval = speed > 5 ? 380 : 750; // Closer together at high speed
            if (worldDistance - lastTrackSoundDist > jointInterval) {
                let trackSound = speed > 5 ? fastTrackAudio : slowTrackAudio;
                if(trackSound.paused || trackSound.ended) {
                    trackSound.volume = Math.min(0.4, speed / 25);
                    trackSound.play().catch(()=>{});
                    lastTrackSoundDist = worldDistance;
                }
            }
        }
        
        // Crowd Proximity Audio
        let nearestDist = 999999;
        stations.forEach(s => { let d = Math.abs(worldDistance - s.x); if(d < nearestDist) nearestDist = d; });
        if(nearestDist < 4000 && crowdAudio) {
            let targetVol = 1.0 - (nearestDist / 4000);
            crowdAudio.volume = Math.max(0, Math.min(0.6, targetVol));
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

    // 🔥 DYNAMIC PARTICLE PHYSICS (Final Pro Fix)
    if (throttleNotch >= 6 && speed > 2 && Math.random() < 0.2) {
        // Pantograph blue/white sparks
        particles.push({x: CONFIG.trainX + 380, y: CONFIG.trackY - 325 - Math.random()*10, vx: -speed*0.5 - Math.random()*2, vy: (Math.random()-0.5)*2, type: 'spark', a: 1.0, c: '#aaddff'});
    }
    if (brakeNotch >= 3 && speed > 3) {
        // High friction brake sparks at the front wheels
        for(let z=0; z<3; z++) {
            particles.push({x: CONFIG.trainX + 80 + Math.random()*20, y: CONFIG.trackY - 10, vx: -speed*1.2 - Math.random()*5, vy: -Math.random()*4, type: 'fire', a: 1.0, c: Math.random() > 0.5 ? '#ff5500' : '#ff9900'});
        }
    }
    particles.forEach((p, i) => {
        p.x += p.vx; p.y += p.vy;
        if(p.type === 'spark') { p.a -= 0.05; }
        if(p.type === 'smoke') { 
            p.a -= 0.01; 
            p.sz += 0.5; 
            p.vx *= 0.98; // Drag
        }
        if(p.type === 'fire') { p.a -= 0.08; p.vy += 0.2; } // gravity
        if(p.a <= 0) particles.splice(i, 1);
    });

    // 🚦 ALP SIGNAL CALLOUTS (CLIENT STORYBOARD SYNC)
    let msg = isWaitingForStarter ? "🔴 Waiting for signal" : "🟢 STARTER Signal green";
    signals.forEach(s => {
        let dist = s.x - worldDistance;
        if(dist > 0 && dist < 1200) {
            if(s.aspect === 'YELLOW') msg = "🟡 Distant yellow signal, caution";
            if(s.aspect === 'DOUBLE_YELLOW') msg = "🟡🟡 Distant double yellow";
            if(s.aspect === 'RED' && !isWaitingForStarter) msg = "🔴 Home Signal - Danger";
        }
    });
    stations.forEach(s => {
        let dist = s.x - worldDistance;
        if(dist > 0 && dist < 5000) msg = `📢 Entering ${s.name}`;
    });
    if(msg !== lastAlpMsg) {
        lastAlpMsg = msg;
        document.getElementById('signal-callout').innerText = msg;
        if(audioStarted) speakALP(msg.replace(/🔴|🟡|🟢|🟡🟡|📢 /g, ''));
    }

    // 🚧 LC GATE ANIMATION (Flashing Lights)
    window.lcFlash = (Math.sin(Date.now() / 200) > 0);
}

function draw() {
    ctx.save();
    
    // 🚉 BIOME & TERRAIN DETECTION (Refined Spatial Logic 🔥)
    let distSinceLast = 1000000;
    stations.forEach(s => { let d = worldDistance - s.x; if(d >= 0 && d < distSinceLast) distSinceLast = d; });
    let isGhatMode = distSinceLast < 30000; 
    
    // Check structural type at the front of the train
    let sType = getStructuralType(worldDistance + 400);
    let isBridgeBiome = sType.main === 'bridge';
    let bridgeSubtype = sType.sub || 'NONE'; // STEEL or WATER
    let distKM = worldDistance / 1000;

    let skyBrightRaw = Math.abs(500 - timeOfDay) / 5;
    
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

    // --- 🚧 LEVEL CROSSING (LC) RENDER ---
    if(window.LC_ZONES) {
        window.LC_ZONES.forEach((lcX, i) => {
            let sx = lcX - worldDistance + (canvas.width / 2);
            if(sx > -400 && sx < canvas.width + 400) {
                drawLevelCrossing(sx, i);
            }
        });
    }

        // (God-rays and birds removed to match image)
    

    // --- 1. FULL CANVAS SKY RENDER (FIXED CUT LINE) ---
    if(imgSky.complete && imgSky.width > 0) {
        ctx.globalAlpha = isNight ? 0.3 : (isSunset ? 0.8 : 1.0);
        // Draw sky slightly taller to prevent any gaps at the horizon
        ctx.drawImage(imgSky, 0, -2, canvas.width, canvas.height + 4); 
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

    // Parallax Layer 2: Biome Mountains/City (Sync Filter Fix 🔥)
    // If we are on a bridge, we force the remote mountain biome for realism
    let currentParallax = (isBridgeBiome || distKM <= 100) ? imgMountains : imgCity;
    if(currentParallax && currentParallax.complete && currentParallax.width > 0) {
        // --- EXTREME REALISM PERSPECTIVE ENGINE (V152.0) ---
        const skyVoid = canvas.height * 0.35; // 🌌 Protected Space for Infinite Sky
        let pW = Math.max(canvas.width * 1.5, 1200); 
        
        // --- 🌊 ULTIMATE REALISM: DUAL-PASS DEPTH ENGINE (PRO FIX: 0.2 SPEED) ---
        const drawPlane = (passType) => {
            let config = {
                far: { speed: 0.2, blur: 2.2, bright: 75, scale: 0.38, overlap: 35 },
                mid: { speed: 0.35, blur: 1.2, bright: 85, scale: 0.45, overlap: 25 }
            }[passType];

            let pOff = (bgX * config.speed) % pW;
            let destH = (canvas.height * config.scale) + 5;
            let hY = CONFIG.trackY - destH + config.overlap;

            ctx.save();
            // 🎨 ATMOSPHERIC OPTICS (Advanced Rim Glow + Indigo Shadows)
            let baseBlur = (CONFIG.vScale > 0.8) ? config.blur : config.blur * 0.6;
            let filter = `blur(${baseBlur}px) brightness(${config.bright}%) contrast(90%)`;
            if(isNight) filter = `blur(${baseBlur}px) brightness(25%) contrast(110%)`;
            else if(isSunset) filter = `blur(${baseBlur}px) brightness(75%) sepia(35%) saturate(140%)`;
            ctx.filter = filter;

            let xPos = -pOff;
            while(xPos < canvas.width) {
                let scH = currentParallax.height * config.scale;
                ctx.drawImage(currentParallax, 0, currentParallax.height - scH, currentParallax.width, scH, xPos, hY, pW + 10, destH + 5);
                
                // ⛅ SUN-RIM GLOW (Rim Lighting for Peak Realism)
                if(!isNight) {
                    let rimGrd = ctx.createLinearGradient(0, hY, 0, hY + 15);
                    rimGrd.addColorStop(0, isSunset ? 'rgba(255, 180, 100, 0.15)' : 'rgba(255, 255, 255, 0.1)');
                    rimGrd.addColorStop(1, 'rgba(0,0,0,0)');
                    ctx.fillStyle = rimGrd; ctx.fillRect(xPos, hY, pW + 10, 15);
                }

                // ⚓ INDIGO AMBIENT OCCLUSION (Cool-Tone Perspective)
                let anchorShadow = ctx.createLinearGradient(0, hY + destH - 80, 0, hY + destH);
                anchorShadow.addColorStop(0, 'rgba(0,0,0,0)');
                anchorShadow.addColorStop(1, isSunset ? 'rgba(40, 10, 0, 0.3)' : 'rgba(10, 15, 45, 0.25)'); // Indigo shadows
                ctx.fillStyle = anchorShadow; ctx.fillRect(xPos, hY + destH - 80, pW + 10, 80);
                
                xPos += pW;
            }
            ctx.restore();
        };

        // Execute Dual Passes
        drawPlane('far');
        drawPlane('mid');

        // 🌫️ 5. DEEP ATMOSPHERIC BRIDGE (Extreme Distance Sync - Ghat-Mist Grey-Green)
        let bridgeGrd = ctx.createLinearGradient(0, CONFIG.trackY - 200, 0, CONFIG.trackY + 100);
        let mistColor = isSunset ? '210, 100, 50' : '180, 195, 205'; 
        bridgeGrd.addColorStop(0, 'rgba(0,0,0,0)');
        bridgeGrd.addColorStop(0.5, `rgba(${mistColor}, 0.15)`);
        bridgeGrd.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = bridgeGrd; ctx.fillRect(0, CONFIG.trackY - 200, canvas.width, 300);

        // 🌬️ ATMOSPHERIC BREATH (Drifting Particles)
        mistParticles.forEach(p => {
            p.x -= p.dx; if(p.x < -200) p.x = canvas.width + 200;
            let pGrd = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.sz);
            pGrd.addColorStop(0, `rgba(${mistColor}, 0.08)`);
            pGrd.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = pGrd; ctx.beginPath(); ctx.arc(p.x, p.y, p.sz, 0, Math.PI*2); ctx.fill();
        });

        // ⚓ 6. GROUND ANCHORING
        let anchorGrd = ctx.createLinearGradient(0, CONFIG.trackY - 100, 0, CONFIG.trackY);
        anchorGrd.addColorStop(0, 'rgba(0,0,0,0)');
        anchorGrd.addColorStop(1, 'rgba(0,0,0,0.6)');
        ctx.fillStyle = anchorGrd; ctx.fillRect(0, CONFIG.trackY-100, canvas.width, 100);

        // Restoration of variables for legacy effects (Night Lights)
        let midSpeed = 0.095;
        let midHorizonY = CONFIG.trackY - (canvas.height * 0.45) + 25;

        if(distKM > 100 && isNight) {
            ctx.fillStyle = 'rgba(255,200,100,0.8)';
            let winOff = (bgX * midSpeed) % pW;
            let winX = -winOff;
            while(winX < canvas.width) {
                for(let w=0; w<20; w++) {
                    ctx.fillRect( winX + (w*150)%pW, midHorizonY + 60 + Math.random()*150, 4, 4 );
                }
                winX += pW;
            }
        }
    }

    trees.filter(t => t.layer === 2).forEach(drawTree);

    // 🌳 TREES (MID LAYER: 0.5 SPEED)
    // Hide trees if on a bridge to keep it clean
    if (!isBridgeBiome) {
        trees.forEach(drawTree);
    }

    // 🛤️ TRACK & GROUND (NEAR LAYER: 1.0 SPEED)
    // Fail-safe ground seal (Backing layer)
    ctx.fillStyle = isNight ? '#050805' : '#0a120a';
    ctx.fillRect(0, CONFIG.trackY, canvas.width, canvas.height - CONFIG.trackY);

    // 🌉 SPATIAL INFRASTRUCTURE (Seamless Ground & Dual-Bridge Transition 🔥)
    drawMovingWater(isNight);            // 🌊 1. Water Pass (Always call - filters per zone)
    drawConcreteBridgeLower(isSunset, isNight); // 🌉 2. Concrete Arches
    drawEarthenBase(isSunset, isNight);  // 🧱 3. Ground Base
    drawBridgeLower(isGhatMode);         // 🏗️ 4. Steel Girder Pass
    drawBridgeTruss(false);              // 🕸️ 5. Hinter Truss Pass

    drawOHELines();
    drawMainTrack();

    stations.forEach(s => {
        let sx = s.x - worldDistance + (canvas.width / 2);
        // Expand clipping boundary to 30,000 to support 15km platforms (Anti-Ghosting Fix)
        if(sx > -30000 && sx < canvas.width + 30000) drawStationProcedural(sx, s.name);
    });

    if(oppTrain) drawOppositeTrain(oppTrain);

    // 🚆 TRAIN (ABOVE TRACK)
    drawRestoredTrain();

    // 🌘 REALISM PASS (Front Truss & Mirror Reflection 🔥)
    drawBridgeTruss(true);
    drawReflectionAndShadow(isSunset, isNight);

    // 🌳 FOREGROUND GROUNDING
    let foreOffset = (canvas.height < 500) ? 60 : 40; 
    if (!isBridgeBiome) {
        drawForegroundGrass(foreOffset);
    }
    
    // Render Particles (Sparks, Smoke, Fire)
    particles.forEach(p => {
        ctx.globalAlpha = p.a;
        if(p.type === 'smoke') {
            ctx.fillStyle = isNight ? 'rgba(50,50,50,0.5)' : 'rgba(200,200,200,0.5)';
            ctx.beginPath(); ctx.arc(p.x, p.y, p.sz, 0, Math.PI*2); ctx.fill();
        } else {
            ctx.fillStyle = p.c;
            if(p.type === 'spark') {
                ctx.beginPath(); ctx.arc(p.x, p.y, Math.random()*3 + 1, 0, Math.PI*2); ctx.fill();
            } else if(p.type === 'fire') {
                ctx.fillRect(p.x, p.y, 4, 4);
            }
        }
    });
    ctx.globalAlpha = 1.0;

    // 🌧️ 12. LAYERED 3D RAIN (Final Plus)
    if (rainAlpha > 0) {
        rainDrops.forEach(d => {
            // Foreground drops move faster and look thicker
            let isForeground = d.layer === 'front';
            ctx.lineWidth = isForeground ? sc(2) : sc(1);
            ctx.strokeStyle = isForeground ? `rgba(200, 230, 255, ${rainAlpha})` : `rgba(150, 150, 200, ${rainAlpha * 0.5})`;
            
            // Illuminating rain in the headlight cone
            let isIlluminated = lampsOn && d.x > CONFIG.trainX + 500 && d.y > CONFIG.trackY - 200 && d.y < CONFIG.trackY + 300;
            if(isIlluminated) {
                ctx.strokeStyle = `rgba(255, 255, 100, ${rainAlpha})`;
                ctx.lineWidth = sc(3);
            }
            
            ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d.x - (speed/2), d.y + d.s); ctx.stroke();
        });
    }

    // 🌙 13. AMBIENT NIGHT OVERLAY (Final Plus)
    const skyPhase = Math.sin((timeOfDay / 1000) * Math.PI * 2);
    if (skyPhase < -0.1) {
        ctx.fillStyle = `rgba(0, 0, 40, ${ Math.min(0.5, Math.abs(skyPhase) * 0.6) })`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Foreground High-Speed Overlay (Softened for Realism)
    foregroundObjects.forEach(f => {
        ctx.save();
        if(f.isPole) {
            ctx.fillStyle = '#222'; ctx.fillRect(f.x, CONFIG.trackY + 10, 20, canvas.height);
            ctx.fillStyle = '#ff3333'; ctx.fillRect(f.x - 5, CONFIG.trackY + 20, 30, 30);
        } else {
            // 🌳 3D BOURNE BUSHES (Radial Gradient Lighting)
            let bushGrd = ctx.createRadialGradient(f.x, canvas.height - 40, 10, f.x, canvas.height + 40, 120);
            bushGrd.addColorStop(0, '#1a3d1a'); // Inner core
            bushGrd.addColorStop(0.6, '#0f2f0f'); // Mid
            bushGrd.addColorStop(1, '#051505'); // Deep base
            
            ctx.shadowBlur = 15; ctx.shadowColor = 'rgba(0,0,0,0.5)';
            ctx.fillStyle = bushGrd; 
            ctx.beginPath(); ctx.arc(f.x, canvas.height + 40, 110, 0, Math.PI*2); ctx.fill();
            
            // Atmospheric Light-Wrap (Makes the bush feel 'In' the sunlight)
            ctx.globalAlpha = 0.15;
            ctx.fillStyle = isSunset ? '#ffa07a' : '#ffffff';
            ctx.beginPath(); ctx.arc(f.x, canvas.height + 40, 115, 0, Math.PI*2); ctx.stroke();
        }
        ctx.restore();
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

    // 🚦 SIGNALS (FINAL LAYER)
    drawSignals4Aspect();

    // 🌨️ 14. ATMOSPHERIC OVERLAYS (Final Pro)
    if (weather === 'STORM') {
        ctx.fillStyle = `rgba(0, 5, 10, ${rainAlpha * 0.4})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    
    // 💨 KINETIC MOTION BLUR
    if (speed > 8) {
        ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(0.08, (speed - 8)*0.01)})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    ctx.restore();
}

function drawSignals4Aspect() {
    signals.forEach(s => {
        let sx = s.x - worldDistance + (canvas.width / 2);
        if(sx > -100 && sx < canvas.width + 100) {
            let signalY = CONFIG.trackY; // 🎯 GROUNDED SIGNAL POSITION
            
            ctx.fillStyle = '#222'; 
            ctx.fillRect(sx, signalY - sc(350), sc(12), sc(350)); 
            ctx.fillStyle = '#111'; 
            ctx.fillRect(sx - sc(15), signalY - sc(350), sc(42), sc(110));
            
            // Adaptive Wire Height for aspect center
            let aspectY = signalY - sc(320);
            
            const drawAspect = (yOff, color, active) => {
                ctx.fillStyle = active ? color : '#333';
                ctx.beginPath(); ctx.arc(sx+sc(6), aspectY + sc(yOff), sc(10), 0, Math.PI*2); ctx.fill();
                if(active) { ctx.save(); ctx.shadowBlur = 15; ctx.shadowColor = color; ctx.stroke(); ctx.restore(); }
            };
            drawAspect(0, '#0f0', s.aspect === 'GREEN'); 
            drawAspect(25, '#ff0', s.aspect === 'DOUBLE_YELLOW' || s.aspect === 'YELLOW'); 
            drawAspect(50, '#ff0', s.aspect === 'DOUBLE_YELLOW'); 
            drawAspect(75, '#f00', s.aspect === 'RED');
        }
    });
}

function drawDDUDisplay() {
    if(!dctx) return;
    dctx.fillStyle = '#051005';
    dctx.fillRect(0, 0, dduCanvas.width, dduCanvas.height);
    
    // Scanline & Flicker Effect (V151.15)
    dctx.fillStyle = 'rgba(0, 255, 0, 0.02)';
    for(let i=0; i<dduCanvas.height; i+=4) dctx.fillRect(0, i, dduCanvas.width, 2);
    if(Math.random() > 0.98) { dctx.fillStyle = 'rgba(0,255,0,0.05)'; dctx.fillRect(0,0,300,150); }

    dctx.fillStyle = '#00ff44';
    dctx.font = 'bold 16px Courier New';
    dctx.fillText(">> LOCO DIAGNOSTICS - WAP7", 15, 25);
    
    dctx.font = '14px Courier New';
    dctx.fillText(`SPEED: ${(speed*10).toFixed(1)} KM/H`, 15, 55);
    
    // Status Logic
    if (isWaitingForStarter) {
        dctx.fillStyle = '#ff9900';
        // 🕒 Precise Starter Countdown
        let timeLeft = Math.max(0, starterTimer).toFixed(1);
        dctx.fillText(`STATUS: SIGNAL CLEARANCE (${timeLeft}s)`, 15, 80);
    } else if (gameState === G_STATE.BOARDING) {
        dctx.fillStyle = '#00ccff';
        // 🕒 Precise 7s Countdown (Frame based)
        let timeLeft = Math.max(0, (dwellTimer / 60)).toFixed(1);
        dctx.fillText(`STATUS: BOARDING (${timeLeft}s)`, 15, 80);
    } else if (brakeNotch === 5 && speed === 0 && throttleNotch === 0) {
        dctx.fillStyle = '#ff3333';
        dctx.fillText("STATUS: EMERGENCY - SIGNAL JUMP", 15, 80);
    } else {
        dctx.fillStyle = '#00ff44';
        dctx.fillText(`NOTCH: ${throttleNotch > 0 ? "P" + throttleNotch : (brakeNotch > 0 ? "B" + brakeNotch : "N0")}`, 15, 80);
    }
    
    let bp = (5.0 - (brakeNotch * 0.4)).toFixed(1);
    dctx.fillStyle = '#00ff44';
    dctx.fillText(`BP PRESSURE: ${bp} KG/CM2`, 15, 100);
    
    // Mission Status
    let nextStation = stations.find(s => s.x > worldDistance);
    if(nextStation) {
        let d = ((nextStation.x - worldDistance) / 1000).toFixed(1);
        dctx.fillStyle = '#ffcc00';
        dctx.fillText(`NEXT: ${nextStation.name} (${d} KM)`, 15, 130);
    }
    
    // Load Bar
    dctx.fillStyle = '#111'; dctx.fillRect(260, 45, 20, 80);
    dctx.fillStyle = (throttleNotch > 0) ? '#00ff00' : (brakeNotch > 0 ? '#ff3333' : '#444');
    let h = (throttleNotch / 8) * 80 || (brakeNotch / 5) * 80;
    dctx.fillRect(260, 125 - h, 20, h);
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
    
    let redGrd = ctx.createLinearGradient(0, y, 0, y + H/2);
    redGrd.addColorStop(0, '#e74c3c'); redGrd.addColorStop(1, '#922b21');
    ctx.fillStyle = redGrd; ctx.fillRect(x, y, W, H/2); 
    
    let greyGrd = ctx.createLinearGradient(0, y + H/2, 0, y + H);
    greyGrd.addColorStop(0, '#bdc3c7'); greyGrd.addColorStop(1, '#566573');
    ctx.fillStyle = greyGrd; ctx.fillRect(x, y + H/2, W, H/2); 
    
    ctx.strokeStyle = '#b30000'; ctx.lineWidth = 1;
    for(let r=0; r<W; r+=sc(12)) {
        ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + r, y + sc(6)); ctx.stroke();
    }
    
    const doorW = sc(35), doorH = H - sc(16), dx = x + sc(5), dy = y + sc(8);
    ctx.fillStyle = '#111';
    ctx.fillRect(dx, dy, doorW, doorH); 
    ctx.fillRect(x + W - sc(40), dy, doorW, doorH); 
    
    ctx.fillStyle = '#a93226';
    ctx.fillRect(dx + (doorOpenAmount * doorW), dy, doorW, doorH);
    ctx.fillRect(x + W - sc(40) - (doorOpenAmount * doorW), dy, doorW, doorH);
    
    ctx.fillStyle = '#f1c40f';
    ctx.fillRect(dx-sc(1), y + sc(16), sc(2), sc(45)); 
    ctx.fillRect(dx+doorW+sc(1), y + sc(16), sc(2), sc(45));
    ctx.fillRect(x + W - sc(41), y + sc(16), sc(2), sc(45)); 
    ctx.fillRect(x + W - sc(5), y + sc(16), sc(2), sc(45));

    for(let i=0; i<7; i++) {
        let wx = x + sc(60) + i * sc(42);
        ctx.fillStyle = '#111'; ctx.fillRect(wx, y + sc(12), sc(30), sc(38)); 
        let wGrd = ctx.createLinearGradient(wx, y+sc(15), wx+sc(22), y+sc(47));
        wGrd.addColorStop(0, 'rgba(41, 128, 185, 0.9)'); wGrd.addColorStop(1, 'rgba(21, 67, 96, 0.95)');
        ctx.fillStyle = wGrd; ctx.fillRect(wx + sc(3), y + sc(15), sc(24), sc(32)); 
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
    
    // Spoke/Movement indicators (Added more for better rotation visual)
    ctx.fillStyle = '#bdc3c7'; 
    for(let i=0; i<4; i++) {
        ctx.rotate(Math.PI/4);
        ctx.fillRect(-sc(2), -sc(16), sc(4), sc(32)); 
    }
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
    const pW = sc(15000); // 🚉 MEGA PLATFORM UPGRADE (Grand Scale)
    const platformY = CONFIG.trackY - sc(10); 
    
    // 🧱 1. THE PLATFORM SLAB (3D Depth)
    // Top Surface
    ctx.fillStyle = '#95a5a6'; 
    ctx.fillRect(x - pW/2, platformY, pW, sc(15));
    
    // Front Wall (Vertical Face)
    let wallGrd = ctx.createLinearGradient(0, platformY + sc(15), 0, platformY + sc(110));
    wallGrd.addColorStop(0, '#7f8c8d');
    wallGrd.addColorStop(1, '#2c3e50');
    ctx.fillStyle = wallGrd;
    ctx.fillRect(x - pW/2, platformY + sc(15), pW, sc(95));

    // 🟡 Safety Yellow Line (Grounded)
    ctx.fillStyle = '#f1c40f';
    ctx.fillRect(x - pW/2, platformY + sc(2), pW, sc(5));

    // 🏠 2. THE ROOF (Aligned to Pillars)
    const roofY = CONFIG.trackY - sc(450);
    const roofHeight = sc(150);
    const pillarTopY = roofY + roofHeight;

    let roofGrd = ctx.createLinearGradient(0, roofY, 0, pillarTopY);
    roofGrd.addColorStop(0, '#5a1f1f');
    roofGrd.addColorStop(1, '#8b2e2e');
    ctx.fillStyle = roofGrd;
    ctx.fillRect(x - pW/2, roofY, pW, roofHeight);
    
    // Roof Structural Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(x - pW/2, pillarTopY - sc(5), pW, sc(10));
    
    // Corrugated Metal Ribbing
    ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth = 1;
    for(let r=0; r<roofHeight; r+=sc(12)) {
        ctx.beginPath(); ctx.moveTo(x - pW/2, roofY + r); ctx.lineTo(x + pW/2, roofY + r); ctx.stroke();
    }
    
    // 📐 3. SLOPED ENDINGS (The 'End Cap' Logic)
    const drawEndSlope = (side) => {
        let ex = (side === 'left') ? x - pW/2 : x + pW/2;
        ctx.beginPath();
        ctx.moveTo(ex, platformY);
        ctx.lineTo(ex + (side === 'left' ? -sc(150) : sc(150)), platformY + sc(110));
        ctx.lineTo(ex, platformY + sc(110));
        ctx.closePath();
        ctx.fillStyle = '#2c3e50';
        ctx.fill();
    };
    drawEndSlope('left');
    drawEndSlope('right');

    const hindiNames = { "KOLLAM JCT": "कोल्लम जंक्शन", "PARAVUR": "परवूर", "VARKALA SIVAGIRI": "वरकला शिवगिरि", "KADAKKAVUR": "कडक्कावूर", "CHIRAYINKEEZHU": "चिरायिनकीझु", "TRIVANDRUM CENTRAL": "तिरुवनंतपुरम सेंट्रल" };
    const hindiName = hindiNames[name] || "";

    for(let k=0; k<45; k++) {
        let sx = x - pW/2.1 + (k * sc(400));
        
        // 🏛️ 4. PILLARS (Perfectly Grounded: Roof -> Platform)
        ctx.fillStyle = '#7f8c8d'; 
        ctx.fillRect(sx, pillarTopY, sc(15), platformY - pillarTopY); 
        ctx.fillStyle = '#444'; // Depth Shadow
        ctx.fillRect(sx + sc(12), pillarTopY, sc(3), platformY - pillarTopY); 
        
        // Digital LED indicators
        if (k % 2 === 0) {
            ctx.fillStyle = '#111'; ctx.fillRect(sx - sc(40), pillarTopY + sc(20), sc(100), sc(30));
            ctx.fillStyle = '#ff3333'; ctx.font = `bold ${sc(12)}px monospace`; ctx.fillText('ETA 05 MIN', sx + sc(10), pillarTopY + sc(40));
        }
        
        // Authentic Station Display Board
        if (k % 5 === 1) {
            ctx.fillStyle = '#111'; ctx.fillRect(sx + sc(10), platformY - sc(180), sc(6), sc(180)); // Grounded Posts
            ctx.fillRect(sx + sc(180), platformY - sc(180), sc(6), sc(180));
            
            ctx.fillStyle = '#ffcc00'; ctx.fillRect(sx, platformY - sc(180), sc(200), sc(80)); 
            ctx.strokeStyle = '#000'; ctx.lineWidth = sc(4); ctx.strokeRect(sx, platformY - sc(180), sc(200), sc(80));
            
            ctx.fillStyle = '#000'; 
            ctx.textAlign = 'center';
            ctx.font = `bold ${sc(20)}px Arial`; ctx.fillText(name, sx + sc(100), platformY - sc(130)); 
            ctx.font = `bold ${sc(14)}px Arial`; ctx.fillText(hindiName, sx + sc(100), platformY - sc(155)); 
        }
        
        // Benches and Stalls (Grounded to Platform)
        if (k % 3 === 0) {
            ctx.fillStyle = '#8e44ad'; ctx.fillRect(sx + 50, platformY - sc(30), sc(60), sc(30));
            ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(sx + 80, platformY - sc(45), sc(10), 0, Math.PI*2); ctx.fill(); // Person
        }
    }
    
    // 🎭 5. LIFE & ACTIVITY (Vibrant Indian Crowd System 🔥)
    const seed = name.length; 
    const crowdColors = ['#e67e22', '#c0392b', '#16a085', '#2980b9', '#f1c40f', '#ecf0f1', '#34495e', '#ffffff'];
    
    for(let j=0; j<70; j++) { 
        // 🏗️ 5A. GROUP CLUSTERING LOGIC (Ending the Loneliness)
        // Deterministic clustering based on station seed
        let clusterSeed = Math.sin(seed + j * 12.3);
        let pxBase = x - pW/2.2 + (j * sc(220)); 
        if (pxBase < x - pW/2 || pxBase > x + pW/2) continue;

        let groupSize = Math.floor(1 + Math.abs(clusterSeed * 4));
        for(let g=0; g<groupSize; g++) {
            let memberSeed = Math.sin(j + g * 3.3);
            let px = pxBase + (g * sc(22)) + (memberSeed * sc(10));
            let py = platformY;
            
            // Human Body (Vibrant clothing colors)
            let clothesColor = crowdColors[Math.abs(Math.floor(memberSeed * 10)) % crowdColors.length];
            ctx.fillStyle = clothesColor;
            let pHeight = sc(38) + (memberSeed * sc(5));
            ctx.beginPath();
            ctx.moveTo(px - sc(8), py); ctx.lineTo(px + sc(8), py);
            ctx.lineTo(px + sc(6), py - pHeight); ctx.lineTo(px - sc(6), py - pHeight);
            ctx.fill();

            // Head
            ctx.fillStyle = '#111';
            ctx.beginPath(); ctx.arc(px, py - pHeight - sc(6), sc(7), 0, Math.PI*2); ctx.fill();

            // 💼 LUGGAGE Props (Suitcases & Backpacks)
            if (g === 0 && clusterSeed > 0.2) {
                ctx.fillStyle = '#2c3e50'; 
                ctx.fillRect(px + sc(15), py - sc(15), sc(22), sc(15));
                if (clusterSeed > 0.6) {
                    ctx.fillStyle = '#7f8c8d'; ctx.fillRect(px + sc(18), py - sc(35), sc(15), sc(20));
                }
            }
        }
    }

    // 🛋️ 6. SITTING PASSENGERS (Grounded to Benches)
    for(let k=0; k<20; k++) {
        if (k % 3 === 0) {
            let sx = x - pW/2.5 + (k * sc(400)) + 80;
            
            // Purple Bench
            ctx.fillStyle = '#8e44ad'; 
            ctx.fillRect(sx - 30, platformY - sc(30), sc(60), sc(30));
            ctx.fillStyle = '#6c3483'; 
            ctx.fillRect(sx - 25, platformY - sc(30), sc(50), sc(5)); // Cushion

            // Sitting Person (Specifically posed)
            ctx.fillStyle = '#0a0a0a';
            ctx.beginPath(); 
            ctx.arc(sx, platformY - sc(42), sc(8), 0, Math.PI*2); // Head
            ctx.fill();
            ctx.fillRect(sx - sc(6), platformY - sc(34), sc(12), sc(20)); // Torso
            
            // Sitting knees
            ctx.fillRect(sx, platformY - sc(20), sc(15), sc(4)); 
            ctx.fillRect(sx + sc(12), platformY - sc(20), sc(4), sc(15)); // Legs down
        }
    }
}

function drawOHELines() { 
    let poleOffset = bgX % sc(450); 
    let wireY = (canvas.height < 500) ? CONFIG.trackY - sc(200) : CONFIG.trackY - sc(325);
    ctx.lineWidth = sc(2); ctx.strokeStyle = '#333'; ctx.beginPath(); ctx.moveTo(0, wireY); ctx.lineTo(canvas.width, wireY); ctx.stroke();
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

function drawMegaBridge(x, width, isSunset, isNight) {
    // 🧬 1. QUANTUM PHYSICS CALCULATIONS (The Pulse & The Jitter)
    let pulse = Math.sin(Date.now() / 1500) * 0.15 + 0.85; // Light-bounce oscillation
    let jitterY = (speed > 5) ? (Math.random() - 0.5) * (speed / 12) : 0; // High-frequency structural vibration
    
    // 🌉 2. SHIP-BASE (Deep Sea/Mist Floor)
    let mistBase = isSunset ? '#2a1a1a' : (isNight ? '#050a1a' : '#102535');
    ctx.fillStyle = mistBase; ctx.fillRect(0, CONFIG.trackY+1, canvas.width, canvas.height); 
    
    ctx.save(); 
    ctx.translate(x, jitterY); // Apply structural vibration matrix

    // 🏗️ 3. REINFORCED ARCH ARCHITECTURE
    for(let i=0; i<Math.floor(width/650); i++) { 
        let px = i*650; 
        
        // 🪨 Weathered Masonry (With Neural Decals)
        let stoneGrd = ctx.createLinearGradient(px, CONFIG.trackY, px+120, CONFIG.trackY);
        stoneGrd.addColorStop(0, '#1a1d1a'); stoneGrd.addColorStop(0.5, '#2c352c'); stoneGrd.addColorStop(1, '#0a0d0a');
        ctx.fillStyle = stoneGrd; 
        ctx.fillRect(px, CONFIG.trackY+1, 120, canvas.height); 

        // Procedural Staining (Weathering Decals)
        if(i % 2 === 0) {
            ctx.fillStyle = 'rgba(0, 20, 0, 0.15)'; // Moss/Algae
            ctx.fillRect(px+20, CONFIG.trackY + 150, 40, 300);
        }

        // 🌑 DYNAMIC PULSE DEPTH (Neural Ambient Occlusion)
        ctx.beginPath(); 
        ctx.moveTo(px+120, CONFIG.trackY+1); 
        ctx.quadraticCurveTo(px+380, CONFIG.trackY+240, px+600, CONFIG.trackY+1); 
        
        let archGrd = ctx.createRadialGradient(px+360, CONFIG.trackY+80, 50, px+360, CONFIG.trackY+80, 250);
        archGrd.addColorStop(0, `rgba(0,0,0,${0.85 * pulse})`); // Shadow actually pulses with life
        archGrd.addColorStop(1, 'rgba(15, 25, 15, 0.4)'); 
        ctx.fillStyle = archGrd; ctx.fill(); 

        ctx.strokeStyle = `rgba(61, 69, 61, ${0.4 * pulse})`; ctx.lineWidth = 4;
        ctx.stroke();
    }

    // 🔩 4. SPECULAR TRUSS SYSTEM (Neural Bloom Engine)
    for(let i=0; i<Math.floor(width/900); i++) {
        let tx = i*900; 
        
        // Base Steel Frame
        ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 8;
        ctx.strokeRect(tx, CONFIG.trackY-480, 900, 480);
        
        // Composite Specular Pass (Molecular Metal Glow)
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = isSunset ? 'rgba(255, 180, 100, 0.12)' : 'rgba(255, 255, 255, 0.08)';
        ctx.lineWidth = 4;
        ctx.beginPath(); 
        ctx.moveTo(tx, CONFIG.trackY-480); ctx.lineTo(tx+450, CONFIG.trackY); ctx.lineTo(tx+900, CONFIG.trackY-480); 
        ctx.stroke();
        
        // Kinetic High-Speed Glint
        let glintOff = (worldDistance / 10) % 900;
        ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(tx + glintOff, CONFIG.trackY-480); ctx.lineTo(tx + glintOff + 20, CONFIG.trackY-480); 
        ctx.stroke();
        ctx.restore();
    }
    ctx.restore();
}
function drawBridgeLower(isHigh = false) {
    const archWidth = 800;
    const startX = - (worldDistance % archWidth) - archWidth;
    
    for (let i = 0; i < 10; i++) {
        let x = startX + (i * archWidth);
        let worldX = worldDistance + (x - (canvas.width / 2)) + (archWidth / 2);
        let sType = getStructuralType(worldX);
        
        // 🧪 STEEL-ONLY GUARD
        if (sType.main !== 'bridge' || sType.sub !== 'STEEL') continue;

        let girderH = sc(50);
        ctx.fillStyle = '#2b2b2b';
        ctx.fillRect(x, CONFIG.trackY + sc(20), archWidth - sc(20), girderH);

        // Diagonal Supports (Steel Lattice)
        ctx.strokeStyle = '#444'; ctx.lineWidth = sc(3); ctx.beginPath();
        for(let j=0; j<8; j++) {
            let segX = x + (j * (archWidth/8));
            ctx.moveTo(segX, CONFIG.trackY + sc(20)); ctx.lineTo(segX + (archWidth/8), CONFIG.trackY + sc(20) + girderH);
            ctx.moveTo(segX + (archWidth/8), CONFIG.trackY + sc(20)); ctx.lineTo(segX, CONFIG.trackY + sc(20) + girderH);
        }
        ctx.stroke();

        ctx.fillStyle = '#111';
        ctx.fillRect(x + (archWidth/2) - sc(30), CONFIG.trackY + sc(70), sc(60), canvas.height);
        ctx.fillStyle = '#050a05';
        ctx.fillRect(x + (archWidth/2) - sc(45), CONFIG.trackY + sc(250), sc(90), sc(30));
    }
}

function drawBridgeTruss(isForeground) {
    const archWidth = 800;
    const startX = - (worldDistance % archWidth) - archWidth;
    const trussHeight = sc(300);
    
    ctx.save();
    ctx.strokeStyle = isForeground ? '#1a1a1a' : '#2b2b2b';
    ctx.lineWidth = isForeground ? sc(12) : sc(8);
    
    for (let i = 0; i < 10; i++) {
        let x = startX + (i * archWidth);
        let worldX = worldDistance + (x - (canvas.width / 2)) + (archWidth / 2);
        let sType = getStructuralType(worldX);
        
        // 🧪 STEEL-ONLY GUARD
        if (sType.main !== 'bridge' || sType.sub !== 'STEEL') continue;

        let tx = x + sc(10);
        let tw = archWidth - sc(40);

        ctx.beginPath();
        ctx.moveTo(tx, CONFIG.trackY); ctx.lineTo(tx, CONFIG.trackY - trussHeight);
        ctx.moveTo(tx + tw, CONFIG.trackY); ctx.lineTo(tx + tw, CONFIG.trackY - trussHeight);
        ctx.moveTo(tx, CONFIG.trackY - trussHeight); ctx.lineTo(tx + tw, CONFIG.trackY - trussHeight);
        ctx.stroke();

        ctx.lineWidth = isForeground ? sc(8) : sc(5);
        ctx.beginPath();
        let segments = 3; let segW = tw / segments;
        for(let j=0; j<segments; j++) {
            let sx = tx + (j * segW);
            ctx.moveTo(sx, CONFIG.trackY); ctx.lineTo(sx + segW, CONFIG.trackY - trussHeight);
            ctx.moveTo(sx + segW, CONFIG.trackY); ctx.lineTo(sx, CONFIG.trackY - trussHeight);
        }
        ctx.stroke();
        
        if(isForeground) {
            ctx.fillStyle = 'rgba(20, 20, 25, 0.8)';
            ctx.fillRect(tx, CONFIG.trackY - trussHeight - sc(10), tw, sc(15));
        }
    }
    ctx.restore();
}

function drawEarthenBase(isSunset, isNight) {
    // 🏗️ SPATIAL GROUND (Only draws where NO bridge exists)
    ctx.fillStyle = isNight ? '#0a0d0a' : '#1a1d1a';
    ctx.fillRect(0, CONFIG.trackY + sc(2), canvas.width, 48); 
    
    // Draw base only in segments categorized as 'ground'
    for(let i=0; i<canvas.width; i+=400) {
        let worldX = worldDistance + (i - (canvas.width / 2));
        if (getStructuralType(worldX).main === 'bridge') continue;

        ctx.beginPath();
        let grd = ctx.createLinearGradient(0, CONFIG.trackY + 40, 0, canvas.height);
        grd.addColorStop(0, '#101510'); grd.addColorStop(1, '#050a05');
        ctx.fillStyle = grd;
        ctx.fillRect(i, CONFIG.trackY + 40, 401, canvas.height);
    }
}

// 🌉 ULTRA REAL CONCRETE BRIDGE (Proposed Indian Style 🔥)
function drawConcreteBridgeLower(isSunset, isNight) {
    const archWidth = 600;
    const startX = - (worldDistance % archWidth) - archWidth;
    const waterY = CONFIG.trackY + sc(120);

    for (let i = 0; i < 12; i++) {
        let x = startX + (i * archWidth);
        let worldX = worldDistance + (x - (canvas.width / 2)) + (archWidth / 2);
        let sType = getStructuralType(worldX);
        if (sType.main !== 'bridge' || sType.sub !== 'WATER') continue;

        // 1. CONCRETE PILLARS
        ctx.fillStyle = isNight ? '#2c3e50' : '#bdc3c7';
        ctx.fillRect(x + sc(100), CONFIG.trackY + sc(20), sc(100), waterY - CONFIG.trackY);
        
        // Depth Shadow on pillar sides
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.fillRect(x + sc(100), CONFIG.trackY + sc(20), sc(15), waterY - CONFIG.trackY);

        // 2. INDIAN ARCH CUTS (Visual Depth Engine)
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();
        ctx.arc(x + archWidth/2, waterY, sc(180), Math.PI, 0);
        ctx.fill();
        ctx.restore();
        
        // 3. SAFETY LINES (Indian Railway Detail)
        ctx.fillStyle = '#f1c40f'; 
        ctx.fillRect(0, CONFIG.trackY + sc(18), canvas.width, sc(4));
    }
}

function drawMovingWater(isNight) {
    waterOffset += 0.8;
    const waterY = CONFIG.trackY + sc(120);
    
    // 🌊 1. DEEP WATER GRADIENT
    let grd = ctx.createLinearGradient(0, waterY, 0, canvas.height);
    grd.addColorStop(0, '#1e3f66');
    grd.addColorStop(0.4, '#001a33');
    grd.addColorStop(1, '#000');
    ctx.fillStyle = grd;
    ctx.fillRect(0, waterY, canvas.width, canvas.height - waterY);

    // 〰️ 2. PROCEDURAL WAVE SYSTEM
    ctx.strokeStyle = isNight ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 2;
    for (let x = 0; x < canvas.width; x += sc(60)) {
        let waveY = waterY + Math.sin((x + (waterOffset * (1.5))) * 0.04) * sc(8);
        ctx.beginPath();
        ctx.moveTo(x, waveY);
        ctx.lineTo(x + sc(30), waveY);
        ctx.stroke();
    }
}

// 🌘 REALISM PASS: REFLECTIONS & SHADOWS
function drawReflectionAndShadow(isSunset, isNight) {
    const waterY = CONFIG.trackY + sc(120);
    const sType = getStructuralType(worldDistance + 400);
    if(sType.sub !== 'WATER') return;

    // 1. TRAIN SHADOW (Ambient Occlusion)
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath();
    ctx.ellipse(CONFIG.trainX + sc(400), CONFIG.trackY + sc(75), sc(600), sc(25), 0, 0, Math.PI * 2);
    ctx.fill();

    // 2. INSANE REALISM REFLECTION
    ctx.save();
    ctx.globalAlpha = isNight ? 0.08 : 0.18;
    ctx.translate(0, waterY * 2);
    ctx.scale(1, -1); // Physics flip!
    
    // We only reflect the WAP-7 body for performance
    drawWAP7Procedural(CONFIG.trainX, CONFIG.trackY);
    ctx.restore();
}


function drawLevelCrossing(sx, id) {
    const roadW = sc(500);
    const gateY = CONFIG.trackY;
    
    // 🛣️ 1. ROAD SURFACE
    ctx.fillStyle = '#222';
    ctx.fillRect(sx - roadW/2, gateY, roadW, sc(60));
    
    // 🎨 2. ROAD MARKINGS
    ctx.fillStyle = '#eee';
    for(let j=0; j<5; j++) {
        ctx.fillRect(sx - roadW/2 + (j*sc(110)), gateY + sc(20), sc(60), sc(10));
    }

    // 🚧 3. LC POSTS & GATES
    const postX = [sx - roadW/2 - sc(20), sx + roadW/2 + sc(20)];
    postX.forEach(px => {
        // Base Post
        ctx.fillStyle = '#444'; ctx.fillRect(px, gateY - sc(250), sc(15), sc(250));
        
        // Gate Arm (Yellow/Black Stripes)
        ctx.save();
        ctx.translate(px + sc(7.5), gateY - sc(80));
        
        // Rotate gate down as train approaches
        let dist = Math.abs(sx - CONFIG.trainX);
        let angle = (dist < 1000) ? 0 : -Math.PI/3; 
        ctx.rotate(angle);
        
        const armL = sc(450);
        ctx.fillStyle = '#f1c40f'; // Yellow
        ctx.fillRect(0, -sc(10), (px < sx ? armL : -armL), sc(20));
        
        // Black Stripes
        ctx.fillStyle = '#111';
        for(let k=0; k<10; k++) {
            ctx.fillRect((px < sx ? k*sc(45) : -k*sc(45)), -sc(10), sc(20), sc(20));
        }
        ctx.restore();

        // 🔴 FLASHING LIGHTS
        ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(px + sc(7.5), gateY - sc(150), sc(18), 0, Math.PI*2); ctx.fill();
        if(window.lcFlash && dist < 3000) {
            ctx.fillStyle = '#ff0000';
            ctx.beginPath(); ctx.arc(px + sc(7.5), gateY - sc(150), sc(12), 0, Math.PI*2); ctx.fill();
            // Glow
            ctx.shadowBlur = 15; ctx.shadowColor = 'red'; ctx.stroke(); ctx.shadowBlur = 0;
        }
    });

    // 🚩 STOP SIGNS
    ctx.fillStyle = '#c0392b';
    ctx.beginPath();
    let signX = sx - roadW/2 - sc(80);
    ctx.moveTo(signX, gateY - sc(220));
    for(let a=0; a<8; a++) {
        ctx.lineTo(signX + sc(25)*Math.cos(a*Math.PI/4), gateY - sc(220) + sc(25)*Math.sin(a*Math.PI/4));
    }
    ctx.fill();
    ctx.fillStyle = 'white'; ctx.font = `bold ${sc(10)}px Arial`; ctx.textAlign = 'center';
    ctx.fillText("STOP", signX, gateY - sc(216));
}

window.onload = init;