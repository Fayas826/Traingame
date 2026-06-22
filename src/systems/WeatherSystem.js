/**
 * ⛈️ WEATHER SYSTEM V2 — Uses TrackMap weather zones
 * Enhanced with C# WeatherEngine integration via BackendBridge
 */
import { WEATHER } from '../config.js';
import { WEATHER_ZONES, KM_SCALE } from '../systems/TrackMap.js';
import bridge from './BackendBridge.js';

export default class WeatherSystem {
    constructor() {
        this.weather = 'CLEAR';
        this.isRaining = false;
        this.rainAlpha = 0;
        this.dayNightCycle = 0;
        this.waterOffset = 0;
    }

    update(worldDistance, physics) {
        const dt = 1;
        const distKM = worldDistance / KM_SCALE;

        // Day/night cycle based on distance
        this.dayNightCycle = (distKM / 64.6) % 1.0;

        // Use C# WeatherEngine when available (more realistic Kerala weather)
        if (bridge.online && bridge.weather) {
            this.isRaining   = bridge.weather.rainfallIntensity > 0.1;
            this.weather     = bridge.weather.type || 'CLEAR';
            this.visibility  = bridge.weather.visibility ?? 10000;
            this.adhesion    = bridge.weather.adhesion   ?? 0.30;
        } else {
            // JS fallback — zone-based simple weather
            this.isRaining = WEATHER_ZONES.some(z => distKM > z.startKM && distKM < z.endKM && z.weather === 'RAIN');
            this.weather   = this.isRaining ? 'RAIN' : 'CLEAR';
            this.visibility  = this.isRaining ? 2000 : 10000;
            this.adhesion    = this.isRaining ? WEATHER.TRACTION_RAIN : WEATHER.TRACTION_CLEAR;
        }

        // Smooth rain alpha
        const targetAlpha = this.isRaining ? WEATHER.RAIN_MAX_ALPHA : 0;
        if (this.rainAlpha < targetAlpha) {
            this.rainAlpha = Math.min(this.rainAlpha + WEATHER.RAIN_ALPHA_FADE_IN * dt, targetAlpha);
        } else {
            this.rainAlpha = Math.max(this.rainAlpha - WEATHER.RAIN_ALPHA_FADE_OUT * dt, targetAlpha);
        }

        this.waterOffset += 0.8 * dt;

        // Apply traction modifier (prefer C# adhesion if available)
        if (physics) physics.setWeatherTraction(this.tractionModifier);
    }

    get tractionModifier() {
        return this.isRaining ? WEATHER.TRACTION_RAIN : WEATHER.TRACTION_CLEAR;
    }

    get isSunset() { return this.dayNightCycle > 0.6 && this.dayNightCycle < 0.8; }
    get isNight() { return this.dayNightCycle >= 0.8 || this.dayNightCycle < 0.1; }
    get starOpacity() { return this.isNight ? 1 : this.isSunset ? 0.3 : 0; }
}
