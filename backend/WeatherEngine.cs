using System;
using System.Collections.Generic;

namespace RailwaySimulator.Backend.Core
{
    // ---------------------------------------------------------------------------
    // Enums
    // ---------------------------------------------------------------------------

    /// <summary>
    /// Weather conditions relevant to train operations in the Kerala monsoon corridor.
    /// </summary>
    public enum WeatherType
    {
        /// <summary>Sunny / dry. Optimal adhesion and visibility.</summary>
        Clear,

        /// <summary>Intermittent drizzle. Slightly reduced adhesion.</summary>
        LightRain,

        /// <summary>Sustained heavy monsoon rainfall. Significantly reduced adhesion.</summary>
        HeavyRain,

        /// <summary>Low-level moisture mist near backwaters. Reduced visibility.</summary>
        Mist,

        /// <summary>Dense radiation fog (mainly pre-dawn). Very low visibility.</summary>
        Fog,

        /// <summary>Afternoon cumulonimbus – lightning, gusty winds, torrential rain.</summary>
        Thunderstorm
    }

    // ---------------------------------------------------------------------------
    // Weather zone model
    // ---------------------------------------------------------------------------

    /// <summary>
    /// Describes a geographic zone along the route with its baseline climate character.
    /// </summary>
    public class WeatherZone
    {
        /// <summary>Zone display name.</summary>
        public string Name { get; set; } = "";

        /// <summary>Start chainage in km.</summary>
        public double StartKm { get; set; }

        /// <summary>End chainage in km.</summary>
        public double EndKm { get; set; }

        /// <summary>Baseline rain probability for this zone (0–1).</summary>
        public double BaseRainProbability { get; set; }

        /// <summary>Baseline mist probability for this zone (0–1).</summary>
        public double BaseMistProbability { get; set; }

        /// <summary>True when zone is within the coastal sea-breeze belt.</summary>
        public bool IsCoastal { get; set; }

        /// <summary>True when zone is over or adjacent to backwaters / lagoons.</summary>
        public bool IsBackwater { get; set; }
    }

    // ---------------------------------------------------------------------------
    // WeatherEngine – singleton
    // ---------------------------------------------------------------------------

    /// <summary>
    /// Realistic weather simulation engine tuned for the Kerala monsoon climate
    /// along the Kollam–Thiruvananthapuram coastal corridor.
    ///
    /// <para><b>Key physics integrations:</b></para>
    /// <list type="bullet">
    ///   <item>Adhesion coefficient feeds into PhysicsEngine tractive effort limits.</item>
    ///   <item>Braking distance multiplier scales emergency stopping distance.</item>
    ///   <item>Wheel-slip risk probability gates traction control interventions.</item>
    ///   <item>Visibility drives signal sighting distance and speed restrictions.</item>
    /// </list>
    ///
    /// <para><b>Kerala weather zones on route:</b></para>
    /// <list type="table">
    ///   <listheader><term>Zone</term><description>km range</description></listheader>
    ///   <item><term>Coastal rain belt</term><description>km 0–25 (heavy SW monsoon exposure)</description></item>
    ///   <item><term>Backwater mist</term><description>km 10–20 (Ashtamudi / Vembanad lakes)</description></item>
    ///   <item><term>Inland transitional</term><description>km 25–50 (mixed; afternoon storms likely)</description></item>
    ///   <item><term>Inland clear</term><description>km 50–65 (TVC urban; rain less intense)</description></item>
    /// </list>
    /// </summary>
    public sealed class WeatherEngine
    {
        // -----------------------------------------------------------------------
        // Singleton
        // -----------------------------------------------------------------------
        private static readonly Lazy<WeatherEngine> _instance =
            new(() => new WeatherEngine(), isThreadSafe: true);

        /// <summary>Gets the singleton instance of the WeatherEngine.</summary>
        public static WeatherEngine Instance => _instance.Value;

        private readonly Random _rng = new(Environment.TickCount);

        private WeatherEngine()
        {
            BuildZones();
            // Start with a realistic default: light rain (Kerala monsoon baseline)
            CurrentWeather      = WeatherType.LightRain;
            RainfallIntensity   = 0.3;
            Visibility          = 4000;
            WindSpeed           = 22.0;
            Humidity            = 88;
            Temperature         = 28.5;
            _lastUpdateTime     = -1.0;
        }

        // -----------------------------------------------------------------------
        // Geographic zones
        // -----------------------------------------------------------------------

        private readonly List<WeatherZone> _zones = new();

        private void BuildZones()
        {
            _zones.AddRange(new[]
            {
                new WeatherZone
                {
                    Name                = "Coastal Rain Belt",
                    StartKm             = 0.0,
                    EndKm               = 25.0,
                    BaseRainProbability = 0.65,  // Heavy SW monsoon exposure
                    BaseMistProbability = 0.10,
                    IsCoastal           = true,
                    IsBackwater         = false
                },
                new WeatherZone
                {
                    Name                = "Backwater Mist Corridor",
                    StartKm             = 10.0,
                    EndKm               = 20.0,
                    BaseRainProbability = 0.55,
                    BaseMistProbability = 0.40,  // Ashtamudi / Kayamkulam lakes
                    IsCoastal           = true,
                    IsBackwater         = true
                },
                new WeatherZone
                {
                    Name                = "Inland Transitional",
                    StartKm             = 25.0,
                    EndKm               = 50.0,
                    BaseRainProbability = 0.45,
                    BaseMistProbability = 0.15,
                    IsCoastal           = false,
                    IsBackwater         = false
                },
                new WeatherZone
                {
                    Name                = "Thiruvananthapuram Urban",
                    StartKm             = 50.0,
                    EndKm               = 65.0,
                    BaseRainProbability = 0.30,
                    BaseMistProbability = 0.08,
                    IsCoastal           = false,
                    IsBackwater         = false
                }
            });
        }

        // -----------------------------------------------------------------------
        // Public weather state properties
        // -----------------------------------------------------------------------

        /// <summary>Current prevailing weather condition.</summary>
        public WeatherType CurrentWeather { get; private set; }

        /// <summary>Rainfall intensity (0 = dry, 1 = extreme downpour).</summary>
        public double RainfallIntensity { get; private set; }

        /// <summary>Horizontal visibility in metres.</summary>
        public double Visibility { get; private set; }

        /// <summary>Wind speed in km/h (sea-breeze or storm-force).</summary>
        public double WindSpeed { get; private set; }

        /// <summary>Relative humidity percentage (0–100).</summary>
        public double Humidity { get; private set; }

        /// <summary>Ambient air temperature in degrees Celsius.</summary>
        public double Temperature { get; private set; }

        // -----------------------------------------------------------------------
        // Physics integration properties
        // -----------------------------------------------------------------------

        /// <summary>
        /// Wheel–rail adhesion coefficient μ for the current conditions.
        ///
        /// <list type="table">
        ///   <listheader><term>Condition</term><description>μ</description></listheader>
        ///   <item><term>Dry / Clear</term><description>0.30</description></item>
        ///   <item><term>Light Rain</term><description>0.22</description></item>
        ///   <item><term>Heavy Rain</term><description>0.15</description></item>
        ///   <item><term>Wet leaf contamination</term><description>0.10</description></item>
        ///   <item><term>Fog (damp rail)</term><description>0.25</description></item>
        /// </list>
        /// </summary>
        public double AdhesionCoefficient
        {
            get
            {
                return CurrentWeather switch
                {
                    WeatherType.Clear         => 0.30,
                    WeatherType.Mist          => 0.25,
                    WeatherType.Fog           => 0.25,
                    WeatherType.LightRain     => 0.22,
                    WeatherType.HeavyRain     => 0.15,
                    WeatherType.Thunderstorm  => 0.14, // Leaf & debris contamination
                    _                         => 0.30
                };
            }
        }

        /// <summary>
        /// Multiplier applied to nominal braking distance calculations.
        /// A value of 1.0 means standard (dry-rail) performance.
        /// </summary>
        public double BrakingDistanceMultiplier
        {
            get
            {
                return CurrentWeather switch
                {
                    WeatherType.Clear         => 1.00,
                    WeatherType.Mist          => 1.15,
                    WeatherType.Fog           => 1.20,
                    WeatherType.LightRain     => 1.40,
                    WeatherType.HeavyRain     => 1.80,
                    WeatherType.Thunderstorm  => 1.90,
                    _                         => 1.00
                };
            }
        }

        /// <summary>
        /// Probability (0–1) of a wheel-slip event occurring at maximum throttle.
        /// Used by the traction control system to gate notch applications.
        /// </summary>
        public double WheelSlipRisk
        {
            get
            {
                // Base risk from adhesion deficit, amplified by rainfall intensity
                double baseRisk = Math.Max(0.0, (0.30 - AdhesionCoefficient) / 0.30);
                return Math.Clamp(baseRisk + RainfallIntensity * 0.15, 0.0, 1.0);
            }
        }

        // -----------------------------------------------------------------------
        // Time-based internal state
        // -----------------------------------------------------------------------
        private double _lastUpdateTime = -1.0; // fractional day (0–1)
        private double _transitionTimer = 0.0;  // minutes until next weather event

        // -----------------------------------------------------------------------
        // Zone query
        // -----------------------------------------------------------------------

        /// <summary>
        /// Returns the most specific <see cref="WeatherZone"/> for the given km position.
        /// Backwater zone takes priority over the wider coastal zone when they overlap.
        /// </summary>
        public WeatherZone GetWeatherZoneAt(double km)
        {
            // Return most-specific (smallest) matching zone
            WeatherZone? best = null;
            double bestWidth = double.MaxValue;

            foreach (var zone in _zones)
            {
                if (km >= zone.StartKm && km <= zone.EndKm)
                {
                    double width = zone.EndKm - zone.StartKm;
                    if (width < bestWidth)
                    {
                        bestWidth = width;
                        best = zone;
                    }
                }
            }

            // Fallback: coastal zone
            return best ?? _zones[0];
        }

        // -----------------------------------------------------------------------
        // Adhesion at position (for physics engine integration)
        // -----------------------------------------------------------------------

        /// <summary>
        /// Returns the wheel–rail adhesion coefficient at the given km, factoring in
        /// zone-specific moisture (e.g. extra slick near backwaters).
        /// </summary>
        public double GetAdhesionAt(double km)
        {
            var zone = GetWeatherZoneAt(km);
            double mu = AdhesionCoefficient;

            // Backwater zones add leaf / organic contamination risk: −0.03 μ
            if (zone.IsBackwater && CurrentWeather is WeatherType.LightRain or WeatherType.HeavyRain)
                mu -= 0.03;

            // Coastal sea-spray effect on dry days (slight reduction)
            if (zone.IsCoastal && CurrentWeather == WeatherType.Clear)
                mu -= 0.01;

            return Math.Clamp(mu, 0.08, 0.33);
        }

        // -----------------------------------------------------------------------
        // Visibility at position
        // -----------------------------------------------------------------------

        /// <summary>
        /// Returns the visibility in metres at the given km, with zone-specific
        /// adjustments for backwater mist and coastal sea-haze.
        /// </summary>
        public double GetVisibilityAt(double km)
        {
            var zone = GetWeatherZoneAt(km);
            double vis = Visibility;

            // Backwater zones have localised mist patches that cut visibility further
            if (zone.IsBackwater && CurrentWeather is WeatherType.Mist or WeatherType.Fog)
                vis *= 0.5;

            return Math.Max(50.0, vis);
        }

        // -----------------------------------------------------------------------
        // Weather update engine
        // -----------------------------------------------------------------------

        /// <summary>
        /// Advances the weather simulation for the given position and time of day.
        /// Call on each game tick (or at a lower rate, e.g. every 10 real seconds).
        /// </summary>
        /// <param name="km">Train position in km (determines active weather zone).</param>
        /// <param name="timeOfDay">
        /// Fractional day: 0.0 = midnight, 0.25 = 06:00, 0.5 = noon, 0.75 = 18:00, 1.0 = midnight.
        /// </param>
        public void Update(double km, double timeOfDay)
        {
            var zone = GetWeatherZoneAt(km);

            // Decrement transition timer; only re-evaluate weather when timer expires
            if (_lastUpdateTime >= 0)
            {
                double elapsed = Math.Abs(timeOfDay - _lastUpdateTime) * 24.0 * 60.0; // minutes
                _transitionTimer -= elapsed;
            }
            _lastUpdateTime = timeOfDay;

            if (_transitionTimer > 0) return; // Not yet time to change

            // Compute time-of-day modifiers
            bool isMorning        = timeOfDay >= 0.167 && timeOfDay <= 0.333; // 04:00–08:00
            bool isAfternoon      = timeOfDay >= 0.542 && timeOfDay <= 0.708; // 13:00–17:00
            bool isNight          = timeOfDay < 0.167 || timeOfDay > 0.875;   // 00:00–04:00 / 21:00–24:00

            double rainProb  = zone.BaseRainProbability;
            double mistProb  = zone.BaseMistProbability;
            double stormProb = 0.0;

            // Afternoon: convective thunderstorm risk peaks between 14:00 and 17:00
            if (isAfternoon)
            {
                rainProb  *= 1.35;
                stormProb  = zone.BaseRainProbability * 0.25;
            }

            // Morning: radiation mist/fog near backwaters and coast peaks at dawn
            if (isMorning && (zone.IsBackwater || zone.IsCoastal))
            {
                mistProb *= 2.0;
            }

            // Night: slight mist increase over backwaters
            if (isNight && zone.IsBackwater)
            {
                mistProb *= 1.5;
            }

            // Roll for next weather event
            double roll = _rng.NextDouble();

            WeatherType newWeather;
            double newRainfall;
            double newVis;

            if (roll < stormProb)
            {
                newWeather  = WeatherType.Thunderstorm;
                newRainfall = 0.85 + _rng.NextDouble() * 0.15;
                newVis      = 800 + _rng.NextDouble() * 400;
            }
            else if (roll < stormProb + rainProb * 0.4)
            {
                newWeather  = WeatherType.HeavyRain;
                newRainfall = 0.60 + _rng.NextDouble() * 0.25;
                newVis      = 1200 + _rng.NextDouble() * 800;
            }
            else if (roll < stormProb + rainProb)
            {
                newWeather  = WeatherType.LightRain;
                newRainfall = 0.15 + _rng.NextDouble() * 0.35;
                newVis      = 2500 + _rng.NextDouble() * 1500;
            }
            else if (roll < stormProb + rainProb + mistProb && isMorning)
            {
                bool denseFog = zone.IsBackwater && _rng.NextDouble() < 0.35;
                newWeather  = denseFog ? WeatherType.Fog : WeatherType.Mist;
                newRainfall = 0.0;
                newVis      = denseFog
                    ? 60 + _rng.NextDouble() * 80      // Fog: 60–140 m
                    : 300 + _rng.NextDouble() * 300;   // Mist: 300–600 m
            }
            else
            {
                newWeather  = WeatherType.Clear;
                newRainfall = 0.0;
                newVis      = 8000 + _rng.NextDouble() * 2000; // 8–10 km
            }

            ApplyWeather(newWeather, newRainfall, newVis, timeOfDay, zone);

            // Next event in 8–25 simulation minutes
            _transitionTimer = 8.0 + _rng.NextDouble() * 17.0;
        }

        /// <summary>Applies a resolved weather state and derives all secondary parameters.</summary>
        private void ApplyWeather(
            WeatherType type,
            double rainfall,
            double visibility,
            double timeOfDay,
            WeatherZone zone)
        {
            CurrentWeather    = type;
            RainfallIntensity = rainfall;
            Visibility        = visibility;

            // --- Temperature (Kerala coastal: 24°C night – 35°C peak afternoon) ---
            double baseTemp = zone.IsCoastal ? 29.0 : 31.0;
            double diurnal  = Math.Sin((timeOfDay - 0.25) * 2 * Math.PI) * 4.0; // ±4°C swing
            Temperature = baseTemp + diurnal
                - (type == WeatherType.Thunderstorm ? 4.0 : 0.0)
                - (rainfall * 3.0);

            // --- Humidity ---
            Humidity = type switch
            {
                WeatherType.Clear        => 65 + _rng.Next(0, 10),
                WeatherType.Mist         => 92 + _rng.Next(0, 6),
                WeatherType.Fog          => 96 + _rng.Next(0, 4),
                WeatherType.LightRain    => 88 + _rng.Next(0, 8),
                WeatherType.HeavyRain    => 95 + _rng.Next(0, 4),
                WeatherType.Thunderstorm => 97 + _rng.Next(0, 3),
                _                        => 75
            };

            // --- Wind speed ---
            double baseWind = zone.IsCoastal ? 18.0 : 10.0;
            WindSpeed = type switch
            {
                WeatherType.Clear        => baseWind + _rng.Next(0, 8),
                WeatherType.Mist         => 2 + _rng.Next(0, 4),       // Calm for mist to form
                WeatherType.Fog          => 1 + _rng.Next(0, 3),
                WeatherType.LightRain    => baseWind + _rng.Next(5, 15),
                WeatherType.HeavyRain    => baseWind + _rng.Next(15, 30),
                WeatherType.Thunderstorm => 45 + _rng.Next(10, 35),     // Gusty squalls
                _                        => baseWind
            };
        }
    }
}
