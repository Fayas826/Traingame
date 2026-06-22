/**
 * 🖥️ HUD SCENE — Overlay scene for speedometer, DDU, ALP panel
 * Runs on top of GameScene as a transparent overlay.
 */
import Phaser from 'phaser';

export default class HUDScene extends Phaser.Scene {
    constructor() {
        super({ key: 'HUDScene' });
        this._lastSpeed = 0;
        this._lastNotch = 'N 0';
        this._lastStatus = '';
        this._lastNextStation = '';
        this._bpPressure = '5.0';
    }

    create() {
        // This scene is transparent — it only draws HUD canvases
        this.cameras.main.setBackgroundColor('rgba(0,0,0,0)');

        // Speedometer canvas (bottom-left in cockpit)
        this.speedCanvas = document.getElementById('speedCanvas');
        if (this.speedCanvas) {
            this.sctx = this.speedCanvas.getContext('2d');
            this.speedCanvas.width = 120;
            this.speedCanvas.height = 120;
        }

        // Pressure Gauge canvas
        this.pressureCanvas = document.getElementById('pressureCanvas');
        if (this.pressureCanvas) {
            this.pctx = this.pressureCanvas.getContext('2d');
            this.pressureCanvas.width = 120;
            this.pressureCanvas.height = 120;
        }

        // DDU canvas
        this.dduCanvas = document.getElementById('dduCanvas');
        if (this.dduCanvas) {
            this.dctx = this.dduCanvas.getContext('2d');
            this.dduCanvas.width = 300;
            this.dduCanvas.height = 150;
        }
    }

    /**
     * Called from GameScene each frame with fresh data.
     */
    updateData(physics, stationManager, weatherSystem) {
        this._lastSpeed = physics.displaySpeed;
        this._lastNotch = physics.notchLabel;
        this._lastStatus = stationManager.getStatusText();
        this._bpPressure = (5.0 - (physics.brakeNotch * 0.4)).toFixed(1);
        this._isEmergency = physics.isEmergencyActive;
        this._isWaiting = stationManager.isWaitingForStarter;
        this._isBoarding = stationManager.gameState === 'BOARDING';
        this._throttle = physics.throttleNotch;
        this._brake = physics.brakeNotch;
        this._isWheelSlip = physics.isWheelSlipActive;
        this._gradientLabel = physics.currentGradientLabel || 'LEVEL';

        this._drawSpeedometer();
        this._drawPressureGauge();
        this._updateDOMHud();

        // Throttle next station lookup and DDU redraw to run every 10 frames
        this.dduFrameCount = (this.dduFrameCount || 0) + 1;
        if (this.dduFrameCount % 10 === 0) {
            const next = stationManager.getNextStation();
            if (next) {
                const d = ((next.x - physics.worldDistance) / 1000).toFixed(1);
                this._lastNextStation = `${next.name} (${d} KM)`;
            } else {
                this._lastNextStation = 'TERMINUS REACHED';
            }
            this._drawDDU();
        }
    }

    updateNotch(physics) {
        // Immediate feedback on notch change
        this._lastNotch = physics.notchLabel;
        this._updateDOMHud();
    }

    _drawSpeedometer() {
        const ctx = this.sctx;
        if (!ctx) return;
        const cx = 60, cy = 60;

        ctx.clearRect(0, 0, 120, 120);

        // Outer ring
        ctx.strokeStyle = '#00ff88';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(cx, cy, 50, 0, Math.PI * 2);
        ctx.stroke();

        // Speed arc (filled portion)
        const speedRatio = this._lastSpeed / 120;
        ctx.strokeStyle = speedRatio > 0.8 ? '#ff4444' : '#00ff88';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(cx, cy, 44, -Math.PI / 2, -Math.PI / 2 + speedRatio * Math.PI * 2);
        ctx.stroke();

        // Needle
        const angle = (this._lastSpeed / 160) * Math.PI;
        ctx.strokeStyle = '#00ff88';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(angle - Math.PI / 2) * 38, cy + Math.sin(angle - Math.PI / 2) * 38);
        ctx.stroke();

        // Center dot
        ctx.fillStyle = '#00ff88';
        ctx.beginPath();
        ctx.arc(cx, cy, 3, 0, Math.PI * 2);
        ctx.fill();

        // Speed text
        ctx.fillStyle = '#00ffcc';
        ctx.font = 'bold 18px "Orbitron", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(this._lastSpeed, cx, cy + 22);
        ctx.font = '9px "Inter", sans-serif';
        ctx.fillText('KM/H', cx, cy + 34);
    }

    _drawPressureGauge() {
        const ctx = this.pctx;
        if (!ctx) return;
        const cx = 60, cy = 60;

        ctx.clearRect(0, 0, 120, 120);

        // Outer ring
        ctx.strokeStyle = '#555555';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(cx, cy, 50, 0, Math.PI * 2);
        ctx.stroke();

        // Ticks for 0 to 6 kg/cm2
        ctx.strokeStyle = '#888888';
        ctx.lineWidth = 1;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '8px "Inter", sans-serif';
        ctx.fillStyle = '#aaaaaa';

        for (let i = 0; i <= 6; i++) {
            const angle = -Math.PI * 0.8 + (i / 6) * (Math.PI * 1.6);
            const x1 = cx + Math.cos(angle) * 44;
            const y1 = cy + Math.sin(angle) * 44;
            const x2 = cx + Math.cos(angle) * 48;
            const y2 = cy + Math.sin(angle) * 48;
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();

            // Label
            const lx = cx + Math.cos(angle) * 36;
            const ly = cy + Math.sin(angle) * 36;
            ctx.fillText(i.toString(), lx, ly);
        }

        // Compute pressure values
        const bpVal = parseFloat(this._bpPressure);
        const bcVal = this._isEmergency ? 5.0 : (this._brake * 0.7);

        // Draw BP Needle (Red)
        const bpAngle = -Math.PI * 0.8 + (bpVal / 6) * (Math.PI * 1.6);
        ctx.strokeStyle = '#ff4444';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(bpAngle) * 38, cy + Math.sin(bpAngle) * 38);
        ctx.stroke();

        // Draw BC Needle (Yellow)
        const bcAngle = -Math.PI * 0.8 + (bcVal / 6) * (Math.PI * 1.6);
        ctx.strokeStyle = '#ffcc00';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(bcAngle) * 38, cy + Math.sin(bcAngle) * 38);
        ctx.stroke();

        // Center hub
        ctx.fillStyle = '#222222';
        ctx.beginPath();
        ctx.arc(cx, cy, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Gauge Label
        ctx.fillStyle = '#00ffcc';
        ctx.font = '8px "Orbitron", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('BP: ' + bpVal.toFixed(1), cx, cy + 20);
        ctx.fillStyle = '#ffcc00';
        ctx.fillText('BC: ' + bcVal.toFixed(1), cx, cy + 30);
    }

    _drawDDU() {
        const ctx = this.dctx;
        if (!ctx) return;

        ctx.fillStyle = '#051005';
        ctx.fillRect(0, 0, 300, 150);

        // Scanlines
        ctx.fillStyle = 'rgba(0, 255, 0, 0.02)';
        for (let i = 0; i < 150; i += 4) ctx.fillRect(0, i, 300, 2);
        if (Math.random() > 0.98) {
            ctx.fillStyle = 'rgba(0,255,0,0.05)';
            ctx.fillRect(0, 0, 300, 150);
        }

        // Title
        ctx.fillStyle = '#00ff44';
        ctx.font = 'bold 14px "Courier New", monospace';
        ctx.fillText('>> LOCO DIAGNOSTICS - WAP7', 15, 22);

        // Speed
        ctx.font = '13px "Courier New", monospace';
        ctx.fillText(`SPEED: ${this._lastSpeed} KM/H`, 15, 48);

        // Status
        if (this._isWaiting) ctx.fillStyle = '#ff9900';
        else if (this._isBoarding) ctx.fillStyle = '#00ccff';
        else if (this._isEmergency) ctx.fillStyle = '#ff3333';
        else ctx.fillStyle = '#00ff44';
        ctx.fillText(`STATUS: ${this._lastStatus}`, 15, 72);

        // BP Pressure
        ctx.fillStyle = '#00ff44';
        ctx.fillText(`BP PRESSURE: ${this._bpPressure} KG/CM2`, 15, 94);

        // Gradient (uphill red, downhill yellow, level green)
        const grad = this._gradientLabel || 'LEVEL';
        if (grad.startsWith('UP')) {
            ctx.fillStyle = '#ff3333';
        } else if (grad.startsWith('DN')) {
            ctx.fillStyle = '#ffcc00';
        } else {
            ctx.fillStyle = '#00ff44';
        }
        ctx.fillText(`GRAD: ${grad}`, 150, 94);

        // Next station
        ctx.fillStyle = '#ffcc00';
        ctx.fillText(`NEXT: ${this._lastNextStation}`, 15, 118);

        // Load bar
        ctx.fillStyle = '#111';
        ctx.fillRect(260, 40, 20, 80);
        ctx.fillStyle = this._throttle > 0 ? '#00ff00' : (this._brake > 0 ? '#ff3333' : '#444');
        const barH = (this._throttle / 8) * 80 || (this._brake / 5) * 80;
        ctx.fillRect(260, 120 - barH, 20, barH);

        // Flashing wheel slip warning
        if (this._isWheelSlip) {
            const flash = Math.floor(Date.now() / 400) % 2 === 0;
            if (flash) {
                ctx.fillStyle = '#ff3333';
                ctx.font = 'bold 12px "Courier New", monospace';
                ctx.fillText('⚠️ WHEEL SLIP ACTIVE - REDUCE THROTTLE', 15, 138);
            }
        }
    }

    _updateDOMHud() {
        const notchEl = document.getElementById('notch-val');
        if (notchEl) notchEl.textContent = this._lastNotch;

        const mSpeed = document.getElementById('mobile-speed');
        if (mSpeed) mSpeed.textContent = `${this._lastSpeed} KM/H`;

        const mNotch = document.getElementById('mobile-notch');
        if (mNotch) mNotch.textContent = this._lastNotch;
    }
}
