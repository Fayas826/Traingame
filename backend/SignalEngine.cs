using System;
using System.Collections.Generic;
using System.Linq;

namespace RailwaySimulator.Backend.Core
{
    // ---------------------------------------------------------------------------
    // Enums
    // ---------------------------------------------------------------------------

    /// <summary>
    /// Indian Railways 4-aspect colour-light signal aspects.
    /// Ordered from most restrictive (Danger) to least restrictive (Clear).
    /// </summary>
    public enum SignalAspect
    {
        /// <summary>RED – Stop and remain at signal.</summary>
        Danger = 0,

        /// <summary>Single YELLOW – Prepare to stop at the next signal.</summary>
        Caution = 1,

        /// <summary>Double YELLOW – Proceed, next signal at Caution.</summary>
        AttentionRequired = 2,

        /// <summary>GREEN – Proceed at line speed.</summary>
        Clear = 3
    }

    // ---------------------------------------------------------------------------
    // Data model
    // ---------------------------------------------------------------------------

    /// <summary>
    /// Represents one colour-light signal on the Kollam–TVC route.
    /// </summary>
    public class Signal
    {
        /// <summary>Unique identifier, e.g. "QLN-HOME" or "AUTO-KM-14".</summary>
        public string Id { get; set; } = "";

        /// <summary>Human-readable name for ALP callouts.</summary>
        public string Name { get; set; } = "";

        /// <summary>Chainage in kilometres from Kollam (origin).</summary>
        public double PositionKm { get; set; }

        /// <summary>Current displayed aspect.</summary>
        public SignalAspect Aspect { get; set; } = SignalAspect.Danger;

        /// <summary>True when this signal is a Starter (departure end of station).</summary>
        public bool IsStarter { get; set; }

        /// <summary>True when this signal is a Home (approach end of station).</summary>
        public bool IsHome { get; set; }

        /// <summary>True for automatic block signals on open line (no station).</summary>
        public bool IsAutomatic { get; set; }

        /// <summary>UTC timestamp of the last aspect change.</summary>
        public DateTime LastChangedAt { get; set; } = DateTime.UtcNow;

        /// <summary>True when route-locking is active (train locked onto approach).</summary>
        public bool IsRouteLocked { get; set; }
    }

    // ---------------------------------------------------------------------------
    // Violation record
    // ---------------------------------------------------------------------------

    /// <summary>Records a Signal Passed at Danger (SPAD) event.</summary>
    public class SignalViolation
    {
        public string SignalId { get; set; } = "";
        public double SpeedKmh { get; set; }
        public double PositionKm { get; set; }
        public DateTime OccurredAt { get; set; } = DateTime.UtcNow;
    }

    // ---------------------------------------------------------------------------
    // SignalEngine – singleton
    // ---------------------------------------------------------------------------

    /// <summary>
    /// 4-aspect interlocking signal engine for the Kollam Junction – Thiruvananthapuram
    /// Central (QLN–TVC) main line (~65 km, 12 stations).
    ///
    /// <para>Signal placement follows Indian Railways SEM rules:</para>
    /// <list type="bullet">
    ///   <item>Home signal: 0.2 km before the station platform limit board.</item>
    ///   <item>Starter signal: 0.2 km past the station advance starter board.</item>
    ///   <item>Automatic block signals: every 2 km on open line sections.</item>
    /// </list>
    ///
    /// <para>4-aspect cascade propagation (rear-to-front):</para>
    /// <list type="bullet">
    ///   <item>Signal immediately before RED → YELLOW (Caution)</item>
    ///   <item>Signal before YELLOW → DOUBLE YELLOW (AttentionRequired)</item>
    ///   <item>Signal before DOUBLE YELLOW → GREEN (Clear)</item>
    /// </list>
    /// </summary>
    public sealed class SignalEngine
    {
        // -----------------------------------------------------------------------
        // Singleton
        // -----------------------------------------------------------------------
        private static readonly Lazy<SignalEngine> _instance =
            new(() => new SignalEngine(), isThreadSafe: true);

        /// <summary>Gets the singleton instance of the SignalEngine.</summary>
        public static SignalEngine Instance => _instance.Value;

        private SignalEngine()
        {
            BuildRoute();
        }

        // -----------------------------------------------------------------------
        // Route constants – Kollam–TVC line
        // -----------------------------------------------------------------------

        /// <summary>
        /// 12 stations on the Kollam–Thiruvananthapuram route with their
        /// chainage (km from Kollam Junction), station code, and full name.
        /// </summary>
        private static readonly (double Km, string Code, string Name)[] Stations = new[]
        {
            ( 0.0,  "QLN",  "Kollam Junction" ),
            ( 4.6,  "IRP",  "Iravipuram" ),
            ( 8.9,  "MYY",  "Mayyanad" ),
            ( 12.4, "PVU",  "Paravur" ),
            ( 17.0, "KFI",  "Kappil" ),
            ( 19.9, "EVA",  "Edavai" ),
            ( 23.7, "VAK",  "Varkala Sivagiri" ),
            ( 30.1, "AKI",  "Akathumuri" ),
            ( 32.8, "KVU",  "Kadakkavur" ),
            ( 35.9, "CRY",  "Chirayinkeezhu" ),
            ( 40.0, "PGZ",  "Perunguzhi" ),
            ( 43.2, "MQU",  "Murukkampuzha" ),
            ( 47.2, "KPY",  "Kaniyapuram" ),
            ( 51.3, "KZK",  "Kazhakkuttam" ),
            ( 55.3, "VELI", "Veli" ),
            ( 57.5, "TVCN", "Thiruvananthapuram North" ),
            ( 62.1, "PET",  "TVM Pettah" ),
            ( 64.6, "TVC",  "Thiruvananthapuram Central" )
        };

        /// <summary>Total route length in km.</summary>
        private const double RouteLengthKm = 64.6;

        /// <summary>Spacing between automatic block signals on open line (km).</summary>
        private const double AutoSignalSpacingKm = 2.0;

        /// <summary>Distance of home/starter from platform limit (km).</summary>
        private const double StationSignalOffsetKm = 0.2;

        /// <summary>Route-lock activation radius (km) before a red signal.</summary>
        private const double RouteLockRadiusKm = 0.5;

        // -----------------------------------------------------------------------
        // State
        // -----------------------------------------------------------------------

        /// <summary>Ordered list of all signals on the route (ascending km).</summary>
        public IReadOnlyList<Signal> Signals => _signals;

        private readonly List<Signal> _signals = new();

        /// <summary>Log of all SPAD violations recorded in this session.</summary>
        public IReadOnlyList<SignalViolation> Violations => _violations;

        private readonly List<SignalViolation> _violations = new();

        private double _lastTrainKm = -1.0;

        public string TrainType { get; set; } = "Passenger";

        public void Reset()
        {
            _violations.Clear();
            _lastTrainKm = -1.0;
            BuildRoute();
        }

        // -----------------------------------------------------------------------
        // Route builder
        // -----------------------------------------------------------------------

        /// <summary>
        /// Builds the complete signal layout: Home + Starter for each station and
        /// automatic block signals every 2 km between stations.
        /// All signals start at Danger; Update() will open them based on train position.
        /// </summary>
        private void BuildRoute()
        {
            _signals.Clear();

            // Collect all station km values for gap detection
            var stationKms = Stations.Select(s => s.Km).ToHashSet();

            // 1. Station signals
            for (int i = 0; i < Stations.Length; i++)
            {
                var (km, code, name) = Stations[i];

                // Home signal – 0.2 km before station (faces approaching train)
                _signals.Add(new Signal
                {
                    Id          = $"{code}-HOME",
                    Name        = $"{name} Home",
                    PositionKm  = km - StationSignalOffsetKm,
                    IsHome      = true,
                    Aspect      = SignalAspect.Danger
                });

                // Starter signal – 0.2 km after station (departure signal)
                _signals.Add(new Signal
                {
                    Id          = $"{code}-STR",
                    Name        = $"{name} Starter",
                    PositionKm  = km + StationSignalOffsetKm,
                    IsStarter   = true,
                    Aspect      = SignalAspect.Danger
                });
            }

            // 2. Automatic block signals every 2 km on open line
            //    Skip positions within ±0.4 km of any station (covered by home/starter)
            for (double pos = AutoSignalSpacingKm; pos < RouteLengthKm; pos += AutoSignalSpacingKm)
            {
                bool nearStation = Stations.Any(s => Math.Abs(s.Km - pos) < 0.5);
                if (nearStation) continue;

                _signals.Add(new Signal
                {
                    Id          = $"AUTO-KM-{pos:F1}",
                    Name        = $"Automatic Block {pos:F1} km",
                    PositionKm  = pos,
                    IsAutomatic = true,
                    Aspect      = SignalAspect.Clear  // auto signals default to Clear (fail-safe open)
                });
            }

            // Sort ascending by position
            _signals.Sort((a, b) => a.PositionKm.CompareTo(b.PositionKm));
        }

        // -----------------------------------------------------------------------
        // Core update
        // -----------------------------------------------------------------------

        /// <summary>
        /// Recalculates all signal aspects based on current train position and speed.
        /// Call on every physics tick from the game loop.
        /// </summary>
        /// <param name="trainKm">Train front position in km from Kollam.</param>
        /// <param name="trainSpeedKmh">Current train speed in km/h (for SPAD detection).</param>
        public void Update(double trainKm, double trainSpeedKmh)
        {
            // --- SPAD detection: has the train passed a RED signal at speed? ---
            if (_lastTrainKm >= 0)
            {
                foreach (var sig in _signals)
                {
                    if (sig.Aspect == SignalAspect.Danger
                        && sig.PositionKm > _lastTrainKm
                        && sig.PositionKm <= trainKm
                        && trainSpeedKmh > 5.0)
                    {
                        _violations.Add(new SignalViolation
                        {
                            SignalId   = sig.Id,
                            SpeedKmh   = trainSpeedKmh,
                            PositionKm = trainKm,
                            OccurredAt = DateTime.UtcNow
                        });
                    }
                }
            }
            _lastTrainKm = trainKm;

            // --- Route locking ---
            foreach (var sig in _signals)
            {
                bool withinLock = sig.Aspect == SignalAspect.Danger
                               && sig.PositionKm > trainKm
                               && sig.PositionKm - trainKm <= RouteLockRadiusKm;

                sig.IsRouteLocked = withinLock;
            }

            // --- Recalculate all signal aspects ---
            // 1. Set baseline aspects for signals
            foreach (var sig in _signals)
            {
                if (sig.PositionKm < trainKm)
                {
                    // Train has already passed this signal (occupied block behind train)
                    // Keep it Danger (RED) for 2.0 km behind the train to simulate block clearance
                    if (trainKm - sig.PositionKm < 2.0)
                    {
                        SetAspect(sig, SignalAspect.Danger);
                    }
                    else
                    {
                        SetAspect(sig, SignalAspect.Clear);
                    }
                }
                else
                {
                    // Signal is ahead of the train
                    if (sig.IsAutomatic)
                    {
                        // Automatic signals default to Clear unless cascaded
                        SetAspect(sig, SignalAspect.Clear);
                    }
                    else
                    {
                        // Station Home or Starter signal
                        string stationCode = sig.Id.Split('-')[0];
                        bool isStoppage = PhysicsEngine.IsStationStoppage(stationCode, TrainType);

                        if (isStoppage)
                        {
                            if (sig.IsStarter)
                            {
                                // Starter signal remains at Danger (RED) until dwell completes and it is cleared
                                if (sig.Aspect != SignalAspect.Clear)
                                {
                                    SetAspect(sig, SignalAspect.Danger);
                                }
                            }
                            else if (sig.IsHome)
                            {
                                // Home is Caution (Yellow) if the Starter is RED, otherwise Clear (Green)
                                string starterId = $"{stationCode}-STR";
                                var starter = _signals.FirstOrDefault(s => s.Id == starterId);
                                if (starter != null && starter.Aspect == SignalAspect.Danger)
                                {
                                    SetAspect(sig, SignalAspect.Caution);
                                }
                                else
                                {
                                    SetAspect(sig, SignalAspect.Clear);
                                }
                            }
                        }
                        else
                        {
                            // Station is skipped: Starter and Home signals are clear
                            SetAspect(sig, SignalAspect.Clear);
                        }
                    }
                }
            }

            // 2. Cascade aspects backwards from Danger signals to build yellow/double-yellow approach cascades
            for (int i = _signals.Count - 2; i >= 0; i--)
            {
                var current = _signals[i];
                var next = _signals[i + 1];

                if (current.PositionKm >= trainKm)
                {
                    if (current.IsAutomatic || current.IsHome)
                    {
                        if (next.Aspect == SignalAspect.Danger)
                        {
                            SetAspect(current, SignalAspect.Caution);
                        }
                        else if (next.Aspect == SignalAspect.Caution)
                        {
                            SetAspect(current, SignalAspect.AttentionRequired);
                        }
                    }
                }
            }
        }

        /// <summary>Sets a signal's aspect and records the timestamp if it changed.</summary>
        private static void SetAspect(Signal signal, SignalAspect aspect)
        {
            if (signal.Aspect != aspect)
            {
                signal.Aspect = aspect;
                signal.LastChangedAt = DateTime.UtcNow;
            }
        }

        // -----------------------------------------------------------------------
        // Query methods
        // -----------------------------------------------------------------------

        /// <summary>
        /// Returns the aspect of the nearest signal ahead of (or at) the given position.
        /// Returns <see cref="SignalAspect.Clear"/> if no signals exist ahead.
        /// </summary>
        public SignalAspect GetAspectAt(double km)
        {
            var next = GetNextSignal(km);
            return next?.Aspect ?? SignalAspect.Clear;
        }

        /// <summary>
        /// Returns the next <see cref="Signal"/> object at or ahead of the given km.
        /// Returns <c>null</c> when past the last signal on the route.
        /// </summary>
        public Signal? GetNextSignal(double km)
        {
            return _signals.FirstOrDefault(s => s.PositionKm >= km);
        }

        /// <summary>
        /// Returns all signals whose position falls within [startKm, endKm] inclusive.
        /// </summary>
        public List<Signal> GetSignalsInRange(double startKm, double endKm)
        {
            return _signals
                .Where(s => s.PositionKm >= startKm && s.PositionKm <= endKm)
                .ToList();
        }

        // -----------------------------------------------------------------------
        // Station starter activation
        // -----------------------------------------------------------------------

        /// <summary>
        /// Clears the starter signal for the given station code (e.g. "QLN").
        /// Called by the game logic when the guard's whistle / line-clear token is obtained.
        /// </summary>
        /// <param name="stationCode">3–5 character IR station code.</param>
        /// <returns><c>true</c> if the starter was found and cleared.</returns>
        public bool ActivateStarter(string stationCode)
        {
            string targetId = $"{stationCode.ToUpperInvariant()}-STR";
            var sig = _signals.FirstOrDefault(s => s.Id == targetId);
            if (sig == null) return false;

            SetAspect(sig, SignalAspect.Clear);
            return true;
        }

        // -----------------------------------------------------------------------
        // ALP callout text
        // -----------------------------------------------------------------------

        /// <summary>
        /// Generates an English-language verbal callout for the Assistant Loco Pilot
        /// based on the next signal ahead and current speed.
        /// </summary>
        /// <param name="km">Train front position in km.</param>
        /// <param name="speedKmh">Current speed in km/h.</param>
        /// <returns>ALP announcement string.</returns>
        public string GetCallout(double km, double speedKmh)
        {
            var next = GetNextSignal(km);
            if (next == null)
                return "Line clear. Approaching destination.";

            double distKm = next.PositionKm - km;
            string distText = distKm < 1.0
                ? $"{(int)(distKm * 1000)} metres"
                : $"{distKm:F1} km";

            string speedText = $"{(int)Math.Round(speedKmh)} km/h";

            return next.Aspect switch
            {
                SignalAspect.Clear =>
                    $"GREEN. {next.Name} at {distText}. Proceed at line speed.",

                SignalAspect.AttentionRequired =>
                    $"DOUBLE YELLOW. {next.Name} at {distText}. Next signal at caution. " +
                    $"Prepare to reduce speed. Current speed {speedText}.",

                SignalAspect.Caution =>
                    $"SINGLE YELLOW. {next.Name} at {distText}. Prepare to stop at next signal. " +
                    $"Reduce speed to 30 km/h. Current speed {speedText}.",

                SignalAspect.Danger =>
                    $"RED SIGNAL! {next.Name} at {distText}. STOP before signal. " +
                    $"Apply brakes immediately! Current speed {speedText}.",

                _ => "Signal status unknown."
            };
        }

        // -----------------------------------------------------------------------
        // Restrictive speed
        // -----------------------------------------------------------------------

        /// <summary>
        /// Returns the maximum permissible speed (km/h) at the given position
        /// based on the next signal aspect, per Indian Railways signalling rules.
        ///
        /// <list type="table">
        ///   <listheader><term>Aspect</term><description>Permitted speed</description></listheader>
        ///   <item><term>Clear (Green)</term><description>Line speed (110 km/h on this route)</description></item>
        ///   <item><term>Double Yellow</term><description>75 km/h (caution ahead)</description></item>
        ///   <item><term>Single Yellow</term><description>30 km/h (stop at next signal)</description></item>
        ///   <item><term>Red</term><description>0 km/h (dead stop)</description></item>
        /// </list>
        /// </summary>
        public double GetRestrictiveSpeed(double km)
        {
            var next = GetNextSignal(km);
            if (next == null) return 110.0; // clear line

            return next.Aspect switch
            {
                SignalAspect.Clear            => 110.0,
                SignalAspect.AttentionRequired => 75.0,
                SignalAspect.Caution          => 30.0,
                SignalAspect.Danger           => 0.0,
                _                             => 110.0
            };
        }
    }
}
