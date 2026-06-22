/**
 * 🌉 BACKEND BRIDGE — Central JS↔C# API Client
 * Provides cached, non-blocking access to all C# backend engines:
 *   • RouteEngine    → /api/route
 *   • SignalEngine   → /api/signal
 *   • WeatherEngine  → /api/weather
 *   • AIScheduler    → /api/scheduler
 *   • ScoreEngine    → /api/score
 *
 * Falls back gracefully if the backend is offline.
 */

const BASE_URL = 'http://localhost:5000';
const TIMEOUT_MS = 800;
const POLL_INTERVAL_MS = 500; // update every 500ms

/** Lightweight fetch with timeout and JSON parsing */
async function apiFetch(path, opts = {}) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
        const res = await fetch(`${BASE_URL}${path}`, {
            ...opts,
            signal: ctrl.signal,
            headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) }
        });
        clearTimeout(timer);
        if (!res.ok) return null;
        return await res.json();
    } catch {
        clearTimeout(timer);
        return null;
    }
}

class BackendBridge {
    constructor() {
        this.online = false;
        this._lastKm = -1;

        // ── Cached state from each engine ──
        this.route = {
            speedLimit: 110,          // km/h
            gradient: { slope: 0, label: 'LEVEL' },
            bridgesAhead: [],
            stationsAhead: [],
            nextStation: null,
        };
        this.signal = {
            nextAspect: 'CLEAR',
            restrictiveSpeed: 110,
            callout: '',
        };
        this.weather = {
            type: 'CLEAR',
            adhesion: 0.30,
            brakingFactor: 1.0,
            visibility: 10000,
            rainfallIntensity: 0,
        };
        this.scheduler = {
            activeTrains: [],
            nextMeet: null,
            spawnRecommendation: null,
        };
        this.score = {
            totalScore: 1000,
            grade: 'A+',
            violations: [],
            punctualityScore: 100,
        };

        this._pollTimer = null;
        this._checkOnline();
    }

    /** Ping the backend to see if it's available */
    async _checkOnline() {
        try {
            const ctrl = new AbortController();
            setTimeout(() => ctrl.abort(), 1000);
            const res = await fetch(`${BASE_URL}/`, { signal: ctrl.signal });
            this.online = res.ok;
            if (this.online) console.log('🔗 BackendBridge: All C# engines online.');
        } catch {
            this.online = false;
            console.warn('⚠️ BackendBridge: C# backend offline — using JS fallbacks.');
        }
    }

    /** Called every frame from GameScene.update — debounced by position */
    async pollAll(km, gameTimeMin, playerSpeedKmh) {
        if (!this.online) return;
        // Only poll when position changes meaningfully (every 50m)
        if (Math.abs(km - this._lastKm) < 0.05) return;
        this._lastKm = km;

        // Fire all polls concurrently — non-blocking
        Promise.all([
            this._pollRoute(km),
            this._pollSignal(km, playerSpeedKmh),
            this._pollWeather(km, gameTimeMin),
            this._pollScheduler(km, gameTimeMin, playerSpeedKmh),
            this._pollScore(),
        ]).catch(() => {});
    }

    async _pollRoute(km) {
        const data = await apiFetch(`/api/route/ahead?km=${km.toFixed(3)}&lookAheadKm=5`);
        if (!data) return;
        this.route.speedLimit    = data.currentSpeedLimit ?? this.route.speedLimit;
        this.route.gradient      = data.gradient          ?? this.route.gradient;
        this.route.bridgesAhead  = data.bridges           ?? [];
        this.route.stationsAhead = data.stations          ?? [];
        this.route.nextStation   = data.nextStation       ?? null;
    }

    async _pollSignal(km, speedKmh) {
        const data = await apiFetch(`/api/signal/state?km=${km.toFixed(3)}&speedKmh=${(speedKmh||0).toFixed(1)}`);
        if (!data) return;
        this.signal.nextAspect       = data.aspect           ?? this.signal.nextAspect;
        this.signal.restrictiveSpeed = data.restrictiveSpeed  ?? this.signal.restrictiveSpeed;
        this.signal.callout          = data.callout           ?? '';
    }

    async _pollWeather(km, timeOfDay) {
        const data = await apiFetch(`/api/weather/state?km=${km.toFixed(3)}&timeOfDay=${(timeOfDay||0).toFixed(3)}`);
        if (!data) return;
        this.weather.type              = data.weatherType       ?? 'CLEAR';
        this.weather.adhesion          = data.adhesionCoeff     ?? 0.30;
        this.weather.brakingFactor     = data.brakingFactor     ?? 1.0;
        this.weather.visibility        = data.visibilityMeters  ?? 10000;
        this.weather.rainfallIntensity = data.rainfallIntensity ?? 0;
    }

    async _pollScheduler(km, gameTimeMin, playerSpeedKmh) {
        const data = await apiFetch(
            `/api/scheduler/active?playerKm=${km.toFixed(3)}&gameTimeMin=${(gameTimeMin||0).toFixed(1)}`
        );
        if (!data) return;
        this.scheduler.activeTrains = data.trains ?? [];

        const meet = await apiFetch(
            `/api/scheduler/next-meet?playerKm=${km.toFixed(3)}&playerSpeedKmh=${(playerSpeedKmh||0).toFixed(1)}&gameTimeMin=${(gameTimeMin||0).toFixed(1)}`
        );
        this.scheduler.nextMeet = meet ?? null;
    }

    async _pollScore() {
        const data = await apiFetch(`/api/score/summary`);
        if (!data) return;
        this.score.totalScore       = data.totalScore       ?? 1000;
        this.score.grade            = data.grade            ?? 'A+';
        this.score.violations       = data.violations       ?? [];
        this.score.punctualityScore = data.punctualityScore ?? 100;
    }

    // ── Reporting helpers (fire-and-forget) ──

    async reportViolation(type, km, severity = 1) {
        if (!this.online) return;
        apiFetch('/api/score/violation', {
            method: 'POST',
            body: JSON.stringify({ type, km, severity }),
        });
    }

    async reportStationArrival(stationCode, arrivalMin, scheduledMin, overshootM = 0) {
        if (!this.online) return;
        apiFetch('/api/score/station-arrival', {
            method: 'POST',
            body: JSON.stringify({ stationCode, arrivalMin, scheduledMin, overshootM }),
        });
    }

    async reportWLBoard(honked, km) {
        if (!this.online) return;
        apiFetch('/api/score/wl-board', {
            method: 'POST',
            body: JSON.stringify({ honked, km }),
        });
    }

    async reportEmergencyBrake(km, speedKmh) {
        if (!this.online) return;
        apiFetch('/api/score/emergency-brake', {
            method: 'POST',
            body: JSON.stringify({ km, speedKmh }),
        });
    }

    async activateStarter(stationCode) {
        if (!this.online) return;
        apiFetch('/api/signal/activate-starter', {
            method: 'POST',
            body: JSON.stringify({ stationCode }),
        });
    }

    async getSpawnRecommendation(km, speedKmh) {
        if (!this.online) return null;
        return apiFetch(`/api/scheduler/spawn?playerKm=${km.toFixed(3)}&playerSpeedKmh=${(speedKmh||0).toFixed(1)}`);
    }

    async resetScore() {
        if (!this.online) return;
        apiFetch('/api/score/reset', { method: 'POST' });
    }
}

// Singleton export
const bridge = new BackendBridge();
export default bridge;
