using Microsoft.AspNetCore.Mvc;
using RailwaySimulator.Backend.Route;

namespace RailwaySimulator.Backend.Controllers
{
    /// <summary>
    /// REST API for the RouteEngine — exposes Kollam-TVC route data,
    /// speed limits, gradients, bridge zones, and lookahead info.
    /// </summary>
    [ApiController]
    [Route("api/route")]
    public class RouteController : ControllerBase
    {
        private readonly RouteEngine _route = RouteEngine.Instance;

        /// <summary>GET /api/route/stations — All stations on the route</summary>
        [HttpGet("stations")]
        public IActionResult GetStations()
        {
            return Ok(_route.GetAllStations());
        }

        /// <summary>GET /api/route/speed-limit?km=25.5 — MPS at given km</summary>
        [HttpGet("speed-limit")]
        public IActionResult GetSpeedLimit([FromQuery] double km)
        {
            return Ok(new { km, speedLimitKmh = _route.GetSpeedLimitAt(km) });
        }

        /// <summary>GET /api/route/gradient?km=25.5 — Gradient info at km</summary>
        [HttpGet("gradient")]
        public IActionResult GetGradient([FromQuery] double km)
        {
            return Ok(_route.GetGradientAt(km));
        }

        /// <summary>GET /api/route/profile — Full route summary</summary>
        [HttpGet("profile")]
        public IActionResult GetProfile()
        {
            return Ok(_route.GetRouteProfile());
        }

        /// <summary>GET /api/route/bridge-zones — All bridge zones</summary>
        [HttpGet("bridge-zones")]
        public IActionResult GetBridgeZones()
        {
            return Ok(_route.GetBridgesInRange(0, 65));
        }

        /// <summary>
        /// GET /api/route/ahead?km=25.5&amp;lookAheadKm=5
        /// Everything in the next N km: stations, bridges, speed changes, gradients
        /// </summary>
        [HttpGet("ahead")]
        public IActionResult GetAhead([FromQuery] double km, [FromQuery] double lookAheadKm = 5)
        {
            var endKm = km + lookAheadKm;
            var gradient = _route.GetGradientAt(km);
            var curve    = _route.GetCurveAt(km);
            var speedLimit = _route.GetSpeedLimitAt(km);
            var nextStation = _route.GetNextStation(km);
            var bridges  = _route.GetBridgesInRange(km, endKm);

            // Collect stations in range
            var stationsAhead = _route.GetAllStations()
                .Where(s => s.Km >= km && s.Km <= endKm)
                .ToList();

            return Ok(new
            {
                currentKm         = km,
                lookAheadKm,
                currentSpeedLimit = speedLimit,
                gradient,
                curve,
                nextStation,
                stations          = stationsAhead,
                bridges,
                isInBridgeZone    = _route.IsInBridgeZone(km),
                isInStationLimits = _route.IsInStationLimits(km),
            });
        }
    }
}
