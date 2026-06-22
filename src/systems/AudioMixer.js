/**
 * 🔊 AUDIO MIXER — Spatial audio, track joints, crowd, engine whoop
 * Ports all audio logic from legacy lines 588–641
 */
import { AUDIO } from '../config.js';

export default class AudioMixer {
    constructor(scene) {
        this.scene = scene;
        this.audioStarted = false;
        this.lastTrackSoundDist = 0;
        this.hummingActive = false;
        this.hummStartTime = 0;
        // Phase 6: cruising motor
        this._motorOsc  = null;
        this._motorGain = null;
        this._motorSpeed = 0;
        // Phase 6: level crossing bell
        this._lcBellTimer = 0;
        this._lcBellPhase = 0;
        this._lcBellActive = false;
    }

    start() {
        if (this.scene.sound.noAudio) return;
        this.audioStarted = true;

        // Pre-create loop sound instances in sound manager so they can be retrieved by get()
        ['crowd', 'humming'].forEach(key => {
            if (this.scene.cache.audio.exists(key) && !this.scene.sound.get(key)) {
                try {
                    this.scene.sound.add(key);
                } catch (e) {}
            }
        });
    }

    update(delta, physics, stationManager, weatherSystem) {
        if (this.scene.sound.noAudio || !this.audioStarted) return;

        const speed = physics.speed;
        const worldDist = physics.worldDistance;
        const gameState = stationManager.gameState;

        // ─── 1. STATION ENGINE WHOOP (Humming) ───
        const isNearStation = stationManager.stations.some(
            s => Math.abs(worldDist - s.x) < AUDIO.STATION_PROXIMITY
        );
        const isTakingOff = (gameState === 'RUNNING' || gameState === 'DEPARTING') && isNearStation;

        if (isTakingOff && speed > 0.1) {
            if (!this.hummingActive && speed < 2.0) {
                this.hummingActive = true;
                this.hummStartTime = Date.now();
                const sound = this.scene.sound.get('humming');
                if (sound && !sound.isPlaying) {
                    try {
                        sound.play({ volume: 0.6 });
                    } catch (e) { /* audio not ready */ }
                }
            }
            if (this.hummingActive) {
                const elapsed = (Date.now() - this.hummStartTime) / 1000;
                if (elapsed >= AUDIO.HUMMING_DURATION || speed <= 0.1) {
                    this.hummingActive = false;
                    this._stopSound('humming');
                }
            }
        } else {
            if (this.hummingActive) {
                this.hummingActive = false;
                this._stopSound('humming');
            }
        }

        // ─── 2. RHYTHMIC TRACK JOINTS ───
        if (speed > 0.3) {
            // Rail joints every 15 meters (approx 45 world units)
            const jointSpacing = 45;
            if (worldDist - this.lastTrackSoundDist > jointSpacing) {
                const vol = Math.min(0.20, (speed / 12.0) * 0.15);
                this.playJointClickClack(vol);
                this.lastTrackSoundDist = worldDist;
            }
        }

        // ─── 3. CROWD PROXIMITY ───
        let nearestDist = 999999;
        stationManager.stations.forEach(s => {
            const d = Math.abs(worldDist - s.x);
            if (d < nearestDist) nearestDist = d;
        });

        if (nearestDist < AUDIO.CROWD_PROXIMITY) {
            const vol = Math.max(0, Math.min(0.6, 1.0 - (nearestDist / AUDIO.CROWD_PROXIMITY)));
            this._setLoopVolume('crowd', vol);
        } else {
            this._setLoopVolume('crowd', 0);
        }

        // ─── 4. RAIN & WIND AUDIO SYNTHESIZERS ───
        const ctx = this.scene.sound?.context;
        if (ctx && !this.scene.sound.noAudio && this.audioStarted) {
            this._initNoiseSynths(ctx);

            // Update Rain Volume
            if (this._rainGain) {
                const targetRainVol = weatherSystem.isRaining ? (weatherSystem.weather === 'STORM' ? 0.16 : 0.08) : 0;
                this._rainGain.gain.linearRampToValueAtTime(targetRainVol, ctx.currentTime + 0.3);
            }

            // Update Wind Volume & Gusts
            if (this._windGain && this._windFilter) {
                const isStorm = weatherSystem.weather === 'STORM';
                const targetWindVol = isStorm ? 0.12 : (weatherSystem.isRaining ? 0.05 : 0.015);
                this._windGain.gain.linearRampToValueAtTime(targetWindVol, ctx.currentTime + 0.3);

                // Modulate wind lowpass filter frequency to simulate howling gusts
                const gust = 350 + Math.sin(ctx.currentTime * 0.6) * 120 + Math.cos(ctx.currentTime * 0.25) * 40;
                this._windFilter.frequency.setValueAtTime(gust, ctx.currentTime);
            }
        }

        // ─── 5. DYNAMIC BRAKE SQUEAL ───
        if (physics.brakeNotch > 0 && speed > 0.05 && speed < 3.0) {
            const intensity = (physics.brakeNotch / 5.0) * ((3.0 - speed) / 3.0);
            this.playBrakeSqueal(intensity);
        } else {
            this.stopBrakeSqueal();
        }

        // ─── 6. CONTINUOUS ELECTRIC MOTOR HUM (WAP7 / electric locos) ───
        // The WAP7 traction motors produce a characteristic whine that
        // rises in pitch with speed. Simulated with a sawtooth oscillator.
        this._updateMotorHum(speed, physics);

        // ─── 7. LEVEL CROSSING BELL (when LC visible on screen) ───
        if (physics.isAtLevelCrossing) {
            this._lcBellActive = true;
        } else if (this._lcBellActive) {
            this._lcBellActive = false;
            this._stopLCBell();
        }
        if (this._lcBellActive) {
            this._updateLCBell(delta, physics);
        }
    }

    playHorn() {
        if (this.scene.sound.noAudio) return;
        try {
            this.scene.sound.play('horn', { volume: 0.8 });
        } catch (e) { /* ok */ }
    }

    /** Utility to manage looping sounds */
    _setLoopVolume(key, targetVol) {
        if (this.scene.sound.noAudio) return;
        if (!this.scene.cache.audio.exists(key)) return;

        let existing = this.scene.sound.get(key);
        if (!existing) {
            try {
                existing = this.scene.sound.add(key, { loop: true });
            } catch (e) {
                return;
            }
        }

        if (targetVol > 0.01) {
            if (!existing.isPlaying) {
                try {
                    existing.play({ loop: true, volume: targetVol });
                } catch (e) { /* ok */ }
            } else {
                existing.setVolume(existing.volume + (targetVol - existing.volume) * 0.05);
            }
        } else if (existing.isPlaying) {
            existing.stop();
        }
    }

    _stopSound(key) {
        if (this.scene.sound.noAudio) return;
        const s = this.scene.sound.get(key);
        if (s && s.isPlaying) {
            try {
                s.stop();
            } catch (e) {}
        }
    }

    playBrakeSqueal(volume) {
        if (this.scene.sound.noAudio) return;
        const ctx = this.scene.sound.context;
        if (!ctx) return;

        if (this.squealOsc) {
            if (volume > 0.01) {
                this.squealGain.gain.setValueAtTime(volume * 0.12, ctx.currentTime);
                const freq = 2800 + Math.sin(Date.now() * 0.02) * 150;
                this.squealOsc.frequency.setValueAtTime(freq, ctx.currentTime);
            } else {
                this.stopBrakeSqueal();
            }
            return;
        }

        if (volume <= 0.01) return;

        try {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(2800, ctx.currentTime);

            gain.gain.setValueAtTime(volume * 0.12, ctx.currentTime);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start();

            this.squealOsc = osc;
            this.squealGain = gain;
        } catch (e) {}
    }

    stopBrakeSqueal() {
        if (this.squealOsc) {
            try { this.squealOsc.stop(); } catch (e) {}
            this.squealOsc = null;
            this.squealGain = null;
        }
    }

    /**
     * Continuous electric motor hum — WAP7 traction whine.
     * Frequency: 80–800 Hz range, rising linearly with speed.
     * Waveform: sawtooth (closest to real IGBT inverter harmonics).
     */
    _updateMotorHum(speed, physics) {
        const ctx = this.scene.sound?.context;
        if (!ctx || this.scene.sound.noAudio) return;

        // Only for electric locos
        const isElectric = !physics.locoType?.includes('WDM');
        const running = speed > 0.3 && physics.throttleNotch > 0;

        if (!isElectric || !running || !this.audioStarted) {
            this._stopMotorHum();
            return;
        }

        // Target frequency: 80Hz at idle → 600Hz at max speed (11.5)
        const targetFreq = 80 + (speed / 12.0) * 520;
        // Target volume: quiet at low speed, louder at cruise
        const targetVol  = Math.min(0.06, 0.015 + (speed / 12.0) * 0.045);

        if (!this._motorOsc) {
            try {
                const osc  = ctx.createOscillator();
                const gain = ctx.createGain();
                // Add slight warmth with a second harmonic
                const osc2  = ctx.createOscillator();
                const gain2 = ctx.createGain();

                osc.type  = 'sawtooth';
                osc2.type = 'sine';
                osc.frequency.setValueAtTime(targetFreq, ctx.currentTime);
                osc2.frequency.setValueAtTime(targetFreq * 2, ctx.currentTime);
                gain.gain.setValueAtTime(targetVol, ctx.currentTime);
                gain2.gain.setValueAtTime(targetVol * 0.3, ctx.currentTime);

                osc.connect(gain);   gain.connect(ctx.destination);
                osc2.connect(gain2); gain2.connect(ctx.destination);

                osc.start(); osc2.start();

                this._motorOsc   = osc;
                this._motorOsc2  = osc2;
                this._motorGain  = gain;
                this._motorGain2 = gain2;
            } catch (e) {}
        } else {
            // Smoothly glide frequency and volume to target
            const t = ctx.currentTime;
            this._motorOsc.frequency.linearRampToValueAtTime(targetFreq, t + 0.1);
            this._motorOsc2.frequency.linearRampToValueAtTime(targetFreq * 2, t + 0.1);
            this._motorGain.gain.linearRampToValueAtTime(targetVol, t + 0.05);
            this._motorGain2.gain.linearRampToValueAtTime(targetVol * 0.3, t + 0.05);
        }
    }

    _stopMotorHum() {
        ['_motorOsc', '_motorOsc2'].forEach(k => {
            if (this[k]) { try { this[k].stop(); } catch (e) {} this[k] = null; }
        });
        this._motorGain = this._motorGain2 = null;
    }

    _updateLCBell(delta, physics) {
        const ctx = this.scene.sound?.context;
        if (!ctx || this.scene.sound.noAudio) return;

        this._lcBellTimer += delta;
        if (this._lcBellTimer < 800) return;
        this._lcBellTimer = 0;
        this._lcBellPhase = 1 - this._lcBellPhase;

        // Proximity volume scaling
        let volumeScale = 1.0;
        if (physics && physics.nearestLCX !== null && physics.nearestLCX !== undefined) {
            const dist = Math.abs(physics.nearestLCX - physics.worldDistance);
            volumeScale = Math.max(0, 1 - dist / 2500); // 1.0 at crossing, 0 at 2500 units away
        }

        const freq = this._lcBellPhase === 0 ? 800 : 600;
        try {
            const osc  = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, ctx.currentTime);
            gain.gain.setValueAtTime(0.18 * volumeScale, ctx.currentTime);
            // Quick decay (bell-like)
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.6);
        } catch (e) {}
    }

    _stopLCBell() {
        this._lcBellTimer = 0;
        this._lcBellPhase = 0;
    }

    _initNoiseSynths(ctx) {
        if (this._noiseBuffer) return;
        try {
            const bufferSize = ctx.sampleRate * 2;
            const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = Math.random() * 2 - 1;
            }
            this._noiseBuffer = buffer;

            // Rain Synth
            const rainSource = ctx.createBufferSource();
            rainSource.buffer = this._noiseBuffer;
            rainSource.loop = true;

            const rainFilter = ctx.createBiquadFilter();
            rainFilter.type = 'bandpass';
            rainFilter.frequency.value = 2200;
            rainFilter.Q.value = 1.0;

            const rainGain = ctx.createGain();
            rainGain.gain.value = 0;

            rainSource.connect(rainFilter);
            rainFilter.connect(rainGain);
            rainGain.connect(ctx.destination);
            rainSource.start();

            this._rainSource = rainSource;
            this._rainGain = rainGain;

            // Wind Synth
            const windSource = ctx.createBufferSource();
            windSource.buffer = this._noiseBuffer;
            windSource.loop = true;

            const windFilter = ctx.createBiquadFilter();
            windFilter.type = 'lowpass';
            windFilter.frequency.value = 400;

            const windGain = ctx.createGain();
            windGain.gain.value = 0;

            windSource.connect(windFilter);
            windFilter.connect(windGain);
            windGain.connect(ctx.destination);
            windSource.start();

            this._windSource = windSource;
            this._windFilter = windFilter;
            this._windGain = windGain;
        } catch (e) {}
    }

    playJointClickClack(volume) {
        const ctx = this.scene.sound?.context;
        if (!ctx || this.scene.sound.noAudio) return;

        const now = ctx.currentTime;
        // Bogie 1 (front) clack-clack
        this._synthClick(ctx, now, volume);
        this._synthClick(ctx, now + 0.08, volume * 0.7);

        // Bogie 2 (rear) clack-clack (bogie spacing wheelbase delay ~160ms)
        this._synthClick(ctx, now + 0.22, volume * 0.85);
        this._synthClick(ctx, now + 0.30, volume * 0.6);
    }

    _synthClick(ctx, time, volume) {
        try {
            // Low-freq thud (axle hitting joint gap)
            const osc1 = ctx.createOscillator();
            const gain1 = ctx.createGain();
            osc1.type = 'triangle';
            osc1.frequency.setValueAtTime(65, time);
            osc1.frequency.exponentialRampToValueAtTime(12, time + 0.07);
            gain1.gain.setValueAtTime(volume * 0.5, time);
            gain1.gain.exponentialRampToValueAtTime(0.001, time + 0.07);
            osc1.connect(gain1);
            gain1.connect(ctx.destination);
            osc1.start(time);
            osc1.stop(time + 0.08);

            // High-freq metallic clank
            const osc2 = ctx.createOscillator();
            const gain2 = ctx.createGain();
            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(1600, time);
            osc2.frequency.exponentialRampToValueAtTime(700, time + 0.025);
            gain2.gain.setValueAtTime(volume * 0.18, time);
            gain2.gain.exponentialRampToValueAtTime(0.001, time + 0.025);
            osc2.connect(gain2);
            gain2.connect(ctx.destination);
            osc2.start(time);
            osc2.stop(time + 0.03);
        } catch (e) {}
    }
}
