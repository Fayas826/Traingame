using System;
using System.Collections.Generic;

namespace RailwaySimulator.Backend.Models
{
    public class LocoProfile
    {
        public string Id { get; set; } = "";
        public string Name { get; set; } = "";
        public string Type { get; set; } = "";
        public double Mass { get; set; } // tons
        public double MaxSpeed { get; set; } // unit speed
        public double ThrottlePower { get; set; }
        public double BrakeFactor { get; set; }
        public double DragA { get; set; }
        public double DragB { get; set; }
        public double DragC { get; set; }
    }

    public class RakeProfile
    {
        public string Id { get; set; } = "";
        public string Name { get; set; } = "";
        public string Style { get; set; } = "";
        public int CoachCount { get; set; }
        public double MassPerCoach { get; set; }
        public double DragMultiplier { get; set; }
    }

    public class SimulationInitRequest
    {
        public string LocoId { get; set; } = "WAP-7";
        public string RakeId { get; set; } = "LHB";
        public string TrainType { get; set; } = "Passenger";
    }

    public class SimulationUpdateRequest
    {
        public double DeltaTimeMs { get; set; }
        public int ThrottleNotch { get; set; }
        public int BrakeNotch { get; set; }
        public bool EmergencyBrake { get; set; }
        public double TractionModifier { get; set; }
        public string GameState { get; set; } = "RUNNING";
        public bool IsWaitingForStarter { get; set; }
        public double TargetStationKm { get; set; } = -1;
    }

    public class SimulationStateResponse
    {
        public double Speed { get; set; }
        public int DisplaySpeed { get; set; }
        public double WorldDistance { get; set; }
        public double WheelRotation { get; set; }
        public double BgX { get; set; }
        public string NotchLabel { get; set; } = "N 0";
        public double[] CoachOffsets { get; set; } = Array.Empty<double>();
        public bool IsEmergencyActive { get; set; }
        public string SignalCallout { get; set; } = "";
        public string SpeedLimitWarning { get; set; } = "";
    }
}
