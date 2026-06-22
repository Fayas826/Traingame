import { useState, useEffect, useRef } from 'react';
import { 
  Play, Pause, RotateCcw, AlertTriangle, CloudRain, Sun, Wind, 
  Thermometer, ShieldAlert, MapPin, Plus, Trash2, 
  FileJson, Clock, Gauge, Info, Volume2, Download, Copy, Check
} from 'lucide-react';
import './App.css';

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------

interface Station {
  code: string;
  name: string;
  km: number;
  isMandatoryStop: boolean;
  platforms: number;
  dwellTimeSec: number;
}

interface SpeedZone {
  id: string;
  startKm: number;
  endKm: number;
  speedKmh: number;
  reason: string;
}

interface ViolationLog {
  id: string;
  timestamp: string;
  km: number;
  type: string;
  description: string;
  penalty: number;
}

// ---------------------------------------------------------------------------
// CONSTANTS
// ---------------------------------------------------------------------------

const INITIAL_STATIONS: Station[] = [
  { code: "QLN", name: "Kollam Junction", km: 0.0, isMandatoryStop: true, platforms: 5, dwellTimeSec: 300 },
  { code: "IRP", name: "Iravipuram", km: 4.6, isMandatoryStop: false, platforms: 2, dwellTimeSec: 0 },
  { code: "MYY", name: "Mayyanad", km: 8.9, isMandatoryStop: false, platforms: 2, dwellTimeSec: 0 },
  { code: "PVU", name: "Paravur", km: 12.4, isMandatoryStop: false, platforms: 2, dwellTimeSec: 0 },
  { code: "KFI", name: "Kappil", km: 17.0, isMandatoryStop: false, platforms: 2, dwellTimeSec: 0 },
  { code: "EVA", name: "Edavai", km: 19.9, isMandatoryStop: false, platforms: 2, dwellTimeSec: 0 },
  { code: "VAK", name: "Varkala Sivagiri", km: 23.7, isMandatoryStop: true, platforms: 3, dwellTimeSec: 120 },
  { code: "AKI", name: "Akathumuri", km: 30.1, isMandatoryStop: false, platforms: 2, dwellTimeSec: 0 },
  { code: "KVU", name: "Kadakkavur", km: 32.8, isMandatoryStop: false, platforms: 2, dwellTimeSec: 0 },
  { code: "CRY", name: "Chirayinkeezhu", km: 35.9, isMandatoryStop: false, platforms: 2, dwellTimeSec: 0 },
  { code: "PGZ", name: "Perunguzhi", km: 40.0, isMandatoryStop: false, platforms: 2, dwellTimeSec: 0 },
  { code: "MQU", name: "Murukkampuzha", km: 43.2, isMandatoryStop: false, platforms: 2, dwellTimeSec: 0 },
  { code: "KPY", name: "Kaniyapuram", km: 47.2, isMandatoryStop: false, platforms: 2, dwellTimeSec: 0 },
  { code: "KZK", name: "Kazhakkuttam", km: 51.3, isMandatoryStop: false, platforms: 3, dwellTimeSec: 0 },
  { code: "VELI", name: "Veli", km: 55.3, isMandatoryStop: false, platforms: 2, dwellTimeSec: 0 },
  { code: "TVCN", name: "Thiruvananthapuram North", km: 57.5, isMandatoryStop: false, platforms: 4, dwellTimeSec: 180 },
  { code: "PET", name: "TVM Pettah", km: 62.1, isMandatoryStop: false, platforms: 2, dwellTimeSec: 0 },
  { code: "TVC", name: "Trivandrum Central", km: 64.6, isMandatoryStop: true, platforms: 5, dwellTimeSec: 300 }
];

const INITIAL_SPEED_ZONES: SpeedZone[] = [
  { id: "sz1", startKm: 0.0, endKm: 0.3, speedKmh: 15, reason: "Kollam Jct yard turnout exit" },
  { id: "sz2", startKm: 0.3, endKm: 0.8, speedKmh: 50, reason: "Kollam Jct station limits" },
  { id: "sz3", startKm: 0.8, endKm: 2.0, speedKmh: 75, reason: "Kollam approach caution" },
  { id: "sz4", startKm: 10.4, endKm: 12.3, speedKmh: 75, reason: "Paravur Lake Bridge crossing" },
  { id: "sz5", startKm: 18.5, endKm: 20.5, speedKmh: 30, reason: "Edavai Sharp Curve restriction" },
  { id: "sz6", startKm: 27.5, endKm: 28.8, speedKmh: 75, reason: "Akathumuri Bridge and curve" },
  { id: "sz7", startKm: 41.5, endKm: 42.6, speedKmh: 75, reason: "Murukkampuzha Bridge crossing" },
  { id: "sz8", startKm: 44.5, endKm: 46.5, speedKmh: 30, reason: "Kaniyapuram curve restriction" },
  { id: "sz9", startKm: 63.8, endKm: 64.3, speedKmh: 30, reason: "Trivandrum yard turnout entry" },
  { id: "sz10", startKm: 64.3, endKm: 64.6, speedKmh: 15, reason: "Trivandrum Central terminal limits" }
];

const WEATHER_PRESETS = [
  { type: "Clear", rain: 0.0, temp: 32.5, wind: 12.0, humidity: 62, adhesion: 0.30 },
  { type: "Mist", rain: 0.0, temp: 26.0, wind: 4.0, humidity: 92, adhesion: 0.25 },
  { type: "LightRain", rain: 0.3, temp: 27.5, wind: 22.0, humidity: 88, adhesion: 0.22 },
  { type: "HeavyRain", rain: 0.7, temp: 25.5, wind: 35.0, humidity: 95, adhesion: 0.15 },
  { type: "Thunderstorm", rain: 0.9, temp: 24.0, wind: 65.0, humidity: 98, adhesion: 0.14 }
];

const SERVICES = [
  { name: "Venad Express (16301)", id: "16301", dep: "06:15", type: "WAP-7", coaches: 12, startKm: 0, endKm: 64.6, color: "#10b981" },
  { name: "Trivandrum Mail (16348)", id: "16348", dep: "22:30", type: "WAP-4", coaches: 18, startKm: 64.6, endKm: 0, color: "#3b82f6" },
  { name: "Sampark Kranti (12201)", id: "12201", dep: "13:45", type: "WAP-7", coaches: 22, startKm: 0, endKm: 64.6, color: "#8b5cf6" },
  { name: "QLN-TVC Passenger (56376)", id: "56376", dep: "08:00", type: "WDM-3A", coaches: 8, startKm: 0, endKm: 64.6, color: "#f59e0b" },
  { name: "TVC-QLN Passenger (56377)", id: "56377", dep: "10:30", type: "WDM-3A", coaches: 8, startKm: 64.6, endKm: 0, color: "#ec4899" },
  { name: "QLN-TVC MEMU (66301)", id: "66301", dep: "07:00", type: "WAG-9", coaches: 8, startKm: 0, endKm: 64.6, color: "#06b6d4" },
  { name: "TVC-QLN MEMU (66302)", id: "66302", dep: "08:30", type: "WAG-9", coaches: 8, startKm: 64.6, endKm: 0, color: "#14b8a6" },
  { name: "West Coast Express (22638)", id: "22638", dep: "16:45", type: "WAP-7", coaches: 14, startKm: 64.6, endKm: 0, color: "#f43f5e" }
];

function App() {
  const [activeTab, setActiveTab] = useState<'telemetry' | 'route' | 'timetable'>('telemetry');
  
  // ---------------------------------------------------------------------------
  // STATE: Route Editor
  // ---------------------------------------------------------------------------
  const [stations, setStations] = useState<Station[]>(INITIAL_STATIONS);
  const [speedZones, setSpeedZones] = useState<SpeedZone[]>(INITIAL_SPEED_ZONES);
  
  const [selectedStation, setSelectedStation] = useState<Station | null>(INITIAL_STATIONS[0]);
  const [copied, setCopied] = useState(false);

  // Form states for new station
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [newKm, setNewKm] = useState(0.0);
  const [newPlats, setNewPlats] = useState(2);
  const [newStop, setNewStop] = useState(false);

  // Form states for new speed zone
  const [szStart, setSzStart] = useState(0.0);
  const [szEnd, setSzEnd] = useState(0.0);
  const [szLimit, setSzLimit] = useState(50);
  const [szReason, setSzReason] = useState('');

  // ---------------------------------------------------------------------------
  // STATE: Telemetry & Local Simulation Loop
  // ---------------------------------------------------------------------------
  const [simActive, setSimActive] = useState(false);
  const [simSpeedKmh, setSimSpeedKmh] = useState(0.0);
  const [simDistanceKm, setSimDistanceKm] = useState(0.0);
  const [throttleNotch, setThrottleNotch] = useState(0); // 0-8
  const [brakeNotch, setBrakeNotch] = useState(0); // 0-5
  const [emergencyBrake, setEmergencyBrake] = useState(false);
  const [wheelSlip, setWheelSlip] = useState(false);
  const [hornActive, setHornActive] = useState(false);
  
  // Weather
  const [weatherPresetIndex, setWeatherPresetIndex] = useState(2); // LightRain
  const weather = WEATHER_PRESETS[weatherPresetIndex];

  // Scoring
  const [complianceScore, setComplianceScore] = useState(100);
  const [smoothnessScore, setSmoothnessScore] = useState(100);
  const [punctualityScore, setPunctualityScore] = useState(100);
  const [violations, setViolations] = useState<ViolationLog[]>([]);

  // Simulation clock
  const [simTimeMin, setSimTimeMin] = useState(480.0); // starts at 08:00 AM (480 mins)

  const timerRef = useRef<number | null>(null);

  // Calculated driving scores
  const score = Math.max(0, Math.round((complianceScore + smoothnessScore + punctualityScore) / 300 * 1000));
  const getGrade = (s: number) => {
    if (s >= 950) return "A+";
    if (s >= 850) return "A";
    if (s >= 700) return "B";
    if (s >= 550) return "C";
    if (s >= 400) return "D";
    return "F";
  };

  // ---------------------------------------------------------------------------
  // ACTIONS: Route Editor
  // ---------------------------------------------------------------------------
  const handleUpdateStation = (updated: Station) => {
    const next = stations.map(s => s.code === updated.code ? updated : s);
    next.sort((a, b) => a.km - b.km);
    setStations(next);
    setSelectedStation(updated);
  };

  const handleAddStation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode || !newName || newKm < 0 || newKm > 65) return;
    
    // Check duplicate code
    if (stations.some(s => s.code.toUpperCase() === newCode.toUpperCase())) {
      alert("Station code already exists!");
      return;
    }

    const added: Station = {
      code: newCode.toUpperCase(),
      name: newName,
      km: newKm,
      platforms: newPlats,
      isMandatoryStop: newStop,
      dwellTimeSec: newStop ? 120 : 0
    };

    const next = [...stations, added].sort((a, b) => a.km - b.km);
    setStations(next);
    
    // Clear form
    setNewCode('');
    setNewName('');
    setNewKm(0);
    setNewPlats(2);
    setNewStop(false);
  };

  const handleDeleteStation = (code: string) => {
    if (stations.length <= 2) {
      alert("Keep at least the origin and destination terminals!");
      return;
    }
    const next = stations.filter(s => s.code !== code);
    setStations(next);
    if (selectedStation?.code === code) {
      setSelectedStation(next[0]);
    }
  };

  const handleAddSpeedZone = (e: React.FormEvent) => {
    e.preventDefault();
    if (szStart >= szEnd || szStart < 0 || szEnd > 65 || szLimit <= 0) return;

    const added: SpeedZone = {
      id: "sz-" + Date.now(),
      startKm: szStart,
      endKm: szEnd,
      speedKmh: szLimit,
      reason: szReason || "Speed restriction"
    };

    setSpeedZones([...speedZones, added].sort((a, b) => a.startKm - b.startKm));
    
    // Clear
    setSzStart(0.0);
    setSzEnd(0.0);
    setSzLimit(50);
    setSzReason('');
  };

  const handleDeleteSpeedZone = (id: string) => {
    setSpeedZones(speedZones.filter(z => z.id !== id));
  };

  const handleExportJson = () => {
    const config = {
      stations,
      speedZones,
      routeLengthKm: 64.6,
      created: new Date().toISOString()
    };
    const str = JSON.stringify(config, null, 2);
    const blob = new Blob([str], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'kerala_route_config.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyToClipboard = () => {
    const config = { stations, speedZones };
    navigator.clipboard.writeText(JSON.stringify(config, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ---------------------------------------------------------------------------
  // LOCAL SIMULATOR LOOP (Davis Equation Physics)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (simActive) {
      const intervalMs = 100; // run every 100ms
      const dt = intervalMs / 1000; // seconds

      timerRef.current = window.setInterval(() => {
        setSimTimeMin(prev => (prev + dt / 60) % 1440); // advance clock

        // Read dynamic parameters
        let currentLimit = 110.0;
        speedZones.forEach(z => {
          if (simDistanceKm >= z.startKm && simDistanceKm <= z.endKm) {
            currentLimit = Math.min(currentLimit, z.speedKmh);
          }
        });

        // 1. Calculate Davis Equation Drag force (modified for train weight)
        // F_drag = A + Bv + Cv^2
        const v = simSpeedKmh / 3.6; // convert km/h to m/s
        const mass = 1200 + 4 * 50; // tons (loco + rake)
        const massRatio = 1200 / mass;

        const dragA = 0.003;
        const dragB = 0.001;
        const dragC = 0.0001;
        const dragForce = dragA + dragB * v + dragC * v * v;

        // 2. Tractive power & Brake factors
        const throttlePowerFactor = 0.06; 
        const brakePowerFactor = 0.08;
        const realThrottle = emergencyBrake ? 0 : throttleNotch;
        const realBrake = emergencyBrake ? 5 : brakeNotch;

        // Apply Monsoon wheel slip
        let activeAdhesion = weather.adhesion;
        // Near backwaters, reduce adhesion further
        const nearBackwater = simDistanceKm >= 10 && simDistanceKm <= 20;
        if (nearBackwater) activeAdhesion -= 0.03;

        // Check if tractive force exceeds adhesion limit
        const tractiveForce = realThrottle * throttlePowerFactor * massRatio;
        const adhesionLimit = activeAdhesion * 2.0; // proxy force limit
        
        let finalTractiveForce = tractiveForce;
        let isSlipping = false;
        if (tractiveForce > adhesionLimit) {
          isSlipping = true;
          finalTractiveForce = adhesionLimit * 0.4; // friction drops during spin
        }
        setWheelSlip(isSlipping);

        const brakeForce = realBrake * brakePowerFactor;

        // 3. Simple grade resistance
        let slope = 0.0;
        if (simDistanceKm >= 22 && simDistanceKm <= 25) slope = 0.010; // 1:100 slope UP
        else if (simDistanceKm >= 52 && simDistanceKm <= 58) slope = -0.0083; // DOWN slope
        else if (simDistanceKm >= 30 && simDistanceKm <= 35) slope = -0.0067;
        const gradeForce = slope * 1.2 * massRatio;

        // 4. Update speed
        const acc = finalTractiveForce - brakeForce - dragForce - gradeForce;
        let nextSpeedKmh = simSpeedKmh + acc * dt * 15.0; // scale acceleration display
        if (nextSpeedKmh < 0.05) nextSpeedKmh = 0;
        if (nextSpeedKmh > 110) nextSpeedKmh = 110;

        // Speed Governor
        if (nextSpeedKmh > currentLimit) {
          // Log speed violation
          if (Math.random() < 0.05) {
            setComplianceScore(prev => Math.max(0, prev - 2));
            logViolation("SpeedExcess", `Exceeded speed limit of ${currentLimit} km/h (speed: ${Math.round(nextSpeedKmh)} km/h)`, 10);
          }
        }

        // SPAD Check: stations starter signals default to Red. 
        // If we approach a station Starter signal without clear token, it counts as SPAD.
        stations.forEach(s => {
          // Starter signal is at station km + 0.2
          const starterKm = s.km + 0.2;
          if (simDistanceKm < starterKm && (simDistanceKm + nextSpeedKmh / 3600) >= starterKm && s.isMandatoryStop) {
            // SPAD!
            setComplianceScore(prev => Math.max(0, prev - 40));
            logViolation("SignalPassing", `CRITICAL: Passed red starter signal at ${s.name} at ${Math.round(nextSpeedKmh)} km/h`, 200);
            setEmergencyBrake(true); // auto stop
          }
        });

        // W/L Board Horn verification
        // Level crossings are at km 15.2 and 48.6. Horn must be active when passing.
        const lcPoints = [15.2, 48.6];
        lcPoints.forEach(lc => {
          if (simDistanceKm < lc && (simDistanceKm + nextSpeedKmh / 3600) >= lc) {
            if (!hornActive) {
              setComplianceScore(prev => Math.max(0, prev - 5));
              logViolation("WLBoardMissed", `Missed sounding horn at LC Whistle Board near km ${lc}`, 30);
            }
          }
        });

        // Wheel slip penalty
        if (isSlipping && Math.random() < 0.1) {
          setSmoothnessScore(prev => Math.max(0, prev - 1));
          logViolation("WheelSlip", `Wheel slip detected on wet rails at km ${simDistanceKm.toFixed(2)}`, 20);
        }

        // Emergency braking penalty
        if (emergencyBrake && nextSpeedKmh > 20 && Math.random() < 0.05) {
          setSmoothnessScore(prev => Math.max(0, prev - 2));
          logViolation("EmergencyBrake", `Emergency brakes applied at high speed (${Math.round(nextSpeedKmh)} km/h)`, 80);
        }

        setSimSpeedKmh(nextSpeedKmh);
        
        // Update distance
        let nextDistance = simDistanceKm + (nextSpeedKmh / 3600) * dt * 10; // accelerate distance for testing
        if (nextDistance >= 64.6) {
          nextDistance = 0.0; // loop back
          setSimActive(false);
          alert("Journey Completed! Arrival at Thiruvananthapuram Central.");
        }
        setSimDistanceKm(nextDistance);

      }, intervalMs);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [simActive, simSpeedKmh, simDistanceKm, throttleNotch, brakeNotch, emergencyBrake, weather, hornActive, stations, speedZones]);

  const logViolation = (type: string, description: string, penalty: number) => {
    const timestamp = new Date().toLocaleTimeString();
    setViolations(prev => [
      { id: "viol-" + Date.now() + "-" + Math.random(), timestamp, km: simDistanceKm, type, description, penalty },
      ...prev.slice(0, 19)
    ]);
  };

  const handleResetSim = () => {
    setSimSpeedKmh(0.0);
    setSimDistanceKm(0.0);
    setThrottleNotch(0);
    setBrakeNotch(0);
    setEmergencyBrake(false);
    setWheelSlip(false);
    setComplianceScore(100);
    setSmoothnessScore(100);
    setPunctualityScore(100);
    setViolations([]);
    setSimTimeMin(480.0); // 08:00 AM
  };

  // Find next station details
  const nextStation = stations.find(s => s.km > simDistanceKm) || stations[stations.length - 1];
  const distToNext = nextStation.km - simDistanceKm;

  // Signal propagation aspect based on distance
  const getSignalAspect = () => {
    // Basic automatic signaling: every 2km.
    // If we are close to next station home/starter, they may change.
    // Station home/starter signals are at station.km - 0.2 and + 0.2
    let aheadSignalDist = 999.0;
    let isRed = false;
    let isCaution = false;
    let isAttention = false;

    stations.forEach(s => {
      const homeKm = s.km - 0.2;
      const starterKm = s.km + 0.2;
      
      if (homeKm > simDistanceKm && homeKm - simDistanceKm < aheadSignalDist) {
        aheadSignalDist = homeKm - simDistanceKm;
        // Home signal is Caution (Yellow) if it's a mandatory stop, else Green
        isCaution = s.isMandatoryStop;
      }
      
      if (starterKm > simDistanceKm && starterKm - simDistanceKm < aheadSignalDist) {
        aheadSignalDist = starterKm - simDistanceKm;
        // Starter is Red (Danger) until authorized (Starter remains Red for mandatory stops in our simulator)
        isRed = s.isMandatoryStop;
      }
    });

    // Also auto block signals every 2 km
    const blockRem = simDistanceKm % 2.0;
    const autoBlockDist = 2.0 - blockRem;
    if (autoBlockDist < aheadSignalDist) {
      aheadSignalDist = autoBlockDist;
      // Auto blocks are Green unless near red starter
      isAttention = blockRem > 1.5;
    }

    if (isRed && aheadSignalDist < 0.6) return { aspect: "Danger", name: "Red Aspect", color: "#ff4a60" };
    if (isCaution && aheadSignalDist < 0.6) return { aspect: "Caution", name: "Caution (Single Yellow)", color: "#ffb800" };
    if (isAttention && aheadSignalDist < 0.6) return { aspect: "AttentionRequired", name: "Attention (Double Yellow)", color: "#dfd600" };
    return { aspect: "Clear", name: "Clear (Green)", color: "#00d294" };
  };

  const signal = getSignalAspect();

  // Speed Limit at current position
  let currentLimit = 110.0;
  speedZones.forEach(z => {
    if (simDistanceKm >= z.startKm && simDistanceKm <= z.endKm) {
      currentLimit = Math.min(currentLimit, z.speedKmh);
    }
  });

  // format clock mins to HH:MM
  const formatTime = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = Math.floor(mins % 60);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  };

  return (
    <div className="webtools-container">
      {/* HEADER */}
      <header className="webtools-header">
        <div className="logo-section">
          <div className="krail-logo">⚡</div>
          <div>
            <h1>Kerala Rail Digital Twin Portal</h1>
            <p>Unified Administration, Route Layout Editing, & Real-Time Telemetry Dashboard</p>
          </div>
        </div>
        <nav className="webtools-nav">
          <button 
            className={activeTab === 'telemetry' ? 'active' : ''} 
            onClick={() => setActiveTab('telemetry')}
          >
            <Gauge size={16} /> Instrumentation Telemetry
          </button>
          <button 
            className={activeTab === 'route' ? 'active' : ''} 
            onClick={() => setActiveTab('route')}
          >
            <FileJson size={16} /> Route Track Editor
          </button>
          <button 
            className={activeTab === 'timetable' ? 'active' : ''} 
            onClick={() => setActiveTab('timetable')}
          >
            <Clock size={16} /> Timetable AI Scheduler
          </button>
        </nav>
      </header>

      <main className="webtools-main">
        {/* =========================================================================
            TAB 1: TELEMETRY DASHBOARD
            ========================================================================= */}
        {activeTab === 'telemetry' && (
          <div className="tab-pane active fade-in">
            {/* Simulation Header controls */}
            <div className="card glass control-bar">
              <div className="info-badge">
                <span className="dot pulse green"></span>
                <span>Portal Mode: <strong>Local Telemetry Simulator (Offline)</strong></span>
              </div>
              <div className="sim-controls">
                <button 
                  className={`btn ${simActive ? 'btn-danger' : 'btn-primary'}`}
                  onClick={() => setSimActive(!simActive)}
                >
                  {simActive ? <Pause size={16} /> : <Play size={16} />}
                  {simActive ? "Pause Telemetry" : "Run Telemetry"}
                </button>
                <button className="btn btn-secondary" onClick={handleResetSim}>
                  <RotateCcw size={16} /> Reset Run
                </button>
                <div className="sim-clock">
                  <Clock size={16} /> <span>Simulation Time: <strong>{formatTime(simTimeMin)}</strong></span>
                </div>
              </div>
            </div>

            {/* Core Panels Grid */}
            <div className="telemetry-grid">
              
              {/* Speedometer & Performance Gauge */}
              <div className="card glass speed-card">
                <h2>Instrumentation Cluster</h2>
                <div className="cluster-row">
                  {/* Gauge dial */}
                  <div className="speedometer-dial">
                    <svg viewBox="0 0 100 100" className="gauge-svg">
                      <circle cx="50" cy="50" r="45" className="gauge-track" />
                      <circle 
                        cx="50" 
                        cy="50" 
                        r="45" 
                        className={`gauge-fill ${simSpeedKmh > currentLimit ? 'overspeed' : ''}`}
                        style={{
                          strokeDasharray: `${2 * Math.PI * 45}`,
                          strokeDashoffset: `${2 * Math.PI * 45 * (1 - simSpeedKmh / 120)}`
                        }}
                      />
                    </svg>
                    <div className="gauge-text">
                      <span className="speed-val">{Math.round(simSpeedKmh)}</span>
                      <span className="speed-unit">KM/H</span>
                    </div>
                  </div>
                  
                  {/* Dynamic stats */}
                  <div className="stats-col">
                    <div className="stat-box">
                      <span className="label">Section Speed Limit</span>
                      <span className="val limit">{currentLimit} KM/H</span>
                    </div>
                    <div className="stat-box">
                      <span className="label">Kilometer Position</span>
                      <span className="val">km {simDistanceKm.toFixed(3)} / 64.60</span>
                    </div>
                    <div className="stat-box">
                      <span className="label">Next Station Limit</span>
                      <span className="val">{nextStation.name} ({distToNext.toFixed(2)} km)</span>
                    </div>
                  </div>
                </div>
                
                {/* Visual Track Map Mini-progress */}
                <div className="mini-progress-track">
                  <div className="progress-fill" style={{ width: `${(simDistanceKm / 64.6) * 100}%` }}></div>
                  {stations.map(st => {
                    const pct = (st.km / 64.6) * 100;
                    return (
                      <div 
                        key={st.code} 
                        className={`station-tick ${simDistanceKm >= st.km ? 'passed' : ''}`}
                        style={{ left: `${pct}%` }}
                        title={`${st.name} (km ${st.km})`}
                      >
                        <span className="tick-label">{st.code}</span>
                      </div>
                    );
                  })}
                  <div className="train-marker" style={{ left: `${(simDistanceKm / 64.6) * 100}%` }}>🚂</div>
                </div>
              </div>

              {/* Locomotive Controllers */}
              <div className="card glass controller-card">
                <h2>Loco Cab Input (WAP-7)</h2>
                
                <div className="control-sliders">
                  {/* Throttle Notches */}
                  <div className="slider-group">
                    <div className="slider-label">
                      <span>Throttle Notch (Power)</span>
                      <span className="notch-indicator text-green">N {throttleNotch}</span>
                    </div>
                    <input 
                      type="range" 
                      min="0" 
                      max="8" 
                      value={throttleNotch} 
                      disabled={emergencyBrake}
                      onChange={(e) => setThrottleNotch(parseInt(e.target.value))}
                      className="slider throttle-slider"
                    />
                    <div className="notch-marks">
                      {[0,1,2,3,4,5,6,7,8].map(n => <span key={n} className={throttleNotch === n ? 'active' : ''}>{n}</span>)}
                    </div>
                  </div>

                  {/* Brake Notches */}
                  <div className="slider-group">
                    <div className="slider-label">
                      <span>Pneumatic Brakes</span>
                      <span className="notch-indicator text-red">B {brakeNotch}</span>
                    </div>
                    <input 
                      type="range" 
                      min="0" 
                      max="5" 
                      value={brakeNotch} 
                      disabled={emergencyBrake}
                      onChange={(e) => setBrakeNotch(parseInt(e.target.value))}
                      className="slider brake-slider"
                    />
                    <div className="notch-marks">
                      {[0,1,2,3,4,5].map(n => <span key={n} className={brakeNotch === n ? 'active' : ''}>{n}</span>)}
                    </div>
                  </div>
                </div>

                {/* Auxiliary Controls */}
                <div className="aux-controls">
                  <button 
                    className={`btn-aux horn ${hornActive ? 'active' : ''}`}
                    onMouseDown={() => setHornActive(true)}
                    onMouseUp={() => setHornActive(false)}
                    onMouseLeave={() => setHornActive(false)}
                  >
                    <Volume2 size={18} /> Sound Horn (W/L)
                  </button>
                  <button 
                    className={`btn-aux emergency ${emergencyBrake ? 'active' : ''}`}
                    onClick={() => {
                      setEmergencyBrake(!emergencyBrake);
                      setThrottleNotch(0);
                      setBrakeNotch(5);
                    }}
                  >
                    <ShieldAlert size={18} /> {emergencyBrake ? "Release Emergency Stop" : "EMERGENCY BRAKE"}
                  </button>
                </div>
              </div>

              {/* Driving Performance Score */}
              <div className="card glass score-card">
                <h2>Assistant Pilot Scorecard</h2>
                
                <div className="score-summary-row">
                  <div className="grade-badge">
                    <span className="grade-letter">{getGrade(score)}</span>
                    <span className="grade-points">{score} / 1000</span>
                  </div>
                  
                  <div className="sub-scores">
                    <div className="sub-score-bar">
                      <div className="score-lbl">
                        <span>Compliance & Safety</span>
                        <span>{complianceScore}%</span>
                      </div>
                      <div className="bar-track"><div className="bar-fill green" style={{ width: `${complianceScore}%` }}></div></div>
                    </div>
                    <div className="sub-score-bar">
                      <div className="score-lbl">
                        <span>Ride Smoothness</span>
                        <span>{smoothnessScore}%</span>
                      </div>
                      <div className="bar-track"><div className="bar-fill yellow" style={{ width: `${smoothnessScore}%` }}></div></div>
                    </div>
                    <div className="sub-score-bar">
                      <div className="score-lbl">
                        <span>Punctuality</span>
                        <span>{punctualityScore}%</span>
                      </div>
                      <div className="bar-track"><div className="bar-fill blue" style={{ width: `${punctualityScore}%` }}></div></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Signals & Weather Widgets */}
              <div className="card glass signal-weather-card">
                <h2>Corridor Conditions</h2>
                
                <div className="widget-row">
                  {/* Signal Aspect Sighting */}
                  <div className="signal-widget">
                    <h3>Aspect Sighting</h3>
                    <div className="signal-visual">
                      <div className="signal-post">
                        <div className={`light aspect-green ${signal.aspect === 'Clear' ? 'active' : ''}`}></div>
                        <div className={`light aspect-yellow ${signal.aspect === 'AttentionRequired' || signal.aspect === 'Caution' ? 'active' : ''}`}></div>
                        <div className={`light aspect-red ${signal.aspect === 'Danger' ? 'active' : ''}`}></div>
                      </div>
                    </div>
                    <div className="signal-desc" style={{ color: signal.color }}>
                      <strong>{signal.name}</strong>
                      <p>Next signal in {distToNext < 0.2 ? "200m" : (distToNext * 1000).toFixed(0) + "m"}</p>
                    </div>
                  </div>

                  {/* Weather Info */}
                  <div className="weather-widget">
                    <h3>Monsoon Profile</h3>
                    <div className="weather-presets-picker">
                      {WEATHER_PRESETS.map((p, idx) => (
                        <button 
                          key={p.type} 
                          className={`preset-btn ${weatherPresetIndex === idx ? 'active' : ''}`}
                          onClick={() => setWeatherPresetIndex(idx)}
                        >
                          {p.type === 'Clear' ? <Sun size={12} /> : <CloudRain size={12} />}
                          {p.type}
                        </button>
                      ))}
                    </div>

                    <div className="weather-stats">
                      <div className="w-item">
                        <Thermometer size={14} />
                        <span>Temp: <strong>{weather.temp}°C</strong></span>
                      </div>
                      <div className="w-item">
                        <Wind size={14} />
                        <span>Wind: <strong>{weather.wind} km/h</strong></span>
                      </div>
                      <div className="w-item">
                        <CloudRain size={14} />
                        <span>Rainfall: <strong>{Math.round(weather.rain * 100)}%</strong></span>
                      </div>
                      <div className="w-item">
                        <Info size={14} />
                        <span>Adhesion: <strong className="text-yellow">{(weather.adhesion).toFixed(2)} μ</strong></span>
                      </div>
                    </div>

                    {wheelSlip && (
                      <div className="slip-alarm flash-red">
                        <AlertTriangle size={14} fill="currentColor" /> WHEEL SLIP DETECTED - REDUCE THROTTLE!
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Violations Log Panel */}
              <div className="card glass violations-card">
                <h2>Violations Log (Indian Railways Compliance)</h2>
                <div className="violations-list">
                  {violations.length === 0 ? (
                    <div className="no-violations">
                      <span>✅ Line clear. No safety violations logged.</span>
                    </div>
                  ) : (
                    violations.map(v => (
                      <div key={v.id} className="violation-item">
                        <div className="viol-header">
                          <span className="viol-type badge-danger">{v.type}</span>
                          <span className="viol-time">{v.timestamp}</span>
                        </div>
                        <p className="viol-desc">{v.description}</p>
                        <div className="viol-footer">
                          <span>Location: <strong>km {v.km.toFixed(3)}</strong></span>
                          <span className="viol-penalty">-{v.penalty} pts</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 2: ROUTE TRACK EDITOR
            ========================================================================= */}
        {activeTab === 'route' && (
          <div className="tab-pane active fade-in">
            <div className="route-editor-grid">
              
              {/* Interactive Station Manager */}
              <div className="card glass stations-list-card">
                <div className="card-header-actions">
                  <h2>18 Corridor Stations (Digital Twin)</h2>
                  <div className="export-actions">
                    <button className="btn btn-primary btn-sm" onClick={handleExportJson}>
                      <Download size={14} /> Export JSON
                    </button>
                    <button className="btn btn-secondary btn-sm" onClick={handleCopyToClipboard}>
                      {copied ? <Check size={14} className="text-green" /> : <Copy size={14} />}
                      {copied ? "Copied!" : "Copy JSON"}
                    </button>
                  </div>
                </div>
                
                <div className="stations-table-wrapper">
                  <table className="stations-table">
                    <thead>
                      <tr>
                        <th>Code</th>
                        <th>Name</th>
                        <th>Chainage (KM)</th>
                        <th>Platforms</th>
                        <th>Mandatory Stop</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stations.map(st => (
                        <tr 
                          key={st.code} 
                          className={selectedStation?.code === st.code ? 'selected-row' : ''}
                          onClick={() => setSelectedStation(st)}
                        >
                          <td><strong className="text-green">{st.code}</strong></td>
                          <td>{st.name}</td>
                          <td>km {st.km.toFixed(1)}</td>
                          <td>{st.platforms}</td>
                          <td>{st.isMandatoryStop ? "🛑 YES" : "⚡ PASS"}</td>
                          <td>
                            <button 
                              className="btn-icon-danger"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteStation(st.code);
                              }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Add Station Form */}
                <form onSubmit={handleAddStation} className="add-station-form">
                  <h3>Add Real-world Station</h3>
                  <div className="form-row">
                    <input 
                      type="text" 
                      placeholder="Code (e.g. VKT)" 
                      value={newCode} 
                      maxLength={5}
                      required
                      onChange={e => setNewCode(e.target.value)} 
                    />
                    <input 
                      type="text" 
                      placeholder="Station Name" 
                      value={newName} 
                      required
                      onChange={e => setNewName(e.target.value)} 
                    />
                    <input 
                      type="number" 
                      step="0.1" 
                      placeholder="KM Milestone" 
                      value={newKm || ''} 
                      min={0}
                      max={65}
                      required
                      onChange={e => setNewKm(parseFloat(e.target.value))} 
                    />
                    <input 
                      type="number" 
                      placeholder="Platforms" 
                      value={newPlats || ''} 
                      min={1}
                      max={10}
                      required
                      onChange={e => setNewPlats(parseInt(e.target.value))} 
                    />
                    <label className="checkbox-label">
                      <input 
                        type="checkbox" 
                        checked={newStop} 
                        onChange={e => setNewStop(e.target.checked)} 
                      />
                      Stop
                    </label>
                    <button type="submit" className="btn btn-primary"><Plus size={16} /> Add</button>
                  </div>
                </form>
              </div>

              {/* Station details sidebar editor */}
              <div className="card glass station-details-card">
                <h2>Station Configuration Panel</h2>
                {selectedStation ? (
                  <div className="details-editor">
                    <div className="details-header">
                      <span className="station-large-code">{selectedStation.code}</span>
                      <h3>Editing: {selectedStation.name}</h3>
                    </div>
                    
                    <div className="edit-fields">
                      <div className="field-group">
                        <label>Station Display Name</label>
                        <input 
                          type="text" 
                          value={selectedStation.name}
                          onChange={e => handleUpdateStation({ ...selectedStation, name: e.target.value })}
                        />
                      </div>
                      <div className="field-group">
                        <label>Chainage Coordinate (KM)</label>
                        <input 
                          type="number" 
                          step="0.1"
                          value={selectedStation.km}
                          onChange={e => handleUpdateStation({ ...selectedStation, km: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                      <div className="field-group">
                        <label>Platforms Count</label>
                        <input 
                          type="number" 
                          value={selectedStation.platforms}
                          onChange={e => handleUpdateStation({ ...selectedStation, platforms: parseInt(e.target.value) || 1 })}
                        />
                      </div>
                      <div className="field-group">
                        <label>Dwell Stop Time (seconds)</label>
                        <input 
                          type="number" 
                          value={selectedStation.dwellTimeSec}
                          onChange={e => handleUpdateStation({ ...selectedStation, dwellTimeSec: parseInt(e.target.value) || 0 })}
                        />
                      </div>
                      <label className="checkbox-label-large">
                        <input 
                          type="checkbox" 
                          checked={selectedStation.isMandatoryStop}
                          onChange={e => handleUpdateStation({ ...selectedStation, isMandatoryStop: e.target.checked, dwellTimeSec: e.target.checked ? 120 : 0 })}
                        />
                        Mandatory Scheduled Stop for Express trains
                      </label>
                    </div>
                  </div>
                ) : (
                  <div className="select-prompt">
                    <MapPin size={32} />
                    <p>Select a station from the table to customize its geometric chainage profiles</p>
                  </div>
                )}

                {/* Speed Zones List */}
                <div className="speed-limits-editor">
                  <h3>Section Speed Limit Zones</h3>
                  <div className="speed-zones-list">
                    {speedZones.map(z => (
                      <div key={z.id} className="speed-zone-pill">
                        <div className="pill-left">
                          <span className="sz-limit-badge">{z.speedKmh} KM/H</span>
                          <span className="sz-km">km {z.startKm.toFixed(1)} - {z.endKm.toFixed(1)}</span>
                          <span className="sz-reason">{z.reason}</span>
                        </div>
                        <button className="btn-delete-sz" onClick={() => handleDeleteSpeedZone(z.id)}>
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>

                  <form onSubmit={handleAddSpeedZone} className="add-speedzone-form">
                    <h4>Add Speed Limit / Caution Restriction</h4>
                    <div className="form-grid">
                      <input 
                        type="number" 
                        step="0.1" 
                        placeholder="Start KM" 
                        value={szStart || ''} 
                        required
                        onChange={e => setSzStart(parseFloat(e.target.value))} 
                      />
                      <input 
                        type="number" 
                        step="0.1" 
                        placeholder="End KM" 
                        value={szEnd || ''} 
                        required
                        onChange={e => setSzEnd(parseFloat(e.target.value))} 
                      />
                      <input 
                        type="number" 
                        placeholder="Limit KM/H" 
                        value={szLimit || ''} 
                        required
                        onChange={e => setSzLimit(parseInt(e.target.value))} 
                      />
                      <input 
                        type="text" 
                        placeholder="Reason" 
                        value={szReason} 
                        required
                        onChange={e => setSzReason(e.target.value)} 
                      />
                    </div>
                    <button type="submit" className="btn btn-secondary btn-sm"><Plus size={12} /> Add Zone</button>
                  </form>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 3: TIMETABLE & AI TRAFFIC
            ========================================================================= */}
        {activeTab === 'timetable' && (
          <div className="tab-pane active fade-in">
            <div className="card glass timetable-card">
              <h2>Monsoon Corridor Schedule (8 Live Services)</h2>
              <p className="card-desc">
                Live interpolation of scheduled passenger and express trains operating along the Kollam $\rightarrow$ Thiruvananthapuram Central line.
              </p>
              
              <div className="services-timeline-panel">
                <div className="timeline-header">
                  <div className="services-info">
                    <span>Active Services: <strong>8 scheduled</strong></span>
                    <span>Corridor Span: <strong>64.6 km</strong></span>
                  </div>
                  <div className="simulation-time-display">
                    Time: <strong className="text-green">{formatTime(simTimeMin)}</strong>
                  </div>
                </div>

                <div className="timeline-tracks">
                  {SERVICES.map(svc => {
                    // Check if active based on time
                    const [depH, depM] = svc.dep.split(':').map(Number);
                    const depTotalMins = depH * 60 + depM;
                    const durationMins = svc.coaches > 12 ? 90 : 105; // express vs passenger duration
                    const endTotalMins = depTotalMins + durationMins;

                    let isActive = false;
                    let currentPosKm = svc.startKm;

                    if (simTimeMin >= depTotalMins && simTimeMin <= endTotalMins) {
                      isActive = true;
                      const progress = (simTimeMin - depTotalMins) / durationMins;
                      currentPosKm = svc.startKm + progress * (svc.endKm - svc.startKm);
                    }

                    return (
                      <div key={svc.id} className={`timeline-row ${isActive ? 'active' : 'idle'}`}>
                        <div className="svc-meta">
                          <div className="svc-identity">
                            <span className="svc-dot" style={{ backgroundColor: svc.color }}></span>
                            <span className="svc-name">{svc.name}</span>
                          </div>
                          <div className="svc-details">
                            <span>Dep: <strong>{svc.dep}</strong></span>
                            <span>Loco: <strong>{svc.type} ({svc.coaches} Coaches)</strong></span>
                          </div>
                        </div>

                        <div className="svc-visual-bar">
                          <div className="route-line"></div>
                          {isActive && (
                            <div 
                              className="svc-train-marker" 
                              style={{ 
                                left: `${(currentPosKm / 64.6) * 100}%`,
                                borderColor: svc.color
                              }}
                              title={`Current position: km ${currentPosKm.toFixed(1)}`}
                            >
                              🚂
                            </div>
                          )}
                          <div className="endpoints">
                            <span className="ep qln">QLN</span>
                            <span className="ep tvc">TVC</span>
                          </div>
                        </div>
                        
                        <div className="svc-status">
                          {isActive ? (
                            <span className="status-badge running" style={{ color: svc.color }}>RUNNING (km {currentPosKm.toFixed(1)})</span>
                          ) : (
                            <span className="status-badge waiting">WAITING</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="webtools-footer">
        <p>Kerala Rail Digital Twin Portal — Powered by Unity C# & React (Vite)</p>
      </footer>
    </div>
  );
}

export default App;
