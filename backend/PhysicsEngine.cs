using System;
using System.Collections.Generic;
using RailwaySimulator.Backend.Models;
using RailwaySimulator.Backend.Route;

namespace RailwaySimulator.Backend.Core
{
    public class PhysicsEngine
    {
        public double Speed { get; set; } = 0;
        public double WorldDistance { get; set; } = 0;
        public int ThrottleNotch { get; set; } = 0;
        public int BrakeNotch { get; set; } = 0;
        public double WheelRotation { get; set; } = 0;
        public double TractionModifier { get; set; } = 1.0;
        public bool IsEmergencyActive { get; set; } = false;
        public int DisplaySpeed => (int)Math.Round(Speed * SPEED_DISPLAY_MULT);

        public LocoProfile Loco { get; private set; }
        public RakeProfile Rake { get; private set; }

        public double TotalMass { get; private set; }
        public double MassRatio { get; private set; }
        public double[] CoachOffsets { get; private set; }

        // Constants matching JS
        private const double SPEED_DISPLAY_MULT = 10.0;
        private const double SCROLLING_MULTIPLIER = 4.8;
        private const double WHEEL_ROTATION_RATE = 0.45;
        private const double COASTING_DECEL = 0.001;
        private const double SWAY_BASE_PERIOD = 130.0;
        private const double SWAY_PHASE_SHIFT = 15.0;
        private const double SWAY_AMPLITUDE = 0.45;

        // Static profiles to mirror src/config.js
        private static readonly Dictionary<string, LocoProfile> LocoProfiles = new()
        {
            { "WAP-7", new LocoProfile { Id = "WAP-7", Name = "WAP-7", Type = "Electric Passenger", Mass = 1200, MaxSpeed = 11.5, ThrottlePower = 0.006, BrakeFactor = 0.008, DragA = 0.003, DragB = 0.001, DragC = 0.0001 } },
            { "WAP-4", new LocoProfile { Id = "WAP-4", Name = "WAP-4", Type = "Electric Passenger", Mass = 1400, MaxSpeed = 10.5, ThrottlePower = 0.005, BrakeFactor = 0.007, DragA = 0.004, DragB = 0.0012, DragC = 0.00015 } },
            { "WAG-12", new LocoProfile { Id = "WAG-12", Name = "WAG-12", Type = "Twin Freight Electric", Mass = 4500, MaxSpeed = 7.5, ThrottlePower = 0.003, BrakeFactor = 0.005, DragA = 0.006, DragB = 0.002, DragC = 0.0003 } },
            { "VANDE_BHARAT", new LocoProfile { Id = "VANDE_BHARAT", Name = "Vande Bharat", Type = "Semi-High Speed EMU", Mass = 850, MaxSpeed = 13.0, ThrottlePower = 0.008, BrakeFactor = 0.010, DragA = 0.002, DragB = 0.0008, DragC = 0.00008 } },
            { "WAG-9", new LocoProfile { Id = "WAG-9", Name = "WAG-9", Type = "Electric Freight", Mass = 3800, MaxSpeed = 8.0, ThrottlePower = 0.0035, BrakeFactor = 0.006, DragA = 0.005, DragB = 0.0018, DragC = 0.00025 } },
            { "WDM-3A", new LocoProfile { Id = "WDM-3A", Name = "WDM-3A / WDP-4D", Type = "Diesel", Mass = 1600, MaxSpeed = 9.5, ThrottlePower = 0.0045, BrakeFactor = 0.007, DragA = 0.004, DragB = 0.0014, DragC = 0.0002 } }
        };

        private static readonly Dictionary<string, RakeProfile> RakeProfiles = new()
        {
            { "LHB", new RakeProfile { Id = "LHB", Name = "LHB Coaches", Style = "Modern Red/Silver", CoachCount = 4, MassPerCoach = 50, DragMultiplier = 1.0 } },
            { "ICF", new RakeProfile { Id = "ICF", Name = "ICF Coaches", Style = "Classic Blue", CoachCount = 5, MassPerCoach = 55, DragMultiplier = 1.15 } },
            { "TANKER", new RakeProfile { Id = "TANKER", Name = "Fuel Tankers", Style = "Silver/Hazmat", CoachCount = 6, MassPerCoach = 80, DragMultiplier = 1.4 } },
            { "BOXN", new RakeProfile { Id = "BOXN", Name = "BOXN Wagons", Style = "Brown/Open-top", CoachCount = 8, MassPerCoach = 70, DragMultiplier = 1.6 } }
        };

        public PhysicsEngine(string locoId, string rakeId)
        {
            Loco = LocoProfiles.ContainsKey(locoId) ? LocoProfiles[locoId] : LocoProfiles["WAP-7"];
            Rake = RakeProfiles.ContainsKey(rakeId) ? RakeProfiles[rakeId] : RakeProfiles["LHB"];

            TotalMass = Loco.Mass + Rake.CoachCount * Rake.MassPerCoach;
            MassRatio = 1200.0 / TotalMass;

            CoachOffsets = new double[Rake.CoachCount];
        }

        public string CurrentGradientLabel { get; set; } = "LEVEL";
        public double CurrentGradientSlope { get; set; } = 0.0;
        public string SpeedLimitWarning { get; set; } = "";
        public string TrainType { get; set; } = "Passenger";

        public static bool IsStationStoppage(string code, string trainType)
        {
            if (trainType == "Express")
            {
                return code == "QLN" || code == "VAK" || code == "KZK" || code == "TVC";
            }
            if (trainType == "Superfast")
            {
                return code == "QLN" || code == "VAK" || code == "TVC";
            }
            if (trainType == "Special")
            {
                return code == "QLN" || code == "PVU" || code == "VAK" || code == "CRY" || code == "KZK" || code == "TVCN" || code == "TVC";
            }
            return true;
        }

        private static readonly (double startKM, double endKM, double slope, string label)[] GradientZones = new[]
        {
            (12.0, 15.0, 0.0067, "UP 1:150"),
            (18.0, 22.0, -0.005, "DN 1:200"),
            (22.0, 25.0, 0.010, "UP 1:100"),
            (30.0, 35.0, -0.0067, "DN 1:150"),
            (35.0, 45.0, 0.004, "UP 1:250"),
            (52.0, 58.0, -0.0083, "DN 1:120")
        };

        private static readonly double[] StationKMs = new double[]
        {
            0.0, 4.6, 8.9, 12.4, 17.0, 19.9, 23.7, 30.1, 32.8, 35.9, 40.0, 43.2, 47.2, 51.3, 55.3, 57.5, 62.1, 64.6
        };

        private (double slope, string label) GetGradientAt(double worldX)
        {
            double km = worldX / 3000.0;
            foreach (var zone in GradientZones)
            {
                if (km >= zone.startKM && km <= zone.endKM)
                {
                    return (zone.slope, zone.label);
                }
            }
            return (0.0, "LEVEL");
        }

        public void Update(double deltaMs, int throttle, int brake, bool emergency, double tractionMod)
        {
            ThrottleNotch = throttle;
            BrakeNotch = brake;
            IsEmergencyActive = emergency;
            TractionModifier = tractionMod;

            if (IsEmergencyActive)
            {
                BrakeNotch = 5;
                ThrottleNotch = 0;
            }

            double dt = deltaMs / 16.667;

            // Davis Equation Drag: F_drag = A + Bv + Cv^2
            double A = Loco.DragA * Rake.DragMultiplier;
            double B = Loco.DragB * Rake.DragMultiplier;
            double C = Loco.DragC * Rake.DragMultiplier;
            double friction = A + B * Speed + C * Speed * Speed;

            // Tractive power with mass scaling
            double power = ThrottleNotch * Loco.ThrottlePower * TractionModifier * MassRatio;
            double brakeForce = BrakeNotch * Loco.BrakeFactor;

            // Grade resistance
            var grad = GetGradientAt(WorldDistance);
            CurrentGradientLabel = grad.label;
            CurrentGradientSlope = grad.slope;
            double gradeForce = CurrentGradientSlope * 1.2 * MassRatio;

            Speed += (power - brakeForce - friction - gradeForce) * dt;

            // Check if train is passing a turnout (200m before any station entry)
            double trainKm = WorldDistance / 3000.0;
            bool isOnTurnout = false;
            foreach (var station in RouteEngine.Instance.GetAllStations())
            {
                if (IsStationStoppage(station.Code, TrainType))
                {
                    double switchKm = station.Km - 0.2;
                    if (Math.Abs(trainKm - switchKm) < 0.05)
                    {
                        isOnTurnout = true;
                        break;
                    }
                }
            }

            // Speed limit / governor
            double currentLimit = RouteEngine.Instance.GetSpeedLimitAt(trainKm);
            if (isOnTurnout && currentLimit > 30)
            {
                currentLimit = 30;
            }
            double maxSpd = currentLimit / SPEED_DISPLAY_MULT; // convert km/h to engine units

            if (DisplaySpeed > currentLimit)
            {
                if (isOnTurnout && currentLimit == 30)
                {
                    SpeedLimitWarning = "⚠️ OVERSPEEDING ON TURNOUT! LIMIT 30 KM/H";
                }
                else
                {
                    SpeedLimitWarning = $"⚠️ OVER SPEED LIMIT! {currentLimit} KM/H MAX";
                }
            }
            else
            {
                if (isOnTurnout && currentLimit == 30)
                {
                    SpeedLimitWarning = "⚠️ 30 KM/H LIMIT ON TURNOUT";
                }
                else
                {
                    SpeedLimitWarning = "";
                }
            }

            // Coasting
            if (ThrottleNotch == 0 && Speed > 0)
            {
                Speed -= COASTING_DECEL * dt;
            }

            // Clamp only to physical locomotive speed limits (no automatic brake clamp on track speed limit)
            Speed = Math.Max(0.0, Math.Min(Speed, Loco.MaxSpeed));
            WorldDistance += Speed * dt;
            WheelRotation += Speed * WHEEL_ROTATION_RATE * dt;

            // Coach sway suspension
            long now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
            for (int i = 0; i < CoachOffsets.Length; i++)
            {
                CoachOffsets[i] = Math.Sin(now / (SWAY_BASE_PERIOD + i * SWAY_PHASE_SHIFT)) * (Speed * SWAY_AMPLITUDE);
            }
        }

        public void ApplyAutoStop(double distToStation, double deltaMs)
        {
            double dt = deltaMs / 16.667;
            double absDist = Math.Abs(distToStation);

            double gentleBrakeDist = 1200.0;
            double aggressiveBrakeDist = 400.0;
            double gentleBrakeFactor = 0.97;
            double aggressiveBrakeFactor = 0.92;
            double snapStopDist = 150.0;
            double snapStopSpeed = 1.0;

            if (absDist < gentleBrakeDist)
            {
                double factor = absDist < aggressiveBrakeDist ? aggressiveBrakeFactor : gentleBrakeFactor;
                Speed *= Math.Pow(factor, dt);
                if (Speed < 0.2) Speed = 0.0;
            }

            if (absDist < snapStopDist && Speed < snapStopSpeed)
            {
                Speed = 0.0;
            }
        }

        public SimulationStateResponse GetStateResponse()
        {
            return new SimulationStateResponse
            {
                Speed = Speed,
                DisplaySpeed = (int)Math.Round(Speed * SPEED_DISPLAY_MULT),
                WorldDistance = WorldDistance,
                WheelRotation = WheelRotation,
                BgX = WorldDistance * SCROLLING_MULTIPLIER,
                NotchLabel = BrakeNotch > 0 ? $"B {BrakeNotch}" : $"N {ThrottleNotch}",
                CoachOffsets = CoachOffsets,
                IsEmergencyActive = IsEmergencyActive,
                SpeedLimitWarning = SpeedLimitWarning
            };
        }
    }
}
