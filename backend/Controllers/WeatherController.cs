using System;
using Microsoft.AspNetCore.Mvc;
using RailwaySimulator.Backend.Core;

namespace RailwaySimulator.Backend.Controllers
{
    // ---------------------------------------------------------------------------
    // WeatherController
    // ---------------------------------------------------------------------------

    /// <summary>
    /// ASP.NET Core API controller exposing the <see cref="WeatherEngine"/> to the
    /// JavaScript frontend (Vite / Three.js game loop).
    ///
    /// <para>
    /// <b>Design notes:</b>
    /// <list type="bullet">
    ///   <item>The WeatherEngine is a process-wide singleton; all endpoints share state.</item>
    ///   <item>
    ///     <c>timeOfDay</c> is a fractional day value: 0.0 = midnight, 0.25 = 06:00,
    ///     0.5 = noon, 0.75 = 18:00. Pass the game's simulated clock.
    ///   </item>
    ///   <item>
    ///     Physics endpoints (adhesion, braking-factor) are designed to be called
    ///     per-tick and return lightweight scalar responses for performance.
    ///   </item>
    /// </list>
    /// </para>
    /// </summary>
    [ApiController]
    [Route("api/weather")]
    public class WeatherController : ControllerBase
    {
        private readonly WeatherEngine _engine = WeatherEngine.Instance;

        // -----------------------------------------------------------------------
        // GET /api/weather/state?km=25.5&timeOfDay=0.5
        // -----------------------------------------------------------------------

        /// <summary>
        /// Returns the full weather state after advancing the simulation for the
        /// given position and time of day.
        ///
        /// <para>
        /// Call this at a low rate (e.g. every 10 real-world seconds) to allow the
        /// weather engine's internal transition timer to advance meaningfully.
        /// </para>
        /// </summary>
        /// <param name="km">Train position in km from Kollam Junction.</param>
        /// <param name="timeOfDay">
        /// Fractional day (0.0–1.0): 0.0 = midnight, 0.25 = 06:00, 0.5 = noon.
        /// </param>
        [HttpGet("state")]
        public IActionResult GetState([FromQuery] double km, [FromQuery] double timeOfDay = 0.5)
        {
            if (km < 0)
                return BadRequest(new { error = "km must be ≥ 0." });
            if (timeOfDay < 0 || timeOfDay > 1.0)
                return BadRequest(new { error = "timeOfDay must be between 0.0 and 1.0." });

            // Advance simulation
            _engine.Update(km, timeOfDay);

            var zone = _engine.GetWeatherZoneAt(km);

            return Ok(new
            {
                km,
                timeOfDay,
                // Qualitative state
                weatherType              = _engine.CurrentWeather.ToString(),
                weatherCode              = (int)_engine.CurrentWeather,
                zone                     = new
                {
                    name        = zone.Name,
                    startKm     = zone.StartKm,
                    endKm       = zone.EndKm,
                    isCoastal   = zone.IsCoastal,
                    isBackwater = zone.IsBackwater
                },
                // Atmospheric measurements
                rainfallIntensity        = Math.Round(_engine.RainfallIntensity, 3),
                visibilityMetres         = Math.Round(_engine.Visibility, 1),
                windSpeedKmh             = Math.Round(_engine.WindSpeed, 1),
                humidityPercent          = _engine.Humidity,
                temperatureCelsius       = Math.Round(_engine.Temperature, 1),
                // Physics integration values
                adhesionCoefficient      = Math.Round(_engine.AdhesionCoefficient, 3),
                adhesionAtPosition       = Math.Round(_engine.GetAdhesionAt(km), 3),
                brakingDistanceMultiplier = Math.Round(_engine.BrakingDistanceMultiplier, 2),
                wheelSlipRisk            = Math.Round(_engine.WheelSlipRisk, 3),
                // Derived advisory
                driverAdvisory           = BuildDriverAdvisory(_engine, km)
            });
        }

        // -----------------------------------------------------------------------
        // GET /api/weather/adhesion?km=25.5
        // -----------------------------------------------------------------------

        /// <summary>
        /// Returns the wheel–rail adhesion coefficient (μ) at the given position.
        /// Integrate this value into the PhysicsEngine's tractive effort calculation:
        /// <c>maxTractiveForce = μ × normalLoad</c>
        /// </summary>
        [HttpGet("adhesion")]
        public IActionResult GetAdhesion([FromQuery] double km)
        {
            if (km < 0)
                return BadRequest(new { error = "km must be ≥ 0." });

            double mu   = _engine.GetAdhesionAt(km);
            var zone    = _engine.GetWeatherZoneAt(km);

            return Ok(new
            {
                km,
                adhesionCoefficient = Math.Round(mu, 3),
                weatherType         = _engine.CurrentWeather.ToString(),
                zone                = zone.Name,
                // Thresholds for traction control
                slipThreshold       = Math.Round(mu * 0.85, 3),   // 85% of μ → wheelslip warning
                gripRating          = ClassifyGrip(mu)
            });
        }

        // -----------------------------------------------------------------------
        // GET /api/weather/visibility?km=25.5
        // -----------------------------------------------------------------------

        /// <summary>
        /// Returns the visibility in metres at the given position.
        /// The frontend uses this to set the Three.js fog near/far planes and to
        /// determine the signal sighting distance.
        /// </summary>
        [HttpGet("visibility")]
        public IActionResult GetVisibility([FromQuery] double km)
        {
            if (km < 0)
                return BadRequest(new { error = "km must be ≥ 0." });

            double vis  = _engine.GetVisibilityAt(km);
            var zone    = _engine.GetWeatherZoneAt(km);

            return Ok(new
            {
                km,
                visibilityMetres    = Math.Round(vis, 1),
                weatherType         = _engine.CurrentWeather.ToString(),
                zone                = zone.Name,
                // Derived signal sighting parameters
                signalSightingDist  = Math.Round(Math.Min(vis * 0.7, 1200.0), 1),  // max 1200 m on IR
                speedRestriction    = VisibilitySpeedLimit(vis),
                fogWarning          = vis < 200 ? "🌫️ Dense fog — Reduced Speed mandatory. Fog signals in use." : null
            });
        }

        // -----------------------------------------------------------------------
        // GET /api/weather/braking-factor?km=25.5
        // -----------------------------------------------------------------------

        /// <summary>
        /// Returns the braking distance multiplier for the current weather conditions
        /// at the given position. Multiply the nominal braking distance by this value
        /// to get the weather-adjusted stopping distance.
        ///
        /// <para>Example: nominal 800 m stop × 1.8 (heavy rain) = 1440 m required.</para>
        /// </summary>
        [HttpGet("braking-factor")]
        public IActionResult GetBrakingFactor([FromQuery] double km)
        {
            if (km < 0)
                return BadRequest(new { error = "km must be ≥ 0." });

            double factor   = _engine.BrakingDistanceMultiplier;
            double slipRisk = _engine.WheelSlipRisk;

            return Ok(new
            {
                km,
                brakingDistanceMultiplier = Math.Round(factor, 2),
                wheelSlipRisk             = Math.Round(slipRisk, 3),
                weatherType               = _engine.CurrentWeather.ToString(),
                // Advisory for driver HUD
                brakingAdvisory           = BrakingAdvisory(factor, slipRisk),
                // Example stopping distances from 110 km/h (WAP-7 nominal ≈ 1100 m)
                estimatedStopDistM        = Math.Round(1100.0 * factor, 0)
            });
        }

        // -----------------------------------------------------------------------
        // Helper methods
        // -----------------------------------------------------------------------

        /// <summary>Produces a human-readable grip rating string for HUD display.</summary>
        private static string ClassifyGrip(double mu) => mu switch
        {
            >= 0.28 => "Good",
            >= 0.22 => "Moderate",
            >= 0.15 => "Poor",
            _       => "Very Poor – Traction Control Active"
        };

        /// <summary>Returns the mandatory speed limit (km/h) based on visibility.</summary>
        private static double VisibilitySpeedLimit(double visMetres) => visMetres switch
        {
            >= 800  => 110.0,  // Normal line speed
            >= 400  => 75.0,   // Caution – reduced visibility
            >= 200  => 50.0,   // Restricted – mist / light fog
            >= 100  => 30.0,   // Very restricted – dense fog
            _       => 15.0    // Creep speed – extreme fog
        };

        /// <summary>Generates a braking advisory message for the driver's HUD.</summary>
        private static string BrakingAdvisory(double factor, double slipRisk)
        {
            if (factor >= 1.8)
                return "🌧️ Heavy rain — stopping distance severely increased. Begin braking early.";
            if (factor >= 1.4)
                return "🌦️ Wet rails — stopping distance increased. Apply brakes progressively.";
            if (slipRisk > 0.5)
                return "⚠️ High wheel-slip risk — avoid rapid throttle application.";
            if (factor > 1.1)
                return "🌫️ Damp rails — slightly increased stopping distance.";
            return "✅ Dry rails — normal braking performance.";
        }

        /// <summary>
        /// Builds a consolidated driver advisory string covering visibility,
        /// adhesion, and weather hazards for the given position.
        /// </summary>
        private static string BuildDriverAdvisory(WeatherEngine eng, double km)
        {
            double vis      = eng.GetVisibilityAt(km);
            double mu       = eng.GetAdhesionAt(km);
            var weather     = eng.CurrentWeather;

            return weather switch
            {
                WeatherType.Thunderstorm =>
                    "🌩️ THUNDERSTORM ACTIVE — Reduce speed, watch for debris and signal sighting issues.",

                WeatherType.HeavyRain =>
                    $"🌧️ Heavy monsoon rain — Adhesion μ={mu:F2}, braking distance ×{eng.BrakingDistanceMultiplier:F1}. " +
                    "Limit speed, brake early.",

                WeatherType.Fog when vis < 150 =>
                    $"🌁 Dense fog — Visibility {vis:F0} m. Creep speed mandatory. " +
                    "Detonators and fog signals in use.",

                WeatherType.Mist =>
                    $"🌫️ Mist — Visibility {vis:F0} m. Speed restricted to {VisibilitySpeedLimit(vis)} km/h.",

                WeatherType.LightRain =>
                    $"🌦️ Light rain — Adhesion μ={mu:F2}. Moderate braking increase. Drive normally.",

                WeatherType.Clear =>
                    "☀️ Clear — Optimal adhesion and visibility. Proceed at line speed.",

                _ => "Weather data nominal."
            };
        }
    }
}
