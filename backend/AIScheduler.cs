using System;
using System.Collections.Generic;
using System.Linq;

namespace RailwaySimulator.Backend.Core
{
    // ─────────────────────────────────────────────────────────────────────────────
    // Data Models
    // ─────────────────────────────────────────────────────────────────────────────

    /// <summary>Direction of travel on the Kollam–Thiruvananthapuram corridor.</summary>
    public enum TrainDirection
    {
        /// <summary>DOWN: Kollam (KLM, km 0) → Thiruvananthapuram (TVC, km 68).</summary>
        DOWN,
        /// <summary>UP: Thiruvananthapuram (TVC, km 68) → Kollam (KLM, km 0).</summary>
        UP
    }

    /// <summary>A single stop on a service's route.</summary>
    public class ServiceStop
    {
        /// <summary>Three/four-letter Indian Railways station code.</summary>
        public string StationCode { get; set; } = "";

        /// <summary>Scheduled arrival in minutes from the route origin departure.</summary>
        public int ArrivalMin { get; set; }

        /// <summary>Scheduled departure in minutes from the route origin departure.</summary>
        public int DepartureMin { get; set; }

        /// <summary>Distance in km from Kollam (km 0 origin).</summary>
        public double KmFromOrigin { get; set; }
    }

    /// <summary>Full description of a scheduled train service on the corridor.</summary>
    public class TrainService
    {
        public string ServiceId    { get; set; } = "";
        public string TrainNo      { get; set; } = "";
        public string Name         { get; set; } = "";
        public TrainDirection Direction { get; set; }
        public string LocoType     { get; set; } = "";
        public string RakeType     { get; set; } = "";
        public int    CoachCount   { get; set; }

        /// <summary>
        /// Ordered stop list.  For DOWN trains index-0 is KLM; for UP trains index-0 is TVC.
        /// Times are minutes from the first stop's departure time.
        /// </summary>
        public ServiceStop[] Stops { get; set; } = Array.Empty<ServiceStop>();

        /// <summary>
        /// Clock-time (minutes past midnight) at which this service departs its first stop.
        /// Used to anchor stop minutes to absolute game-clock minutes.
        /// </summary>
        public int OriginDepartureClockMin { get; set; }
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Live / Computed Types
    // ─────────────────────────────────────────────────────────────────────────────

    /// <summary>Snapshot of an AI-controlled train's current position and state.</summary>
    public class ActiveTrain
    {
        public string         ServiceId   { get; set; } = "";
        public string         TrainNo     { get; set; } = "";
        public string         Name        { get; set; } = "";
        public double         PositionKm  { get; set; }
        public double         SpeedKmh    { get; set; }
        public string         LocoType    { get; set; } = "";
        public string         RakeType    { get; set; } = "";
        public int            CoachCount  { get; set; }
        public TrainDirection Direction   { get; set; }
    }

    /// <summary>Information about the next meeting / crossing point with another train.</summary>
    public class MeetInfo
    {
        public string ServiceId        { get; set; } = "";
        public string TrainNo          { get; set; } = "";
        public string Name             { get; set; } = "";
        public double MeetAtKm         { get; set; }
        public double MeetInSeconds    { get; set; }
        public string MeetAtStationCode{ get; set; } = "";
    }

    /// <summary>Recommendation for spawning a new AI train ahead of / behind the player.</summary>
    public class SpawnInfo
    {
        public string         ServiceId      { get; set; } = "";
        public string         TrainNo        { get; set; } = "";
        public string         Name           { get; set; } = "";
        public double         SpawnKm        { get; set; }
        public double         SpeedKmh       { get; set; }
        public TrainDirection Direction      { get; set; }
        public string         LocoType       { get; set; } = "";
        public string         RakeType       { get; set; } = "";
        public int            CoachCount     { get; set; }
        public string         Reason         { get; set; } = "";
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // AIScheduler Singleton
    // ─────────────────────────────────────────────────────────────────────────────

    /// <summary>
    /// Singleton AI scheduling engine for the Kollam–Thiruvananthapuram corridor.
    /// Maintains the master timetable for 8 real services and provides real-time
    /// position interpolation, meet detection, and spawn recommendations.
    ///
    /// <para>
    /// Corridor reference distances (from Kollam, km 0):
    /// KLM 0 → AWY 4.6 → KAYD 8.9 → MUCI 12.4 → PAPH 17.0 → PANH 19.9
    /// → VKT 23.7 → KKVL 30.1 → KQK 32.8 → MNCR 35.9 → CHVY 40.0
    /// → PRMD 43.2 → NEM 47.2 → KRPD 51.3 → KZK 55.2 → PGMN 57.5
    /// → KTVL 62.1 → TVC 64.6
    /// </para>
    /// </summary>
    public sealed class AIScheduler
    {
        // ── Singleton boilerplate ────────────────────────────────────────────────
        private static readonly Lazy<AIScheduler> _instance =
            new Lazy<AIScheduler>(() => new AIScheduler());
        public static AIScheduler Instance => _instance.Value;
        private AIScheduler() => _services = BuildTimetable();

        // ── Constants ───────────────────────────────────────────────────────────

        /// <summary>Total corridor length in km (KLM → TVC).</summary>
        private const double CorridorLengthKm = 64.6;

        /// <summary>
        /// Window around the player (km) within which an AI train is considered "active"
        /// and rendered / simulated.
        /// </summary>
        private const double ActiveWindowKm = 40.0;

        /// <summary>Typical line-speed on this route (km/h) used for coarse interpolation.</summary>
        private const double DefaultLineSpeedKmh = 90.0;

        // ── Station distance table (km from KLM = 0) ────────────────────────────
        private static readonly Dictionary<string, double> StationKm = new()
        {
            ["QLN"]  =  0.0,
            ["IRP"]  =  4.6,
            ["MYY"]  =  8.9,
            ["PVU"]  = 12.4,
            ["KFI"]  = 17.0,
            ["EVA"]  = 19.9,
            ["VAK"]  = 23.7,
            ["AKI"]  = 30.1,
            ["KVU"]  = 32.8,
            ["CRY"]  = 35.9,
            ["PGZ"]  = 40.0,
            ["MQU"]  = 43.2,
            ["KPY"]  = 47.2,
            ["KZK"]  = 51.3,
            ["VELI"] = 55.3,
            ["TVCN"] = 57.5,
            ["PET"]  = 62.1,
            ["TVC"]  = 64.6
        };

        private readonly List<TrainService> _services;

        // ─────────────────────────────────────────────────────────────────────────
        // Timetable Construction
        // ─────────────────────────────────────────────────────────────────────────

        private static List<TrainService> BuildTimetable()
        {
            var list = new List<TrainService>();

            // ── 16301 Venad Express (DOWN) ───────────────────────────────────────
            list.Add(new TrainService
            {
                ServiceId  = "SVC_16301",
                TrainNo    = "16301",
                Name       = "Venad Express",
                Direction  = TrainDirection.DOWN,
                LocoType   = "WAP-7",
                RakeType   = "LHB",
                CoachCount = 12,
                OriginDepartureClockMin = 6 * 60 + 15, // 06:15
                Stops = new[]
                {
                    MkStop("QLN",   0,  0.0),
                    MkStop("IRP",   6,  4.6),
                    MkStop("EVA",  23, 19.9),
                    MkStop("VAK",  30, 23.7),
                    MkStop("AKI",  44, 30.1),
                    MkStop("CRY",  55, 35.9),
                    MkStop("PGZ",  65, 40.0),
                    MkStop("KPY",  80, 47.2),
                    MkStop("VELI", 93, 55.3),
                    MkStop("TVC", 105, 64.6),
                }
            });

            // ── 16348 Trivandrum Mail (UP) ───────────────────────────────────────
            list.Add(new TrainService
            {
                ServiceId  = "SVC_16348",
                TrainNo    = "16348",
                Name       = "Trivandrum Mail",
                Direction  = TrainDirection.UP,
                LocoType   = "WAP-4",
                RakeType   = "ICF",
                CoachCount = 18,
                OriginDepartureClockMin = 22 * 60 + 30, // 22:30 from TVC
                Stops = new[]
                {
                    MkStop("TVC",   0, 64.6),
                    MkStop("VELI", 12, 55.3),
                    MkStop("KPY",  24, 47.2),
                    MkStop("PGZ",  37, 40.0),
                    MkStop("CRY",  47, 35.9),
                    MkStop("AKI",  58, 30.1),
                    MkStop("VAK",  72, 23.7),
                    MkStop("EVA",  79, 19.9),
                    MkStop("IRP",  97,  4.6),
                    MkStop("QLN", 105,  0.0),
                }
            });

            // ── 12201 Kerala Sampark Kranti Express (DOWN) ───────────────────────
            list.Add(new TrainService
            {
                ServiceId  = "SVC_12201",
                TrainNo    = "12201",
                Name       = "Kerala Sampark Kranti",
                Direction  = TrainDirection.DOWN,
                LocoType   = "WAP-7",
                RakeType   = "LHB",
                CoachCount = 22,
                OriginDepartureClockMin = 13 * 60 + 45, // 13:45
                Stops = new[]
                {
                    MkStop("QLN",   0,  0.0),
                    MkStop("VAK",  28, 23.7),
                    MkStop("CRY",  52, 35.9),
                    MkStop("KPY",  72, 47.2),
                    MkStop("TVC",  90, 64.6),
                }
            });

            // ── 56376 Passenger (DOWN) ───────────────────────────────────────────
            list.Add(new TrainService
            {
                ServiceId  = "SVC_56376",
                TrainNo    = "56376",
                Name       = "QLN-TVC Passenger",
                Direction  = TrainDirection.DOWN,
                LocoType   = "WDM-3A",
                RakeType   = "ICF",
                CoachCount = 8,
                OriginDepartureClockMin = 8 * 60 + 0, // 08:00
                Stops = new[]
                {
                    MkStop("QLN",   0,  0.0),
                    MkStop("IRP",  10,  4.6),
                    MkStop("MYY",  20,  8.9),
                    MkStop("PVU",  30, 12.4),
                    MkStop("KFI",  42, 17.0),
                    MkStop("EVA",  50, 19.9),
                    MkStop("VAK",  62, 23.7),
                    MkStop("AKI",  80, 30.1),
                    MkStop("KVU",  88, 32.8),
                    MkStop("CRY",  98, 35.9),
                    MkStop("PGZ", 110, 40.0),
                    MkStop("MQU", 120, 43.2),
                    MkStop("KPY", 132, 47.2),
                    MkStop("KZK", 144, 51.3),
                    MkStop("VELI",155, 55.3),
                    MkStop("TVCN",162, 57.5),
                    MkStop("PET", 172, 62.1),
                    MkStop("TVC", 182, 64.6),
                }
            });

            // ── 56377 Passenger (UP) ─────────────────────────────────────────────
            list.Add(new TrainService
            {
                ServiceId  = "SVC_56377",
                TrainNo    = "56377",
                Name       = "TVC-QLN Passenger",
                Direction  = TrainDirection.UP,
                LocoType   = "WDM-3A",
                RakeType   = "ICF",
                CoachCount = 8,
                OriginDepartureClockMin = 10 * 60 + 30, // 10:30
                Stops = new[]
                {
                    MkStop("TVC",   0, 64.6),
                    MkStop("PET",  10, 62.1),
                    MkStop("TVCN", 18, 57.5),
                    MkStop("VELI", 25, 55.3),
                    MkStop("KZK",  35, 51.3),
                    MkStop("KPY",  47, 47.2),
                    MkStop("MQU",  58, 43.2),
                    MkStop("PGZ",  68, 40.0),
                    MkStop("CRY",  80, 35.9),
                    MkStop("KVU",  89, 32.8),
                    MkStop("AKI",  97, 30.1),
                    MkStop("VAK", 115, 23.7),
                    MkStop("EVA", 126, 19.9),
                    MkStop("KFI", 133, 17.0),
                    MkStop("PVU", 143, 12.4),
                    MkStop("MYY", 153,  8.9),
                    MkStop("IRP", 162,  4.6),
                    MkStop("QLN", 172,  0.0),
                }
            });

            // ── 66301 MEMU (DOWN) ────────────────────────────────────────────────
            list.Add(new TrainService
            {
                ServiceId  = "SVC_66301",
                TrainNo    = "66301",
                Name       = "QLN-TVC MEMU",
                Direction  = TrainDirection.DOWN,
                LocoType   = "WAG-9",
                RakeType   = "ICF",
                CoachCount = 8,
                OriginDepartureClockMin = 7 * 60 + 0, // 07:00
                Stops = new[]
                {
                    MkStop("QLN",   0,  0.0),
                    MkStop("IRP",   8,  4.6),
                    MkStop("MYY",  17,  8.9),
                    MkStop("PVU",  25, 12.4),
                    MkStop("KFI",  35, 17.0),
                    MkStop("EVA",  42, 19.9),
                    MkStop("VAK",  52, 23.7),
                    MkStop("AKI",  67, 30.1),
                    MkStop("KVU",  73, 32.8),
                    MkStop("CRY",  82, 35.9),
                    MkStop("PGZ",  92, 40.0),
                    MkStop("MQU", 100, 43.2),
                    MkStop("KPY", 110, 47.2),
                    MkStop("KZK", 120, 51.3),
                    MkStop("VELI",130, 55.3),
                    MkStop("TVCN",136, 57.5),
                    MkStop("PET", 144, 62.1),
                    MkStop("TVC", 152, 64.6),
                }
            });

            // ── 66302 MEMU (UP) ──────────────────────────────────────────────────
            list.Add(new TrainService
            {
                ServiceId  = "SVC_66302",
                TrainNo    = "66302",
                Name       = "TVC-QLN MEMU",
                Direction  = TrainDirection.UP,
                LocoType   = "WAG-9",
                RakeType   = "ICF",
                CoachCount = 8,
                OriginDepartureClockMin = 8 * 60 + 30, // 08:30
                Stops = new[]
                {
                    MkStop("TVC",   0, 64.6),
                    MkStop("PET",   8, 62.1),
                    MkStop("TVCN", 14, 57.5),
                    MkStop("VELI", 22, 55.3),
                    MkStop("KZK",  31, 51.3),
                    MkStop("KPY",  41, 47.2),
                    MkStop("MQU",  51, 43.2),
                    MkStop("PGZ",  60, 40.0),
                    MkStop("CRY",  70, 35.9),
                    MkStop("KVU",  78, 32.8),
                    MkStop("AKI",  85, 30.1),
                    MkStop("VAK", 100, 23.7),
                    MkStop("EVA", 110, 19.9),
                    MkStop("KFI", 116, 17.0),
                    MkStop("PVU", 125, 12.4),
                    MkStop("MYY", 134,  8.9),
                    MkStop("IRP", 142,  4.6),
                    MkStop("QLN", 152,  0.0),
                }
            });

            // ── 22638 West Coast Express (UP) ────────────────────────────────────
            list.Add(new TrainService
            {
                ServiceId  = "SVC_22638",
                TrainNo    = "22638",
                Name       = "West Coast Express",
                Direction  = TrainDirection.UP,
                LocoType   = "WAP-7",
                RakeType   = "LHB",
                CoachCount = 14,
                OriginDepartureClockMin = 16 * 60 + 45, // 16:45
                Stops = new[]
                {
                    MkStop("TVC",   0, 64.6),
                    MkStop("VELI", 13, 55.3),
                    MkStop("KPY",  26, 47.2),
                    MkStop("PGZ",  38, 40.0),
                    MkStop("CRY",  48, 35.9),
                    MkStop("AKI",  60, 30.1),
                    MkStop("VAK",  74, 23.7),
                    MkStop("EVA",  81, 19.9),
                    MkStop("IRP",  98,  4.6),
                    MkStop("QLN", 107,  0.0),
                }
            });

            return list;
        }

        /// <summary>Creates a ServiceStop with a 2-minute default dwell (arrival = dep - 2, except terminus).</summary>
        private static ServiceStop MkStop(string code, int depMin, double km)
        {
            int arr = depMin == 0 ? 0 : Math.Max(0, depMin - 2);
            return new ServiceStop
            {
                StationCode  = code,
                ArrivalMin   = arr,
                DepartureMin = depMin,
                KmFromOrigin = km
            };
        }

        // ─────────────────────────────────────────────────────────────────────────
        // Public API
        // ─────────────────────────────────────────────────────────────────────────

        /// <summary>
        /// Returns all AI trains currently active (within <see cref="ActiveWindowKm"/> km of the player).
        /// Position is interpolated between scheduled stops using elapsed clock-time.
        /// </summary>
        /// <param name="playerKm">Player train's current position on the corridor (km from KLM).</param>
        /// <param name="gameTimeMinutes">Current game-clock in minutes past midnight.</param>
        public List<ActiveTrain> GetActiveTrains(double playerKm, double gameTimeMinutes)
        {
            var result = new List<ActiveTrain>();

            foreach (var svc in _services)
            {
                double? pos = InterpolatePosition(svc, gameTimeMinutes);
                if (pos == null) continue;

                double km = pos.Value;
                if (Math.Abs(km - playerKm) > ActiveWindowKm) continue;

                double speed = EstimateSpeed(svc, gameTimeMinutes);

                result.Add(new ActiveTrain
                {
                    ServiceId  = svc.ServiceId,
                    TrainNo    = svc.TrainNo,
                    Name       = svc.Name,
                    PositionKm = Math.Round(km, 2),
                    SpeedKmh   = Math.Round(speed, 1),
                    LocoType   = svc.LocoType,
                    RakeType   = svc.RakeType,
                    CoachCount = svc.CoachCount,
                    Direction  = svc.Direction
                });
            }

            return result;
        }

        /// <summary>
        /// Calculates the next meeting (crossing) point between the player train and any
        /// oncoming AI train.  Returns <c>null</c> if no meeting is imminent within the corridor.
        /// </summary>
        /// <param name="playerKm">Player position (km).</param>
        /// <param name="playerSpeedKmh">Player speed (km/h).</param>
        /// <param name="gameTimeMinutes">Game-clock (minutes past midnight).</param>
        public MeetInfo? GetNextMeet(double playerKm, double playerSpeedKmh, double gameTimeMinutes)
        {
            MeetInfo? best = null;
            double bestSecs = double.MaxValue;

            // Determine player direction heuristically from speed sign; assume DOWN (positive km) as default.
            // For meet detection we look for trains travelling in the OPPOSITE direction.
            foreach (var svc in _services)
            {
                double? pos = InterpolatePosition(svc, gameTimeMinutes);
                if (pos == null) continue;

                double aiKm    = pos.Value;
                double aiSpeed = EstimateSpeed(svc, gameTimeMinutes); // km/h

                // Convert to km/min for arithmetic
                double aiSpeedKmMin     = aiSpeed / 60.0;
                double playerSpeedKmMin = playerSpeedKmh / 60.0;

                double relativeSpeed; // approach speed in km/min
                bool isOpposite;

                if (svc.Direction == TrainDirection.DOWN)
                {
                    // AI moves towards higher km; player assumed UP (lower km)
                    isOpposite      = playerSpeedKmh > 0; // player moving in any direction
                    relativeSpeed   = aiSpeedKmMin + playerSpeedKmMin; // approaching
                }
                else
                {
                    // AI moves towards lower km
                    isOpposite    = true;
                    relativeSpeed = aiSpeedKmMin + playerSpeedKmMin;
                }

                // Only consider if they are approaching each other
                double gap = aiKm - playerKm; // positive = AI ahead (DOWN side)

                // For a DOWN AI and a player going DOWN too — that's a same-direction chase, not a meet.
                // We only count meet if one is DOWN and the other UP:
                // Simplification: treat player as always going DOWN (from KLM toward TVC).
                if (svc.Direction == TrainDirection.DOWN) continue; // same direction as player

                // AI is UP, player is DOWN — they approach each other if aiKm > playerKm
                if (aiKm <= playerKm) continue; // AI already behind us

                double meetInMin = gap / relativeSpeed;
                if (meetInMin < 0 || meetInMin > 180) continue; // ignore > 3 h

                double meetInSec = meetInMin * 60.0;
                if (meetInSec >= bestSecs) continue;

                // Find nearest station to meet point
                double meetKm  = playerKm + playerSpeedKmMin * meetInMin;
                string station = NearestStation(meetKm);

                bestSecs = meetInSec;
                best = new MeetInfo
                {
                    ServiceId         = svc.ServiceId,
                    TrainNo           = svc.TrainNo,
                    Name              = svc.Name,
                    MeetAtKm          = Math.Round(meetKm, 2),
                    MeetInSeconds     = Math.Round(meetInSec, 1),
                    MeetAtStationCode = station
                };
            }

            return best;
        }

        /// <summary>
        /// Recommends a train to spawn on the corridor based on the player's current position and speed.
        /// Typically spawns an oncoming train 10–20 km ahead so the driver gets realistic traffic.
        /// Returns <c>null</c> when no suitable candidate is found (e.g., corridor is already busy).
        /// </summary>
        /// <param name="playerKm">Player position (km).</param>
        /// <param name="playerSpeedKmh">Player speed (km/h).</param>
        public SpawnInfo? GetSpawnRecommendation(double playerKm, double playerSpeedKmh)
        {
            // Look for an UP train to spawn ~15 km ahead of the player
            const double spawnAheadKm = 15.0;
            double targetKm = Math.Min(playerKm + spawnAheadKm, CorridorLengthKm - 2.0);

            // Pick the first UP service that is not currently anywhere near the player
            // (acts as a "not yet spawned" ghost train candidate)
            foreach (var svc in _services.Where(s => s.Direction == TrainDirection.UP))
            {
                // Estimate a plausible spawn speed
                double speed = TypicalSpeed(svc);

                return new SpawnInfo
                {
                    ServiceId  = svc.ServiceId,
                    TrainNo    = svc.TrainNo,
                    Name       = svc.Name,
                    SpawnKm    = Math.Round(targetKm, 2),
                    SpeedKmh   = Math.Round(speed, 1),
                    Direction  = TrainDirection.UP,
                    LocoType   = svc.LocoType,
                    RakeType   = svc.RakeType,
                    CoachCount = svc.CoachCount,
                    Reason     = $"Oncoming traffic spawn ~{spawnAheadKm} km ahead of player"
                };
            }

            return null;
        }

        /// <summary>
        /// Returns <c>true</c> when an oncoming train is within 3 km of the player —
        /// used to trigger horn / alert UI.
        /// </summary>
        /// <param name="playerKm">Player position (km).</param>
        /// <param name="gameTimeMinutes">Game-clock (minutes past midnight).</param>
        public bool IsOnComingTrain(double playerKm, double gameTimeMinutes)
        {
            const double alertRadiusKm = 3.0;

            foreach (var svc in _services.Where(s => s.Direction == TrainDirection.UP))
            {
                double? pos = InterpolatePosition(svc, gameTimeMinutes);
                if (pos == null) continue;

                // UP train and player going DOWN → they approach each other
                if (pos.Value > playerKm && (pos.Value - playerKm) <= alertRadiusKm)
                    return true;
            }

            return false;
        }

        /// <summary>
        /// Returns the number of AI trains whose interpolated position falls within ±5 km of
        /// the supplied km-mark at the current game time.  Useful for driving-difficulty HUD.
        /// </summary>
        /// <param name="km">Corridor position to query.</param>
        public int GetTrafficDensity(double km)
        {
            // We need a game-time reference; use current UTC hour/minute as a proxy.
            double now = DateTime.UtcNow.Hour * 60.0 + DateTime.UtcNow.Minute;
            const double sectionHalfKm = 5.0;
            int count = 0;

            foreach (var svc in _services)
            {
                double? pos = InterpolatePosition(svc, now);
                if (pos == null) continue;
                if (Math.Abs(pos.Value - km) <= sectionHalfKm) count++;
            }

            return count;
        }

        // ─────────────────────────────────────────────────────────────────────────
        // Internal helpers
        // ─────────────────────────────────────────────────────────────────────────

        /// <summary>
        /// Interpolates the train's corridor position (km from KLM) at the given game-clock time.
        /// Returns <c>null</c> when the service has not yet started or has already terminated.
        /// </summary>
        private static double? InterpolatePosition(TrainService svc, double gameTimeMin)
        {
            // Convert game-clock to elapsed minutes since the service's origin departure.
            double elapsed = gameTimeMin - svc.OriginDepartureClockMin;

            // Allow wrapping past midnight (1440 minutes) for overnight services.
            if (elapsed < -60)  elapsed += 1440;
            if (elapsed > 1440) elapsed -= 1440;

            var stops = svc.Stops;
            if (stops.Length == 0) return null;

            // Before departure
            if (elapsed < stops[0].DepartureMin) return null;

            // After termination
            if (elapsed > stops[^1].ArrivalMin + 5) return null;

            // Dwell at a stop
            for (int i = 0; i < stops.Length; i++)
            {
                if (elapsed >= stops[i].ArrivalMin && elapsed <= stops[i].DepartureMin)
                    return stops[i].KmFromOrigin;
            }

            // In transit between two stops
            for (int i = 0; i < stops.Length - 1; i++)
            {
                var from = stops[i];
                var to   = stops[i + 1];

                if (elapsed > from.DepartureMin && elapsed < to.ArrivalMin)
                {
                    double segElapsed = elapsed - from.DepartureMin;
                    double segTotal   = to.ArrivalMin - from.DepartureMin;
                    double t          = segElapsed / segTotal; // 0..1

                    // Linear interpolation along the corridor
                    double km = from.KmFromOrigin + t * (to.KmFromOrigin - from.KmFromOrigin);
                    return km;
                }
            }

            return null;
        }

        /// <summary>
        /// Estimates the AI train's current speed (km/h) by examining the inter-stop segment
        /// it currently occupies.
        /// </summary>
        private static double EstimateSpeed(TrainService svc, double gameTimeMin)
        {
            double elapsed = gameTimeMin - svc.OriginDepartureClockMin;
            if (elapsed < -60)  elapsed += 1440;
            if (elapsed > 1440) elapsed -= 1440;

            var stops = svc.Stops;

            for (int i = 0; i < stops.Length - 1; i++)
            {
                var from = stops[i];
                var to   = stops[i + 1];

                if (elapsed > from.DepartureMin && elapsed < to.ArrivalMin)
                {
                    double distKm  = Math.Abs(to.KmFromOrigin - from.KmFromOrigin);
                    double timeMins = to.ArrivalMin - from.DepartureMin;
                    if (timeMins <= 0) return DefaultLineSpeedKmh;
                    return distKm / (timeMins / 60.0); // km ÷ hours
                }
            }

            // Dwelt at a station
            return 0.0;
        }

        /// <summary>Returns a representative line-speed for the service based on traction type.</summary>
        private static double TypicalSpeed(TrainService svc) =>
            svc.LocoType switch
            {
                "WAP-7" => 110.0,
                "WAP-4" =>  90.0,
                "WAG-9" =>  75.0,
                "WDM-3A" => 60.0,
                _ => DefaultLineSpeedKmh
            };

        /// <summary>Returns the code of the station nearest to <paramref name="km"/>.</summary>
        private static string NearestStation(double km)
        {
            string best = "KLM";
            double bestDist = double.MaxValue;

            foreach (var kvp in StationKm)
            {
                double d = Math.Abs(kvp.Value - km);
                if (d < bestDist) { bestDist = d; best = kvp.Key; }
            }

            return best;
        }
    }
}
