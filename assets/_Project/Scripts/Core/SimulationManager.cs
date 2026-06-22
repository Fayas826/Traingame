using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using KeralaRailTwin.Physics;
using KeralaRailTwin.Infrastructure;
using KeralaRailTwin.Environment;
using KeralaRailTwin.AI;

namespace KeralaRailTwin.Core
{
    public enum TrainType
    {
        Express,
        Superfast,
        Passenger,
        MEMU,
        Special
    }

    public enum StopReason
    {
        None,
        ManualBrake,
        RedSignal,
        ScheduledStop,
        EmergencyStop
    }

    public class SimulationManager : MonoBehaviour
    {
        public static SimulationManager Instance { get; private set; }

        [Header("Engine References")]
        public PhysicsEngine physicsEngine;
        
        [Header("Clock & Session State")]
        [Range(0f, 1f)] public float timeOfDay = 0.33f; // Starts at 08:00 AM (8/24)
        public float timeSpeedMultiplier = 0.001f;
        public float simTimeMinutes = 480.0f; // 08:00 AM in minutes

        [Header("Timetable Configuration")]
        public TrainType activeTrainType = TrainType.Express;

        [Header("Driving Evaluation Settings")]
        public float lcApproachThresholdKm = 0.4f;
        
        [Header("Live Diagnostics")]
        [ReadOnly] public StopReason currentStopReason = StopReason.None;

        // Cooldowns to avoid logging violations too frequently (in seconds)
        private float nextOverspeedLogTime = 0f;
        private float nextWheelSlipLogTime = 0f;
        private const float ViolationLogCooldown = 4f;

        // Level crossing tracking
        private readonly float[] levelCrossingKms = new float[] { 15.2f, 48.6f };
        private readonly HashSet<float> activeLcCrossings = new HashSet<float>();
        private bool hornSoundedInCurrentLcZone = false;

        // Station arrival tracking
        private string lastVisitedStationCode = "";
        private bool isCurrentlyDwellAtStation = false;

        private void Awake()
        {
            if (Instance == null)
            {
                Instance = this;
                DontDestroyOnLoad(gameObject);
            }
            else
            {
                Destroy(gameObject);
            }
        }

        private void Start()
        {
            if (physicsEngine == null)
            {
                physicsEngine = FindFirstObjectByType<PhysicsEngine>();
            }
        }

        public bool IsStationScheduledStop(string code)
        {
            if (string.IsNullOrEmpty(code)) return true;
            code = code.ToUpperInvariant();

            switch (activeTrainType)
            {
                case TrainType.Express:
                    // Stops only at Kollam Junction (QLN), Varkala Sivagiri (VAK), Kazhakkuttam (KZK), and Trivandrum Central (TVC)
                    return code == "QLN" || code == "VAK" || code == "KZK" || code == "TVC";
                case TrainType.Superfast:
                    // Stops only at QLN, VAK, TVC
                    return code == "QLN" || code == "VAK" || code == "TVC";
                case TrainType.Special:
                    // Stops at QLN, Paravur (PVU), VAK, Kadakkavur (KVU), Chirayinkeezhu (CRY), Kazhakkuttam (KZK), TVC
                    return code == "QLN" || code == "PVU" || code == "VAK" || code == "KVU" || code == "CRY" || code == "KZK" || code == "TVC";
                case TrainType.Passenger:
                case TrainType.MEMU:
                default:
                    // Stops at all 18 stations
                    return true;
            }
        }

        private void Update()
        {
            if (physicsEngine == null) return;

            float trainKm = physicsEngine.worldDistance / 3000.0f; // Convert meters to km
            float trainSpeedKmh = physicsEngine.DisplaySpeed;

            // 1. Update Game Time & Weather
            timeOfDay = (timeOfDay + Time.deltaTime * timeSpeedMultiplier) % 1.0f;
            simTimeMinutes = (simTimeMinutes + Time.deltaTime * timeSpeedMultiplier * 1440.0f) % 1440.0f;

            if (WeatherEngine.Instance != null)
            {
                WeatherEngine.Instance.UpdateWeather(trainKm, timeOfDay);
                physicsEngine.tractionModifier = WeatherEngine.Instance.GetAdhesionAt(trainKm);
            }

            // 2. Update Signaling Interlocking Limits
            if (SignalEngine.Instance != null)
            {
                SignalEngine.Instance.UpdateSignals(trainKm, trainSpeedKmh);
                float restrictiveSpeed = SignalEngine.Instance.GetRestrictiveSpeed(trainKm);
                physicsEngine.speedLimitOverride = restrictiveSpeed;

                // Sync SPAD violations from SignalEngine to ScoreEngine
                if (SignalEngine.Instance.violations.Count > ScoreEngine.Instance.GetViolations().Count)
                {
                    var lastViolation = SignalEngine.Instance.violations[SignalEngine.Instance.violations.Count - 1];
                    bool alreadyLogged = false;
                    foreach (var scoreViol in ScoreEngine.Instance.GetViolations())
                    {
                        if (scoreViol.type == ViolationType.SignalPassing && Mathf.Abs(scoreViol.kmPosition - lastViolation.positionKm) < 0.05f)
                        {
                            alreadyLogged = true;
                            break;
                        }
                    }

                    if (!alreadyLogged)
                    {
                        ScoreEngine.Instance.RecordViolation(ViolationType.SignalPassing, lastViolation.positionKm, 3.0f);
                        physicsEngine.isEmergencyActive = true; // Auto stop
                    }
                }
            }

            // 3. Evaluate Speed Limits compliance
            float speedLimit = 110f;
            if (RouteEngine.Instance != null)
            {
                speedLimit = RouteEngine.Instance.GetSpeedLimitAt(trainKm);
            }
            if (physicsEngine.speedLimitOverride < speedLimit)
            {
                speedLimit = physicsEngine.speedLimitOverride;
            }

            if (trainSpeedKmh > speedLimit)
            {
                if (Time.time >= nextOverspeedLogTime)
                {
                    nextOverspeedLogTime = Time.time + ViolationLogCooldown;
                    float severity = (trainSpeedKmh - speedLimit) > 10f ? 2.0f : 1.0f;
                    ScoreEngine.Instance.RecordViolation(ViolationType.SpeedExcess, trainKm, severity);
                }
            }

            // 4. Evaluate Wheel Slips
            if (physicsEngine.isSlipping)
            {
                if (Time.time >= nextWheelSlipLogTime)
                {
                    nextWheelSlipLogTime = Time.time + ViolationLogCooldown;
                    ScoreEngine.Instance.RecordWheelSlip(trainKm, physicsEngine.throttleNotch);
                }
            }

            // 5. Level Crossing Whistle Rule Verification
            EvaluateLevelCrossings(trainKm);

            // 6. Station Stop Accuracy & Timetable Check
            EvaluateStationStops(trainKm, trainSpeedKmh);

            // 7. Resolve Current Stopping Reason
            ResolveStopReason(trainKm, trainSpeedKmh);
        }

        private void EvaluateLevelCrossings(float trainKm)
        {
            foreach (var lcKm in levelCrossingKms)
            {
                float entryKm = lcKm - lcApproachThresholdKm;
                float exitKm = lcKm + 0.05f;

                if (trainKm >= entryKm && trainKm <= exitKm)
                {
                    if (!activeLcCrossings.Contains(lcKm))
                    {
                        activeLcCrossings.Add(lcKm);
                        hornSoundedInCurrentLcZone = false;
                    }

                    if (physicsEngine.hornActive)
                    {
                        hornSoundedInCurrentLcZone = true;
                    }
                }
                else if (activeLcCrossings.Contains(lcKm))
                {
                    activeLcCrossings.Remove(lcKm);
                    ScoreEngine.Instance.RecordWLBoard(hornSoundedInCurrentLcZone, lcKm);
                }
            }
        }

        private void EvaluateStationStops(float trainKm, float trainSpeedKmh)
        {
            if (RouteEngine.Instance == null) return;

            var nextStation = RouteEngine.Instance.GetNextStation(trainKm - 0.2f);
            if (nextStation == null) return;

            // Bypassed if intermediate/skipped station
            if (!IsStationScheduledStop(nextStation.code)) return;

            float distToStation = nextStation.km - trainKm;
            float absDist = Mathf.Abs(distToStation);

            // Check if train is stopped near platform stop mark (within 50 meters)
            if (trainSpeedKmh == 0f && absDist <= 0.05f)
            {
                if (lastVisitedStationCode != nextStation.code)
                {
                    lastVisitedStationCode = nextStation.code;
                    isCurrentlyDwellAtStation = true;

                    float offsetMeters = distToStation * 1000f; 
                    float platformOvershoot = -offsetMeters; 

                    float scheduledArrival = 480.0f + nextStation.km * 1.5f; 
                    float actualArrival = simTimeMinutes;

                    ScoreEngine.Instance.RecordStationArrival(nextStation.code, actualArrival, scheduledArrival, platformOvershoot);
                    
                    if (SignalEngine.Instance != null)
                    {
                        SignalEngine.Instance.ActivateStarter(nextStation.code);
                    }
                }
            }
            else if (absDist > 0.1f && isCurrentlyDwellAtStation && lastVisitedStationCode == nextStation.code)
            {
                isCurrentlyDwellAtStation = false;
            }
        }

        private void ResolveStopReason(float trainKm, float trainSpeedKmh)
        {
            if (trainSpeedKmh > 0.1f)
            {
                currentStopReason = StopReason.None;
                return;
            }

            if (physicsEngine.isEmergencyActive)
            {
                currentStopReason = StopReason.EmergencyStop;
                return;
            }

            if (physicsEngine.brakeNotch > 0)
            {
                currentStopReason = StopReason.ManualBrake;
                return;
            }

            if (SignalEngine.Instance != null)
            {
                var nextSig = SignalEngine.Instance.GetNextSignal(trainKm);
                if (nextSig != null && nextSig.aspect == SignalAspect.Danger && Mathf.Abs(nextSig.positionKm - trainKm) <= 0.05f)
                {
                    currentStopReason = StopReason.RedSignal;
                    return;
                }
            }

            if (isCurrentlyDwellAtStation)
            {
                currentStopReason = StopReason.ScheduledStop;
                return;
            }

            currentStopReason = StopReason.None;
        }

        private void OnGUI()
        {
            // Set up a semi-transparent black texture for background
            Texture2D bgTex = new Texture2D(1, 1);
            bgTex.SetPixel(0, 0, new Color(0.05f, 0.06f, 0.09f, 0.85f));
            bgTex.Apply();

            GUIStyle boxStyle = new GUIStyle(GUI.skin.box);
            boxStyle.normal.background = bgTex;

            Rect areaRect = new Rect(Screen.width - 330, 20, 310, 240);
            GUILayout.BeginArea(areaRect, boxStyle);
            GUILayout.BeginVertical();

            // Header
            GUIStyle headerStyle = new GUIStyle();
            headerStyle.fontSize = 13;
            headerStyle.fontStyle = FontStyle.Bold;
            headerStyle.normal.textColor = Color.cyan;
            headerStyle.alignment = TextAnchor.MiddleCenter;
            headerStyle.margin = new RectOffset(0, 0, 8, 8);
            GUILayout.Label("📟 KERALA DIGITAL TWIN: CONTROL DECK", headerStyle);

            // Spacer line
            GUILayout.Box("", GUILayout.Height(1), GUILayout.ExpandWidth(true));

            // Labels and Values styles
            GUIStyle labelStyle = new GUIStyle();
            labelStyle.fontSize = 11;
            labelStyle.normal.textColor = new Color(0.8f, 0.8f, 0.8f);
            labelStyle.margin = new RectOffset(10, 10, 2, 2);

            GUIStyle valueStyle = new GUIStyle();
            valueStyle.fontSize = 11;
            valueStyle.fontStyle = FontStyle.Bold;
            valueStyle.normal.textColor = Color.white;
            valueStyle.margin = new RectOffset(10, 10, 2, 2);

            void DrawStat(string label, string val, Color valColor)
            {
                GUILayout.BeginHorizontal();
                GUILayout.Label(label, labelStyle, GUILayout.Width(130));
                valueStyle.normal.textColor = valColor;
                GUILayout.Label(val, valueStyle);
                GUILayout.EndHorizontal();
            }

            float trainKm = physicsEngine.worldDistance / 3000.0f;
            float speedLimit = 110f;
            if (RouteEngine.Instance != null)
            {
                speedLimit = RouteEngine.Instance.GetSpeedLimitAt(trainKm);
            }
            if (physicsEngine.speedLimitOverride < speedLimit)
            {
                speedLimit = physicsEngine.speedLimitOverride;
            }

            string aspectStr = "CLEAR";
            Color aspectCol = Color.green;
            if (SignalEngine.Instance != null)
            {
                var next = SignalEngine.Instance.GetNextSignal(trainKm);
                if (next != null)
                {
                    aspectStr = next.aspect.ToString().ToUpperInvariant();
                    aspectCol = next.aspect == SignalAspect.Danger ? Color.red :
                                next.aspect == SignalAspect.Caution ? Color.yellow :
                                next.aspect == SignalAspect.AttentionRequired ? new Color(1f, 0.8f, 0f) : Color.green;
                }
            }

            Color stopColor = currentStopReason == StopReason.None ? Color.white :
                              currentStopReason == StopReason.EmergencyStop || currentStopReason == StopReason.RedSignal ? Color.red : Color.yellow;

            DrawStat("Current Speed:", $"{physicsEngine.DisplaySpeed} KM/H", physicsEngine.DisplaySpeed > speedLimit ? Color.red : Color.green);
            DrawStat("Target Speed Limit:", $"{speedLimit} KM/H", Color.yellow);
            DrawStat("Signal Aspect:", aspectStr, aspectCol);
            DrawStat("Brake Configuration:", physicsEngine.isEmergencyActive ? "EMERGENCY" : $"NOTCH {physicsEngine.brakeNotch}", physicsEngine.isEmergencyActive ? Color.red : Color.white);
            DrawStat("Active Stop Reason:", currentStopReason.ToString().ToUpperInvariant(), stopColor);
            DrawStat("Active Timetable:", activeTrainType.ToString().ToUpperInvariant(), Color.cyan);
            DrawStat("Control Mode:", "PLAYER MANUAL", Color.white);

            GUILayout.EndVertical();
            GUILayout.EndArea();
        }
    }
}
