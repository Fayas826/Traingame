using Microsoft.AspNetCore.Mvc;
using RailwaySimulator.Backend.Core;

namespace RailwaySimulator.Backend.Controllers
{
    /// <summary>
    /// REST API for the AIScheduler — exposes timetable, active trains,
    /// meet/cross predictions, and spawn recommendations.
    /// </summary>
    [ApiController]
    [Route("api/scheduler")]
    public class AISchedulerController : ControllerBase
    {
        private readonly AIScheduler _scheduler = AIScheduler.Instance;

        /// <summary>
        /// GET /api/scheduler/active?playerKm=25.5&amp;gameTimeMin=45
        /// Returns all AI trains currently active on the corridor
        /// </summary>
        [HttpGet("active")]
        public IActionResult GetActiveTrains(
            [FromQuery] double playerKm     = 0,
            [FromQuery] double gameTimeMin  = 0)
        {
            var trains = _scheduler.GetActiveTrains(playerKm, gameTimeMin);
            return Ok(new { count = trains.Count, trains });
        }

        /// <summary>
        /// GET /api/scheduler/next-meet?playerKm=25.5&amp;playerSpeedKmh=110&amp;gameTimeMin=45
        /// Returns the next predicted meet/crossing point
        /// </summary>
        [HttpGet("next-meet")]
        public IActionResult GetNextMeet(
            [FromQuery] double playerKm        = 0,
            [FromQuery] double playerSpeedKmh  = 0,
            [FromQuery] double gameTimeMin     = 0)
        {
            var meet = _scheduler.GetNextMeet(playerKm, playerSpeedKmh, gameTimeMin);
            if (meet == null)
                return Ok(new { hasMeet = false });
            return Ok(new { hasMeet = true, meet });
        }

        /// <summary>
        /// GET /api/scheduler/spawn?playerKm=25.5&amp;playerSpeedKmh=110
        /// Returns a spawn recommendation for the AI train manager
        /// </summary>
        [HttpGet("spawn")]
        public IActionResult GetSpawnRecommendation(
            [FromQuery] double playerKm       = 0,
            [FromQuery] double playerSpeedKmh = 0)
        {
            var rec = _scheduler.GetSpawnRecommendation(playerKm, playerSpeedKmh);
            if (rec == null)
                return Ok(new { shouldSpawn = false });
            return Ok(new { shouldSpawn = true, recommendation = rec });
        }

        /// <summary>
        /// GET /api/scheduler/traffic?km=25.5
        /// Returns number of active trains in the section around km
        /// </summary>
        [HttpGet("traffic")]
        public IActionResult GetTrafficDensity([FromQuery] double km = 0)
        {
            var density = _scheduler.GetTrafficDensity(km);
            return Ok(new { km, trafficDensity = density });
        }
    }
}
