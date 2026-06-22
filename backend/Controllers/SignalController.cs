using System;
using System.Collections.Generic;
using Microsoft.AspNetCore.Mvc;
using RailwaySimulator.Backend.Core;

namespace RailwaySimulator.Backend.Controllers
{
    // ---------------------------------------------------------------------------
    // Request / response DTOs
    // ---------------------------------------------------------------------------

    /// <summary>Request body for activating a station starter signal.</summary>
    public class ActivateStarterRequest
    {
        /// <summary>IR station code, e.g. "QLN", "VAK", "TVC".</summary>
        public string StationCode { get; set; } = "";
    }

    // ---------------------------------------------------------------------------
    // SignalController
    // ---------------------------------------------------------------------------

    /// <summary>
    /// ASP.NET Core API controller exposing the <see cref="SignalEngine"/> to the
    /// JavaScript frontend (Vite / Three.js game loop).
    ///
    /// <para>All positional parameters use kilometres from Kollam Junction (origin 0.0).</para>
    /// </summary>
    [ApiController]
    [Route("api/signal")]
    public class SignalController : ControllerBase
    {
        private readonly SignalEngine _engine = SignalEngine.Instance;

        // -----------------------------------------------------------------------
        // GET /api/signal/state?km=25.5
        // -----------------------------------------------------------------------

        /// <summary>
        /// Returns the signal state (aspect, name, position) at or immediately ahead
        /// of the given kilometre position.
        /// </summary>
        /// <param name="km">Train front position in km from Kollam Junction.</param>
        /// <param name="speedKmh">Current train speed in km/h.</param>
        [HttpGet("state")]
        public IActionResult GetState([FromQuery] double km, [FromQuery] double speedKmh = 0)
        {
            if (km < 0)
                return BadRequest(new { error = "km must be ≥ 0." });

            _engine.Update(km, speedKmh);

            var next = _engine.GetNextSignal(km);
            if (next == null)
                return Ok(new
                {
                    km,
                    aspect        = "Clear",
                    aspectCode    = (int)SignalAspect.Clear,
                    message       = "No signals ahead. Approaching terminus."
                });

            return Ok(new
            {
                km,
                signalId      = next.Id,
                signalName    = next.Name,
                positionKm    = next.PositionKm,
                distanceKm    = Math.Round(next.PositionKm - km, 3),
                aspect        = next.Aspect.ToString(),
                aspectCode    = (int)next.Aspect,
                isHome        = next.IsHome,
                isStarter     = next.IsStarter,
                isAutomatic   = next.IsAutomatic,
                isRouteLocked = next.IsRouteLocked,
                lastChangedAt = next.LastChangedAt.ToString("o")
            });
        }

        // -----------------------------------------------------------------------
        // GET /api/signal/next?km=25.5
        // -----------------------------------------------------------------------

        /// <summary>
        /// Returns the full <see cref="Signal"/> object for the next signal ahead.
        /// </summary>
        [HttpGet("next")]
        public IActionResult GetNext([FromQuery] double km)
        {
            if (km < 0)
                return BadRequest(new { error = "km must be ≥ 0." });

            var sig = _engine.GetNextSignal(km);
            if (sig == null)
                return Ok(new { km, signal = (object?)null, message = "No signals ahead." });

            return Ok(new
            {
                km,
                signal = new
                {
                    id            = sig.Id,
                    name          = sig.Name,
                    positionKm    = sig.PositionKm,
                    distanceKm    = Math.Round(sig.PositionKm - km, 3),
                    aspect        = sig.Aspect.ToString(),
                    aspectCode    = (int)sig.Aspect,
                    isHome        = sig.IsHome,
                    isStarter     = sig.IsStarter,
                    isAutomatic   = sig.IsAutomatic,
                    isRouteLocked = sig.IsRouteLocked,
                    lastChangedAt = sig.LastChangedAt.ToString("o")
                }
            });
        }

        // -----------------------------------------------------------------------
        // GET /api/signal/range?startKm=20&endKm=30
        // -----------------------------------------------------------------------

        /// <summary>
        /// Returns all signals whose position falls within [startKm, endKm].
        /// Useful for the driver's desk display and minimap rendering.
        /// </summary>
        [HttpGet("range")]
        public IActionResult GetRange([FromQuery] double startKm, [FromQuery] double endKm)
        {
            if (startKm < 0 || endKm < startKm)
                return BadRequest(new { error = "Requires 0 ≤ startKm ≤ endKm." });

            var signals = _engine.GetSignalsInRange(startKm, endKm);

            var result = new List<object>();
            foreach (var sig in signals)
            {
                result.Add(new
                {
                    id            = sig.Id,
                    name          = sig.Name,
                    positionKm    = sig.PositionKm,
                    aspect        = sig.Aspect.ToString(),
                    aspectCode    = (int)sig.Aspect,
                    isHome        = sig.IsHome,
                    isStarter     = sig.IsStarter,
                    isAutomatic   = sig.IsAutomatic,
                    isRouteLocked = sig.IsRouteLocked,
                    lastChangedAt = sig.LastChangedAt.ToString("o")
                });
            }

            return Ok(new
            {
                startKm,
                endKm,
                count   = result.Count,
                signals = result
            });
        }

        // -----------------------------------------------------------------------
        // GET /api/signal/callout?km=25.5&speedKmh=110
        // -----------------------------------------------------------------------

        /// <summary>
        /// Returns the ALP (Assistant Loco Pilot) verbal callout text for the current
        /// signal situation. Feed the returned string into the frontend TTS system.
        /// </summary>
        [HttpGet("callout")]
        public IActionResult GetCallout([FromQuery] double km, [FromQuery] double speedKmh)
        {
            if (km < 0)
                return BadRequest(new { error = "km must be ≥ 0." });

            string callout      = _engine.GetCallout(km, speedKmh);
            var nextSig         = _engine.GetNextSignal(km);
            double maxSpeed     = _engine.GetRestrictiveSpeed(km);

            return Ok(new
            {
                km,
                speedKmh,
                callout,
                nextSignalId    = nextSig?.Id,
                nextAspect      = nextSig?.Aspect.ToString(),
                maxAllowedSpeed = maxSpeed
            });
        }

        // -----------------------------------------------------------------------
        // POST /api/signal/activate-starter
        // -----------------------------------------------------------------------

        /// <summary>
        /// Clears the starter signal for the specified station, granting line-clear
        /// and authorising the driver to depart.
        ///
        /// <para>Called by the game logic after the mandatory dwell timer expires.</para>
        /// </summary>
        [HttpPost("activate-starter")]
        public IActionResult ActivateStarter([FromBody] ActivateStarterRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.StationCode))
                return BadRequest(new { error = "stationCode is required." });

            bool success = _engine.ActivateStarter(request.StationCode);
            if (!success)
            {
                return NotFound(new
                {
                    error       = $"No starter signal found for station code '{request.StationCode}'.",
                    stationCode = request.StationCode
                });
            }

            return Ok(new
            {
                status      = "cleared",
                stationCode = request.StationCode.ToUpperInvariant(),
                message     = $"Starter signal for {request.StationCode.ToUpperInvariant()} cleared. Line clear granted.",
                timestamp   = DateTime.UtcNow.ToString("o")
            });
        }

        // -----------------------------------------------------------------------
        // GET /api/signal/restrictive-speed?km=25.5
        // -----------------------------------------------------------------------

        /// <summary>
        /// Returns the maximum permissible speed (km/h) at the given position based on
        /// the next signal aspect. Used by the physics engine's governor and the HUD.
        /// </summary>
        [HttpGet("restrictive-speed")]
        public IActionResult GetRestrictiveSpeed([FromQuery] double km)
        {
            if (km < 0)
                return BadRequest(new { error = "km must be ≥ 0." });

            double maxSpeed = _engine.GetRestrictiveSpeed(km);
            var nextSig     = _engine.GetNextSignal(km);

            return Ok(new
            {
                km,
                maxSpeedKmh     = maxSpeed,
                limitingSignalId = nextSig?.Id,
                limitingAspect   = nextSig?.Aspect.ToString(),
                distanceToSignal = nextSig != null
                    ? Math.Round(nextSig.PositionKm - km, 3)
                    : (double?)null
            });
        }

        // -----------------------------------------------------------------------
        // GET /api/signal/violations  (bonus: SPAD log)
        // -----------------------------------------------------------------------

        /// <summary>
        /// Returns a log of all Signal-Passed-at-Danger (SPAD) violations recorded
        /// in the current session. Useful for post-run analysis and scoring.
        /// </summary>
        [HttpGet("violations")]
        public IActionResult GetViolations()
        {
            return Ok(new
            {
                count      = _engine.Violations.Count,
                violations = _engine.Violations
            });
        }

        // -----------------------------------------------------------------------
        // POST /api/signal/update  (for game-loop driven state pushes)
        // -----------------------------------------------------------------------

        /// <summary>
        /// Drives the SignalEngine update from the game's physics tick.
        /// Call this on every tick alongside the physics /update endpoint.
        /// </summary>
        [HttpPost("update")]
        public IActionResult UpdateSignals([FromQuery] double km, [FromQuery] double speedKmh)
        {
            if (km < 0)
                return BadRequest(new { error = "km must be ≥ 0." });

            _engine.Update(km, speedKmh);

            var nextSig     = _engine.GetNextSignal(km);
            double maxSpeed = _engine.GetRestrictiveSpeed(km);
            string callout  = _engine.GetCallout(km, speedKmh);

            return Ok(new
            {
                km,
                speedKmh,
                nextSignalId    = nextSig?.Id,
                nextAspect      = nextSig?.Aspect.ToString(),
                aspectCode      = nextSig != null ? (int)nextSig.Aspect : (int)SignalAspect.Clear,
                maxAllowedSpeed = maxSpeed,
                callout,
                spadCount       = _engine.Violations.Count
            });
        }
    }
}
