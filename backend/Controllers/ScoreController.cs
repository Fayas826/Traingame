using Microsoft.AspNetCore.Mvc;
using RailwaySimulator.Backend.Core;

namespace RailwaySimulator.Backend.Controllers
{
    /// <summary>
    /// REST API for the ScoreEngine — records driving events
    /// and returns ALP performance scores and grades.
    /// </summary>
    [ApiController]
    [Route("api/score")]
    public class ScoreController : ControllerBase
    {
        private readonly ScoreEngine _score = ScoreEngine.Instance;

        /// <summary>GET /api/score/summary — Full score summary</summary>
        [HttpGet("summary")]
        public IActionResult GetSummary()
        {
            return Ok(_score.GetScoreSummary());
        }

        /// <summary>GET /api/score/grade — Current ALP grade</summary>
        [HttpGet("grade")]
        public IActionResult GetGrade()
        {
            return Ok(new
            {
                grade      = _score.GetCurrentGrade(),
                totalScore = _score.TotalScore,
                violations = _score.ViolationCount,
            });
        }

        /// <summary>GET /api/score/violations — List all recorded violations</summary>
        [HttpGet("violations")]
        public IActionResult GetViolations()
        {
            return Ok(_score.GetViolations());
        }

        /// <summary>
        /// POST /api/score/violation
        /// Body: { "type": "SpeedExcess", "km": 25.5, "severity": 2 }
        /// </summary>
        [HttpPost("violation")]
        public IActionResult RecordViolation([FromBody] ViolationRequest req)
        {
            if (!Enum.TryParse<ViolationType>(req.Type, true, out var vtype))
                return BadRequest(new { error = $"Unknown violation type: {req.Type}" });
            _score.RecordViolation(vtype, req.Km, req.Severity);
            return Ok(new { recorded = true, type = req.Type, penalty = _score.TotalScore });
        }

        /// <summary>
        /// POST /api/score/station-arrival
        /// Body: { "stationCode": "QLN", "arrivalMin": 5.2, "scheduledMin": 5.0, "overshootM": 2.3 }
        /// </summary>
        [HttpPost("station-arrival")]
        public IActionResult RecordStationArrival([FromBody] StationArrivalRequest req)
        {
            _score.RecordStationArrival(req.StationCode, req.ArrivalMin, req.ScheduledMin, req.OvershootM);
            return Ok(new { recorded = true, totalScore = _score.TotalScore });
        }

        /// <summary>
        /// POST /api/score/wl-board
        /// Body: { "honked": true, "km": 14.2 }
        /// </summary>
        [HttpPost("wl-board")]
        public IActionResult RecordWLBoard([FromBody] WLBoardRequest req)
        {
            _score.RecordWLBoard(req.Honked, req.Km);
            return Ok(new { recorded = true, totalScore = _score.TotalScore });
        }

        /// <summary>
        /// POST /api/score/emergency-brake
        /// Body: { "km": 22.1, "speedKmh": 95.0 }
        /// </summary>
        [HttpPost("emergency-brake")]
        public IActionResult RecordEmergencyBrake([FromBody] EmergencyBrakeRequest req)
        {
            _score.RecordEmergencyBrake(req.Km, req.SpeedKmh);
            return Ok(new { recorded = true, totalScore = _score.TotalScore });
        }

        /// <summary>POST /api/score/reset — Reset all scores and violations</summary>
        [HttpPost("reset")]
        public IActionResult Reset()
        {
            _score.Reset();
            return Ok(new { reset = true, totalScore = _score.TotalScore, grade = _score.GetCurrentGrade() });
        }
    }

    // ── Request DTOs ──
    public class ViolationRequest
    {
        public string Type     { get; set; } = "";
        public double Km       { get; set; }
        public double Severity { get; set; } = 1;
    }

    public class StationArrivalRequest
    {
        public string StationCode  { get; set; } = "";
        public double ArrivalMin   { get; set; }
        public double ScheduledMin { get; set; }
        public double OvershootM   { get; set; }
    }

    public class WLBoardRequest
    {
        public bool   Honked { get; set; }
        public double Km     { get; set; }
    }

    public class EmergencyBrakeRequest
    {
        public double Km       { get; set; }
        public double SpeedKmh { get; set; }
    }
}
