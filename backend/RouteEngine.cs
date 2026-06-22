using System;
using System.Collections.Generic;
using System.Linq;

namespace RailwaySimulator.Backend.Route
{
    // ─────────────────────────────────────────────────────────────────────────────
    // Model classes
    // ─────────────────────────────────────────────────────────────────────────────

    /// <summary>
    /// Represents a single station on the route with its chainage position and metadata.
    /// </summary>
    public class StationInfo
    {
        /// <summary>Station code as used by Indian Railways (e.g. "QLN").</summary>
        public string Code { get; init; } = "";

        /// <summary>Full display name of the station.</summary>
        public string Name { get; init; } = "";

        /// <summary>Distance from the origin station in kilometres.</summary>
        public double Km { get; init; }

        /// <summary>Whether this station has a mandatory scheduled stop.</summary>
        public bool IsMandatoryStop { get; init; }

        /// <summary>Platform track count at this station.</summary>
        public int Platforms { get; init; }

        /// <summary>Station category under Indian Railways classification (A1/A/B/C/D/E).</summary>
        public string Category { get; init; } = "";

        /// <summary>Typical scheduled dwell time in seconds (0 = pass-through).</summary>
        public int DwellTimeSec { get; init; }
    }

    /// <summary>
    /// Defines a speed-restriction zone along the route track.
    /// </summary>
    public class SpeedLimitZone
    {
        /// <summary>Start chainage of the zone in km.</summary>
        public double StartKm { get; init; }

        /// <summary>End chainage of the zone in km.</summary>
        public double EndKm { get; init; }

        /// <summary>Maximum Permissible Speed (MPS) in km/h for this zone.</summary>
        public double SpeedKmh { get; init; }

        /// <summary>Human-readable reason for the restriction.</summary>
        public string Reason { get; init; } = "";
    }

    /// <summary>
    /// Gradient information at a specific chainage point.
    /// </summary>
    public class GradientInfo
    {
        /// <summary>Slope as a dimensionless fraction (positive = ascending, negative = descending).
        /// e.g. 0.0067 ≈ 1 in 150 rising grade.</summary>
        public double Slope { get; init; }

        /// <summary>Human-readable label such as "UP 1:150" or "LEVEL".</summary>
        public string Label { get; init; } = "LEVEL";

        /// <summary>Grade resistance in N per kN of train weight (‰ of weight).</summary>
        public double GradeResistancePerMille => Slope * 1000.0;
    }

    /// <summary>
    /// Internal gradient zone definition stored inside RouteEngine.
    /// </summary>
    internal sealed class GradientZone
    {
        public double StartKm { get; init; }
        public double EndKm { get; init; }
        public double Slope { get; init; }
        public string Label { get; init; } = "";
    }

    /// <summary>
    /// Information about a horizontal curve on the route.
    /// </summary>
    public class CurveInfo
    {
        /// <summary>Start chainage of the curve in km.</summary>
        public double StartKm { get; init; }

        /// <summary>End chainage of the curve in km.</summary>
        public double EndKm { get; init; }

        /// <summary>Curve radius in metres.</summary>
        public double RadiusMetres { get; init; }

        /// <summary>Direction of curve when viewed in the direction of travel.</summary>
        public string Direction { get; init; } = "LEFT";

        /// <summary>Speed restriction imposed on this curve in km/h, derived from radius
        /// using the Indian Railways formula V = 4.35 * sqrt(R) for BG tracks.</summary>
        public double SpeedRestrictionKmh { get; init; }

        /// <summary>Descriptive name or landmark associated with the curve.</summary>
        public string Name { get; init; } = "";
    }

    /// <summary>
    /// Information about a bridge or major structure on the route.
    /// </summary>
    public class BridgeInfo
    {
        /// <summary>Name of the bridge or water body crossed.</summary>
        public string Name { get; init; } = "";

        /// <summary>Chainage at the start of the bridge in km.</summary>
        public double StartKm { get; init; }

        /// <summary>Length of the bridge structure in km.</summary>
        public double LengthKm { get; init; }

        /// <summary>Chainage at the end of the bridge in km (StartKm + LengthKm).</summary>
        public double EndKm => StartKm + LengthKm;

        /// <summary>Type of bridge: WATER (river/backwater) or VIADUCT (land).</summary>
        public string BridgeType { get; init; } = "WATER";

        /// <summary>Number of spans in the bridge.</summary>
        public int Spans { get; init; }

        /// <summary>Speed restriction on bridge in km/h (per Indian Railways bridge rules).</summary>
        public double SpeedRestrictionKmh { get; init; }
    }

    /// <summary>
    /// A weather-condition zone applied to a section of the route.
    /// </summary>
    public class WeatherZone
    {
        /// <summary>Start chainage of the weather zone in km.</summary>
        public double StartKm { get; init; }

        /// <summary>End chainage of the weather zone in km.</summary>
        public double EndKm { get; init; }

        /// <summary>Weather condition type: CLEAR, RAIN, or MIST.</summary>
        public string WeatherType { get; init; } = "CLEAR";

        /// <summary>Visibility reduction factor (0.0 = no reduction, 1.0 = zero visibility).</summary>
        public double VisibilityReduction { get; init; }
    }

    /// <summary>
    /// Aggregated look-ahead report for a train at a given chainage position.
    /// </summary>
    public class RouteAheadReport
    {
        /// <summary>Current chainage position in km.</summary>
        public double CurrentKm { get; init; }

        /// <summary>Look-ahead distance applied in km.</summary>
        public double LookAheadKm { get; init; }

        /// <summary>Next station within look-ahead range, or null.</summary>
        public StationInfo? NextStation { get; init; }

        /// <summary>Distance to the next station in km (null if no station in range).</summary>
        public double? DistanceToNextStationKm { get; init; }

        /// <summary>Bridges encountered in look-ahead range.</summary>
        public List<BridgeInfo> BridgesAhead { get; init; } = new();

        /// <summary>Curve zones within look-ahead range.</summary>
        public List<CurveInfo> CurvesAhead { get; init; } = new();

        /// <summary>All distinct speed limit zones within look-ahead range, ordered by start km.</summary>
        public List<SpeedLimitZone> SpeedChangesAhead { get; init; } = new();

        /// <summary>Current speed limit at <see cref="CurrentKm"/>.</summary>
        public double CurrentSpeedLimitKmh { get; init; }

        /// <summary>Minimum speed limit anywhere in the look-ahead window.</summary>
        public double MinSpeedLimitAheadKmh { get; init; }

        /// <summary>Whether the train is currently inside a bridge zone.</summary>
        public bool IsOnBridge { get; init; }

        /// <summary>Whether the train is currently inside station limits.</summary>
        public bool IsInStationLimits { get; init; }
    }

    /// <summary>
    /// Full summary profile of the entire route.
    /// </summary>
    public class RouteProfile
    {
        /// <summary>Display name of the route.</summary>
        public string RouteName { get; init; } = "";

        /// <summary>Origin station name.</summary>
        public string Origin { get; init; } = "";

        /// <summary>Destination station name.</summary>
        public string Destination { get; init; } = "";

        /// <summary>Total route length in km.</summary>
        public double TotalLengthKm { get; init; }

        /// <summary>Number of intermediate stations.</summary>
        public int IntermediateStationCount { get; init; }

        /// <summary>Total number of stations including origin and destination.</summary>
        public int TotalStationCount { get; init; }

        /// <summary>Maximum speed limit anywhere on the route in km/h.</summary>
        public double MaxSpeedKmh { get; init; }

        /// <summary>Number of major bridge structures on the route.</summary>
        public int BridgeCount { get; init; }

        /// <summary>Number of curve zones on the route.</summary>
        public int CurveCount { get; init; }

        /// <summary>Total cumulative rising grade in metres.</summary>
        public double TotalRisingGradeM { get; init; }

        /// <summary>Total cumulative falling grade in metres.</summary>
        public double TotalFallingGradeM { get; init; }

        /// <summary>All stations on the route.</summary>
        public List<StationInfo> Stations { get; init; } = new();

        /// <summary>All bridge zones on the route.</summary>
        public List<BridgeInfo> Bridges { get; init; } = new();
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // RouteEngine singleton
    // ─────────────────────────────────────────────────────────────────────────────

    /// <summary>
    /// Singleton engine encapsulating the complete operational parameters of the
    /// Kollam Junction → Thiruvananthapuram Central broad-gauge route (64.6 km)
    /// on the Thiruvananthapuram Division of Southern Railway, Indian Railways.
    ///
    /// All chainage positions are measured in kilometres from Kollam Junction (km 0.0).
    /// Speed values follow Indian Railways MPS (Maximum Permissible Speed) norms.
    /// Gradient values are dimensionless fractions (rise over run).
    /// </summary>
    public sealed class RouteEngine
    {
        // ── Singleton ────────────────────────────────────────────────────────────
        private static readonly Lazy<RouteEngine> _lazy =
            new(() => new RouteEngine(), isThreadSafe: true);

        /// <summary>Gets the singleton instance of <see cref="RouteEngine"/>.</summary>
        public static RouteEngine Instance => _lazy.Value;

        private RouteEngine() { }   // private constructor enforces singleton

        // ── Route constants ──────────────────────────────────────────────────────
        private const double ROUTE_LENGTH_KM  = 64.6;
        private const double STATION_LIMITS_RADIUS_KM = 0.5;   // ±500 m around any station

        // ── Station data ─────────────────────────────────────────────────────────

        /// <summary>
        /// Complete ordered list of stations on the Kollam–Thiruvananthapuram route.
        /// Kilometre positions are measured from Kollam Junction (0.0 km).
        /// </summary>
        private static readonly List<StationInfo> _stations = new()
        {
            new StationInfo { Code = "QLN", Name = "Kollam Junction", Km = 0.0, IsMandatoryStop = true, Platforms = 5, Category = "A1", DwellTimeSec = 300 },
            new StationInfo { Code = "IRP", Name = "Iravipuram", Km = 4.6, IsMandatoryStop = false, Platforms = 2, Category = "HG-2", DwellTimeSec = 0 },
            new StationInfo { Code = "MYY", Name = "Mayyanad", Km = 8.9, IsMandatoryStop = false, Platforms = 2, Category = "NSG-6", DwellTimeSec = 0 },
            new StationInfo { Code = "PVU", Name = "Paravur", Km = 12.4, IsMandatoryStop = false, Platforms = 2, Category = "NSG-5", DwellTimeSec = 0 },
            new StationInfo { Code = "KFI", Name = "Kappil", Km = 17.0, IsMandatoryStop = false, Platforms = 2, Category = "HG-3", DwellTimeSec = 0 },
            new StationInfo { Code = "EVA", Name = "Edavai", Km = 19.9, IsMandatoryStop = false, Platforms = 2, Category = "NSG-6", DwellTimeSec = 0 },
            new StationInfo { Code = "VAK", Name = "Varkala Sivagiri", Km = 23.7, IsMandatoryStop = true, Platforms = 3, Category = "NSG-4", DwellTimeSec = 120 },
            new StationInfo { Code = "AKI", Name = "Akathumuri", Km = 30.1, IsMandatoryStop = false, Platforms = 2, Category = "HG-3", DwellTimeSec = 0 },
            new StationInfo { Code = "KVU", Name = "Kadakkavur", Km = 32.8, IsMandatoryStop = false, Platforms = 2, Category = "NSG-6", DwellTimeSec = 0 },
            new StationInfo { Code = "CRY", Name = "Chirayinkeezhu", Km = 35.9, IsMandatoryStop = false, Platforms = 2, Category = "NSG-5", DwellTimeSec = 0 },
            new StationInfo { Code = "PGZ", Name = "Perunguzhi", Km = 40.0, IsMandatoryStop = false, Platforms = 2, Category = "HG-2", DwellTimeSec = 0 },
            new StationInfo { Code = "MQU", Name = "Murukkampuzha", Km = 43.2, IsMandatoryStop = false, Platforms = 2, Category = "NSG-6", DwellTimeSec = 0 },
            new StationInfo { Code = "KPY", Name = "Kaniyapuram", Km = 47.2, IsMandatoryStop = false, Platforms = 2, Category = "HG-2", DwellTimeSec = 0 },
            new StationInfo { Code = "KZK", Name = "Kazhakkuttam", Km = 51.3, IsMandatoryStop = false, Platforms = 3, Category = "NSG-5", DwellTimeSec = 0 },
            new StationInfo { Code = "VELI", Name = "Veli", Km = 55.3, IsMandatoryStop = false, Platforms = 2, Category = "HG-2", DwellTimeSec = 0 },
            new StationInfo { Code = "TVCN", Name = "Thiruvananthapuram North", Km = 57.5, IsMandatoryStop = false, Platforms = 4, Category = "NSG-3", DwellTimeSec = 180 },
            new StationInfo { Code = "PET", Name = "TVM Pettah", Km = 62.1, IsMandatoryStop = false, Platforms = 2, Category = "NSG-6", DwellTimeSec = 0 },
            new StationInfo { Code = "TVC", Name = "Trivandrum Central", Km = 64.6, IsMandatoryStop = true, Platforms = 5, Category = "NSG-2", DwellTimeSec = 300 }
        };

        // ── Speed limit zones ────────────────────────────────────────────────────
        private static readonly List<SpeedLimitZone> _speedLimitZones = new()
        {
            // ── Departure from Kollam Junction ───────────────────────────────────
            new SpeedLimitZone { StartKm =  0.0,  EndKm =  0.3,  SpeedKmh =  15, Reason = "Turnout – Kollam Jct yard exit" },
            new SpeedLimitZone { StartKm =  0.3,  EndKm =  0.8,  SpeedKmh =  50, Reason = "Kollam Jct station limits" },
            new SpeedLimitZone { StartKm =  0.8,  EndKm =  2.0,  SpeedKmh =  75, Reason = "Caution zone – Kollam approach" },
            // ── Open line Kollam-Eravipuram ─────────────────────────────────────
            new SpeedLimitZone { StartKm =  2.0,  EndKm =  2.1,  SpeedKmh = 110, Reason = "Open main line" },
            new SpeedLimitZone { StartKm =  2.1,  EndKm =  3.5,  SpeedKmh =  30, Reason = "Speed Board 30 km/h restriction" },
            new SpeedLimitZone { StartKm =  3.5,  EndKm =  4.3,  SpeedKmh = 110, Reason = "Open main line" },
            // ── Eravipuram ───────────────────────────────────────────────────────
            new SpeedLimitZone { StartKm =  4.3,  EndKm =  4.8,  SpeedKmh =  75, Reason = "Turnout curve near Eravipuram" },
            // ── Open line Eravipuram-Mayyanad ───────────────────────────────────
            new SpeedLimitZone { StartKm =  4.8,  EndKm =  7.5,  SpeedKmh = 110, Reason = "Open main line" },
            new SpeedLimitZone { StartKm =  7.5,  EndKm =  9.5,  SpeedKmh =  50, Reason = "Speed Board 50 km/h restriction" },
            new SpeedLimitZone { StartKm =  9.5,  EndKm = 10.4,  SpeedKmh = 110, Reason = "Open main line" },
            // ── Paravur Lake Bridge approach ─────────────────────────────────────
            new SpeedLimitZone { StartKm = 10.4,  EndKm = 12.3,  SpeedKmh =  75, Reason = "Paravur Lake Bridge crossing" },
            // ── Paravur ──────────────────────────────────────────────────────────
            new SpeedLimitZone { StartKm = 12.3,  EndKm = 12.8,  SpeedKmh =  50, Reason = "Paravur station limits" },
            // ── Open line Paravur-Kappil ─────────────────────────────────────────
            new SpeedLimitZone { StartKm = 12.8,  EndKm = 16.5,  SpeedKmh = 110, Reason = "Open main line" },
            // ── Kappil ───────────────────────────────────────────────────────────
            new SpeedLimitZone { StartKm = 16.5,  EndKm = 17.5,  SpeedKmh =  75, Reason = "Kappil station approach" },
            // ── Open line Kappil-Edava ───────────────────────────────────────────
            new SpeedLimitZone { StartKm = 17.5,  EndKm = 18.5,  SpeedKmh = 110, Reason = "Open main line" },
            new SpeedLimitZone { StartKm = 18.5,  EndKm = 20.5,  SpeedKmh =  30, Reason = "Speed Board 30 km/h restriction" },
            new SpeedLimitZone { StartKm = 20.5,  EndKm = 22.5,  SpeedKmh = 110, Reason = "Open main line" },
            // ── Varkala Sivagiri approach ────────────────────────────────────────
            new SpeedLimitZone { StartKm = 22.5,  EndKm = 23.5,  SpeedKmh =  75, Reason = "Approach caution – Varkala" },
            new SpeedLimitZone { StartKm = 23.5,  EndKm = 24.0,  SpeedKmh =  50, Reason = "Varkala Sivagiri station limits" },
            // ── Open line Varkala-Akathumuri ─────────────────────────────────────
            new SpeedLimitZone { StartKm = 24.0,  EndKm = 27.5,  SpeedKmh = 110, Reason = "Open main line" },
            // ── Akathumuri Bridge and curve ──────────────────────────────────────
            new SpeedLimitZone { StartKm = 27.5,  EndKm = 28.8,  SpeedKmh =  75, Reason = "Akathumuri Bridge and curve" },
            // ── Akathumuri ───────────────────────────────────────────────────────
            new SpeedLimitZone { StartKm = 28.8,  EndKm = 29.3,  SpeedKmh = 110, Reason = "Open main line" },
            new SpeedLimitZone { StartKm = 29.3,  EndKm = 31.0,  SpeedKmh =  50, Reason = "Speed Board 50 km/h restriction" },
            new SpeedLimitZone { StartKm = 31.0,  EndKm = 32.3,  SpeedKmh = 110, Reason = "Open main line" },
            // ── Kadakkavur ───────────────────────────────────────────────────────
            new SpeedLimitZone { StartKm = 32.3,  EndKm = 33.2,  SpeedKmh =  50, Reason = "Kadakkavur station limits" },
            // ── Open line Kadakkavur-Chirayinkeezhu ──────────────────────────────
            new SpeedLimitZone { StartKm = 33.2,  EndKm = 35.4,  SpeedKmh = 110, Reason = "Open main line" },
            // ── Chirayinkeezhu ───────────────────────────────────────────────────
            new SpeedLimitZone { StartKm = 35.4,  EndKm = 36.4,  SpeedKmh =  50, Reason = "Chirayinkeezhu station limits" },
            // ── Open line Chirayinkeezhu-Perunguzhi ──────────────────────────────
            new SpeedLimitZone { StartKm = 36.4,  EndKm = 39.5,  SpeedKmh = 110, Reason = "Open main line" },
            // ── Perunguzhi ───────────────────────────────────────────────────────
            new SpeedLimitZone { StartKm = 39.5,  EndKm = 40.5,  SpeedKmh =  50, Reason = "Perunguzhi station limits" },
            // ── Murukkampuzha Bridge and approach ────────────────────────────────
            new SpeedLimitZone { StartKm = 40.5,  EndKm = 41.5,  SpeedKmh = 110, Reason = "Open main line" },
            new SpeedLimitZone { StartKm = 41.5,  EndKm = 42.6,  SpeedKmh =  75, Reason = "Murukkampuzha Bridge and approach" },
            // ── Murukkampuzha ────────────────────────────────────────────────────
            new SpeedLimitZone { StartKm = 42.6,  EndKm = 43.6,  SpeedKmh =  50, Reason = "Murukkampuzha station limits" },
            // ── Open line Murukkampuzha-Kaniyapuram ──────────────────────────────
            new SpeedLimitZone { StartKm = 43.6,  EndKm = 44.5,  SpeedKmh = 110, Reason = "Open main line" },
            new SpeedLimitZone { StartKm = 44.5,  EndKm = 46.5,  SpeedKmh =  30, Reason = "Speed Board 30 km/h restriction" },
            new SpeedLimitZone { StartKm = 46.5,  EndKm = 46.8,  SpeedKmh = 110, Reason = "Open main line" },
            // ── Kaniyapuram ──────────────────────────────────────────────────────
            new SpeedLimitZone { StartKm = 46.8,  EndKm = 47.6,  SpeedKmh =  50, Reason = "Kaniyapuram station limits" },
            // ── Open line Kaniyapuram-Kazhakkuttam ────────────────────────────────
            new SpeedLimitZone { StartKm = 47.6,  EndKm = 50.8,  SpeedKmh = 110, Reason = "Open main line" },
            // ── Kazhakkuttam ─────────────────────────────────────────────────────
            new SpeedLimitZone { StartKm = 50.8,  EndKm = 51.8,  SpeedKmh =  50, Reason = "Kazhakkuttam station limits" },
            // ── Open line Kazhakkuttam-Veli ──────────────────────────────────────
            new SpeedLimitZone { StartKm = 51.8,  EndKm = 54.8,  SpeedKmh = 110, Reason = "Open main line" },
            // ── Veli Creek Bridge and Veli station ───────────────────────────────
            new SpeedLimitZone { StartKm = 54.8,  EndKm = 56.8,  SpeedKmh =  75, Reason = "Veli Creek Bridge and Veli station" },
            // ── Thiruvananthapuram North (Kochuveli) yard ────────────────────────
            new SpeedLimitZone { StartKm = 56.8,  EndKm = 58.0,  SpeedKmh =  50, Reason = "Thiruvananthapuram North yard limits" },
            // ── Open line TVCN-Pettah ────────────────────────────────────────────
            new SpeedLimitZone { StartKm = 58.0,  EndKm = 61.6,  SpeedKmh = 110, Reason = "Open main line" },
            // ── TVM Pettah station limits ────────────────────────────────────────
            new SpeedLimitZone { StartKm = 61.6,  EndKm = 62.6,  SpeedKmh =  50, Reason = "TVM Pettah station limits" },
            // ── Thiruvananthapuram Central approach ──────────────────────────────
            new SpeedLimitZone { StartKm = 62.6,  EndKm = 63.8,  SpeedKmh =  75, Reason = "Approach caution – TVC Central" },
            new SpeedLimitZone { StartKm = 63.8,  EndKm = 64.3,  SpeedKmh =  30, Reason = "Turnout – TVC yard entrance" },
            new SpeedLimitZone { StartKm = 64.3,  EndKm = 64.6,  SpeedKmh =  15, Reason = "Trivandrum Central terminal limits" }
        };

        // ── Gradient zones ───────────────────────────────────────────────────────

        /// <summary>
        /// Gradient zones along the route. Slope is a dimensionless fraction
        /// (positive = uphill in direction of travel, negative = downhill).
        /// Sections not listed are assumed level (slope = 0.0).
        /// </summary>
        private static readonly List<GradientZone> _gradientZones = new()
        {
            new GradientZone { StartKm = 12.0, EndKm = 15.0, Slope =  0.0067, Label = "UP 1:150" },
            new GradientZone { StartKm = 18.0, EndKm = 22.0, Slope = -0.0050, Label = "DN 1:200" },
            new GradientZone { StartKm = 22.0, EndKm = 25.0, Slope =  0.0100, Label = "UP 1:100" },
            new GradientZone { StartKm = 30.0, EndKm = 35.0, Slope = -0.0067, Label = "DN 1:150" },
            new GradientZone { StartKm = 35.0, EndKm = 45.0, Slope =  0.0040, Label = "UP 1:250" },
            new GradientZone { StartKm = 52.0, EndKm = 58.0, Slope = -0.0083, Label = "DN 1:120" }
        };

        // ── Curve zones ──────────────────────────────────────────────────────────

        /// <summary>
        /// Horizontal curve zones on the route.
        /// Speed restrictions are calculated using the Indian Railways formula:
        ///   V = 4.35 * sqrt(R)  km/h  (for BG routes, cant = 75 mm, cant deficiency = 75 mm)
        /// Results are rounded down to the nearest 5 km/h and capped at 110 km/h.
        /// </summary>
        public static readonly IReadOnlyList<CurveInfo> CurveZones = new List<CurveInfo>
        {
            new CurveInfo { StartKm = 2.1, EndKm = 3.5, RadiusMetres = 50, Direction = "RIGHT", SpeedRestrictionKmh = CalcCurveSpeed(50), Name = "Kollam South curve" },
            new CurveInfo { StartKm = 7.5, EndKm = 9.5, RadiusMetres = 150, Direction = "LEFT", SpeedRestrictionKmh = CalcCurveSpeed(150), Name = "Iravipuram approach curve" },
            new CurveInfo { StartKm = 18.5, EndKm = 20.5, RadiusMetres = 50, Direction = "RIGHT", SpeedRestrictionKmh = CalcCurveSpeed(50), Name = "Edavai curve" },
            new CurveInfo { StartKm = 29.3, EndKm = 31.0, RadiusMetres = 150, Direction = "LEFT", SpeedRestrictionKmh = CalcCurveSpeed(150), Name = "Akathumuri approach curve" },
            new CurveInfo { StartKm = 44.5, EndKm = 46.5, RadiusMetres = 50, Direction = "RIGHT", SpeedRestrictionKmh = CalcCurveSpeed(50), Name = "Kaniyapuram curve" }
        }.AsReadOnly();

        // ── Bridge zones ─────────────────────────────────────────────────────────

        /// <summary>
        /// Major bridge structures on the Kollam–Trivandrum route.
        /// </summary>
        public static readonly IReadOnlyList<BridgeInfo> BridgeZones = new List<BridgeInfo>
        {
            new BridgeInfo { Name = "Paravur Lake Bridge", StartKm = 10.5, LengthKm = 1.8, BridgeType = "WATER", Spans = 24, SpeedRestrictionKmh = 75 },
            new BridgeInfo { Name = "Akathumuri Bridge", StartKm = 28.0, LengthKm = 0.8, BridgeType = "WATER", Spans = 10, SpeedRestrictionKmh = 75 },
            new BridgeInfo { Name = "Murukkampuzha Bridge", StartKm = 42.0, LengthKm = 0.6, BridgeType = "WATER", Spans = 8, SpeedRestrictionKmh = 75 },
            new BridgeInfo { Name = "Veli Creek Bridge", StartKm = 56.5, LengthKm = 0.5, BridgeType = "WATER", Spans = 6, SpeedRestrictionKmh = 75 }
        }.AsReadOnly();

        // ── Weather zones ─────────────────────────────────────────────────────────

        /// <summary>
        /// Default weather zones matching TrackMap.js
        /// </summary>
        public static readonly IReadOnlyList<WeatherZone> WeatherZones = new List<WeatherZone>
        {
            new WeatherZone { StartKm = 0.0, EndKm = 10.0, WeatherType = "CLEAR", VisibilityReduction = 0.0 },
            new WeatherZone { StartKm = 10.0, EndKm = 18.0, WeatherType = "RAIN", VisibilityReduction = 0.35 },
            new WeatherZone { StartKm = 18.0, EndKm = 42.0, WeatherType = "CLEAR", VisibilityReduction = 0.0 },
            new WeatherZone { StartKm = 42.0, EndKm = 48.0, WeatherType = "RAIN", VisibilityReduction = 0.35 },
            new WeatherZone { StartKm = 48.0, EndKm = 55.0, WeatherType = "CLEAR", VisibilityReduction = 0.0 },
            new WeatherZone { StartKm = 55.0, EndKm = 64.6, WeatherType = "CLEAR", VisibilityReduction = 0.0 }
        }.AsReadOnly();

        // ── Helper: Indian Railways curve speed formula ────────────────────────────

        /// <summary>
        /// Computes Maximum Permissible Speed on a horizontal curve using the
        /// Indian Railways BG formula: V = 4.35 × √R (km/h), capped at 110 km/h.
        /// Result is floored to the nearest 5 km/h.
        /// </summary>
        private static double CalcCurveSpeed(double radiusMetres)
        {
            double raw = 4.35 * Math.Sqrt(radiusMetres);
            double floored = Math.Floor(raw / 5.0) * 5.0;
            return Math.Min(floored, 110.0);
        }

        // ═════════════════════════════════════════════════════════════════════════
        // Public API
        // ═════════════════════════════════════════════════════════════════════════

        /// <summary>
        /// Returns the Maximum Permissible Speed (MPS) in km/h at the given
        /// kilometre position. Applies the most restrictive zone active at that
        /// point. Returns 110 km/h (open-line default) if no zone matches.
        /// </summary>
        /// <param name="km">Chainage in km from Kollam Junction.</param>
        /// <returns>Speed limit in km/h.</returns>
        public double GetSpeedLimitAt(double km)
        {
            double minSpeed = 110.0;    // open-line default
            foreach (var zone in _speedLimitZones)
            {
                if (km >= zone.StartKm && km <= zone.EndKm)
                {
                    if (zone.SpeedKmh < minSpeed)
                        minSpeed = zone.SpeedKmh;
                }
            }
            return minSpeed;
        }

        /// <summary>
        /// Returns the <see cref="GradientInfo"/> at the given kilometre position.
        /// Returns a level gradient (slope = 0) if no gradient zone is defined there.
        /// </summary>
        /// <param name="km">Chainage in km from Kollam Junction.</param>
        public GradientInfo GetGradientAt(double km)
        {
            foreach (var zone in _gradientZones)
            {
                if (km >= zone.StartKm && km < zone.EndKm)
                    return new GradientInfo { Slope = zone.Slope, Label = zone.Label };
            }
            return new GradientInfo { Slope = 0.0, Label = "LEVEL" };
        }

        /// <summary>
        /// Returns the <see cref="CurveInfo"/> for the curve at the given km position,
        /// or <c>null</c> if the position is on a straight section.
        /// </summary>
        /// <param name="km">Chainage in km from Kollam Junction.</param>
        public CurveInfo? GetCurveAt(double km)
        {
            foreach (var curve in CurveZones)
            {
                if (km >= curve.StartKm && km <= curve.EndKm)
                    return curve;
            }
            return null;
        }

        /// <summary>
        /// Returns all <see cref="BridgeInfo"/> records whose extents overlap the
        /// specified kilometre range [<paramref name="startKm"/>, <paramref name="endKm"/>].
        /// </summary>
        /// <param name="startKm">Range start in km.</param>
        /// <param name="endKm">Range end in km.</param>
        public List<BridgeInfo> GetBridgesInRange(double startKm, double endKm)
        {
            return BridgeZones
                .Where(b => b.StartKm < endKm && b.EndKm > startKm)
                .ToList();
        }

        /// <summary>
        /// Finds the station whose kilometre position is within
        /// <paramref name="toleranceKm"/> of the given <paramref name="km"/> value.
        /// Returns <c>null</c> when no station is within tolerance.
        /// </summary>
        /// <param name="km">Chainage in km.</param>
        /// <param name="toleranceKm">Search radius in km (default 0.3 km = 300 m).</param>
        public StationInfo? GetStationAt(double km, double toleranceKm = 0.3)
        {
            return _stations
                .Where(s => Math.Abs(s.Km - km) <= toleranceKm)
                .OrderBy(s => Math.Abs(s.Km - km))
                .FirstOrDefault();
        }

        /// <summary>
        /// Returns the complete list of all stations on the route, ordered by km position.
        /// </summary>
        public List<StationInfo> GetAllStations() => _stations.ToList();

        /// <summary>
        /// Returns the next station ahead of the given kilometre position,
        /// or <c>null</c> if the train has passed the last station.
        /// </summary>
        /// <param name="currentKm">Current chainage in km.</param>
        public StationInfo? GetNextStation(double currentKm)
        {
            return _stations
                .Where(s => s.Km > currentKm)
                .OrderBy(s => s.Km)
                .FirstOrDefault();
        }

        /// <summary>
        /// Returns <c>true</c> when the given chainage falls within any bridge zone.
        /// </summary>
        /// <param name="km">Chainage in km.</param>
        public bool IsInBridgeZone(double km)
        {
            return BridgeZones.Any(b => km >= b.StartKm && km <= b.EndKm);
        }

        /// <summary>
        /// Returns <c>true</c> when the given chainage is within the station-limits
        /// radius (±<see cref="STATION_LIMITS_RADIUS_KM"/> km) of any station.
        /// </summary>
        /// <param name="km">Chainage in km.</param>
        public bool IsInStationLimits(double km)
        {
            return _stations.Any(s => Math.Abs(s.Km - km) <= STATION_LIMITS_RADIUS_KM);
        }

        /// <summary>
        /// Builds a comprehensive look-ahead report for a train at
        /// <paramref name="currentKm"/> covering the next <paramref name="lookAheadKm"/> kilometres.
        /// Includes upcoming stations, bridges, curves and speed-change events.
        /// </summary>
        /// <param name="currentKm">Current chainage in km.</param>
        /// <param name="lookAheadKm">Distance to scan ahead in km.</param>
        public RouteAheadReport GetAheadReport(double currentKm, double lookAheadKm = 5.0)
        {
            double endKm = Math.Min(currentKm + lookAheadKm, ROUTE_LENGTH_KM);

            var nextStation = GetNextStation(currentKm);
            double? distToNext = nextStation != null ? nextStation.Km - currentKm : (double?)null;

            var bridges = GetBridgesInRange(currentKm, endKm);

            var curves = CurveZones
                .Where(c => c.StartKm < endKm && c.EndKm > currentKm)
                .ToList();

            // Collect all speed zones that start or overlap within the look-ahead window
            var speedChanges = _speedLimitZones
                .Where(z => z.StartKm < endKm && z.EndKm > currentKm)
                .OrderBy(z => z.StartKm)
                .ToList();

            double currentLimit = GetSpeedLimitAt(currentKm);
            double minAhead = speedChanges.Count > 0
                ? speedChanges.Min(z => z.SpeedKmh)
                : currentLimit;

            return new RouteAheadReport
            {
                CurrentKm               = currentKm,
                LookAheadKm             = lookAheadKm,
                NextStation             = nextStation != null && nextStation.Km <= endKm ? nextStation : null,
                DistanceToNextStationKm = distToNext.HasValue && distToNext <= lookAheadKm ? distToNext : null,
                BridgesAhead            = bridges,
                CurvesAhead             = curves,
                SpeedChangesAhead       = speedChanges,
                CurrentSpeedLimitKmh    = currentLimit,
                MinSpeedLimitAheadKmh   = minAhead,
                IsOnBridge              = IsInBridgeZone(currentKm),
                IsInStationLimits       = IsInStationLimits(currentKm),
            };
        }

        /// <summary>
        /// Returns the full <see cref="RouteProfile"/> summary for the entire route,
        /// including aggregate statistics and complete station/bridge lists.
        /// </summary>
        public RouteProfile GetRouteProfile()
        {
            // Compute cumulative rising and falling grades
            double totalRise = 0.0, totalFall = 0.0;
            foreach (var zone in _gradientZones)
            {
                double sectionLen = (zone.EndKm - zone.StartKm) * 1000.0;  // metres
                double heightChange = zone.Slope * sectionLen;
                if (heightChange > 0) totalRise += heightChange;
                else                  totalFall += Math.Abs(heightChange);
            }

            return new RouteProfile
            {
                RouteName               = "Kollam Junction – Thiruvananthapuram Central (TVC Div, SR)",
                Origin                  = "Kollam Junction (QLN)",
                Destination             = "Thiruvananthapuram Central (TVC)",
                TotalLengthKm           = ROUTE_LENGTH_KM,
                TotalStationCount       = _stations.Count,
                IntermediateStationCount = _stations.Count - 2,
                MaxSpeedKmh             = 110.0,
                BridgeCount             = BridgeZones.Count,
                CurveCount              = CurveZones.Count,
                TotalRisingGradeM       = Math.Round(totalRise, 1),
                TotalFallingGradeM      = Math.Round(totalFall, 1),
                Stations                = _stations.ToList(),
                Bridges                 = BridgeZones.ToList(),
            };
        }
    }
}
