using System;
using System.Collections.Concurrent;
using Microsoft.AspNetCore.Mvc;
using RailwaySimulator.Backend.Models;
using RailwaySimulator.Backend.Core;

namespace RailwaySimulator.Backend.Controllers
{
    [ApiController]
    [Route("api/physics")]
    public class PhysicsController : ControllerBase
    {
        private static readonly ConcurrentDictionary<string, PhysicsEngine> ActiveSessions = new();
        private const string DEFAULT_SESSION = "global_session";

        [HttpPost("init")]
        public IActionResult Initialize([FromBody] SimulationInitRequest request, [FromHeader(Name = "X-Session-ID")] string? sessionId)
        {
            var id = sessionId ?? DEFAULT_SESSION;
            var engine = new PhysicsEngine(request.LocoId, request.RakeId)
            {
                TrainType = request.TrainType
            };
            ActiveSessions[id] = engine;

            return Ok(new { status = "initialized", sessionId = id, loco = engine.Loco.Name, rake = engine.Rake.Name });
        }

        [HttpPost("update")]
        public IActionResult Update([FromBody] SimulationUpdateRequest request, [FromHeader(Name = "X-Session-ID")] string? sessionId)
        {
            var id = sessionId ?? DEFAULT_SESSION;
            if (!ActiveSessions.TryGetValue(id, out var engine))
            {
                // Auto-init fallback
                engine = new PhysicsEngine("WAP-7", "LHB");
                ActiveSessions[id] = engine;
            }

            // Sync emergency state from request
            if (request.EmergencyBrake && !engine.IsEmergencyActive)
            {
                engine.IsEmergencyActive = true;
            }

            // Standard tick
            engine.Update(request.DeltaTimeMs, request.ThrottleNotch, request.BrakeNotch, request.EmergencyBrake, request.TractionModifier);

            // Process route safety limits (Timetable stop, station boards, approach signal compliance)
            var response = engine.GetStateResponse();

            // Dynamic Timetable Station Stoppage check
            if (request.GameState == "APPROACHING" && request.TargetStationKm >= 0)
            {
                double targetWorldDist = request.TargetStationKm * 3000.0;
                double distToTarget = targetWorldDist - engine.WorldDistance;
                engine.ApplyAutoStop(distToTarget, request.DeltaTimeMs);
                response.Speed = engine.Speed;
                response.DisplaySpeed = (int)Math.Round(engine.Speed * 10.0);
            }

            // Sync engine-level safety states to response
            response.IsEmergencyActive = engine.IsEmergencyActive;
            response.SpeedLimitWarning = engine.SpeedLimitWarning;

            // Update safety warning when approaching red signal
            if (request.IsWaitingForStarter && request.GameState == "STOPPED")
            {
                response.SignalCallout = "🔴 Starter Signal Red. Wait for 7 seconds timer.";
            }
            else if (request.GameState == "BOARDING")
            {
                response.SignalCallout = "🚪 Passenger Boarding in progress. Doors open.";
            }
            else
            {
                response.SignalCallout = "🟢 Line Clear. Drive safely.";
            }

            return Ok(response);
        }
    }
}
