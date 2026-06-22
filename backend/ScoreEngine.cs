using System;
using System.Collections.Generic;
using System.Linq;

namespace RailwaySimulator.Backend.Core
{
    // ─────────────────────────────────────────────────────────────────────────────
    // Enums & Data Models
    // ─────────────────────────────────────────────────────────────────────────────

    /// <summary>
    /// Categories of operational violation that an ALP (Assistant Loco Pilot) can commit
    /// on Indian Railways. Each type carries its own base penalty weight.
    /// </summary>
    public enum ViolationType
    {
        /// <summary>Exceeding the permissible speed on a section or near a station.</summary>
        SpeedExcess,

        /// <summary>Passing a signal at danger (SPAD — Signal Passed At Danger).</summary>
        SignalPassing,

        /// <summary>Failing to sound horn at a whistle / level-crossing (W/L) board.</summary>
        WLBoardMissed,

        /// <summary>Stopping beyond the designated stopping mark at a station platform.</summary>
        OvershootStation,

        /// <summary>Stopping short of the designated stopping mark at a station platform.</summary>
        UndershootStation,

        /// <summary>Application of emergency brake outside a signal/danger situation.</summary>
        EmergencyBrake,

        /// <summary>Jerky, rough start from a station (excessive jolt on passengers).</summary>
        RoughStart,

        /// <summary>Wheel slip detected, typically from over-notching on poor adhesion.</summary>
        WheelSlip
    }

    /// <summary>A single rule infraction logged during a run.</summary>
    public class Violation
    {
        /// <summary>Category of the violation.</summary>
        public ViolationType Type { get; set; }

        /// <summary>Corridor position (km) at which the violation occurred.</summary>
        public double KmPosition { get; set; }

        /// <summary>
        /// Severity level: 1 = Minor, 2 = Moderate, 3 = Major.
        /// Controls the penalty multiplier.
        /// </summary>
        public int Severity { get; set; }

        /// <summary>Human-readable description of the event.</summary>
        public string Description { get; set; } = "";

        /// <summary>Points deducted from the session score for this violation.</summary>
        public int PenaltyPoints { get; set; }

        /// <summary>Timestamp of the violation within the game session (seconds since run start).</summary>
        public double SessionTimestamp { get; set; }
    }

    /// <summary>Complete end-of-run (or live) performance summary for a driver.</summary>
    public class ScoreSummary
    {
        /// <summary>Composite score out of 1000.</summary>
        public int TotalScore { get; set; }

        /// <summary>Letter grade derived from TotalScore.</summary>
        public string Grade { get; set; } = "F";

        /// <summary>Number of violations logged in the session.</summary>
        public int ViolationCount { get; set; }

        // ── Sub-scores ──────────────────────────────────────────────────────────

        /// <summary>Punctuality sub-score (0–100).  Based on station timing adherence.</summary>
        public int PunctualityScore { get; set; }

        /// <summary>Smoothness sub-score (0–100).  Penalised for rough handling events.</summary>
        public int SmoothnessScore { get; set; }

        /// <summary>Compliance sub-score (0–100).  Penalised for rule / signal violations.</summary>
        public int ComplianceScore { get; set; }

        // ── Detailed lists ──────────────────────────────────────────────────────

        /// <summary>All violations recorded in this session.</summary>
        public List<Violation> Violations { get; set; } = new();

        /// <summary>
        /// Performance remarks: positive achievements and areas for improvement.
        /// Suitable for displaying on the end-of-run report screen.
        /// </summary>
        public List<string> Remarks { get; set; } = new();

        // ── Raw counters (useful for analytics / frontend charts) ───────────────

        public int StationsVisited       { get; set; }
        public int StationsOnTime        { get; set; }
        public int TotalMinutesLate      { get; set; }
        public int WLBoardsHonked        { get; set; }
        public int WLBoardsMissed        { get; set; }
        public int EmergencyBrakeEvents  { get; set; }
        public int WheelSlipEvents       { get; set; }
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // ScoreEngine Singleton
    // ─────────────────────────────────────────────────────────────────────────────

    /// <summary>
    /// Singleton scoring and performance-grading engine for the Indian Railways simulator.
    ///
    /// <para><b>Scoring Algorithm (base 1000 points):</b></para>
    /// <list type="bullet">
    ///   <item>Speed excess &gt; 10 km/h above limit: −50 per event (×severity)</item>
    ///   <item>Signal passed at RED (SPAD): −200 (critical)</item>
    ///   <item>W/L board missed: −30 per board</item>
    ///   <item>Station overshoot &gt;3 m: −50; &gt;10 m: −100</item>
    ///   <item>Station undershoot &gt;3 m: −30</item>
    ///   <item>Emergency brake (non-signal cause): −80</item>
    ///   <item>Wheel slip per event: −20</item>
    ///   <item>Punctuality bonus: +100 if on time; −5 per minute late</item>
    /// </list>
    ///
    /// <para><b>Grade thresholds:</b> A+ ≥ 950 · A ≥ 850 · B ≥ 700 · C ≥ 550 · D ≥ 400 · F &lt; 400</para>
    /// </summary>
    public sealed class ScoreEngine
    {
        // ── Singleton boilerplate ────────────────────────────────────────────────
        private static readonly Lazy<ScoreEngine> _instance =
            new Lazy<ScoreEngine>(() => new ScoreEngine());
        public static ScoreEngine Instance => _instance.Value;
        private ScoreEngine() => Reset();

        // ─────────────────────────────────────────────────────────────────────────
        // State fields (all reset-able)
        // ─────────────────────────────────────────────────────────────────────────

        private readonly List<Violation> _violations  = new();
        private readonly object _lock = new();

        // Sub-score accumulators (start at 100 each, clamped 0–100)
        private int _punctualityScore  = 100;
        private int _smoothnessScore   = 100;
        private int _complianceScore   = 100;

        // Bonus pool from punctuality
        private int _punctualityBonus  = 0;

        // Counters
        private int _stationsVisited   = 0;
        private int _stationsOnTime    = 0;
        private int _totalMinutesLate  = 0;
        private int _wlBoardsHonked    = 0;
        private int _wlBoardsMissed    = 0;
        private int _emergencyEvents   = 0;
        private int _wheelSlipEvents   = 0;

        // Session clock (seconds)
        private double _sessionStartSec;

        // ─────────────────────────────────────────────────────────────────────────
        // Public properties (computed)
        // ─────────────────────────────────────────────────────────────────────────

        /// <summary>Total composite score 0–1000 (base 1000 minus penalty points plus bonuses).</summary>
        public int TotalScore
        {
            get
            {
                lock (_lock)
                {
                    int penalties = _violations.Sum(v => v.PenaltyPoints);
                    int raw = 1000 - penalties + _punctualityBonus;
                    return Math.Clamp(raw, 0, 1000);
                }
            }
        }

        /// <summary>Current grade string (A+/A/B/C/D/F).</summary>
        public string Grade => ScoreToGrade(TotalScore);

        /// <summary>Total number of violations recorded.</summary>
        public int ViolationCount
        {
            get { lock (_lock) { return _violations.Count; } }
        }

        /// <summary>Punctuality sub-score (0–100).</summary>
        public int PunctualityScore { get { lock (_lock) { return _punctualityScore; } } }

        /// <summary>Smoothness sub-score (0–100).  Penalised by rough handling.</summary>
        public int SmoothnessScore  { get { lock (_lock) { return _smoothnessScore;  } } }

        /// <summary>Compliance sub-score (0–100).  Penalised by rule violations.</summary>
        public int ComplianceScore  { get { lock (_lock) { return _complianceScore;  } } }

        // ─────────────────────────────────────────────────────────────────────────
        // Public Methods
        // ─────────────────────────────────────────────────────────────────────────

        /// <summary>
        /// Records a generic rule violation.
        /// The penalty is calculated from the violation type's base penalty × severity multiplier.
        /// </summary>
        /// <param name="type">Category of violation.</param>
        /// <param name="km">Corridor position (km) where the violation occurred.</param>
        /// <param name="severity">Severity 1–3 (clamped).</param>
        public void RecordViolation(ViolationType type, double km, double severity)
        {
            int sev = Math.Clamp((int)Math.Round(severity), 1, 3);
            int basePenalty = BasePenalty(type);
            int totalPenalty = basePenalty * sev;

            var v = new Violation
            {
                Type             = type,
                KmPosition       = Math.Round(km, 2),
                Severity         = sev,
                Description      = BuildDescription(type, km, sev),
                PenaltyPoints    = totalPenalty,
                SessionTimestamp = ElapsedSeconds()
            };

            lock (_lock)
            {
                _violations.Add(v);

                // Affect sub-scores
                switch (type)
                {
                    case ViolationType.SpeedExcess:
                        _complianceScore  = Math.Max(0, _complianceScore - 10 * sev);
                        break;
                    case ViolationType.SignalPassing:
                        _complianceScore  = Math.Max(0, _complianceScore - 40);
                        break;
                    case ViolationType.WLBoardMissed:
                        _complianceScore  = Math.Max(0, _complianceScore - 5);
                        _wlBoardsMissed++;
                        break;
                    case ViolationType.OvershootStation:
                    case ViolationType.UndershootStation:
                        _punctualityScore = Math.Max(0, _punctualityScore - 5 * sev);
                        break;
                    case ViolationType.EmergencyBrake:
                        _smoothnessScore  = Math.Max(0, _smoothnessScore  - 15 * sev);
                        _emergencyEvents++;
                        break;
                    case ViolationType.RoughStart:
                        _smoothnessScore  = Math.Max(0, _smoothnessScore  - 10 * sev);
                        break;
                    case ViolationType.WheelSlip:
                        _smoothnessScore  = Math.Max(0, _smoothnessScore  - 5);
                        _wheelSlipEvents++;
                        break;
                }
            }
        }

        /// <summary>
        /// Records a station arrival event.  Calculates punctuality penalty/bonus and
        /// overshoot/undershoot violations automatically.
        /// </summary>
        /// <param name="stationCode">IR station code (e.g., "VKT").</param>
        /// <param name="arrivalMin">Actual arrival time (minutes past midnight, game-clock).</param>
        /// <param name="scheduledMin">Scheduled arrival time (minutes past midnight).</param>
        /// <param name="platformOvershootM">
        /// Signed overshoot in metres: positive = overshot stopping mark, negative = undershot.
        /// </param>
        public void RecordStationArrival(string stationCode, double arrivalMin,
                                          double scheduledMin, double platformOvershootM)
        {
            lock (_lock) { _stationsVisited++; }

            double lateMins = arrivalMin - scheduledMin;
            int lateWhole   = (int)Math.Max(0, Math.Floor(lateMins));

            if (lateWhole == 0)
            {
                // On time — grant punctuality bonus
                lock (_lock)
                {
                    _stationsOnTime++;
                    _punctualityBonus += 100;
                    _punctualityScore  = Math.Min(100, _punctualityScore + 5);
                }
            }
            else
            {
                // Late — deduct 5 per minute
                int latePenalty = lateWhole * 5;
                var v = new Violation
                {
                    Type             = ViolationType.UndershootStation, // re-used as proxy for "late"
                    KmPosition       = 0, // station km unknown here
                    Severity         = Math.Clamp(lateWhole / 3, 1, 3),
                    Description      = $"Arrived at {stationCode} {lateWhole} min late (scheduled: {scheduledMin:F0} min).",
                    PenaltyPoints    = latePenalty,
                    SessionTimestamp = ElapsedSeconds()
                };

                lock (_lock)
                {
                    _violations.Add(v);
                    _totalMinutesLate  += lateWhole;
                    _punctualityScore   = Math.Max(0, _punctualityScore - lateWhole * 2);
                }
            }

            // Platform stopping accuracy
            double overshootAbs = Math.Abs(platformOvershootM);

            if (platformOvershootM > 10.0)
            {
                // Major overshoot
                RecordViolation(ViolationType.OvershootStation, 0, 3);
            }
            else if (platformOvershootM > 3.0)
            {
                // Minor overshoot
                RecordViolation(ViolationType.OvershootStation, 0, 1);
            }
            else if (platformOvershootM < -3.0)
            {
                // Undershoot
                RecordViolation(ViolationType.UndershootStation, 0, 1);
            }
        }

        /// <summary>
        /// Records whether the driver sounded the horn at a W/L (Whistle/Level-crossing) board.
        /// A missed horn deducts 30 points.
        /// </summary>
        /// <param name="honked"><c>true</c> if the horn was sounded; <c>false</c> if missed.</param>
        /// <param name="km">Corridor position of the board (km).</param>
        public void RecordWLBoard(bool honked, double km)
        {
            lock (_lock)
            {
                if (honked)
                {
                    _wlBoardsHonked++;
                }
                else
                {
                    _wlBoardsMissed++;
                    // RecordViolation is already thread-safe via its own lock,
                    // but we already hold _lock here — call the internal version.
                    var v = new Violation
                    {
                        Type             = ViolationType.WLBoardMissed,
                        KmPosition       = Math.Round(km, 2),
                        Severity         = 1,
                        Description      = $"Missed horn at W/L board at km {km:F2}.",
                        PenaltyPoints    = 30,
                        SessionTimestamp = ElapsedSeconds()
                    };
                    _violations.Add(v);
                    _complianceScore = Math.Max(0, _complianceScore - 5);
                }
            }
        }

        /// <summary>
        /// Records an emergency brake application.  If this was not triggered by a signal at
        /// danger (the game should indicate that separately via <see cref="RecordViolation"/>),
        /// it deducts 80 points for rough driving.
        /// </summary>
        /// <param name="km">Corridor position (km).</param>
        /// <param name="speedKmh">Speed at the moment of emergency brake application (km/h).</param>
        public void RecordEmergencyBrake(double km, double speedKmh)
        {
            int sev = speedKmh > 80 ? 3 : speedKmh > 40 ? 2 : 1;

            var v = new Violation
            {
                Type             = ViolationType.EmergencyBrake,
                KmPosition       = Math.Round(km, 2),
                Severity         = sev,
                Description      = $"Emergency brake applied at km {km:F2} at {speedKmh:F0} km/h.",
                PenaltyPoints    = 80,
                SessionTimestamp = ElapsedSeconds()
            };

            lock (_lock)
            {
                _violations.Add(v);
                _smoothnessScore = Math.Max(0, _smoothnessScore - 15 * sev);
                _emergencyEvents++;
            }
        }

        /// <summary>
        /// Records a wheel-slip event.  Excessive throttle notching on low-adhesion rail
        /// causes wheel-slip, penalising −20 points per incident.
        /// </summary>
        /// <param name="km">Corridor position (km).</param>
        /// <param name="throttleNotch">Throttle notch at time of slip (1–8).</param>
        public void RecordWheelSlip(double km, int throttleNotch)
        {
            var v = new Violation
            {
                Type             = ViolationType.WheelSlip,
                KmPosition       = Math.Round(km, 2),
                Severity         = Math.Clamp(throttleNotch / 3, 1, 3),
                Description      = $"Wheel slip at km {km:F2} (throttle notch {throttleNotch}).",
                PenaltyPoints    = 20,
                SessionTimestamp = ElapsedSeconds()
            };

            lock (_lock)
            {
                _violations.Add(v);
                _smoothnessScore = Math.Max(0, _smoothnessScore - 5);
                _wheelSlipEvents++;
            }
        }

        /// <summary>Returns the current driver grade string (A+/A/B/C/D/F).</summary>
        public string GetCurrentGrade() => Grade;

        /// <summary>Returns the full session score summary including all violations and remarks.</summary>
        public ScoreSummary GetScoreSummary()
        {
            lock (_lock)
            {
                var remarks = BuildRemarks();

                return new ScoreSummary
                {
                    TotalScore         = TotalScore,
                    Grade              = Grade,
                    ViolationCount     = _violations.Count,
                    PunctualityScore   = _punctualityScore,
                    SmoothnessScore    = _smoothnessScore,
                    ComplianceScore    = _complianceScore,
                    Violations         = new List<Violation>(_violations),
                    Remarks            = remarks,
                    StationsVisited    = _stationsVisited,
                    StationsOnTime     = _stationsOnTime,
                    TotalMinutesLate   = _totalMinutesLate,
                    WLBoardsHonked     = _wlBoardsHonked,
                    WLBoardsMissed     = _wlBoardsMissed,
                    EmergencyBrakeEvents = _emergencyEvents,
                    WheelSlipEvents    = _wheelSlipEvents
                };
            }
        }

        /// <summary>Returns the list of all violations recorded in the current session.</summary>
        public List<Violation> GetViolations()
        {
            lock (_lock) { return new List<Violation>(_violations); }
        }

        /// <summary>
        /// Resets all scores, violations, and counters to their initial state.
        /// Call at the start of each new run.
        /// </summary>
        public void Reset()
        {
            lock (_lock)
            {
                _violations.Clear();
                _punctualityScore   = 100;
                _smoothnessScore    = 100;
                _complianceScore    = 100;
                _punctualityBonus   = 0;
                _stationsVisited    = 0;
                _stationsOnTime     = 0;
                _totalMinutesLate   = 0;
                _wlBoardsHonked     = 0;
                _wlBoardsMissed     = 0;
                _emergencyEvents    = 0;
                _wheelSlipEvents    = 0;
                _sessionStartSec    = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() / 1000.0;
            }
        }

        // ─────────────────────────────────────────────────────────────────────────
        // Private helpers
        // ─────────────────────────────────────────────────────────────────────────

        /// <summary>Maps a violation type to its base penalty in points.</summary>
        private static int BasePenalty(ViolationType type) => type switch
        {
            ViolationType.SpeedExcess        => 50,
            ViolationType.SignalPassing      => 200,
            ViolationType.WLBoardMissed      => 30,
            ViolationType.OvershootStation   => 50,
            ViolationType.UndershootStation  => 30,
            ViolationType.EmergencyBrake     => 80,
            ViolationType.RoughStart         => 40,
            ViolationType.WheelSlip          => 20,
            _                                => 10
        };

        /// <summary>Converts a total score to a grade string.</summary>
        private static string ScoreToGrade(int score) => score switch
        {
            >= 950 => "A+",
            >= 850 => "A",
            >= 700 => "B",
            >= 550 => "C",
            >= 400 => "D",
            _      => "F"
        };

        /// <summary>Generates a human-readable description for a violation event.</summary>
        private static string BuildDescription(ViolationType type, double km, int severity)
        {
            string sevStr = severity switch { 3 => "MAJOR", 2 => "MODERATE", _ => "MINOR" };
            return type switch
            {
                ViolationType.SpeedExcess
                    => $"[{sevStr}] Speed limit exceeded at km {km:F2}.",
                ViolationType.SignalPassing
                    => $"[CRITICAL] Signal passed at DANGER (SPAD) at km {km:F2}.",
                ViolationType.WLBoardMissed
                    => $"[{sevStr}] Horn missed at W/L board at km {km:F2}.",
                ViolationType.OvershootStation
                    => $"[{sevStr}] Station stopping mark overshot at km {km:F2}.",
                ViolationType.UndershootStation
                    => $"[{sevStr}] Station stopping mark undershot at km {km:F2}.",
                ViolationType.EmergencyBrake
                    => $"[{sevStr}] Emergency brake applied at km {km:F2}.",
                ViolationType.RoughStart
                    => $"[{sevStr}] Rough / jerky start at km {km:F2}.",
                ViolationType.WheelSlip
                    => $"[{sevStr}] Wheel slip detected at km {km:F2}.",
                _ => $"[{sevStr}] Unknown violation at km {km:F2}."
            };
        }

        /// <summary>Builds a list of performance remarks based on the session statistics.</summary>
        private List<string> BuildRemarks()
        {
            // Called inside _lock
            var r = new List<string>();

            int score = TotalScore;
            string grade = ScoreToGrade(score);

            // Overall assessment
            r.Add($"Final Grade: {grade} — Total Score: {score}/1000.");

            // Punctuality
            if (_stationsVisited > 0)
            {
                int pct = _stationsOnTime * 100 / _stationsVisited;
                r.Add(_stationsOnTime == _stationsVisited
                    ? "✅ Perfect punctuality — all stations on time!"
                    : $"⏱ On-time at {pct}% of stations ({_stationsOnTime}/{_stationsVisited}). Total late: {_totalMinutesLate} min.");
            }

            // W/L boards
            int totalBoards = _wlBoardsHonked + _wlBoardsMissed;
            if (totalBoards > 0)
            {
                r.Add(_wlBoardsMissed == 0
                    ? $"✅ All {_wlBoardsHonked} W/L board horn(s) sounded correctly."
                    : $"⚠ Missed horn at {_wlBoardsMissed}/{totalBoards} W/L board(s).");
            }

            // Emergency brakes
            if (_emergencyEvents == 0)
                r.Add("✅ No emergency brake applications — excellent train handling.");
            else
                r.Add($"🚨 {_emergencyEvents} emergency brake application(s) recorded.");

            // Wheel slips
            if (_wheelSlipEvents == 0)
                r.Add("✅ No wheel slip incidents — good throttle discipline.");
            else
                r.Add($"⚠ {_wheelSlipEvents} wheel slip event(s) — reduce throttle on wet/oily rail.");

            // Signal violations (SPAD)
            int spads = _violations.Count(v => v.Type == ViolationType.SignalPassing);
            if (spads > 0)
                r.Add($"🚨 CRITICAL: {spads} Signal Passed At Danger (SPAD) event(s) — grounds for immediate review.");
            else
                r.Add("✅ No signals passed at danger.");

            // Speed violations
            int overspeeds = _violations.Count(v => v.Type == ViolationType.SpeedExcess);
            if (overspeeds > 0)
                r.Add($"⚠ {overspeeds} speed excess violation(s). Observe section speed limits.");
            else
                r.Add("✅ Speed discipline maintained throughout the run.");

            // Grade-specific advice
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

        /// <summary>Returns elapsed time in seconds since the session was started / reset.</summary>
        private double ElapsedSeconds() =>
            DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() / 1000.0 - _sessionStartSec;
    }
}
