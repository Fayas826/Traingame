using System;
using UnityEngine;
using KeralaRailTwin.Core;
using KeralaRailTwin.Infrastructure;

namespace KeralaRailTwin.Physics
{
    public class PhysicsEngine : MonoBehaviour
    {
        [Header("Locomotive & Rake Configuration")]
        public LocoProfile loco;
        public RakeProfile rake;

        [Header("Train Physics State")]
        [ReadOnly] public float speed = 0f;
        [ReadOnly] public float worldDistance = 0f;
        [Range(0, 8)] public int throttleNotch = 0;
        [Range(0, 5)] public int brakeNotch = 0;
        [ReadOnly] public float wheelRotation = 0f;
        public float tractionModifier = 1.0f;
        [ReadOnly] public bool isEmergencyActive = false;
        [ReadOnly] public bool isSlipping = false;
        public bool hornActive = false;
        [ReadOnly] public float speedLimitOverride = 110f;

        [Header("Davis Equation Details")]
        [ReadOnly] public float totalMass;
        [ReadOnly] public float massRatio;
        [ReadOnly] public float[] coachOffsets;

        [Header("Route Context")]
        [ReadOnly] public string currentGradientLabel = "LEVEL";
        [ReadOnly] public float currentGradientSlope = 0.0f;
        [ReadOnly] public string speedLimitWarning = "";

        private const float SPEED_DISPLAY_MULT = 10.0f;
        private const float SCROLLING_MULTIPLIER = 4.8f;
        private const float WHEEL_ROTATION_RATE = 0.45f;
        private const float COASTING_DECEL = 0.001f;
        private const float SWAY_BASE_PERIOD = 130.0f;
        private const float SWAY_PHASE_SHIFT = 15.0f;
        private const float SWAY_AMPLITUDE = 0.45f;

        public int DisplaySpeed => (int)Mathf.Round(speed * SPEED_DISPLAY_MULT);
        public float BgX => worldDistance * SCROLLING_MULTIPLIER;
        public string NotchLabel => brakeNotch > 0 ? $"B {brakeNotch}" : $"N {throttleNotch}";

        private static readonly float[] StationKMs = new float[]
        {
            0.0f, 4.6f, 8.9f, 12.4f, 17.0f, 19.9f, 23.7f, 30.1f, 32.8f, 35.9f, 40.0f, 43.2f, 47.2f, 51.3f, 55.3f, 57.5f, 62.1f, 64.6f
        };

        private void Start()
        {
            InitializePhysics();
        }

        public void InitializePhysics()
        {
            if (loco == null)
            {
                Debug.LogWarning("LocoProfile is not assigned! Loading default WAP-7 values.");
                loco = ScriptableObject.CreateInstance<LocoProfile>();
                loco.id = "WAP-7";
                loco.locoName = "WAP-7";
                loco.mass = 1200f;
                loco.maxSpeed = 11.5f;
                loco.throttlePower = 0.006f;
                loco.brakeFactor = 0.008f;
                loco.dragA = 0.003f;
                loco.dragB = 0.001f;
                loco.dragC = 0.0001f;
            }

            if (rake == null)
            {
                Debug.LogWarning("RakeProfile is not assigned! Loading default LHB values.");
                rake = ScriptableObject.CreateInstance<RakeProfile>();
                rake.id = "LHB";
                rake.rakeName = "LHB Coaches";
                rake.coachCount = 4;
                rake.massPerCoach = 50f;
                rake.dragMultiplier = 1.0f;
            }

            totalMass = loco.mass + rake.coachCount * rake.massPerCoach;
            massRatio = 1200.0f / totalMass;

            coachOffsets = new float[rake.coachCount];
        }

        private void Update()
        {
            // Update physics step using Unity deltaTime
            UpdatePhysics(Time.deltaTime * 1000f);
        }

        public void UpdatePhysics(float deltaMs)
        {
            if (isEmergencyActive)
            {
                brakeNotch = 5;
                throttleNotch = 0;
            }

            float dt = deltaMs / 16.667f;

            // Davis Equation Drag: F_drag = A + Bv + Cv^2
            float A = loco.dragA * rake.dragMultiplier;
            float B = loco.dragB * rake.dragMultiplier;
            float C = loco.dragC * rake.dragMultiplier;
            float friction = A + B * speed + C * speed * speed;

            // Tractive power with mass scaling and wheel slip simulation
            float tractivePower = throttleNotch * loco.throttlePower * tractionModifier * massRatio;
            float adhesionLimit = tractionModifier * 2.0f; // proxy adhesion force limit
            
            float power = tractivePower;
            if (tractivePower > adhesionLimit && throttleNotch > 0)
            {
                isSlipping = true;
                power = adhesionLimit * 0.4f; // traction drops during wheel spin
            }
            else
            {
                isSlipping = false;
            }

            float brakeForce = brakeNotch * loco.brakeFactor;

            // Grade resistance
            float trainKm = worldDistance / 3000.0f;
            if (RouteEngine.Instance != null)
            {
                var grad = RouteEngine.Instance.GetGradientAt(trainKm);
                currentGradientLabel = grad.label;
                currentGradientSlope = grad.slope;
            }
            float gradeForce = currentGradientSlope * 1.2f * massRatio;

            speed += (power - brakeForce - friction - gradeForce) * dt;

            // Check if train is passing a turnout (200m before any station entry)
            bool isOnTurnout = false;
            foreach (var stKm in StationKMs)
            {
                float switchKm = stKm - 0.2f;
                if (Mathf.Abs(trainKm - switchKm) < 0.05f)
                {
                    bool isScheduledStop = true;
                    if (RouteEngine.Instance != null && SimulationManager.Instance != null)
                    {
                        var st = RouteEngine.Instance.GetStationNear(stKm, 0.5f);
                        if (st != null)
                        {
                            isScheduledStop = SimulationManager.Instance.IsStationScheduledStop(st.code);
                        }
                    }

                    if (isScheduledStop)
                    {
                        isOnTurnout = true;
                        break;
                    }
                }
            }

            // Speed limit / governor
            float currentLimit = 110f;
            if (RouteEngine.Instance != null)
            {
                currentLimit = RouteEngine.Instance.GetSpeedLimitAt(trainKm);
            }

            currentLimit = Mathf.Min(currentLimit, speedLimitOverride);

            if (isOnTurnout && currentLimit > 30)
            {
                currentLimit = 30;
            }
            float maxSpd = currentLimit / SPEED_DISPLAY_MULT; // convert km/h to engine units

            if (DisplaySpeed > currentLimit)
            {
                if (isOnTurnout && currentLimit == 30)
                {
                    speedLimitWarning = "⚠️ OVERSPEEDING ON TURNOUT! LIMIT 30 KM/H";
                }
                else
                {
                    speedLimitWarning = $"⚠️ OVER SPEED LIMIT! {currentLimit} KM/H MAX";
                }
            }
            else
            {
                if (isOnTurnout && currentLimit == 30)
                {
                    speedLimitWarning = "⚠️ 30 KM/H LIMIT ON TURNOUT";
                }
                else
                {
                    speedLimitWarning = "";
                }
            }

            if (speed > maxSpd)
            {
                if (isOnTurnout && currentLimit == 30)
                {
                    speed = Mathf.Max(speed - 0.05f * dt, maxSpd);
                }
                else if (throttleNotch > 6)
                {
                    speed = Mathf.Max(speed - 0.005f * dt, maxSpd);
                }
            }

            // Coasting
            if (throttleNotch == 0 && speed > 0)
            {
                speed -= COASTING_DECEL * dt;
            }

            speed = Mathf.Max(0.0f, Mathf.Min(speed, maxSpd));
            worldDistance += speed * dt;
            wheelRotation += speed * WHEEL_ROTATION_RATE * dt;

            // Coach sway suspension
            long now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
            for (int i = 0; i < coachOffsets.Length; i++)
            {
                coachOffsets[i] = Mathf.Sin(now / (SWAY_BASE_PERIOD + i * SWAY_PHASE_SHIFT)) * (speed * SWAY_AMPLITUDE);
            }
        }

        public void ApplyAutoStop(float distToStation, float deltaMs)
        {
            float dt = deltaMs / 16.667f;
            float absDist = Mathf.Abs(distToStation);

            float gentleBrakeDist = 1200.0f;
            float aggressiveBrakeDist = 400.0f;
            float gentleBrakeFactor = 0.97f;
            float aggressiveBrakeFactor = 0.92f;
            float snapStopDist = 150.0f;
            float snapStopSpeed = 1.0f;

            if (absDist < gentleBrakeDist)
            {
                float factor = absDist < aggressiveBrakeDist ? aggressiveBrakeFactor : gentleBrakeFactor;
                speed *= Mathf.Pow(factor, dt);
                if (speed < 0.2f) speed = 0.0f;
            }

            if (absDist < snapStopDist && speed < snapStopSpeed)
            {
                speed = 0.0f;
            }
        }
    }

    // Custom attribute to display readonly fields in the Unity Inspector
    public class ReadOnlyAttribute : PropertyAttribute { }
}
