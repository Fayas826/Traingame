using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;

namespace KeralaRailTwin.Core
{
    public enum ViolationType
    {
        SpeedExcess,
        SignalPassing,
        WLBoardMissed,
        OvershootStation,
        UndershootStation,
        EmergencyBrake,
        RoughStart,
        WheelSlip
    }

    [System.Serializable]
    public class Violation
    {
        public ViolationType type;
        public float kmPosition;
        public int severity;
        public string description = "";
        public int penaltyPoints;
        public float sessionTimestamp;
    }

    [System.Serializable]
    public class ScoreSummary
    {
        public int totalScore;
        public string grade = "F";
        public int violationCount;
        public int punctualityScore;
        public int smoothnessScore;
        public int complianceScore;
        public List<Violation> violations = new List<Violation>();
        public List<string> remarks = new List<string>();

        public int stationsVisited;
        public int stationsOnTime;
        public int totalMinutesLate;
        public int wlBoardsHonked;
        public int wlBoardsMissed;
        public int emergencyBrakeEvents;
        public int wheelSlipEvents;
    }

    public class ScoreEngine : MonoBehaviour
    {
        public static ScoreEngine Instance { get; private set; }

        private readonly List<Violation> violationsList = new List<Violation>();
        private readonly object stateLock = new object();

        private int punctualityScore = 100;
        private int smoothnessScore = 100;
        private int complianceScore = 100;
        private int punctualityBonus = 0;

        private int stationsVisited = 0;
        private int stationsOnTime = 0;
        private int totalMinutesLate = 0;
        private int wlBoardsHonked = 0;
        private int wlBoardsMissed = 0;
        private int emergencyEvents = 0;
        private int wheelSlipEvents = 0;

        private float sessionStartTime;

        public int TotalScore
        {
            get
            {
                lock (stateLock)
                {
                    int penalties = violationsList.Sum(v => v.penaltyPoints);
                    int raw = 1000 - penalties + punctualityBonus;
                    return Mathf.Clamp(raw, 0, 1000);
                }
            }
        }

        public string Grade => ScoreToGrade(TotalScore);

        public int ViolationCount
        {
            get { lock (stateLock) { return violationsList.Count; } }
        }

        public int PunctualityScoreVal { get { lock (stateLock) { return punctualityScore; } } }
        public int SmoothnessScoreVal  { get { lock (stateLock) { return smoothnessScore;  } } }
        public int ComplianceScoreVal  { get { lock (stateLock) { return complianceScore;  } } }

        private void Awake()
        {
            if (Instance == null)
            {
                Instance = this;
                DontDestroyOnLoad(gameObject);
                ResetEngine();
            }
            else
            {
                Destroy(gameObject);
            }
        }

        public void RecordViolation(ViolationType type, float km, float severity)
        {
            int sev = Mathf.Clamp((int)Mathf.Round(severity), 1, 3);
            int basePenalty = BasePenalty(type);
            int totalPenalty = basePenalty * sev;

            var v = new Violation
            {
                type = type,
                kmPosition = (float)Math.Round(km, 2),
                severity = sev,
                description = BuildDescription(type, km, sev),
                penaltyPoints = totalPenalty,
                sessionTimestamp = ElapsedSeconds()
            };

            lock (stateLock)
            {
                violationsList.Add(v);

                switch (type)
                {
                    case ViolationType.SpeedExcess:
                        complianceScore = Mathf.Max(0, complianceScore - 10 * sev);
                        break;
                    case ViolationType.SignalPassing:
                        complianceScore = Mathf.Max(0, complianceScore - 40);
                        break;
                    case ViolationType.WLBoardMissed:
                        complianceScore = Mathf.Max(0, complianceScore - 5);
                        wlBoardsMissed++;
                        break;
                    case ViolationType.OvershootStation:
                    case ViolationType.UndershootStation:
                        punctualityScore = Mathf.Max(0, punctualityScore - 5 * sev);
                        break;
                    case ViolationType.EmergencyBrake:
                        smoothnessScore = Mathf.Max(0, smoothnessScore - 15 * sev);
                        emergencyEvents++;
                        break;
                    case ViolationType.RoughStart:
                        smoothnessScore = Mathf.Max(0, smoothnessScore - 10 * sev);
                        break;
                    case ViolationType.WheelSlip:
                        smoothnessScore = Mathf.Max(0, smoothnessScore - 5);
                        wheelSlipEvents++;
                        break;
                }
            }
        }

        public void RecordStationArrival(string stationCode, float arrivalMin, float scheduledMin, float platformOvershootM)
        {
            lock (stateLock) { stationsVisited++; }

            float lateMins = arrivalMin - scheduledMin;
            int lateWhole = (int)Mathf.Max(0f, Mathf.Floor(lateMins));

            if (lateWhole == 0)
            {
                lock (stateLock)
                {
                    stationsOnTime++;
                    punctualityBonus += 100;
                    punctualityScore = Mathf.Min(100, punctualityScore + 5);
                }
            }
            else
            {
                int latePenalty = lateWhole * 5;
                var v = new Violation
                {
                    type = ViolationType.UndershootStation, // proxy for late arrival
                    kmPosition = 0f,
                    severity = Mathf.Clamp(lateWhole / 3, 1, 3),
                    description = $"Arrived at {stationCode} {lateWhole} min late (scheduled: {scheduledMin:F0} min).",
                    penaltyPoints = latePenalty,
                    sessionTimestamp = ElapsedSeconds()
                };

                lock (stateLock)
                {
                    violationsList.Add(v);
                    totalMinutesLate += lateWhole;
                    punctualityScore = Mathf.Max(0, punctualityScore - lateWhole * 2);
                }
            }

            float overshootAbs = Mathf.Abs(platformOvershootM);

            if (platformOvershootM > 10.0f)
            {
                RecordViolation(ViolationType.OvershootStation, 0f, 3f);
            }
            else if (platformOvershootM > 3.0f)
            {
                RecordViolation(ViolationType.OvershootStation, 0f, 1f);
            }
            else if (platformOvershootM < -3.0f)
            {
                RecordViolation(ViolationType.UndershootStation, 0f, 1f);
            }
        }

        public void RecordWLBoard(bool honked, float km)
        {
            lock (stateLock)
            {
                if (honked)
                {
                    wlBoardsHonked++;
                }
                else
                {
                    wlBoardsMissed++;
                    var v = new Violation
                    {
                        type = ViolationType.WLBoardMissed,
                        kmPosition = (float)Math.Round(km, 2),
                        severity = 1,
                        description = $"Missed horn at W/L board at km {km:F2}.",
                        penaltyPoints = 30,
                        sessionTimestamp = ElapsedSeconds()
                    };
                    violationsList.Add(v);
                    complianceScore = Mathf.Max(0, complianceScore - 5);
                }
            }
        }

        public void RecordEmergencyBrake(float km, float speedKmh)
        {
            int sev = speedKmh > 80f ? 3 : speedKmh > 40f ? 2 : 1;

            var v = new Violation
            {
                type = ViolationType.EmergencyBrake,
                kmPosition = (float)Math.Round(km, 2),
                severity = sev,
                description = $"Emergency brake applied at km {km:F2} at {speedKmh:F0} km/h.",
                penaltyPoints = 80,
                sessionTimestamp = ElapsedSeconds()
            };

            lock (stateLock)
            {
                violationsList.Add(v);
                smoothnessScore = Mathf.Max(0, smoothnessScore - 15 * sev);
                emergencyEvents++;
            }
        }

        public void RecordWheelSlip(float km, int throttleNotch)
        {
            var v = new Violation
            {
                type = ViolationType.WheelSlip,
                kmPosition = (float)Math.Round(km, 2),
                severity = Mathf.Clamp(throttleNotch / 3, 1, 3),
                description = $"Wheel slip at km {km:F2} (throttle notch {throttleNotch}).",
                penaltyPoints = 20,
                sessionTimestamp = ElapsedSeconds()
            };

            lock (stateLock)
            {
                violationsList.Add(v);
                smoothnessScore = Mathf.Max(0, smoothnessScore - 5);
                wheelSlipEvents++;
            }
        }

        public ScoreSummary GetScoreSummary()
        {
            lock (stateLock)
            {
                var remarks = BuildRemarks();

                return new ScoreSummary
                {
                    totalScore = TotalScore,
                    grade = Grade,
                    violationCount = violationsList.Count,
                    punctualityScore = punctualityScore,
                    smoothnessScore = smoothnessScore,
                    complianceScore = complianceScore,
                    violations = new List<Violation>(violationsList),
                    remarks = remarks,
                    stationsVisited = stationsVisited,
                    stationsOnTime = stationsOnTime,
                    totalMinutesLate = totalMinutesLate,
                    wlBoardsHonked = wlBoardsHonked,
                    wlBoardsMissed = wlBoardsMissed,
                    emergencyBrakeEvents = emergencyEvents,
                    wheelSlipEvents = wheelSlipEvents
                };
            }
        }

        public List<Violation> GetViolations()
        {
            lock (stateLock) { return new List<Violation>(violationsList); }
        }

        public void ResetEngine()
        {
            lock (stateLock)
            {
                violationsList.Clear();
                punctualityScore = 100;
                smoothnessScore = 100;
                complianceScore = 100;
                punctualityBonus = 0;
                stationsVisited = 0;
                stationsOnTime = 0;
                totalMinutesLate = 0;
                wlBoardsHonked = 0;
                wlBoardsMissed = 0;
                emergencyEvents = 0;
                wheelSlipEvents = 0;
                sessionStartTime = Time.time;
            }
        }

        private static int BasePenalty(ViolationType type) => type switch
        {
            ViolationType.SpeedExcess       => 50,
            ViolationType.SignalPassing     => 200,
            ViolationType.WLBoardMissed     => 30,
            ViolationType.OvershootStation  => 50,
            ViolationType.UndershootStation => 30,
            ViolationType.EmergencyBrake    => 80,
            ViolationType.RoughStart        => 40,
            ViolationType.WheelSlip         => 20,
            _                               => 10
        };

        private static string ScoreToGrade(int score) => score switch
        {
            >= 950 => "A+",
            >= 850 => "A",
            >= 700 => "B",
            >= 550 => "C",
            >= 400 => "D",
            _      => "F"
        };

        private static string BuildDescription(ViolationType type, float km, int severity)
        {
            string sevStr = severity switch { 3 => "MAJOR", 2 => "MODERATE", _ => "MINOR" };
            return type switch
            {
                ViolationType.SpeedExcess       => $"[{sevStr}] Speed limit exceeded at km {km:F2}.",
                ViolationType.SignalPassing     => $"[CRITICAL] Signal passed at DANGER (SPAD) at km {km:F2}.",
                ViolationType.WLBoardMissed     => $"[{sevStr}] Horn missed at W/L board at km {km:F2}.",
                ViolationType.OvershootStation  => $"[{sevStr}] Station stopping mark overshot at km {km:F2}.",
                ViolationType.UndershootStation => $"[{sevStr}] Station stopping mark undershot at km {km:F2}.",
                ViolationType.EmergencyBrake    => $"[{sevStr}] Emergency brake applied at km {km:F2}.",
                ViolationType.RoughStart        => $"[{sevStr}] Rough / jerky start at km {km:F2}.",
                ViolationType.WheelSlip         => $"[{sevStr}] Wheel slip detected at km {km:F2}.",
                _                               => $"[{sevStr}] Unknown violation at km {km:F2}."
            };
        }

        private List<string> BuildRemarks()
        {
            var r = new List<string>();
            int score = TotalScore;
            string grade = ScoreToGrade(score);

            r.Add($"Final Grade: {grade} — Total Score: {score}/1000.");

            if (stationsVisited > 0)
            {
                int pct = stationsOnTime * 100 / stationsVisited;
                r.Add(stationsOnTime == stationsVisited
                    ? "✅ Perfect punctuality — all stations on time!"
                    : $"⏱ On-time at {pct}% of stations ({stationsOnTime}/{stationsVisited}). Total late: {totalMinutesLate} min.");
            }

            int totalBoards = wlBoardsHonked + wlBoardsMissed;
            if (totalBoards > 0)
            {
                r.Add(wlBoardsMissed == 0
                    ? $"✅ All {wlBoardsHonked} W/L board horn(s) sounded correctly."
                    : $"⚠ Missed horn at {wlBoardsMissed}/{totalBoards} W/L board(s).");
            }

            if (emergencyEvents == 0)
                r.Add("✅ No emergency brake applications — excellent train handling.");
            else
                r.Add($"🚨 {emergencyEvents} emergency brake application(s) recorded.");

            if (wheelSlipEvents == 0)
                r.Add("✅ No wheel slip incidents — good throttle discipline.");
            else
                r.Add($"⚠ {wheelSlipEvents} wheel slip event(s) — reduce throttle on wet/oily rail.");

            int spads = violationsList.Count(v => v.type == ViolationType.SignalPassing);
            if (spads > 0)
                r.Add($"🚨 CRITICAL: {spads} Signal Passed At Danger (SPAD) event(s) — grounds for immediate review.");
            else
                r.Add("✅ No signals passed at danger.");

            int overspeeds = violationsList.Count(v => v.type == ViolationType.SpeedExcess);
            if (overspeeds > 0)
                r.Add($"⚠ {overspeeds} speed excess violation(s). Observe section speed limits.");
            else
                r.Add("✅ Speed discipline maintained throughout the run.");

            r.Add(grade switch
            {
                "A+" => "🏆 Outstanding performance! Grade A+ — Eligible for commendation.",
                "A"  => "🌟 Excellent driving. Minor improvements can push to A+.",
                "B"  => "👍 Good performance overall. Focus on punctuality and compliance.",
                "C"  => "📋 Average run. Review signal compliance and platform stopping accuracy.",
                "D"  => "⚠ Below standard. Mandatory re-training on signal rules recommended.",
                _    => "🚨 Unsatisfactory. SPAD or multiple critical violations. Immediate review required."
            });

            return r;
        }

        private float ElapsedSeconds()
        {
            return Time.time - sessionStartTime;
        }
    }
}
